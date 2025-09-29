/**
 * PyMOL-Style Cartoon Representation System
 * Based on PyMOL's sophisticated cartoon rendering algorithms
 */

// Cartoon type constants (from PyMOL)
const CartoonType = {
    AUTO: 0,        // Automatic detection
    TUBE: 1,        // Simple tube
    LOOP: 2,        // Loop representation
    HELIX: 3,       // Alpha helix
    SHEET: 4,       // Beta sheet
    ARROW: 5,       // Arrow (sheet end)
    DASH: 6,        // Dashed line
    PUTTY: 7,       // Variable width (B-factor)
    SKIP: 8,        // Skip this segment
    SKIP_HELIX: 9,  // Skip helix
    SKIP_SHEET: 10, // Skip sheet
    SKIP_LOOP: 11   // Skip loop
};

/**
 * Core extrusion data structure (based on PyMOL's CExtrude)
 */
class CartoonExtrude {
    constructor() {
        this.n = 0;                              // Number of points
        this.points = new Float32Array(0);       // 3D points
        this.normals = new Float32Array(0);      // Normals (3x3 per point)
        this.colors = new Float32Array(0);       // Colors
        this.alphas = new Float32Array(0);       // Alpha values
        this.indices = new Uint32Array(0);       // Atom indices
        this.radius = 1.0;                       // Radius
        this.scaleFactors = new Float32Array(0); // Scale factors
        this.shapeVertices = new Float32Array(0); // Shape vertices
        this.shapeNormals = new Float32Array(0);  // Shape normals
        this.nShapePoints = 0;                   // Number of shape points
    }

    allocatePointsNormalsColors(n) {
        this.n = n;
        this.points = new Float32Array(n * 3);
        this.normals = new Float32Array(n * 9); // 3x3 normals per point
        this.colors = new Float32Array(n * 3);
        this.alphas = new Float32Array(n);
        this.indices = new Uint32Array(n);
        this.scaleFactors = new Float32Array(n);

        // Fill with defaults
        this.alphas.fill(1.0);
        this.scaleFactors.fill(1.0);
    }

    copyPointsNormalsColors(other) {
        this.allocatePointsNormalsColors(other.n);
        this.points.set(other.points);
        this.normals.set(other.normals);
        this.colors.set(other.colors);
        this.alphas.set(other.alphas);
        this.indices.set(other.indices);
        this.scaleFactors.set(other.scaleFactors);
    }

    dispose() {
        // Clean up typed arrays
        this.points = null;
        this.normals = null;
        this.colors = null;
        this.alphas = null;
        this.indices = null;
        this.scaleFactors = null;
        this.shapeVertices = null;
        this.shapeNormals = null;
    }
}

/**
 * Shape generation for cross-sections (based on PyMOL's extrusion shapes)
 */
class CartoonShapes {
    static circle(extrude, n, size) {
        extrude.shapeVertices = new Float32Array((n + 1) * 3);
        extrude.shapeNormals = new Float32Array((n + 1) * 3);

        for (let i = 0; i <= n; i++) {
            const angle = (2 * Math.PI * i) / n;
            const x = size * Math.cos(angle);
            const y = size * Math.sin(angle);
            const z = 0;

            const idx = i * 3;
            extrude.shapeVertices[idx] = x;
            extrude.shapeVertices[idx + 1] = y;
            extrude.shapeVertices[idx + 2] = z;

            // Normal points outward
            extrude.shapeNormals[idx] = Math.cos(angle);
            extrude.shapeNormals[idx + 1] = Math.sin(angle);
            extrude.shapeNormals[idx + 2] = 0;
        }

        extrude.nShapePoints = n + 1;
    }

    static rectangle(extrude, width, length, mode = 0) {
        const w = width / 2;
        const l = length / 2;

        extrude.shapeVertices = new Float32Array(16 * 3); // 16 points for smooth rectangle
        extrude.shapeNormals = new Float32Array(16 * 3);

        // Create rounded rectangle for smooth appearance
        const points = [];
        const normals = [];

        // Top edge
        for (let i = 0; i < 4; i++) {
            const t = i / 3;
            points.push([-l + t * 2 * l, w, 0]);
            normals.push([0, 1, 0]);
        }

        // Right edge
        for (let i = 0; i < 4; i++) {
            const t = i / 3;
            points.push([l, w - t * 2 * w, 0]);
            normals.push([1, 0, 0]);
        }

        // Bottom edge
        for (let i = 0; i < 4; i++) {
            const t = i / 3;
            points.push([l - t * 2 * l, -w, 0]);
            normals.push([0, -1, 0]);
        }

        // Left edge
        for (let i = 0; i < 4; i++) {
            const t = i / 3;
            points.push([-l, -w + t * 2 * w, 0]);
            normals.push([-1, 0, 0]);
        }

        for (let i = 0; i < points.length; i++) {
            const idx = i * 3;
            extrude.shapeVertices[idx] = points[i][0];
            extrude.shapeVertices[idx + 1] = points[i][1];
            extrude.shapeVertices[idx + 2] = points[i][2];

            extrude.shapeNormals[idx] = normals[i][0];
            extrude.shapeNormals[idx + 1] = normals[i][1];
            extrude.shapeNormals[idx + 2] = normals[i][2];
        }

        extrude.nShapePoints = points.length;
    }

    static oval(extrude, n, width, length) {
        extrude.shapeVertices = new Float32Array((n + 1) * 3);
        extrude.shapeNormals = new Float32Array((n + 1) * 3);

        const a = length / 2;
        const b = width / 2;

        for (let i = 0; i <= n; i++) {
            const angle = (2 * Math.PI * i) / n;
            const x = a * Math.cos(angle);
            const y = b * Math.sin(angle);
            const z = 0;

            const idx = i * 3;
            extrude.shapeVertices[idx] = x;
            extrude.shapeVertices[idx + 1] = y;
            extrude.shapeVertices[idx + 2] = z;

            // Normal points outward (ellipse normal)
            const nx = Math.cos(angle) / a;
            const ny = Math.sin(angle) / b;
            const length = Math.sqrt(nx * nx + ny * ny);

            extrude.shapeNormals[idx] = nx / length;
            extrude.shapeNormals[idx + 1] = ny / length;
            extrude.shapeNormals[idx + 2] = 0;
        }

        extrude.nShapePoints = n + 1;
    }
}

/**
 * Smooth interpolation functions (based on PyMOL's algorithms)
 */
class CartoonInterpolation {
    static smooth(t, power = 2.0) {
        // Bias sampling towards the center of the curve (PyMOL's smooth function)
        if (t <= 0.5) {
            return 0.5 * Math.pow(2 * t, power);
        } else {
            return 1 - 0.5 * Math.pow(2 * (1 - t), power);
        }
    }

    static catmullRom(p0, p1, p2, p3, t) {
        // Catmull-Rom spline interpolation
        const t2 = t * t;
        const t3 = t2 * t;

        const result = {
            x: 0.5 * ((2 * p1.x) +
                      (-p0.x + p2.x) * t +
                      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) +
                      (-p0.y + p2.y) * t +
                      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
            z: 0.5 * ((2 * p1.z) +
                      (-p0.z + p2.z) * t +
                      (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
                      (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
        };

        return result;
    }

    static linearInterpolate(p1, p2, t) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
            z: p1.z + t * (p2.z - p1.z)
        };
    }

    static hermiteInterpolate(p1, p2, t1, t2, t) {
        // Hermite spline interpolation with tangents
        const t2_val = t * t;
        const t3 = t2_val * t;

        const h1 = 2 * t3 - 3 * t2_val + 1;
        const h2 = -2 * t3 + 3 * t2_val;
        const h3 = t3 - 2 * t2_val + t;
        const h4 = t3 - t2_val;

        return {
            x: h1 * p1.x + h2 * p2.x + h3 * t1.x + h4 * t2.x,
            y: h1 * p1.y + h2 * p2.y + h3 * t1.y + h4 * t2.y,
            z: h1 * p1.z + h2 * p2.z + h3 * t1.z + h4 * t2.z
        };
    }
}

/**
 * Vector math utilities
 */
class CartoonMath {
    static normalize(v) {
        const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (length > 0) {
            return { x: v.x / length, y: v.y / length, z: v.z / length };
        }
        return { x: 0, y: 0, z: 1 }; // Default up vector
    }

    static cross(a, b) {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        };
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static subtract(a, b) {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }

    static add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    }

    static scale(v, s) {
        return { x: v.x * s, y: v.y * s, z: v.z * s };
    }

    static length(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    static distance(a, b) {
        const diff = this.subtract(a, b);
        return this.length(diff);
    }

    // Compute Frenet frame (tangent, normal, binormal)
    static computeFrenetFrame(points, index) {
        const n = points.length;

        // Compute tangent vector
        let tangent;
        if (index === 0) {
            // Forward difference
            tangent = this.subtract(points[1], points[0]);
        } else if (index === n - 1) {
            // Backward difference
            tangent = this.subtract(points[n - 1], points[n - 2]);
        } else {
            // Central difference
            tangent = this.subtract(points[index + 1], points[index - 1]);
        }

        tangent = this.normalize(tangent);

        // Compute normal vector (second derivative approximation)
        let normal;
        if (index === 0 || index === n - 1) {
            // Use arbitrary perpendicular vector
            if (Math.abs(tangent.y) < 0.9) {
                normal = this.cross(tangent, { x: 0, y: 1, z: 0 });
            } else {
                normal = this.cross(tangent, { x: 1, y: 0, z: 0 });
            }
        } else {
            // Use curvature vector
            const prev = points[index - 1];
            const curr = points[index];
            const next = points[index + 1];

            const d1 = this.subtract(curr, prev);
            const d2 = this.subtract(next, curr);
            const curvature = this.subtract(d2, d1);

            // Project out tangent component
            const proj = this.scale(tangent, this.dot(curvature, tangent));
            normal = this.subtract(curvature, proj);

            if (this.length(normal) < 1e-6) {
                // Fallback to arbitrary perpendicular
                if (Math.abs(tangent.y) < 0.9) {
                    normal = this.cross(tangent, { x: 0, y: 1, z: 0 });
                } else {
                    normal = this.cross(tangent, { x: 1, y: 0, z: 0 });
                }
            }
        }

        normal = this.normalize(normal);

        // Compute binormal (cross product of tangent and normal)
        const binormal = this.normalize(this.cross(tangent, normal));

        return { tangent, normal, binormal };
    }
}

// Export to global namespace for non-module usage
window.CartoonType = CartoonType;
window.CartoonExtrude = CartoonExtrude;
window.CartoonShapes = CartoonShapes;
window.CartoonInterpolation = CartoonInterpolation;
window.CartoonMath = CartoonMath;