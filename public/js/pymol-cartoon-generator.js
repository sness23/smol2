/**
 * PyMOL-Style Cartoon Generator
 * Main pipeline for generating cartoon representations
 */

// Dependencies loaded via script tags

/**
 * Main cartoon generation pipeline
 */
class CartoonGenerator {
    constructor(scene) {
        this.scene = scene;
        this.extrudes = [];
        this.meshes = [];

        // Cartoon settings (PyMOL defaults)
        this.settings = {
            sampling: 20,           // Points per residue segment
            helix_radius: 1.8,      // Helix tube radius
            sheet_width: 2.5,       // Sheet width
            sheet_length: 0.3,      // Sheet thickness
            loop_radius: 0.8,       // Loop/coil radius
            smooth_power: 2.0,      // Smoothing power
            arrow_scale: 1.5,       // Arrow scaling for sheet ends
            putty_scale: 2.0        // Putty B-factor scaling
        };
    }

    /**
     * Generate cartoon representation for a protein chain
     */
    generateCartoon(parser, chainId, options = {}) {
        const chain = parser.chains.find(c => c.id === chainId);
        if (!chain || !chain.residues || chain.residues.length < 2) {
            console.warn(`Chain ${chainId} not found or too short`);
            return [];
        }

        // Merge options with defaults
        const settings = { ...this.settings, ...options };

        console.log(`Generating PyMOL-style cartoon for chain ${chainId} with ${chain.residues.length} residues`);

        // Extract backbone coordinates
        const backbonePoints = this.extractBackboneCoordinates(chain);
        console.log(`Extracted ${backbonePoints.length} backbone points for chain ${chainId}`);

        if (backbonePoints.length < 2) {
            console.warn(`Insufficient backbone points for chain ${chainId}: found ${backbonePoints.length}, need at least 2`);

            // Debug: Check what residues we have
            console.log('Available residues:', chain.residues.map(r => ({
                name: r.resName,
                seq: r.resSeq,
                hasCA: !!r.ca,
                isProtein: r.isProtein
            })));

            return [];
        }

        // Detect secondary structure and assign cartoon types
        const cartoonSegments = this.detectSecondaryStructure(backbonePoints, chain);

        // Generate smooth interpolated curves
        const smoothCurves = this.generateSmoothCurves(cartoonSegments, settings);

        // Create extrusions for each segment
        const meshes = [];
        for (const curve of smoothCurves) {
            const extrude = this.createExtrusion(curve, settings);
            if (extrude) {
                const mesh = this.generateMesh(extrude, curve.cartoonType, curve.colors);
                if (mesh) {
                    meshes.push(mesh);
                    this.extrudes.push(extrude);
                }
            }
        }

        this.meshes.push(...meshes);
        console.log(`Generated ${meshes.length} cartoon segments for chain ${chainId}`);
        return meshes;
    }

    /**
     * Extract backbone coordinates from residues
     */
    extractBackboneCoordinates(chain) {
        const points = [];

        for (const residue of chain.residues) {
            // Use CA (alpha carbon) for backbone
            // The PDB parser stores CA directly as residue.ca
            const ca = residue.ca;
            if (ca) {
                points.push({
                    x: ca.x,
                    y: ca.y,
                    z: ca.z,
                    residue: residue,
                    atomName: 'CA'
                });
            }
        }

        return points;
    }

    /**
     * Detect secondary structure and assign cartoon types
     */
    detectSecondaryStructure(points, chain) {
        const segments = [];

        for (let i = 0; i < points.length - 1; i++) {
            const point1 = points[i];
            const point2 = points[i + 1];
            const residue = point1.residue;

            // Determine cartoon type based on secondary structure
            let cartoonType = CartoonType.AUTO;

            if (residue.secondaryStructure) {
                switch (residue.secondaryStructure.toLowerCase()) {
                    case 'helix':
                    case 'h':
                        cartoonType = CartoonType.HELIX;
                        break;
                    case 'sheet':
                    case 'strand':
                    case 'e':
                        cartoonType = CartoonType.SHEET;
                        break;
                    case 'loop':
                    case 'coil':
                    case 'turn':
                    case 'l':
                    case 't':
                    default:
                        cartoonType = CartoonType.LOOP;
                        break;
                }
            } else {
                // Auto-detect based on geometry if no annotation
                cartoonType = this.autoDetectSecondaryStructure(points, i);
            }

            segments.push({
                point1: point1,
                point2: point2,
                cartoonType: cartoonType,
                residue: residue,
                index: i
            });
        }

        return this.groupSegmentsByType(segments);
    }

    /**
     * Auto-detect secondary structure based on geometry
     */
    autoDetectSecondaryStructure(points, index) {
        // Simple geometric heuristics for secondary structure detection
        const windowSize = 4;
        const start = Math.max(0, index - windowSize);
        const end = Math.min(points.length, index + windowSize + 1);

        if (end - start < 3) return CartoonType.LOOP;

        const segmentPoints = points.slice(start, end);

        // Calculate local curvature and regularity
        let totalCurvature = 0;
        let regularityScore = 0;

        for (let i = 1; i < segmentPoints.length - 1; i++) {
            const p1 = segmentPoints[i - 1];
            const p2 = segmentPoints[i];
            const p3 = segmentPoints[i + 1];

            // Calculate angle between vectors
            const v1 = CartoonMath.normalize(CartoonMath.subtract(p2, p1));
            const v2 = CartoonMath.normalize(CartoonMath.subtract(p3, p2));
            const angle = Math.acos(Math.max(-1, Math.min(1, CartoonMath.dot(v1, v2))));

            totalCurvature += angle;

            // Check distance regularity
            const d1 = CartoonMath.distance(p1, p2);
            const d2 = CartoonMath.distance(p2, p3);
            regularityScore += Math.abs(d1 - d2);
        }

        const avgCurvature = totalCurvature / (segmentPoints.length - 2);
        const avgRegularity = regularityScore / (segmentPoints.length - 2);

        // Heuristic classification
        if (avgCurvature < 0.3 && avgRegularity < 1.0) {
            return CartoonType.HELIX; // Low curvature, regular = helix
        } else if (avgCurvature < 0.5 && avgRegularity < 2.0) {
            return CartoonType.SHEET; // Medium curvature, fairly regular = sheet
        } else {
            return CartoonType.LOOP; // High curvature or irregular = loop
        }
    }

    /**
     * Group consecutive segments of the same type
     */
    groupSegmentsByType(segments) {
        const groups = [];
        let currentGroup = null;

        for (const segment of segments) {
            if (!currentGroup || currentGroup.cartoonType !== segment.cartoonType) {
                // Start new group
                if (currentGroup) {
                    groups.push(currentGroup);
                }
                currentGroup = {
                    cartoonType: segment.cartoonType,
                    segments: [segment],
                    points: [segment.point1, segment.point2]
                };
            } else {
                // Add to current group
                currentGroup.segments.push(segment);
                currentGroup.points.push(segment.point2);
            }
        }

        if (currentGroup) {
            groups.push(currentGroup);
        }

        return groups;
    }

    /**
     * Generate smooth interpolated curves
     */
    generateSmoothCurves(segmentGroups, settings) {
        const curves = [];

        for (const group of segmentGroups) {
            const points = group.points;
            if (points.length < 2) continue;

            // Generate smooth curve through the points
            const smoothPoints = this.interpolateSmooth(points, settings.sampling);

            // Compute Frenet frames
            const frames = this.computeFrenetFrames(smoothPoints);

            // Generate colors
            const colors = this.generateColors(group.segments);

            curves.push({
                cartoonType: group.cartoonType,
                points: smoothPoints,
                frames: frames,
                colors: colors,
                segments: group.segments
            });
        }

        return curves;
    }

    /**
     * Interpolate smooth curves using splines
     */
    interpolateSmooth(points, sampling) {
        if (points.length < 2) return points;

        const smoothPoints = [];
        const totalSegments = (points.length - 1) * sampling;

        for (let i = 0; i < totalSegments; i++) {
            const t = i / (totalSegments - 1);
            const segmentIndex = Math.floor(t * (points.length - 1));
            const localT = (t * (points.length - 1)) - segmentIndex;

            let interpolatedPoint;

            if (points.length === 2) {
                // Linear interpolation for two points
                interpolatedPoint = CartoonInterpolation.linearInterpolate(
                    points[0], points[1], localT
                );
            } else {
                // Catmull-Rom spline for smooth curves
                const p0 = points[Math.max(0, segmentIndex - 1)];
                const p1 = points[segmentIndex];
                const p2 = points[Math.min(points.length - 1, segmentIndex + 1)];
                const p3 = points[Math.min(points.length - 1, segmentIndex + 2)];

                interpolatedPoint = CartoonInterpolation.catmullRom(p0, p1, p2, p3, localT);
            }

            // Apply smooth function for better curve quality
            const smoothT = CartoonInterpolation.smooth(localT, 2.0);
            smoothPoints.push(interpolatedPoint);
        }

        return smoothPoints;
    }

    /**
     * Compute Frenet frames for each point
     */
    computeFrenetFrames(points) {
        const frames = [];

        for (let i = 0; i < points.length; i++) {
            const frame = CartoonMath.computeFrenetFrame(points, i);
            frames.push(frame);
        }

        // Ensure frame consistency (minimize twisting)
        this.minimizeFrameTwisting(frames);

        return frames;
    }

    /**
     * Minimize frame twisting for smoother ribbons
     */
    minimizeFrameTwisting(frames) {
        if (frames.length < 2) return;

        // Ensure consistent orientation by checking dot products
        for (let i = 1; i < frames.length; i++) {
            const prevFrame = frames[i - 1];
            const currFrame = frames[i];

            // Check if normal flipped
            const normalDot = CartoonMath.dot(prevFrame.normal, currFrame.normal);
            if (normalDot < 0) {
                // Flip normal and binormal to maintain consistency
                currFrame.normal = CartoonMath.scale(currFrame.normal, -1);
                currFrame.binormal = CartoonMath.scale(currFrame.binormal, -1);
            }

            // Check if binormal flipped
            const binormalDot = CartoonMath.dot(prevFrame.binormal, currFrame.binormal);
            if (binormalDot < 0) {
                // Flip binormal only
                currFrame.binormal = CartoonMath.scale(currFrame.binormal, -1);
            }
        }
    }

    /**
     * Generate colors for the cartoon
     */
    generateColors(segments) {
        const colors = [];

        for (const segment of segments) {
            // Default color scheme - can be extended
            let color = [0.8, 0.8, 0.8]; // Default gray

            // Color by secondary structure
            switch (segment.cartoonType) {
                case CartoonType.HELIX:
                    color = [0.8, 0.2, 0.2]; // Red for helices
                    break;
                case CartoonType.SHEET:
                    color = [0.2, 0.2, 0.8]; // Blue for sheets
                    break;
                case CartoonType.LOOP:
                default:
                    color = [0.2, 0.8, 0.2]; // Green for loops
                    break;
            }

            colors.push(color);
        }

        return colors;
    }

    /**
     * Create extrusion object from curve data
     */
    createExtrusion(curve, settings) {
        const extrude = new CartoonExtrude();
        const n = curve.points.length;

        extrude.allocatePointsNormalsColors(n);

        // Copy points
        for (let i = 0; i < n; i++) {
            const point = curve.points[i];
            const idx = i * 3;
            extrude.points[idx] = point.x;
            extrude.points[idx + 1] = point.y;
            extrude.points[idx + 2] = point.z;
        }

        // Copy frames to normals
        for (let i = 0; i < n; i++) {
            const frame = curve.frames[i];
            const idx = i * 9; // 3x3 matrix per point

            // Store tangent, normal, binormal
            extrude.normals[idx] = frame.tangent.x;
            extrude.normals[idx + 1] = frame.tangent.y;
            extrude.normals[idx + 2] = frame.tangent.z;
            extrude.normals[idx + 3] = frame.normal.x;
            extrude.normals[idx + 4] = frame.normal.y;
            extrude.normals[idx + 5] = frame.normal.z;
            extrude.normals[idx + 6] = frame.binormal.x;
            extrude.normals[idx + 7] = frame.binormal.y;
            extrude.normals[idx + 8] = frame.binormal.z;
        }

        // Set colors
        const colorIndex = Math.floor(curve.colors.length / 2);
        const color = curve.colors[colorIndex] || [0.8, 0.8, 0.8];
        for (let i = 0; i < n; i++) {
            const idx = i * 3;
            extrude.colors[idx] = color[0];
            extrude.colors[idx + 1] = color[1];
            extrude.colors[idx + 2] = color[2];
        }

        // Generate shape based on cartoon type
        switch (curve.cartoonType) {
            case CartoonType.HELIX:
                CartoonShapes.circle(extrude, 12, settings.helix_radius);
                break;
            case CartoonType.SHEET:
                CartoonShapes.rectangle(extrude, settings.sheet_width, settings.sheet_length);
                break;
            case CartoonType.LOOP:
            case CartoonType.TUBE:
            default:
                CartoonShapes.circle(extrude, 8, settings.loop_radius);
                break;
        }

        return extrude;
    }

    /**
     * Generate Babylon.js mesh from extrusion
     */
    generateMesh(extrude, cartoonType, colors) {
        try {
            const geometry = this.generateGeometry(extrude);
            if (!geometry.vertices || geometry.vertices.length === 0) {
                console.warn('Generated empty geometry');
                return null;
            }

            // Create custom mesh
            const mesh = new BABYLON.Mesh(`cartoon_${cartoonType}_${Date.now()}`, this.scene);

            // Create vertex data
            const vertexData = new BABYLON.VertexData();
            vertexData.positions = geometry.vertices;
            vertexData.normals = geometry.normals;
            vertexData.colors = geometry.colors;
            vertexData.indices = geometry.indices;

            // Apply to mesh
            vertexData.applyToMesh(mesh);

            // Create material
            const material = new BABYLON.StandardMaterial(`cartoonMat_${Date.now()}`, this.scene);
            material.diffuseColor = new BABYLON.Color3(colors[0] || 0.8, colors[1] || 0.8, colors[2] || 0.8);
            material.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
            material.shininess = 32;
            material.backFaceCulling = false; // Show both sides for ribbons

            mesh.material = material;

            return mesh;
        } catch (error) {
            console.error('Error generating mesh:', error);
            return null;
        }
    }

    /**
     * Generate triangle mesh geometry from extrusion
     */
    generateGeometry(extrude) {
        const n = extrude.n;
        const shapePoints = extrude.nShapePoints;

        if (n < 2 || shapePoints < 3) {
            console.warn('Insufficient points for geometry generation');
            return { vertices: [], normals: [], colors: [], indices: [] };
        }

        const vertices = [];
        const normals = [];
        const colors = [];
        const indices = [];

        // Generate vertices by extruding shape along the curve
        for (let i = 0; i < n; i++) {
            const pointIdx = i * 3;
            const frameIdx = i * 9;
            const colorIdx = i * 3;

            const point = {
                x: extrude.points[pointIdx],
                y: extrude.points[pointIdx + 1],
                z: extrude.points[pointIdx + 2]
            };

            const tangent = {
                x: extrude.normals[frameIdx],
                y: extrude.normals[frameIdx + 1],
                z: extrude.normals[frameIdx + 2]
            };

            const normal = {
                x: extrude.normals[frameIdx + 3],
                y: extrude.normals[frameIdx + 4],
                z: extrude.normals[frameIdx + 5]
            };

            const binormal = {
                x: extrude.normals[frameIdx + 6],
                y: extrude.normals[frameIdx + 7],
                z: extrude.normals[frameIdx + 8]
            };

            const color = {
                r: extrude.colors[colorIdx],
                g: extrude.colors[colorIdx + 1],
                b: extrude.colors[colorIdx + 2]
            };

            // Generate vertices for this cross-section
            for (let j = 0; j < shapePoints; j++) {
                const shapeIdx = j * 3;
                const shapePoint = {
                    x: extrude.shapeVertices[shapeIdx],
                    y: extrude.shapeVertices[shapeIdx + 1],
                    z: extrude.shapeVertices[shapeIdx + 2]
                };

                const shapeNormal = {
                    x: extrude.shapeNormals[shapeIdx],
                    y: extrude.shapeNormals[shapeIdx + 1],
                    z: extrude.shapeNormals[shapeIdx + 2]
                };

                // Transform shape point to world coordinates
                const worldPoint = {
                    x: point.x + shapePoint.x * normal.x + shapePoint.y * binormal.x,
                    y: point.y + shapePoint.x * normal.y + shapePoint.y * binormal.y,
                    z: point.z + shapePoint.x * normal.z + shapePoint.y * binormal.z
                };

                // Transform shape normal to world coordinates
                const worldNormal = {
                    x: shapeNormal.x * normal.x + shapeNormal.y * binormal.x,
                    y: shapeNormal.x * normal.y + shapeNormal.y * binormal.y,
                    z: shapeNormal.x * normal.z + shapeNormal.y * binormal.z
                };

                vertices.push(worldPoint.x, worldPoint.y, worldPoint.z);
                normals.push(worldNormal.x, worldNormal.y, worldNormal.z);
                colors.push(color.r, color.g, color.b, 1.0); // RGBA
            }
        }

        // Generate triangle indices
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < shapePoints; j++) {
                const nextJ = (j + 1) % shapePoints;

                const i1 = i * shapePoints + j;
                const i2 = i * shapePoints + nextJ;
                const i3 = (i + 1) * shapePoints + j;
                const i4 = (i + 1) * shapePoints + nextJ;

                // First triangle
                indices.push(i1, i2, i3);
                // Second triangle
                indices.push(i2, i4, i3);
            }
        }

        return { vertices, normals, colors, indices };
    }

    /**
     * Clear all generated cartoons
     */
    clearAll() {
        // Dispose meshes
        for (const mesh of this.meshes) {
            if (mesh.material) {
                mesh.material.dispose();
            }
            mesh.dispose();
        }

        // Dispose extrudes
        for (const extrude of this.extrudes) {
            extrude.dispose();
        }

        this.meshes = [];
        this.extrudes = [];
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
}

// Export to global namespace for non-module usage
window.CartoonGenerator = CartoonGenerator;