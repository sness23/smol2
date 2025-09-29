/**
 * Ribbon Geometry Generator
 * Creates 3D ribbon meshes from protein backbone splines
 */

class RibbonGeometryGenerator {
    constructor(scene) {
        this.scene = scene;
        this.materials = new Map();

        // CPK atomic radii in Angstroms
        this.cpkRadii = {
            'H': 1.20,   // Hydrogen
            'HE': 1.40,  // Helium
            'LI': 1.82,  // Lithium
            'BE': 1.53,  // Beryllium
            'B': 1.92,   // Boron
            'C': 1.70,   // Carbon
            'N': 1.55,   // Nitrogen
            'O': 1.52,   // Oxygen
            'F': 1.47,   // Fluorine
            'NE': 1.54,  // Neon
            'NA': 2.27,  // Sodium
            'MG': 1.73,  // Magnesium
            'AL': 1.84,  // Aluminum
            'SI': 2.10,  // Silicon
            'P': 1.80,   // Phosphorus
            'S': 1.80,   // Sulfur
            'CL': 1.75,  // Chlorine
            'AR': 1.88,  // Argon
            'K': 2.75,   // Potassium
            'CA': 2.31,  // Calcium
            'SC': 2.11,  // Scandium
            'TI': 2.00,  // Titanium
            'V': 1.92,   // Vanadium
            'CR': 1.89,  // Chromium
            'MN': 1.97,  // Manganese
            'FE': 1.94,  // Iron
            'CO': 1.92,  // Cobalt
            'NI': 1.84,  // Nickel
            'CU': 1.32,  // Copper
            'ZN': 1.22,  // Zinc
            'GA': 1.87,  // Gallium
            'GE': 2.11,  // Germanium
            'AS': 1.85,  // Arsenic
            'SE': 1.90,  // Selenium
            'BR': 1.85,  // Bromine
            'KR': 2.02,  // Krypton
            'RB': 3.03,  // Rubidium
            'SR': 2.49,  // Strontium
            'Y': 2.32,   // Yttrium
            'ZR': 2.23,  // Zirconium
            'NB': 2.18,  // Niobium
            'MO': 2.17,  // Molybdenum
            'TC': 2.16,  // Technetium
            'RU': 2.13,  // Ruthenium
            'RH': 2.10,  // Rhodium
            'PD': 2.10,  // Palladium
            'AG': 1.72,  // Silver
            'CD': 1.58,  // Cadmium
            'IN': 1.93,  // Indium
            'SN': 2.17,  // Tin
            'SB': 2.06,  // Antimony
            'TE': 2.06,  // Tellurium
            'I': 1.98,   // Iodine
            'XE': 2.16,  // Xenon
            'CS': 3.43,  // Cesium
            'BA': 2.68,  // Barium
            'LA': 2.43,  // Lanthanum
            'CE': 2.42,  // Cerium
            'PR': 2.40,  // Praseodymium
            'ND': 2.39,  // Neodymium
            'PM': 2.38,  // Promethium
            'SM': 2.36,  // Samarium
            'EU': 2.35,  // Europium
            'GD': 2.34,  // Gadolinium
            'TB': 2.33,  // Terbium
            'DY': 2.31,  // Dysprosium
            'HO': 2.30,  // Holmium
            'ER': 2.29,  // Erbium
            'TM': 2.27,  // Thulium
            'YB': 2.26,  // Ytterbium
            'LU': 2.24,  // Lutetium
            'HF': 2.23,  // Hafnium
            'TA': 2.22,  // Tantalum
            'W': 2.18,   // Tungsten
            'RE': 2.16,  // Rhenium
            'OS': 2.16,  // Osmium
            'IR': 2.13,  // Iridium
            'PT': 2.13,  // Platinum
            'AU': 1.66,  // Gold
            'HG': 1.55,  // Mercury
            'TL': 1.96,  // Thallium
            'PB': 2.02,  // Lead
            'BI': 2.07,  // Bismuth
            'PO': 1.97,  // Polonium
            'AT': 2.02,  // Astatine
            'RN': 2.20,  // Radon
            'FR': 3.48,  // Francium
            'RA': 2.83,  // Radium
            'AC': 2.47,  // Actinium
            'TH': 2.45,  // Thorium
            'PA': 2.43,  // Protactinium
            'U': 2.41,   // Uranium
            'NP': 2.39,  // Neptunium
            'PU': 2.43,  // Plutonium
            'AM': 2.44,  // Americium
            'CM': 2.45,  // Curium
            'BK': 2.44,  // Berkelium
            'CF': 2.45,  // Californium
            'ES': 2.45,  // Einsteinium
            'FM': 2.45,  // Fermium
            'MD': 2.46,  // Mendelevium
            'NO': 2.46,  // Nobelium
            'LR': 2.46   // Lawrencium
        };

        // CPK element colors
        this.cpkColors = {
            'H': { r: 1.0, g: 1.0, b: 1.0 },   // White
            'C': { r: 0.3, g: 0.3, b: 0.3 },   // Dark gray
            'N': { r: 0.2, g: 0.2, b: 1.0 },   // Blue
            'O': { r: 1.0, g: 0.2, b: 0.2 },   // Red
            'S': { r: 1.0, g: 1.0, b: 0.2 },   // Yellow
            'P': { r: 1.0, g: 0.5, b: 0.0 },   // Orange
            'F': { r: 0.7, g: 1.0, b: 0.7 },   // Light green
            'CL': { r: 0.0, g: 1.0, b: 0.0 },  // Green
            'BR': { r: 0.6, g: 0.2, b: 0.0 },  // Brown
            'I': { r: 0.4, g: 0.0, b: 0.7 },   // Purple
            'FE': { r: 1.0, g: 0.6, b: 0.0 },  // Orange
            'CA': { r: 0.5, g: 0.5, b: 0.5 },  // Gray
            'MG': { r: 0.5, g: 0.5, b: 0.5 },  // Gray
            'ZN': { r: 0.5, g: 0.5, b: 0.5 },  // Gray
            'default': { r: 0.8, g: 0.4, b: 0.8 } // Pink for unknown elements
        };
    }

    // Generate ribbon meshes for a protein chain
    generateRibbon(parser, chainId) {
        console.log(`Generating ribbon for chain ${chainId}`);

        const chain = parser.chains.find(c => c.id === chainId);
        if (!chain || chain.type !== 'protein') {
            console.warn(`Chain ${chainId} not found or not a protein`);
            return [];
        }

        // Extract backbone atoms
        const backboneAtoms = this.extractBackbone(chain.residues);
        if (backboneAtoms.length < 4) {
            console.warn(`Insufficient backbone atoms for chain ${chainId}: ${backboneAtoms.length}`);
            return [];
        }

        // Create spline curve through CA atoms
        const spline = BSplineCurve.createProteinBackbone(backboneAtoms);

        // Generate ribbon segments
        const segments = this.generateSegments(spline, chain.residues);

        // Create mesh geometry
        const meshes = this.createRibbonMeshes(segments, chainId);

        console.log(`Generated ${meshes.length} ribbon segments for chain ${chainId}`);
        return meshes;
    }

    extractBackbone(residues) {
        const backbone = [];

        for (const residue of residues) {
            if (residue.isProtein && residue.ca) {
                backbone.push({
                    residue: residue,
                    x: residue.ca.x,
                    y: residue.ca.y,
                    z: residue.ca.z,
                    secondaryStructure: residue.secondaryStructure
                });
            }
        }

        return backbone;
    }

    generateSegments(spline, residues) {
        const segments = [];
        const pointsPerResidue = 8; // Subdivision resolution
        const totalPoints = residues.length * pointsPerResidue;

        for (let i = 0; i < totalPoints; i++) {
            const t = i / (totalPoints - 1);
            const frame = spline.getFrenetFrameAt(t);

            // Determine which residue this segment corresponds to
            const residueIndex = Math.floor(i / pointsPerResidue);
            const residue = residues[Math.min(residueIndex, residues.length - 1)];

            // Get cross-section profile based on secondary structure
            const profile = this.getProfileForSecondaryStructure(
                residue.secondaryStructure,
                residue
            );

            segments.push({
                position: frame.position,
                tangent: frame.tangent,
                normal: frame.normal,
                binormal: frame.binormal,
                profile: profile,
                residue: residue,
                t: t,
                segmentIndex: i
            });
        }

        return this.smoothTransitions(segments);
    }

    getProfileForSecondaryStructure(ssType, residue) {
        switch (ssType) {
            case 'helix':
                return this.getHelixProfile(residue);
            case 'sheet':
                return this.getSheetProfile(residue);
            default:
                return this.getCoilProfile(residue);
        }
    }

    getHelixProfile(residue) {
        // Circular profile for helical tubes
        const radius = 1.2;
        const segments = 12;
        const profile = [];

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            profile.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                isCircular: true
            });
        }

        return profile;
    }

    getSheetProfile(residue) {
        // Flat rectangular profile for beta sheets
        const width = 2.5;
        const thickness = 0.3;
        const arrowWidth = 3.5; // Wider at ends for arrow effect

        return [
            { x: -width / 2, y: -thickness / 2 },
            { x: width / 2, y: -thickness / 2 },
            { x: width / 2, y: thickness / 2 },
            { x: -width / 2, y: thickness / 2 }
        ];
    }

    getCoilProfile(residue) {
        // Thin rectangular profile for coils/turns
        const width = 0.8;
        const thickness = 0.2;

        return [
            { x: -width / 2, y: -thickness / 2 },
            { x: width / 2, y: -thickness / 2 },
            { x: width / 2, y: thickness / 2 },
            { x: -width / 2, y: thickness / 2 }
        ];
    }

    smoothTransitions(segments) {
        // Smooth transitions between different secondary structures
        for (let i = 1; i < segments.length - 1; i++) {
            const prev = segments[i - 1];
            const current = segments[i];
            const next = segments[i + 1];

            // Check for secondary structure transitions
            if (prev.residue.secondaryStructure !== current.residue.secondaryStructure ||
                current.residue.secondaryStructure !== next.residue.secondaryStructure) {

                // Create interpolated profile for smooth transitions
                const blendFactor = 0.3;
                if (prev.residue.secondaryStructure !== current.residue.secondaryStructure) {
                    current.profile = this.interpolateProfiles(
                        prev.profile,
                        current.profile,
                        blendFactor
                    );
                }
            }
        }

        return segments;
    }

    interpolateProfiles(profile1, profile2, t) {
        const result = [];
        const maxLength = Math.max(profile1.length, profile2.length);

        for (let i = 0; i < maxLength; i++) {
            const p1 = profile1[i % profile1.length];
            const p2 = profile2[i % profile2.length];

            result.push({
                x: p1.x * (1 - t) + p2.x * t,
                y: p1.y * (1 - t) + p2.y * t
            });
        }

        return result;
    }

    createRibbonMeshes(segments, chainId) {
        const meshes = [];
        const segmentLength = 4; // Group segments for each mesh

        for (let i = 0; i < segments.length - segmentLength; i += segmentLength) {
            const segmentGroup = segments.slice(i, i + segmentLength + 1);
            const mesh = this.createSegmentMesh(segmentGroup, `${chainId}_${i}`);

            if (mesh) {
                meshes.push(mesh);
            }
        }

        return meshes;
    }

    createSegmentMesh(segments, name) {
        if (segments.length < 2) return null;

        const positions = [];
        const indices = [];
        const normals = [];
        const uvs = [];
        const colors = [];

        // Generate vertices by transforming profiles to world space
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const worldProfile = this.transformProfileToWorld(segment);

            for (const point of worldProfile) {
                positions.push(point.x, point.y, point.z);

                // UV coordinates
                const u = i / (segments.length - 1);
                const v = worldProfile.indexOf(point) / (worldProfile.length - 1);
                uvs.push(u, v);

                // Color based on secondary structure
                const color = this.getColorForSecondaryStructure(segment.residue.secondaryStructure);
                colors.push(color.r, color.g, color.b, 1.0);
            }
        }

        // Generate faces
        for (let i = 0; i < segments.length - 1; i++) {
            const currentProfile = segments[i].profile;
            const profileSize = currentProfile.length;

            for (let j = 0; j < profileSize; j++) {
                const next = (j + 1) % profileSize;

                // Current ring indices
                const c1 = i * profileSize + j;
                const c2 = i * profileSize + next;

                // Next ring indices
                const n1 = (i + 1) * profileSize + j;
                const n2 = (i + 1) * profileSize + next;

                // Two triangles per quad
                indices.push(c1, n1, c2);
                indices.push(c2, n1, n2);
            }
        }

        // Calculate normals
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);

        // Create mesh
        const mesh = new BABYLON.Mesh(name, this.scene);
        const vertexData = new BABYLON.VertexData();

        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;
        vertexData.uvs = uvs;

        vertexData.applyToMesh(mesh);

        // Apply material
        const ssType = segments[0].residue.secondaryStructure;
        mesh.material = this.getMaterialForSecondaryStructure(ssType);

        // Store metadata
        mesh.metadata = {
            chainId: segments[0].residue.chainId,
            secondaryStructure: ssType,
            residueRange: {
                start: segments[0].residue.resSeq,
                end: segments[segments.length - 1].residue.resSeq
            }
        };

        return mesh;
    }

    transformProfileToWorld(segment) {
        const worldPoints = [];

        for (const point of segment.profile) {
            // Transform 2D profile point to 3D world space
            const localX = point.x;
            const localY = point.y;

            const worldPoint = segment.position
                .add(segment.normal.scale(localX))
                .add(segment.binormal.scale(localY));

            worldPoints.push(worldPoint);
        }

        return worldPoints;
    }

    getColorForSecondaryStructure(ssType) {
        switch (ssType) {
            case 'helix':
                return { r: 1.0, g: 0.0, b: 1.0 }; // Bright Magenta
            case 'sheet':
                return { r: 0.0, g: 1.0, b: 1.0 }; // Bright Cyan
            default:
                return { r: 1.0, g: 1.0, b: 0.0 }; // Bright Yellow
        }
    }

    getMaterialForSecondaryStructure(ssType) {
        const key = `ribbon_${ssType}`;

        if (!this.materials.has(key)) {
            const material = new BABYLON.PBRMaterial(key, this.scene);

            switch (ssType) {
                case 'helix':
                    material.albedoColor = new BABYLON.Color3(1, 0, 1); // Bright Magenta
                    material.emissiveColor = new BABYLON.Color3(0.3, 0, 0.3); // Add glow
                    material.roughness = 0.3;
                    material.metallic = 0.0;
                    break;
                case 'sheet':
                    material.albedoColor = new BABYLON.Color3(0, 1, 1); // Bright Cyan
                    material.emissiveColor = new BABYLON.Color3(0, 0.3, 0.3); // Add glow
                    material.roughness = 0.3;
                    material.metallic = 0.0;
                    break;
                default:
                    material.albedoColor = new BABYLON.Color3(1, 1, 0); // Bright Yellow
                    material.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0); // Add glow
                    material.roughness = 0.3;
                    material.metallic = 0.0;
                    break;
            }

            material.backFaceCulling = false; // Show both sides
            material.enableSpecularAntiAliasing = true;

            this.materials.set(key, material);
        }

        return this.materials.get(key);
    }

    // Create simple backbone trace for comparison
    createBackboneTrace(parser, chainId) {
        const chain = parser.chains.find(c => c.id === chainId);
        if (!chain) return null;

        const points = [];
        for (const residue of chain.residues) {
            if (residue.ca) {
                points.push(new BABYLON.Vector3(residue.ca.x, residue.ca.y, residue.ca.z));
            }
        }

        if (points.length < 2) return null;

        const lines = BABYLON.MeshBuilder.CreateLines(`backbone_${chainId}`, {
            points: points
        }, this.scene);

        lines.color = new BABYLON.Color3(0.5, 0.5, 0.5);
        lines.isPickable = false;

        return lines;
    }

    // Create atom spheres with CPK radii and colors
    createAtomSpheres(parser, chainId) {
        const chain = parser.chains.find(c => c.id === chainId);
        if (!chain) return [];

        const spheres = [];
        const materialCache = new Map();

        // Scale factor to make atoms visible but not overwhelming
        const radiusScale = 0.3; // Scale down from actual CPK radii for better visualization

        for (const residue of chain.residues) {
            // Process all atoms in the residue, not just CA
            for (const atomName in residue.atoms) {
                const atom = residue.atoms[atomName];
                if (!atom) continue;

                // Get element symbol (first letter, sometimes two)
                let element = atom.element || this.guessElementFromAtomName(atomName);
                element = element.toUpperCase();

                // Get CPK radius and color
                const radius = (this.cpkRadii[element] || 1.70) * radiusScale; // Default to carbon if unknown
                const color = this.cpkColors[element] || this.cpkColors['default'];

                // Debug logging for first few atoms
                if (spheres.length < 5) {
                    console.log(`Atom ${atomName} -> Element ${element}, Color:`, color);
                    console.log(`RGB values: r=${color.r}, g=${color.g}, b=${color.b}`);
                }

                // Create sphere with proper radius
                const sphere = BABYLON.MeshBuilder.CreateSphere(`atom_${residue.chainId}_${residue.resSeq}_${atomName}`, {
                    diameter: radius * 2
                }, this.scene);

                sphere.position = new BABYLON.Vector3(atom.x, atom.y, atom.z);

                // Get or create material for this element
                const materialKey = `cpk_${element}`;
                let material;
                if (materialCache.has(materialKey)) {
                    material = materialCache.get(materialKey);
                } else {
                    material = new BABYLON.StandardMaterial(materialKey, this.scene);
                    material.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
                    material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
                    material.shininess = 32;
                    materialCache.set(materialKey, material);

                    // Debug material creation
                    if (spheres.length < 5) {
                        console.log(`Created material ${materialKey} with diffuseColor:`, material.diffuseColor);
                    }
                }

                sphere.material = material;

                // Store metadata
                sphere.metadata = {
                    atomName: atomName,
                    element: element,
                    residueName: residue.name,
                    residueSeq: residue.resSeq,
                    chainId: residue.chainId,
                    cpkRadius: this.cpkRadii[element] || 1.70
                };

                spheres.push(sphere);
            }
        }

        console.log(`Created ${spheres.length} atom spheres for chain ${chainId}`);
        return spheres;
    }

    // Create space-filling (CPK) spheres at full atomic radii
    createSpaceFillingSpheres(parser, chainId) {
        const chain = parser.chains.find(c => c.id === chainId);
        if (!chain) return [];

        const spheres = [];
        const materialCache = new Map();

        console.log(`Creating space-filling spheres for chain ${chainId}...`);

        for (const residue of chain.residues) {
            // Process all atoms in the residue
            for (const atomName in residue.atoms) {
                const atom = residue.atoms[atomName];
                if (!atom) continue;

                // Get element symbol
                let element = atom.element || this.guessElementFromAtomName(atomName);
                element = element.toUpperCase();

                // Get CPK radius and color (full size, no scaling)
                const radius = this.cpkRadii[element] || 1.70; // Full CPK radius
                const color = this.cpkColors[element] || this.cpkColors['default'];

                // Create sphere with full CPK radius
                const sphere = BABYLON.MeshBuilder.CreateSphere(`sphere_${residue.chainId}_${residue.resSeq}_${atomName}`, {
                    diameter: radius * 2
                }, this.scene);

                sphere.position = new BABYLON.Vector3(atom.x, atom.y, atom.z);

                // Get or create material for this element (reuse from atom spheres)
                const materialKey = `cpk_${element}`;
                let material;
                if (materialCache.has(materialKey)) {
                    material = materialCache.get(materialKey);
                } else {
                    material = new BABYLON.StandardMaterial(materialKey, this.scene);
                    material.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
                    material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
                    material.shininess = 32;
                    materialCache.set(materialKey, material);
                }

                sphere.material = material;

                // Store metadata
                sphere.metadata = {
                    atomName: atomName,
                    element: element,
                    residueName: residue.name,
                    residueSeq: residue.resSeq,
                    chainId: residue.chainId,
                    cpkRadius: radius,
                    representationType: 'spaceFilling'
                };

                spheres.push(sphere);
            }
        }

        console.log(`Created ${spheres.length} space-filling spheres for chain ${chainId}`);
        return spheres;
    }

    // Guess element from atom name (for PDB files that don't have element column)
    guessElementFromAtomName(atomName) {
        // Remove numbers and special characters, take first 1-2 letters
        const clean = atomName.replace(/[0-9'"*]/g, '').trim();

        // Common two-letter elements in proteins
        if (clean.startsWith('CA') && clean.length === 2) return 'CA'; // Calcium
        if (clean.startsWith('MG')) return 'MG'; // Magnesium
        if (clean.startsWith('FE')) return 'FE'; // Iron
        if (clean.startsWith('ZN')) return 'ZN'; // Zinc
        if (clean.startsWith('CL')) return 'CL'; // Chlorine
        if (clean.startsWith('BR')) return 'BR'; // Bromine

        // Single letter elements
        const firstChar = clean.charAt(0).toUpperCase();
        if (['H', 'C', 'N', 'O', 'S', 'P', 'F', 'I'].includes(firstChar)) {
            return firstChar;
        }

        // Default to carbon for unknown
        return 'C';
    }

    // Apply different color schemes
    applyColorScheme(meshes, scheme, parser) {
        switch (scheme) {
            case 'secondary':
                this.applySecondaryStructureColors(meshes);
                break;
            case 'chain':
                this.applyChainColors(meshes);
                break;
            case 'rainbow':
                this.applyRainbowColors(meshes);
                break;
            case 'uniform':
                this.applyUniformColor(meshes, new BABYLON.Color3(0.7, 0.7, 0.7));
                break;
        }
    }

    applySecondaryStructureColors(meshes) {
        for (const mesh of meshes) {
            if (mesh.metadata && mesh.metadata.secondaryStructure) {
                mesh.material = this.getMaterialForSecondaryStructure(mesh.metadata.secondaryStructure);
            }
        }
    }

    applyChainColors(meshes) {
        const chainColors = [
            new BABYLON.Color3(0.8, 0.3, 0.3), // Red
            new BABYLON.Color3(0.3, 0.8, 0.3), // Green
            new BABYLON.Color3(0.3, 0.3, 0.8), // Blue
            new BABYLON.Color3(0.8, 0.8, 0.3), // Yellow
            new BABYLON.Color3(0.8, 0.3, 0.8), // Magenta
            new BABYLON.Color3(0.3, 0.8, 0.8)  // Cyan
        ];

        const chainMap = new Map();
        let colorIndex = 0;

        for (const mesh of meshes) {
            if (mesh.metadata && mesh.metadata.chainId) {
                const chainId = mesh.metadata.chainId;

                if (!chainMap.has(chainId)) {
                    chainMap.set(chainId, chainColors[colorIndex % chainColors.length]);
                    colorIndex++;
                }

                const material = new BABYLON.PBRMaterial(`chain_${chainId}`, this.scene);
                material.baseColor = chainMap.get(chainId);
                material.roughness = 0.4;
                material.metallic = 0.05;
                material.backFaceCulling = false;

                mesh.material = material;
            }
        }
    }

    applyRainbowColors(meshes) {
        for (let i = 0; i < meshes.length; i++) {
            const hue = (i / meshes.length) * 360;
            const color = this.hslToRgb(hue, 0.8, 0.6);

            const material = new BABYLON.PBRMaterial(`rainbow_${i}`, this.scene);
            material.baseColor = new BABYLON.Color3(color.r, color.g, color.b);
            material.roughness = 0.4;
            material.metallic = 0.05;
            material.backFaceCulling = false;

            meshes[i].material = material;
        }
    }

    applyUniformColor(meshes, color) {
        const material = new BABYLON.PBRMaterial('uniform', this.scene);
        material.baseColor = color;
        material.roughness = 0.4;
        material.metallic = 0.05;
        material.backFaceCulling = false;

        for (const mesh of meshes) {
            mesh.material = material;
        }
    }

    hslToRgb(h, s, l) {
        h /= 360;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;

        let r, g, b;

        if (h >= 0 && h < 1/6) {
            r = c; g = x; b = 0;
        } else if (h >= 1/6 && h < 2/6) {
            r = x; g = c; b = 0;
        } else if (h >= 2/6 && h < 3/6) {
            r = 0; g = c; b = x;
        } else if (h >= 3/6 && h < 4/6) {
            r = 0; g = x; b = c;
        } else if (h >= 4/6 && h < 5/6) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }

        return {
            r: r + m,
            g: g + m,
            b: b + m
        };
    }

    // Create bonds between atoms in a chain
    createAtomBonds(parser, chainId) {
        const chain = parser.chains.find(c => c.id === chainId);
        if (!chain) return [];

        const bonds = [];
        const bondMaterial = this.getBondMaterial();

        console.log(`Creating bonds for chain ${chainId}...`);

        // Bond detection parameters
        const bondTolerances = {
            'C-C': 1.8,   // Carbon-Carbon
            'C-N': 1.6,   // Carbon-Nitrogen
            'C-O': 1.5,   // Carbon-Oxygen
            'C-S': 2.1,   // Carbon-Sulfur
            'N-N': 1.6,   // Nitrogen-Nitrogen
            'N-O': 1.5,   // Nitrogen-Oxygen
            'O-O': 1.6,   // Oxygen-Oxygen
            'S-S': 2.2,   // Sulfur-Sulfur
            'default': 2.0 // Default bond distance
        };

        // Collect all atoms from the chain
        const atoms = [];
        for (const residue of chain.residues) {
            for (const atomName in residue.atoms) {
                const atom = residue.atoms[atomName];
                if (atom) {
                    atoms.push({
                        ...atom,
                        atomName: atomName,
                        residueId: residue.id,
                        element: atom.element || this.guessElementFromAtomName(atomName)
                    });
                }
            }
        }

        console.log(`Found ${atoms.length} atoms for bond detection`);

        // Detect bonds between atoms
        for (let i = 0; i < atoms.length; i++) {
            for (let j = i + 1; j < atoms.length; j++) {
                const atom1 = atoms[i];
                const atom2 = atoms[j];

                // Calculate distance
                const dx = atom1.x - atom2.x;
                const dy = atom1.y - atom2.y;
                const dz = atom1.z - atom2.z;
                const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

                // Determine bond tolerance
                const elem1 = atom1.element.toUpperCase();
                const elem2 = atom2.element.toUpperCase();
                const bondKey1 = `${elem1}-${elem2}`;
                const bondKey2 = `${elem2}-${elem1}`;
                const tolerance = bondTolerances[bondKey1] || bondTolerances[bondKey2] || bondTolerances['default'];

                // Check if atoms are bonded
                const shouldBond = this.shouldCreateBond(atom1, atom2, distance, tolerance);

                if (shouldBond) {
                    const bond = this.createBondCylinder(atom1, atom2, bondMaterial);
                    if (bond) {
                        bonds.push(bond);
                    }
                }
            }
        }

        console.log(`Created ${bonds.length} bonds for chain ${chainId}`);
        return bonds;
    }

    // Determine if two atoms should be bonded
    shouldCreateBond(atom1, atom2, distance, tolerance) {
        // Too far apart
        if (distance > tolerance) return false;

        // Too close (same atom or overlapping)
        if (distance < 0.5) return false;

        // Same residue - allow most bonds except very long ones
        if (atom1.residueId === atom2.residueId) {
            return distance < tolerance;
        }

        // Adjacent residues - allow backbone bonds (C-N peptide bonds)
        const residueDiff = Math.abs(atom1.residueId - atom2.residueId);
        if (residueDiff === 1) {
            // Peptide bond: C of residue i to N of residue i+1
            if ((atom1.atomName === 'C' && atom2.atomName === 'N') ||
                (atom1.atomName === 'N' && atom2.atomName === 'C')) {
                return distance < 1.5; // Stricter tolerance for peptide bonds
            }
        }

        // Distant residues - only very close atoms (like disulfide bonds)
        if (residueDiff > 1) {
            return distance < 2.2 &&
                   ((atom1.element === 'S' && atom2.element === 'S') || distance < 1.8);
        }

        return false;
    }

    // Create a cylinder representing a bond between two atoms
    createBondCylinder(atom1, atom2, material) {
        try {
            // Calculate bond vector
            const start = new BABYLON.Vector3(atom1.x, atom1.y, atom1.z);
            const end = new BABYLON.Vector3(atom2.x, atom2.y, atom2.z);
            const vector = end.subtract(start);
            const length = vector.length();

            if (length < 0.1) return null; // Skip very short bonds

            // Create cylinder
            const cylinder = BABYLON.MeshBuilder.CreateCylinder(`bond_${atom1.residueId}_${atom1.atomName}_${atom2.residueId}_${atom2.atomName}`, {
                height: length,
                diameter: 0.2, // Bond thickness
                tessellation: 8 // Low poly for performance
            }, this.scene);

            // Position and orient the cylinder
            const center = start.add(end).scale(0.5);
            cylinder.position = center;

            // Orient cylinder along bond vector
            const up = new BABYLON.Vector3(0, 1, 0);
            const axis = vector.normalize();
            const rotationAxis = BABYLON.Vector3.Cross(up, axis);
            const angle = Math.acos(BABYLON.Vector3.Dot(up, axis));

            if (rotationAxis.length() > 0.001) {
                cylinder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(rotationAxis.normalize(), angle);
            }

            // Apply material
            cylinder.material = material;

            return cylinder;

        } catch (error) {
            console.warn('Error creating bond cylinder:', error);
            return null;
        }
    }

    // Get or create bond material
    getBondMaterial() {
        if (!this.materials.has('bond')) {
            const material = new BABYLON.StandardMaterial('bondMaterial', this.scene);
            material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Gray bonds
            material.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
            material.shininess = 32;
            this.materials.set('bond', material);
        }
        return this.materials.get('bond');
    }

    // Cleanup resources
    dispose() {
        for (const material of this.materials.values()) {
            material.dispose();
        }
        this.materials.clear();
    }
}