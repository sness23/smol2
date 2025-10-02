/**
 * PDB Parser for protein structure files
 * Extracts atoms, residues, and secondary structure information
 */

class PDBParser {
    constructor() {
        this.atoms = [];
        this.residues = [];
        this.chains = [];
        this.helices = [];
        this.sheets = [];
        this.header = {};
        this.ligands = []; // Store ligand molecules separately
    }

    parse(pdbText) {
        console.log('Parsing PDB structure...');
        this.reset();

        const lines = pdbText.split('\n');
        const atomMap = new Map();

        for (const line of lines) {
            if (line.startsWith('HEADER')) {
                this.parseHeader(line);
            } else if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
                this.parseAtom(line, atomMap);
            } else if (line.startsWith('HELIX')) {
                this.parseHelix(line);
            } else if (line.startsWith('SHEET')) {
                this.parseSheet(line);
            }
        }

        this.buildResidues(atomMap);
        this.buildChains();
        this.assignSecondaryStructure();
        this.buildLigands();

        console.log(`Parsed ${this.atoms.length} atoms, ${this.residues.length} residues, ${this.chains.length} chains, ${this.ligands.length} ligands`);
        return this;
    }

    reset() {
        this.atoms = [];
        this.residues = [];
        this.chains = [];
        this.helices = [];
        this.sheets = [];
        this.header = {};
        this.ligands = [];
    }

    parseHeader(line) {
        // HEADER    CLASSIFICATION            DD-MMM-YY   IDCODE
        this.header = {
            classification: line.substring(10, 50).trim(),
            depDate: line.substring(50, 59).trim(),
            idCode: line.substring(62, 66).trim()
        };
    }

    parseAtom(line, atomMap) {
        // ATOM/HETATM record format
        const atom = {
            id: parseInt(line.substring(6, 11).trim()),
            name: line.substring(12, 16).trim(),
            altLoc: line.substring(16, 17).trim(),
            resName: line.substring(17, 20).trim(),
            chainId: line.substring(21, 22).trim(),
            resSeq: parseInt(line.substring(22, 26).trim()),
            iCode: line.substring(26, 27).trim(),
            x: parseFloat(line.substring(30, 38).trim()),
            y: parseFloat(line.substring(38, 46).trim()),
            z: parseFloat(line.substring(46, 54).trim()),
            occupancy: parseFloat(line.substring(54, 60).trim()) || 1.0,
            tempFactor: parseFloat(line.substring(60, 66).trim()) || 0.0,
            element: line.substring(76, 78).trim() || this.guessElement(line.substring(12, 16).trim()),
            charge: line.substring(78, 80).trim(),
            isHetAtom: line.startsWith('HETATM')
        };

        this.atoms.push(atom);

        // Group by residue
        const resKey = `${atom.chainId}_${atom.resSeq}_${atom.iCode}`;
        if (!atomMap.has(resKey)) {
            atomMap.set(resKey, []);
        }
        atomMap.get(resKey).push(atom);
    }

    parseHelix(line) {
        // HELIX  Serial Class InitChain InitSeqNum EndChain EndSeqNum Comments
        const helix = {
            id: line.substring(7, 10).trim(),
            helixClass: parseInt(line.substring(38, 40).trim()) || 1,
            initChainId: line.substring(19, 20).trim(),
            initResSeq: parseInt(line.substring(21, 25).trim()),
            initICode: line.substring(25, 26).trim(),
            endChainId: line.substring(31, 32).trim(),
            endResSeq: parseInt(line.substring(33, 37).trim()),
            endICode: line.substring(37, 38).trim(),
            comment: line.substring(40, 70).trim(),
            length: parseInt(line.substring(71, 76).trim()) || 0
        };
        this.helices.push(helix);
    }

    parseSheet(line) {
        // SHEET  Serial StrandNum SheetID InitChain InitSeqNum EndChain EndSeqNum
        const sheet = {
            strand: parseInt(line.substring(7, 10).trim()),
            sheetId: line.substring(11, 14).trim(),
            numStrands: parseInt(line.substring(14, 16).trim()) || 1,
            initChainId: line.substring(21, 22).trim(),
            initResSeq: parseInt(line.substring(22, 26).trim()),
            initICode: line.substring(26, 27).trim(),
            endChainId: line.substring(32, 33).trim(),
            endResSeq: parseInt(line.substring(33, 37).trim()),
            endICode: line.substring(37, 38).trim(),
            sense: parseInt(line.substring(38, 40).trim()) || 0
        };
        this.sheets.push(sheet);
    }

    buildResidues(atomMap) {
        this.residues = [];

        for (const [resKey, atoms] of atomMap) {
            if (atoms.length === 0) continue;

            const firstAtom = atoms[0];
            const residue = {
                chainId: firstAtom.chainId,
                resSeq: firstAtom.resSeq,
                iCode: firstAtom.iCode,
                resName: firstAtom.resName,
                atoms: atoms,
                secondaryStructure: 'coil',
                isProtein: this.isProteinResidue(firstAtom.resName),
                isNucleic: this.isNucleicResidue(firstAtom.resName),
                isWater: firstAtom.resName === 'HOH' || firstAtom.resName === 'WAT'
            };

            // Find backbone atoms for proteins
            if (residue.isProtein) {
                residue.ca = atoms.find(a => a.name === 'CA');
                residue.c = atoms.find(a => a.name === 'C');
                residue.n = atoms.find(a => a.name === 'N');
                residue.o = atoms.find(a => a.name === 'O');
            }

            // Find backbone atoms for nucleic acids
            if (residue.isNucleic) {
                residue.p = atoms.find(a => a.name === 'P');
                residue.c5p = atoms.find(a => a.name === "C5'");
                residue.c3p = atoms.find(a => a.name === "C3'");
                residue.c1p = atoms.find(a => a.name === "C1'");
            }

            this.residues.push(residue);
        }

        // Sort by chain and residue number
        this.residues.sort((a, b) => {
            if (a.chainId !== b.chainId) {
                return a.chainId.localeCompare(b.chainId);
            }
            return a.resSeq - b.resSeq;
        });
    }

    buildChains() {
        const chainMap = new Map();

        for (const residue of this.residues) {
            // Skip ligands (HETATM that aren't water or standard protein/nucleic residues)
            if (residue.isLigand) continue;

            if (!chainMap.has(residue.chainId)) {
                chainMap.set(residue.chainId, {
                    id: residue.chainId,
                    residues: [],
                    type: 'protein' // Will be refined based on content
                });
            }
            chainMap.get(residue.chainId).residues.push(residue);
        }

        this.chains = Array.from(chainMap.values());

        // Determine chain types
        for (const chain of this.chains) {
            const proteinCount = chain.residues.filter(r => r.isProtein).length;
            const nucleicCount = chain.residues.filter(r => r.isNucleic).length;

            if (proteinCount > nucleicCount) {
                chain.type = 'protein';
            } else if (nucleicCount > 0) {
                chain.type = 'nucleic';
            } else {
                chain.type = 'other';
            }
        }
    }

    buildLigands() {
        // Group HETATM residues that aren't water or standard protein/nucleic
        const ligandMap = new Map();

        for (const residue of this.residues) {
            // Identify ligands: HETATM residues that aren't water
            const hasHetAtom = residue.atoms.some(a => a.isHetAtom);
            const isLigand = hasHetAtom && !residue.isWater && !residue.isProtein && !residue.isNucleic;

            if (isLigand) {
                residue.isLigand = true;

                const ligandKey = `${residue.chainId}_${residue.resName}_${residue.resSeq}`;

                if (!ligandMap.has(ligandKey)) {
                    ligandMap.set(ligandKey, {
                        resName: residue.resName,
                        chainId: residue.chainId,
                        resSeq: residue.resSeq,
                        atoms: residue.atoms,
                        bonds: this.calculateLigandBonds(residue.atoms)
                    });
                }
            }
        }

        this.ligands = Array.from(ligandMap.values());
    }

    calculateLigandBonds(atoms) {
        // Calculate bonds based on distance criteria
        const bonds = [];
        const maxBondDistance = 1.8; // Maximum bond distance in Angstroms

        // Common covalent radii for bond detection (in Angstroms)
        const covalentRadii = {
            'H': 0.31, 'C': 0.76, 'N': 0.71, 'O': 0.66, 'S': 1.05,
            'P': 1.07, 'F': 0.57, 'CL': 1.02, 'BR': 1.20, 'I': 1.39,
            'FE': 1.32, 'MG': 1.41, 'CA': 1.76, 'ZN': 1.22
        };

        for (let i = 0; i < atoms.length; i++) {
            for (let j = i + 1; j < atoms.length; j++) {
                const atom1 = atoms[i];
                const atom2 = atoms[j];

                const dx = atom2.x - atom1.x;
                const dy = atom2.y - atom1.y;
                const dz = atom2.z - atom1.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                // Get covalent radii
                const r1 = covalentRadii[atom1.element.toUpperCase()] || 0.76;
                const r2 = covalentRadii[atom2.element.toUpperCase()] || 0.76;
                const maxDist = (r1 + r2) * 1.3; // Allow 30% tolerance

                if (distance < maxDist && distance > 0.4) {
                    bonds.push({
                        atom1: atom1,
                        atom2: atom2,
                        distance: distance
                    });
                }
            }
        }

        return bonds;
    }

    assignSecondaryStructure() {
        // First pass: assign from PDB records
        this.assignFromPDBRecords();

        // Second pass: use geometric analysis for unassigned regions
        this.assignByGeometry();
    }

    assignFromPDBRecords() {
        // Assign helices
        for (const helix of this.helices) {
            const residues = this.residues.filter(r =>
                r.chainId === helix.initChainId &&
                r.resSeq >= helix.initResSeq &&
                r.resSeq <= helix.endResSeq
            );

            for (const residue of residues) {
                residue.secondaryStructure = 'helix';
                residue.helixClass = helix.helixClass;
            }
        }

        // Assign sheets
        for (const sheet of this.sheets) {
            const residues = this.residues.filter(r =>
                r.chainId === sheet.initChainId &&
                r.resSeq >= sheet.initResSeq &&
                r.resSeq <= sheet.endResSeq
            );

            for (const residue of residues) {
                residue.secondaryStructure = 'sheet';
                residue.sheetId = sheet.sheetId;
            }
        }
    }

    assignByGeometry() {
        // Simple geometric secondary structure assignment
        for (const chain of this.chains) {
            if (chain.type !== 'protein') continue;

            const proteinResidues = chain.residues.filter(r => r.isProtein && r.ca);

            for (let i = 2; i < proteinResidues.length - 2; i++) {
                const residue = proteinResidues[i];

                // Skip if already assigned
                if (residue.secondaryStructure !== 'coil') continue;

                // Analyze local geometry
                const window = proteinResidues.slice(i - 2, i + 3);
                const geometry = this.analyzeLocalGeometry(window);

                if (geometry.isHelix) {
                    residue.secondaryStructure = 'helix';
                } else if (geometry.isSheet) {
                    residue.secondaryStructure = 'sheet';
                }
            }
        }
    }

    analyzeLocalGeometry(residueWindow) {
        const caAtoms = residueWindow.map(r => r.ca).filter(Boolean);

        if (caAtoms.length < 5) {
            return { isHelix: false, isSheet: false };
        }

        // Calculate CA-CA distances and angles
        const distances = [];
        const vectors = [];

        for (let i = 0; i < caAtoms.length - 1; i++) {
            const v = {
                x: caAtoms[i + 1].x - caAtoms[i].x,
                y: caAtoms[i + 1].y - caAtoms[i].y,
                z: caAtoms[i + 1].z - caAtoms[i].z
            };
            const dist = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            distances.push(dist);
            vectors.push({
                x: v.x / dist,
                y: v.y / dist,
                z: v.z / dist
            });
        }

        // Helix detection: consistent 3.8Å spacing and ~100° turns
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        let helixScore = 0;

        if (avgDistance > 3.6 && avgDistance < 4.0) {
            helixScore += 2;
        }

        // Check for consistent turning angles
        let consistentTurns = 0;
        for (let i = 0; i < vectors.length - 1; i++) {
            const dot = vectors[i].x * vectors[i + 1].x +
                       vectors[i].y * vectors[i + 1].y +
                       vectors[i].z * vectors[i + 1].z;
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;

            if (angle > 70 && angle < 130) { // ~100° ± 30°
                consistentTurns++;
            }
        }

        if (consistentTurns >= vectors.length - 2) {
            helixScore += 3;
        }

        // Sheet detection: extended conformation
        let sheetScore = 0;

        if (avgDistance > 3.5) { // Extended conformation
            sheetScore += 2;
        }

        // Check for minimal turning (straight)
        let straightSegments = 0;
        for (let i = 0; i < vectors.length - 1; i++) {
            const dot = vectors[i].x * vectors[i + 1].x +
                       vectors[i].y * vectors[i + 1].y +
                       vectors[i].z * vectors[i + 1].z;
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;

            if (angle < 30) { // Nearly straight
                straightSegments++;
            }
        }

        if (straightSegments >= vectors.length - 2) {
            sheetScore += 3;
        }

        return {
            isHelix: helixScore >= 3,
            isSheet: sheetScore >= 3
        };
    }

    guessElement(atomName) {
        // Simple element guessing from atom name
        const name = atomName.trim().toUpperCase();
        if (name.startsWith('C')) return 'C';
        if (name.startsWith('N')) return 'N';
        if (name.startsWith('O')) return 'O';
        if (name.startsWith('S')) return 'S';
        if (name.startsWith('P')) return 'P';
        if (name.startsWith('H')) return 'H';
        if (name.startsWith('FE')) return 'FE';
        if (name.startsWith('MG')) return 'MG';
        if (name.startsWith('CA')) return 'CA';
        if (name.startsWith('ZN')) return 'ZN';
        return 'C'; // Default to carbon
    }

    isProteinResidue(resName) {
        const proteinResidues = new Set([
            'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
            'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
            'MSE', 'SEP', 'TPO', 'PTR', 'MLY', 'M3L', 'HOH'
        ]);
        return proteinResidues.has(resName.toUpperCase());
    }

    isNucleicResidue(resName) {
        const nucleicResidues = new Set([
            'A', 'G', 'C', 'T', 'U', 'DA', 'DG', 'DC', 'DT',
            'ADE', 'GUA', 'CYT', 'THY', 'URA'
        ]);
        return nucleicResidues.has(resName.toUpperCase());
    }

    getBackboneAtoms(chainId) {
        const chain = this.chains.find(c => c.id === chainId);
        if (!chain) return [];

        const backboneAtoms = [];

        for (const residue of chain.residues) {
            if (residue.isProtein && residue.ca) {
                backboneAtoms.push({
                    residue: residue,
                    ca: residue.ca,
                    c: residue.c,
                    n: residue.n,
                    o: residue.o
                });
            } else if (residue.isNucleic && residue.p) {
                backboneAtoms.push({
                    residue: residue,
                    p: residue.p,
                    c5p: residue.c5p,
                    c3p: residue.c3p,
                    c1p: residue.c1p
                });
            }
        }

        return backboneAtoms;
    }

    getBoundingBox() {
        if (this.atoms.length === 0) {
            return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
        }

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const atom of this.atoms) {
            minX = Math.min(minX, atom.x);
            minY = Math.min(minY, atom.y);
            minZ = Math.min(minZ, atom.z);
            maxX = Math.max(maxX, atom.x);
            maxY = Math.max(maxY, atom.y);
            maxZ = Math.max(maxZ, atom.z);
        }

        return {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                z: (minZ + maxZ) / 2
            },
            size: {
                x: maxX - minX,
                y: maxY - minY,
                z: maxZ - minZ
            }
        };
    }

    getStatistics() {
        const stats = {
            totalAtoms: this.atoms.length,
            totalResidues: this.residues.length,
            totalChains: this.chains.length,
            helixCount: this.residues.filter(r => r.secondaryStructure === 'helix').length,
            sheetCount: this.residues.filter(r => r.secondaryStructure === 'sheet').length,
            coilCount: this.residues.filter(r => r.secondaryStructure === 'coil').length,
            proteinResidues: this.residues.filter(r => r.isProtein).length,
            nucleicResidues: this.residues.filter(r => r.isNucleic).length,
            waterMolecules: this.residues.filter(r => r.isWater).length
        };

        return stats;
    }
}