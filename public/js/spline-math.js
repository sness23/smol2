/**
 * B-Spline mathematics for smooth curve generation
 * Based on Chimera's spline implementation
 */

class BSplineCurve {
    constructor(controlPoints) {
        this.controlPoints = controlPoints || [];
        this.degree = 3; // Cubic B-splines
        this.closed = false;
    }

    setControlPoints(points) {
        this.controlPoints = points;
        this.invalidateCache();
    }

    addControlPoint(point) {
        this.controlPoints.push(point);
        this.invalidateCache();
    }

    invalidateCache() {
        this._tangentCache = new Map();
        this._normalCache = new Map();
    }

    // Get point on curve at parameter t (0 to 1)
    getPointAt(t) {
        if (this.controlPoints.length < 4) {
            if (this.controlPoints.length === 0) {
                return new BABYLON.Vector3(0, 0, 0);
            }
            return this.controlPoints[0].clone();
        }

        // Clamp t to valid range
        t = Math.max(0, Math.min(1, t));

        // Find the correct span
        const numSpans = this.controlPoints.length - this.degree;
        const span = Math.floor(t * numSpans);
        const localT = (t * numSpans) - span;

        // Get 4 control points for cubic B-spline evaluation
        const startIndex = Math.max(0, Math.min(span, this.controlPoints.length - 4));
        const p0 = this.controlPoints[startIndex];
        const p1 = this.controlPoints[startIndex + 1];
        const p2 = this.controlPoints[startIndex + 2];
        const p3 = this.controlPoints[startIndex + 3];

        return this.evaluateBSpline([p0, p1, p2, p3], localT);
    }

    // Get tangent vector at parameter t
    getTangentAt(t) {
        const cacheKey = Math.round(t * 10000);
        if (this._tangentCache && this._tangentCache.has(cacheKey)) {
            return this._tangentCache.get(cacheKey);
        }

        const delta = 0.001;
        const t1 = Math.max(0, t - delta);
        const t2 = Math.min(1, t + delta);

        const p1 = this.getPointAt(t1);
        const p2 = this.getPointAt(t2);

        const tangent = p2.subtract(p1).normalize();

        if (this._tangentCache) {
            this._tangentCache.set(cacheKey, tangent);
        }

        return tangent;
    }

    // Get Frenet frame (position, tangent, normal, binormal) at parameter t
    getFrenetFrameAt(t) {
        const position = this.getPointAt(t);
        const tangent = this.getTangentAt(t);

        // Calculate normal using finite differences of tangent
        const delta = 0.001;
        const t1 = Math.max(0, t - delta);
        const t2 = Math.min(1, t + delta);

        const tangent1 = this.getTangentAt(t1);
        const tangent2 = this.getTangentAt(t2);

        let normal = tangent2.subtract(tangent1);

        // If normal is too small, create an arbitrary perpendicular vector
        if (normal.length() < 0.001) {
            normal = this.getPerpendicularVector(tangent);
        } else {
            normal = normal.normalize();
        }

        // Calculate binormal (cross product of tangent and normal)
        const binormal = BABYLON.Vector3.Cross(tangent, normal).normalize();

        // Recalculate normal to ensure orthogonality
        normal = BABYLON.Vector3.Cross(binormal, tangent).normalize();

        return {
            position: position,
            tangent: tangent,
            normal: normal,
            binormal: binormal
        };
    }

    // Evaluate cubic B-spline with 4 control points
    evaluateBSpline(controlPoints, t) {
        if (controlPoints.length !== 4) {
            throw new Error('B-spline evaluation requires exactly 4 control points');
        }

        const t2 = t * t;
        const t3 = t2 * t;

        // Cubic B-spline basis functions
        const w0 = (-t3 + 3*t2 - 3*t + 1) / 6;
        const w1 = (3*t3 - 6*t2 + 4) / 6;
        const w2 = (-3*t3 + 3*t2 + 3*t + 1) / 6;
        const w3 = t3 / 6;

        // Weighted sum of control points
        return controlPoints[0].scale(w0)
            .add(controlPoints[1].scale(w1))
            .add(controlPoints[2].scale(w2))
            .add(controlPoints[3].scale(w3));
    }

    // Find a vector perpendicular to the given vector
    getPerpendicularVector(vector) {
        // Choose the coordinate with the smallest absolute value
        const absX = Math.abs(vector.x);
        const absY = Math.abs(vector.y);
        const absZ = Math.abs(vector.z);

        if (absX <= absY && absX <= absZ) {
            // X component is smallest, use (1,0,0) for cross product
            return BABYLON.Vector3.Cross(vector, BABYLON.Vector3.Right()).normalize();
        } else if (absY <= absZ) {
            // Y component is smallest, use (0,1,0) for cross product
            return BABYLON.Vector3.Cross(vector, BABYLON.Vector3.Up()).normalize();
        } else {
            // Z component is smallest, use (0,0,1) for cross product
            return BABYLON.Vector3.Cross(vector, BABYLON.Vector3.Forward()).normalize();
        }
    }

    // Calculate the total arc length of the curve
    getArcLength(subdivisions = 100) {
        let totalLength = 0;
        let prevPoint = this.getPointAt(0);

        for (let i = 1; i <= subdivisions; i++) {
            const t = i / subdivisions;
            const currentPoint = this.getPointAt(t);
            totalLength += BABYLON.Vector3.Distance(prevPoint, currentPoint);
            prevPoint = currentPoint;
        }

        return totalLength;
    }

    // Get parameter t for a given arc length along the curve
    getParameterByArcLength(targetLength, subdivisions = 100) {
        let currentLength = 0;
        let prevPoint = this.getPointAt(0);

        for (let i = 1; i <= subdivisions; i++) {
            const t = i / subdivisions;
            const currentPoint = this.getPointAt(t);
            const segmentLength = BABYLON.Vector3.Distance(prevPoint, currentPoint);

            if (currentLength + segmentLength >= targetLength) {
                // Interpolate within this segment
                const ratio = (targetLength - currentLength) / segmentLength;
                return ((i - 1) + ratio) / subdivisions;
            }

            currentLength += segmentLength;
            prevPoint = currentPoint;
        }

        return 1.0; // Return end of curve if target length exceeds total length
    }

    // Sample points along the curve with uniform arc length spacing
    sampleUniform(numSamples) {
        const points = [];
        const totalLength = this.getArcLength();

        for (let i = 0; i < numSamples; i++) {
            const targetLength = (i / (numSamples - 1)) * totalLength;
            const t = this.getParameterByArcLength(targetLength);
            points.push(this.getPointAt(t));
        }

        return points;
    }

    // Create a smooth curve through a set of points
    static createSmoothCurve(points, tension = 0.5) {
        if (points.length < 2) {
            return new BSplineCurve(points);
        }

        // Add phantom points for proper end conditions
        const controlPoints = [...points];

        if (points.length >= 2) {
            // Add phantom point at the beginning
            const first = points[0];
            const second = points[1];
            const phantomStart = first.add(first.subtract(second).scale(tension));
            controlPoints.unshift(phantomStart);

            // Add phantom point at the end
            const secondLast = points[points.length - 2];
            const last = points[points.length - 1];
            const phantomEnd = last.add(last.subtract(secondLast).scale(tension));
            controlPoints.push(phantomEnd);
        }

        return new BSplineCurve(controlPoints);
    }

    // Create a curve optimized for protein backbone
    static createProteinBackbone(caAtoms) {
        if (caAtoms.length < 2) {
            return new BSplineCurve([]);
        }

        // Convert CA atoms to Vector3 points
        const points = caAtoms.map(atom => new BABYLON.Vector3(atom.x, atom.y, atom.z));

        // Create smooth curve through CA atoms
        const curve = BSplineCurve.createSmoothCurve(points, 0.3);

        // Store residue information for later use
        curve.residueData = caAtoms.map(atom => ({
            residue: atom.residue,
            position: new BABYLON.Vector3(atom.x, atom.y, atom.z)
        }));

        return curve;
    }

    // Get curvature at parameter t
    getCurvatureAt(t) {
        const delta = 0.001;
        const t1 = Math.max(0, t - delta);
        const t2 = Math.min(1, t + delta);

        const tangent1 = this.getTangentAt(t1);
        const tangent2 = this.getTangentAt(t2);

        const dTangent = tangent2.subtract(tangent1);
        const ds = 2 * delta; // Approximate arc length

        return dTangent.length() / ds;
    }

    // Check if the curve is valid
    isValid() {
        return this.controlPoints.length >= 4;
    }

    // Get bounds of the curve
    getBounds() {
        if (this.controlPoints.length === 0) {
            return {
                min: new BABYLON.Vector3(0, 0, 0),
                max: new BABYLON.Vector3(0, 0, 0)
            };
        }

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        // Sample points along the curve to find bounds
        const numSamples = Math.max(50, this.controlPoints.length * 10);
        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const point = this.getPointAt(t);

            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            minZ = Math.min(minZ, point.z);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
            maxZ = Math.max(maxZ, point.z);
        }

        return {
            min: new BABYLON.Vector3(minX, minY, minZ),
            max: new BABYLON.Vector3(maxX, maxY, maxZ),
            center: new BABYLON.Vector3(
                (minX + maxX) / 2,
                (minY + maxY) / 2,
                (minZ + maxZ) / 2
            )
        };
    }
}

// Utility functions for spline mathematics
class SplineUtils {
    // Calculate Catmull-Rom spline (alternative to B-spline)
    static catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;

        return p1.scale(2)
            .add(p2.subtract(p0).scale(t))
            .add(p0.scale(2).subtract(p1.scale(5)).add(p2.scale(4)).subtract(p3).scale(t2))
            .add(p1.scale(3).subtract(p0).subtract(p2.scale(3)).add(p3).scale(t3))
            .scale(0.5);
    }

    // Smooth a path using moving average
    static smoothPath(points, windowSize = 3) {
        if (points.length <= windowSize) {
            return [...points];
        }

        const smoothed = [];
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < points.length; i++) {
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(points.length - 1, i + halfWindow);

            let sum = new BABYLON.Vector3(0, 0, 0);
            let count = 0;

            for (let j = start; j <= end; j++) {
                sum = sum.add(points[j]);
                count++;
            }

            smoothed.push(sum.scale(1 / count));
        }

        return smoothed;
    }

    // Calculate twist angle to minimize ribbon flipping
    static calculateTwist(frames) {
        if (frames.length < 2) return [];

        const twists = [0]; // First frame has no twist

        for (let i = 1; i < frames.length; i++) {
            const prevFrame = frames[i - 1];
            const currentFrame = frames[i];

            // Calculate rotation between consecutive frames
            const axis = currentFrame.tangent;
            const prevNormal = prevFrame.normal;
            const currentNormal = currentFrame.normal;

            // Project normals onto plane perpendicular to tangent
            const projectedPrev = prevNormal.subtract(axis.scale(BABYLON.Vector3.Dot(prevNormal, axis)));
            const projectedCurrent = currentNormal.subtract(axis.scale(BABYLON.Vector3.Dot(currentNormal, axis)));

            // Calculate angle between projected normals
            const cosAngle = BABYLON.Vector3.Dot(projectedPrev.normalize(), projectedCurrent.normalize());
            const sinAngle = BABYLON.Vector3.Dot(BABYLON.Vector3.Cross(projectedPrev, projectedCurrent), axis);

            const twist = Math.atan2(sinAngle, cosAngle);
            twists.push(twist);
        }

        return twists;
    }
}