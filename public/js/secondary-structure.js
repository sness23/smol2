/**
 * Secondary Structure Assignment
 * Implements geometric-based secondary structure detection
 * Based on backbone geometry analysis
 */

class SecondaryStructureAnalyzer {
    constructor() {
        // Standard geometry parameters for secondary structures
        this.helixParams = {
            minLength: 4,           // Minimum residues for helix
            caDistance: 3.8,        // Typical CA-CA distance in helix (Å)
            distanceTolerance: 0.4, // Tolerance for CA-CA distance
            turnAngle: 100,         // Typical turn angle in helix (degrees)
            angleTolerance: 30,     // Tolerance for turn angle
            rise: 1.5              // Rise per residue in helix (Å)
        };

        this.sheetParams = {
            minLength: 3,           // Minimum residues for sheet
            caDistance: 3.5,        // Typical CA-CA distance in sheet (Å)
            distanceTolerance: 0.3, // Tolerance for CA-CA distance
            maxTurnAngle: 30,       // Maximum turn angle for extended conformation
            minDistance: 3.3        // Minimum distance for extended conformation
        };

        this.geometryWindow = 5;    // Window size for geometry analysis
    }

    // Analyze secondary structure for a chain of residues
    analyzeChain(residues) {
        console.log(`Analyzing secondary structure for ${residues.length} residues`);

        if (residues.length < this.geometryWindow) {
            return this.assignDefaultStructure(residues);
        }

        // First pass: analyze local geometry
        const geometryScores = this.calculateGeometryScores(residues);

        // Second pass: apply continuity constraints
        const assignments = this.applyGeometryAssignments(geometryScores, residues);

        // Third pass: smooth short segments
        const smoothed = this.smoothAssignments(assignments, residues);

        // Apply assignments to residues
        this.applyAssignments(smoothed, residues);

        return this.getAssignmentSummary(residues);
    }

    // Calculate geometry scores for each residue position
    calculateGeometryScores(residues) {
        const scores = [];
        const halfWindow = Math.floor(this.geometryWindow / 2);

        for (let i = 0; i < residues.length; i++) {
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(residues.length - 1, i + halfWindow);

            const window = residues.slice(start, end + 1);
            const score = this.analyzeLocalGeometry(window, i - start);

            scores.push({
                index: i,
                helixScore: score.helix,
                sheetScore: score.sheet,
                coilScore: score.coil,
                confidence: score.confidence
            });
        }

        return scores;
    }

    // Analyze geometry within a local window
    analyzeLocalGeometry(window, centerIndex) {
        const caAtoms = this.extractCAAtoms(window);

        if (caAtoms.length < 3) {
            return { helix: 0, sheet: 0, coil: 1, confidence: 0 };
        }

        // Calculate various geometric features
        const distances = this.calculateDistances(caAtoms);
        const angles = this.calculateAngles(caAtoms);
        const torsions = this.calculateTorsions(caAtoms);

        // Score for helical geometry
        const helixScore = this.scoreHelicalGeometry(distances, angles, torsions);

        // Score for sheet geometry
        const sheetScore = this.scoreSheetGeometry(distances, angles);

        // Coil score is inverse of structured scores
        const structureScore = Math.max(helixScore, sheetScore);
        const coilScore = Math.max(0, 1 - structureScore);

        // Confidence based on data quality and consistency
        const confidence = this.calculateConfidence(caAtoms, distances, angles);

        return {
            helix: helixScore,
            sheet: sheetScore,
            coil: coilScore,
            confidence: confidence
        };
    }

    extractCAAtoms(residues) {
        return residues
            .filter(r => r.isProtein && r.ca)
            .map(r => ({
                x: r.ca.x,
                y: r.ca.y,
                z: r.ca.z,
                residue: r
            }));
    }

    calculateDistances(caAtoms) {
        const distances = [];

        for (let i = 0; i < caAtoms.length - 1; i++) {
            const dist = this.distance3D(caAtoms[i], caAtoms[i + 1]);
            distances.push(dist);
        }

        return distances;
    }

    calculateAngles(caAtoms) {
        const angles = [];

        for (let i = 0; i < caAtoms.length - 2; i++) {
            const v1 = this.vector3D(caAtoms[i], caAtoms[i + 1]);
            const v2 = this.vector3D(caAtoms[i + 1], caAtoms[i + 2]);

            const angle = this.angleBetweenVectors(v1, v2) * 180 / Math.PI;
            angles.push(angle);
        }

        return angles;
    }

    calculateTorsions(caAtoms) {
        const torsions = [];

        for (let i = 0; i < caAtoms.length - 3; i++) {
            const torsion = this.calculateTorsionAngle(
                caAtoms[i],
                caAtoms[i + 1],
                caAtoms[i + 2],
                caAtoms[i + 3]
            );
            torsions.push(torsion);
        }

        return torsions;
    }

    scoreHelicalGeometry(distances, angles, torsions) {
        let score = 0;
        let count = 0;

        // Check CA-CA distances
        for (const dist of distances) {
            const ideal = this.helixParams.caDistance;
            const tolerance = this.helixParams.distanceTolerance;

            if (Math.abs(dist - ideal) <= tolerance) {
                score += 1 - Math.abs(dist - ideal) / tolerance;
            }
            count++;
        }

        // Check turn angles
        for (const angle of angles) {
            const ideal = this.helixParams.turnAngle;
            const tolerance = this.helixParams.angleTolerance;

            if (Math.abs(angle - ideal) <= tolerance) {
                score += 1 - Math.abs(angle - ideal) / tolerance;
            }
            count++;
        }

        // Check regularity of torsion angles
        if (torsions.length >= 2) {
            const avgTorsion = torsions.reduce((a, b) => a + b, 0) / torsions.length;
            let regularityScore = 0;

            for (const torsion of torsions) {
                if (Math.abs(torsion - avgTorsion) < 30) { // 30 degree tolerance
                    regularityScore += 1;
                }
            }

            score += regularityScore / torsions.length;
            count++;
        }

        return count > 0 ? score / count : 0;
    }

    scoreSheetGeometry(distances, angles) {
        let score = 0;
        let count = 0;

        // Check for extended conformation (longer CA-CA distances)
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

        if (avgDistance >= this.sheetParams.minDistance) {
            score += Math.min(1, (avgDistance - this.sheetParams.minDistance) / 0.5);
        }
        count++;

        // Check for minimal turning (straight segments)
        let straightSegments = 0;
        for (const angle of angles) {
            if (angle < this.sheetParams.maxTurnAngle || angle > (180 - this.sheetParams.maxTurnAngle)) {
                straightSegments++;
            }
        }

        if (angles.length > 0) {
            score += straightSegments / angles.length;
            count++;
        }

        return count > 0 ? score / count : 0;
    }

    calculateConfidence(caAtoms, distances, angles) {
        let confidence = 1.0;

        // Reduce confidence for incomplete data
        if (caAtoms.length < this.geometryWindow) {
            confidence *= caAtoms.length / this.geometryWindow;
        }

        // Reduce confidence for irregular spacing
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const distanceVariance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;

        if (distanceVariance > 0.5) {
            confidence *= 0.8;
        }

        return Math.max(0.1, confidence);
    }

    applyGeometryAssignments(scores, residues) {
        const assignments = [];

        for (let i = 0; i < scores.length; i++) {
            const score = scores[i];
            let assignment = 'coil';

            // Require minimum confidence for structured assignments
            if (score.confidence > 0.5) {
                if (score.helixScore > score.sheetScore && score.helixScore > 0.6) {
                    assignment = 'helix';
                } else if (score.sheetScore > score.helixScore && score.sheetScore > 0.6) {
                    assignment = 'sheet';
                }
            }

            assignments.push({
                index: i,
                assignment: assignment,
                score: score,
                residue: residues[i]
            });
        }

        return assignments;
    }

    smoothAssignments(assignments, residues) {
        const smoothed = [...assignments];

        // Apply minimum length constraints
        this.enforceMinimumLength(smoothed, 'helix', this.helixParams.minLength);
        this.enforceMinimumLength(smoothed, 'sheet', this.sheetParams.minLength);

        // Fill short gaps
        this.fillShortGaps(smoothed, 2);

        return smoothed;
    }

    enforceMinimumLength(assignments, ssType, minLength) {
        let currentRun = 0;
        let runStart = -1;

        for (let i = 0; i <= assignments.length; i++) {
            const isType = i < assignments.length && assignments[i].assignment === ssType;

            if (isType) {
                if (currentRun === 0) {
                    runStart = i;
                }
                currentRun++;
            } else {
                if (currentRun > 0 && currentRun < minLength) {
                    // Convert short runs to coil
                    for (let j = runStart; j < runStart + currentRun; j++) {
                        assignments[j].assignment = 'coil';
                    }
                }
                currentRun = 0;
            }
        }
    }

    fillShortGaps(assignments, maxGapLength) {
        for (let i = 1; i < assignments.length - 1; i++) {
            const prev = assignments[i - 1].assignment;
            const current = assignments[i].assignment;
            const next = assignments[i + 1].assignment;

            // Fill single coil residues between same secondary structure
            if (current === 'coil' && prev === next && prev !== 'coil') {
                assignments[i].assignment = prev;
            }
        }

        // Fill gaps of maxGapLength
        for (let gapSize = 2; gapSize <= maxGapLength; gapSize++) {
            for (let i = gapSize; i < assignments.length - gapSize; i++) {
                const before = assignments[i - 1].assignment;
                const after = assignments[i + gapSize].assignment;

                // Check if all residues in gap are coil
                let allCoil = true;
                for (let j = 0; j < gapSize; j++) {
                    if (assignments[i + j].assignment !== 'coil') {
                        allCoil = false;
                        break;
                    }
                }

                if (allCoil && before === after && before !== 'coil') {
                    for (let j = 0; j < gapSize; j++) {
                        assignments[i + j].assignment = before;
                    }
                }
            }
        }
    }

    applyAssignments(assignments, residues) {
        for (let i = 0; i < assignments.length; i++) {
            if (i < residues.length) {
                residues[i].secondaryStructure = assignments[i].assignment;
                residues[i].ssConfidence = assignments[i].score.confidence;
            }
        }
    }

    assignDefaultStructure(residues) {
        for (const residue of residues) {
            residue.secondaryStructure = 'coil';
            residue.ssConfidence = 0.1;
        }

        return {
            helix: 0,
            sheet: 0,
            coil: residues.length,
            total: residues.length
        };
    }

    getAssignmentSummary(residues) {
        const counts = { helix: 0, sheet: 0, coil: 0 };

        for (const residue of residues) {
            if (residue.secondaryStructure) {
                counts[residue.secondaryStructure]++;
            }
        }

        return {
            ...counts,
            total: residues.length,
            percentages: {
                helix: (counts.helix / residues.length * 100).toFixed(1),
                sheet: (counts.sheet / residues.length * 100).toFixed(1),
                coil: (counts.coil / residues.length * 100).toFixed(1)
            }
        };
    }

    // Utility functions for 3D geometry
    distance3D(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    vector3D(p1, p2) {
        return {
            x: p2.x - p1.x,
            y: p2.y - p1.y,
            z: p2.z - p1.z
        };
    }

    dotProduct(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    }

    vectorLength(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    angleBetweenVectors(v1, v2) {
        const dot = this.dotProduct(v1, v2);
        const len1 = this.vectorLength(v1);
        const len2 = this.vectorLength(v2);

        if (len1 === 0 || len2 === 0) return 0;

        const cosAngle = dot / (len1 * len2);
        return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    }

    calculateTorsionAngle(p1, p2, p3, p4) {
        // Calculate torsion angle between four points
        const v1 = this.vector3D(p1, p2);
        const v2 = this.vector3D(p2, p3);
        const v3 = this.vector3D(p3, p4);

        const n1 = this.crossProduct(v1, v2);
        const n2 = this.crossProduct(v2, v3);

        const angle = this.angleBetweenVectors(n1, n2);
        const sign = this.dotProduct(this.crossProduct(n1, n2), v2) > 0 ? 1 : -1;

        return sign * angle * 180 / Math.PI;
    }

    crossProduct(v1, v2) {
        return {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
        };
    }
}