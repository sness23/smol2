/**
 * Main Protein Renderer Class
 * Orchestrates the entire protein visualization pipeline
 */

class ProteinRenderer {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.ribbonGenerator = new RibbonGeometryGenerator(scene);
        this.cartoonGenerator = new CartoonGenerator(scene);

        // Multi-protein management
        this.proteins = new Map(); // filename -> protein data
        this.nextProteinPosition = { x: 0, y: 0, z: 0 };
        this.proteinSpacing = 100; // Distance between proteins

        // Global rendering options
        this.currentColorScheme = 'secondary';
        this.showCartoon = false;
        this.showBackbone = true;
        this.showSticks = false;
        this.showSpheres = false;
        this.lodEnabled = true;

        // Performance tracking
        this.renderStats = {
            totalProteins: 0,
            totalAtoms: 0,
            totalResidues: 0,
            totalChains: 0,
            meshCount: 0,
            lastRenderTime: 0
        };
    }

    // Add a new protein to the scene (supports multiple proteins)
    async addProtein(pdbText, filename = 'unknown.pdb', clearFirst = false) {
        console.log(`Adding protein from ${filename}...`);
        const startTime = performance.now();

        try {
            // Show loading indicator
            this.showLoading(true);

            // Clear all proteins if requested (backwards compatibility)
            if (clearFirst) {
                this.clearAllProteins();
            }

            // Check if protein already exists
            if (this.proteins.has(filename)) {
                console.log(`Protein ${filename} already loaded, removing previous version`);
                this.removeProtein(filename);
            }

            // Create new parser for this protein
            const parser = new PDBParser();
            parser.parse(pdbText);

            // Calculate position for this protein
            const position = this.calculateProteinPosition();

            // Create protein data object
            const proteinData = {
                filename: filename,
                parser: parser,
                position: position,
                meshes: [],
                backboneTraces: [],
                sticks: [], // Combined atoms and bonds
                spheres: [], // Space-filling CPK spheres
                bounds: null,
                visible: true
            };

            // Store protein
            this.proteins.set(filename, proteinData);

            // Generate visualizations for this protein
            await this.generateProteinVisualizations(proteinData);

            // Update statistics
            this.updateRenderStats();

            // Update UI
            this.updateProteinInfo(filename);

            const endTime = performance.now();
            console.log(`Protein ${filename} added in ${(endTime - startTime).toFixed(2)}ms`);
            console.log(`Total proteins loaded: ${this.proteins.size}`);

            return true;

        } catch (error) {
            console.error('Error adding protein:', error);
            this.showError(`Failed to add protein: ${error.message}`);
            return false;

        } finally {
            this.showLoading(false);
        }
    }

    // Legacy method for backwards compatibility
    async loadProtein(pdbText, filename = 'unknown.pdb') {
        return await this.addProtein(pdbText, filename, true);
    }

    // Generate all visualizations based on current settings
    async generateVisualizations() {
        const promises = [];

        // Generate cartoon ribbons
        if (this.showCartoon) {
            promises.push(this.generateCartoonRibbons());
        }

        // Generate backbone traces
        if (this.showBackbone) {
            promises.push(this.generateBackboneTraces());
        }

        // Generate atom spheres
        if (this.showAtoms) {
            promises.push(this.generateAtomSpheres());
        }

        await Promise.all(promises);
    }

    // Calculate position for next protein (spreads them out spatially)
    calculateProteinPosition() {
        const position = { ...this.nextProteinPosition };

        // Move to next position (simple grid layout)
        this.nextProteinPosition.x += this.proteinSpacing;
        if (this.nextProteinPosition.x > this.proteinSpacing * 3) {
            this.nextProteinPosition.x = 0;
            this.nextProteinPosition.z += this.proteinSpacing;
        }

        return position;
    }

    // Generate visualizations for a specific protein
    async generateProteinVisualizations(proteinData) {
        const promises = [];

        // Generate backbone traces
        if (this.showBackbone) {
            promises.push(this.generateProteinBackboneTraces(proteinData));
        }

        // Generate sticks (atoms + bonds)
        if (this.showSticks) {
            promises.push(this.generateProteinSticks(proteinData));
        }

        // Generate spheres (space-filling)
        if (this.showSpheres) {
            promises.push(this.generateProteinSpheres(proteinData));
        }

        await Promise.all(promises);
    }

    async generateProteinCartoonRibbons(proteinData) {
        console.log(`Generating PyMOL-style cartoon ribbons for ${proteinData.filename}...`);

        for (const chain of proteinData.parser.chains) {
            if (chain.type === 'protein' && chain.residues.length > 3) {
                // Use new PyMOL-style cartoon generator
                const cartoonMeshes = this.cartoonGenerator.generateCartoon(proteinData.parser, chain.id);

                // Apply position offset to each mesh
                cartoonMeshes.forEach(mesh => {
                    mesh.position.x += proteinData.position.x;
                    mesh.position.y += proteinData.position.y;
                    mesh.position.z += proteinData.position.z;
                    mesh.proteinId = proteinData.filename; // Tag for identification
                });

                proteinData.meshes.push(...cartoonMeshes);
            }
        }

        // Apply current color scheme
        this.applyProteinColorScheme(proteinData, this.currentColorScheme);

        console.log(`Generated ${proteinData.meshes.length} PyMOL-style cartoon segments for ${proteinData.filename}`);
    }

    async generateProteinBackboneTraces(proteinData) {
        console.log(`Generating backbone traces for ${proteinData.filename}...`);

        for (const chain of proteinData.parser.chains) {
            if (chain.type === 'protein') {
                const trace = this.ribbonGenerator.createBackboneTrace(proteinData.parser, chain.id);
                if (trace) {
                    // Apply position offset
                    trace.position.x += proteinData.position.x;
                    trace.position.y += proteinData.position.y;
                    trace.position.z += proteinData.position.z;
                    trace.proteinId = proteinData.filename; // Tag for identification
                    trace.isVisible = this.showBackbone;
                    proteinData.backboneTraces.push(trace);
                    console.log(`Created backbone trace for chain ${chain.id} in ${proteinData.filename}`);
                } else {
                    console.warn(`Failed to create backbone trace for chain ${chain.id} in ${proteinData.filename}`);
                }
            }
        }

        console.log(`Generated ${proteinData.backboneTraces.length} backbone traces for ${proteinData.filename}`);
    }

    async generateProteinSticks(proteinData) {
        console.log(`Generating sticks (atoms + bonds) for ${proteinData.filename}...`);

        // Generate both atoms and bonds for each chain in the protein
        for (const chain of proteinData.parser.chains) {
            if (chain.type === 'protein') {
                // Generate atom spheres
                const spheres = this.ribbonGenerator.createAtomSpheres(proteinData.parser, chain.id);
                spheres.forEach(sphere => {
                    sphere.position.x += proteinData.position.x;
                    sphere.position.y += proteinData.position.y;
                    sphere.position.z += proteinData.position.z;
                    sphere.proteinId = proteinData.filename;
                    sphere.isVisible = this.showSticks;
                });

                // Generate bonds
                const bonds = this.ribbonGenerator.createAtomBonds(proteinData.parser, chain.id);
                bonds.forEach(bond => {
                    bond.position.x += proteinData.position.x;
                    bond.position.y += proteinData.position.y;
                    bond.position.z += proteinData.position.z;
                    bond.proteinId = proteinData.filename;
                    bond.isVisible = this.showSticks;
                });

                // Combine atoms and bonds into sticks array
                proteinData.sticks.push(...spheres, ...bonds);
            }
        }

        console.log(`Generated ${proteinData.sticks.length} stick elements (atoms + bonds) for ${proteinData.filename}`);
    }

    async generateProteinSpheres(proteinData) {
        console.log(`Generating space-filling spheres for ${proteinData.filename}...`);

        // Generate spheres for each chain in the protein
        for (const chain of proteinData.parser.chains) {
            if (chain.type === 'protein') {
                const spheres = this.ribbonGenerator.createSpaceFillingSpheres(proteinData.parser, chain.id);

                // Apply position offset to each sphere
                spheres.forEach(sphere => {
                    sphere.position.x += proteinData.position.x;
                    sphere.position.y += proteinData.position.y;
                    sphere.position.z += proteinData.position.z;
                    sphere.proteinId = proteinData.filename;
                    sphere.isVisible = this.showSpheres;
                });

                proteinData.spheres.push(...spheres);
            }
        }

        console.log(`Generated ${proteinData.spheres.length} space-filling spheres for ${proteinData.filename}`);
    }

    // Remove a specific protein
    removeProtein(filename) {
        const proteinData = this.proteins.get(filename);
        if (!proteinData) {
            console.warn(`Protein ${filename} not found`);
            return false;
        }

        console.log(`Removing protein ${filename}...`);

        // Dispose meshes
        proteinData.meshes.forEach(mesh => mesh.dispose());
        proteinData.backboneTraces.forEach(trace => trace.dispose());
        proteinData.sticks.forEach(stick => stick.dispose());
        proteinData.spheres.forEach(sphere => sphere.dispose());

        // Remove from map
        this.proteins.delete(filename);

        // Update statistics
        this.updateRenderStats();

        console.log(`Protein ${filename} removed. Remaining proteins: ${this.proteins.size}`);
        return true;
    }

    // Clear all proteins
    clearAllProteins() {
        console.log('Clearing all proteins...');

        for (const [filename, proteinData] of this.proteins) {
            // Dispose meshes
            proteinData.meshes.forEach(mesh => mesh.dispose());
            proteinData.backboneTraces.forEach(trace => trace.dispose());
            proteinData.sticks.forEach(stick => stick.dispose());
            proteinData.spheres.forEach(sphere => sphere.dispose());
        }

        this.proteins.clear();
        this.nextProteinPosition = { x: 0, y: 0, z: 0 };

        // Update statistics
        this.updateRenderStats();

        console.log('All proteins cleared');
    }

    // Apply color scheme to a specific protein
    applyProteinColorScheme(proteinData, colorScheme) {
        this.ribbonGenerator.applyColorScheme(proteinData.meshes, colorScheme, proteinData.parser);
    }

    // Get list of loaded protein names
    getLoadedProteins() {
        return Array.from(this.proteins.keys());
    }

    // Get protein count
    getProteinCount() {
        return this.proteins.size;
    }

    // Helper method to determine mesh type from any protein
    getMeshType(mesh) {
        for (const [filename, proteinData] of this.proteins) {
            if (proteinData.meshes.includes(mesh)) {
                return 'cartoon';
            }
            if (proteinData.backboneTraces.includes(mesh)) {
                return 'backbone';
            }
            if (proteinData.sticks.includes(mesh)) {
                return 'sticks';
            }
            if (proteinData.spheres.includes(mesh)) {
                return 'spheres';
            }
        }
        return 'unknown';
    }

    // Legacy method - now regenerates for all proteins
    async generateCartoonRibbons() {
        console.log('Regenerating cartoon ribbons for all proteins...');

        for (const [filename, proteinData] of this.proteins) {
            // Clear existing cartoon meshes for this protein
            proteinData.meshes.forEach(mesh => mesh.dispose());
            proteinData.meshes = [];

            // Generate new ones
            if (this.showCartoon) {
                await this.generateProteinCartoonRibbons(proteinData);
            }
        }
    }

    // Legacy method - now regenerates for all proteins
    async generateBackboneTraces() {
        console.log('Regenerating backbone traces for all proteins...', 'showBackbone:', this.showBackbone);

        for (const [filename, proteinData] of this.proteins) {
            // Clear existing backbone traces for this protein
            proteinData.backboneTraces.forEach(trace => trace.dispose());
            proteinData.backboneTraces = [];

            // Generate new ones
            if (this.showBackbone) {
                await this.generateProteinBackboneTraces(proteinData);
            }
        }
    }

    // Legacy method - now regenerates for all proteins
    async generateSticks() {
        console.log('Regenerating sticks for all proteins...');

        for (const [filename, proteinData] of this.proteins) {
            // Clear existing sticks for this protein
            proteinData.sticks.forEach(stick => stick.dispose());
            proteinData.sticks = [];

            // Generate new ones
            if (this.showSticks) {
                await this.generateProteinSticks(proteinData);
            }
        }
    }

    // Legacy method - now regenerates for all proteins
    async generateSpheres() {
        console.log('Regenerating space-filling spheres for all proteins...');

        for (const [filename, proteinData] of this.proteins) {
            // Clear existing spheres for this protein
            proteinData.spheres.forEach(sphere => sphere.dispose());
            proteinData.spheres = [];

            // Generate new ones
            if (this.showSpheres) {
                await this.generateProteinSpheres(proteinData);
            }
        }
    }

    // Clear all protein visualizations
    // Legacy method - now calls clearAllProteins
    clearProtein() {
        this.clearAllProteins();
    }

    // Center and scale protein to fit in view
    // Calculate overall bounds for all proteins (legacy method)
    centerAndScaleProtein() {
        if (this.proteins.size === 0) return;

        // Calculate combined bounds of all proteins
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const [filename, proteinData] of this.proteins) {
            const bounds = proteinData.parser.getBoundingBox();
            const pos = proteinData.position;

            minX = Math.min(minX, bounds.min.x + pos.x);
            minY = Math.min(minY, bounds.min.y + pos.y);
            minZ = Math.min(minZ, bounds.min.z + pos.z);
            maxX = Math.max(maxX, bounds.max.x + pos.x);
            maxY = Math.max(maxY, bounds.max.y + pos.y);
            maxZ = Math.max(maxZ, bounds.max.z + pos.z);
        }

        // Calculate overall center and size
        const center = new BABYLON.Vector3(
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2
        );

        const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

        // Store for camera positioning
        this.proteinCenter = center;
        this.proteinSize = size;

        console.log(`Overall scene center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        console.log(`Overall scene size: ${size.toFixed(2)} Å`);
    }

    // Position camera to view entire protein
    resetCamera() {
        if (!this.proteinCenter || !this.proteinSize) return;

        const distance = this.proteinSize * 2.5;
        this.camera.position = this.proteinCenter.add(new BABYLON.Vector3(0, 0, distance));
        this.camera.setTarget(this.proteinCenter);

        console.log('Camera reset to view entire protein');
    }

    // Center structure in view
    centerStructure() {
        if (!this.proteinCenter) return;

        this.camera.setTarget(this.proteinCenter);
        console.log('Structure centered in view');
    }

    // Toggle representation visibility
    toggleRepresentation(type, visible) {
        switch (type) {
            case 'backbone':
                this.showBackbone = visible;
                for (const [filename, proteinData] of this.proteins) {
                    for (const trace of proteinData.backboneTraces) {
                        trace.isVisible = visible;
                    }
                }
                if (visible) {
                    this.generateBackboneTraces();
                }
                break;

            case 'sticks':
                this.showSticks = visible;
                for (const [filename, proteinData] of this.proteins) {
                    for (const stick of proteinData.sticks) {
                        stick.isVisible = visible;
                    }
                }
                if (visible) {
                    this.generateSticks();
                }
                break;

            case 'spheres':
                this.showSpheres = visible;
                for (const [filename, proteinData] of this.proteins) {
                    for (const sphere of proteinData.spheres) {
                        sphere.isVisible = visible;
                    }
                }
                if (visible) {
                    this.generateSpheres();
                }
                break;
        }

        console.log(`${type} representation: ${visible ? 'shown' : 'hidden'}`);
    }

    // Apply color scheme to all proteins
    applyColorScheme(scheme) {
        this.currentColorScheme = scheme;

        for (const [filename, proteinData] of this.proteins) {
            this.applyProteinColorScheme(proteinData, scheme);
        }

        console.log(`Applied color scheme: ${scheme} to ${this.proteins.size} proteins`);
    }

    // Update render statistics
    updateRenderStats() {
        this.renderStats = {
            totalProteins: this.proteins.size,
            totalAtoms: 0,
            totalResidues: 0,
            totalChains: 0,
            helixCount: 0,
            sheetCount: 0,
            coilCount: 0,
            meshCount: 0,
            lastRenderTime: performance.now()
        };

        // Sum stats from all proteins
        for (const [filename, proteinData] of this.proteins) {
            const stats = proteinData.parser.getStatistics();
            this.renderStats.totalAtoms += stats.totalAtoms;
            this.renderStats.totalResidues += stats.totalResidues;
            this.renderStats.totalChains += stats.totalChains;
            this.renderStats.helixCount += stats.helixCount;
            this.renderStats.sheetCount += stats.sheetCount;
            this.renderStats.coilCount += stats.coilCount;
            this.renderStats.meshCount += proteinData.meshes.length + proteinData.backboneTraces.length + proteinData.sticks.length + proteinData.spheres.length;
        }
    }

    // Update protein information display
    updateProteinInfo(filename) {
        const nameElement = document.getElementById('proteinName');
        const detailsElement = document.getElementById('proteinDetails');
        const statsElement = document.getElementById('renderStats');

        if (nameElement) {
            nameElement.textContent = `${filename} (${this.parser.chains.length} chains)`;
        }

        if (detailsElement) {
            const stats = this.renderStats;
            detailsElement.innerHTML = `
                <strong>Structure:</strong> ${stats.totalResidues} residues, ${stats.totalAtoms} atoms<br>
                <strong>Secondary Structure:</strong> ${stats.helixCount} helix, ${stats.sheetCount} sheet, ${stats.coilCount} coil
            `;
        }

        if (statsElement) {
            statsElement.textContent = `Rendered: ${this.renderStats.meshCount} mesh segments`;
        }
    }

    // Show/hide loading indicator
    showLoading(show) {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.classList.toggle('hidden', !show);
        }
    }

    // Show error message
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');

            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorElement.classList.add('hidden');
            }, 5000);
        }
    }

    // Get protein information for display
    getProteinInfo() {
        return {
            filename: this.currentFilename || 'Unknown',
            header: this.parser.header,
            statistics: this.renderStats,
            chains: this.parser.chains.map(chain => ({
                id: chain.id,
                type: chain.type,
                residueCount: chain.residues.length
            })),
            boundingBox: this.parser.getBoundingBox()
        };
    }

    // Export current view as image
    exportImage(width = 1920, height = 1080) {
        return new Promise((resolve) => {
            const canvas = this.scene.getEngine().getRenderingCanvas();

            // Render at higher resolution
            this.scene.getEngine().setSize(width, height);
            this.scene.render();

            // Get image data
            canvas.toBlob((blob) => {
                resolve(blob);

                // Restore original canvas size
                this.scene.getEngine().resize();
            }, 'image/png');
        });
    }

    // Performance optimization: Level of Detail
    updateLOD() {
        if (!this.lodEnabled) return;

        const cameraDistance = BABYLON.Vector3.Distance(
            this.camera.position,
            this.proteinCenter || BABYLON.Vector3.Zero()
        );

        const lodLevel = this.calculateLODLevel(cameraDistance);

        // Adjust mesh detail based on distance for all proteins
        for (const [filename, proteinData] of this.proteins) {
            for (const mesh of proteinData.meshes) {
                this.applyLODToMesh(mesh, lodLevel);
            }
        }
    }

    calculateLODLevel(distance) {
        if (distance < 50) return 'high';
        if (distance < 100) return 'medium';
        return 'low';
    }

    applyLODToMesh(mesh, lodLevel) {
        // Implement LOD by adjusting mesh visibility or detail
        // But respect user's representation settings

        let shouldBeVisible = false;

        // Determine if mesh should be visible based on representation settings
        let meshType = this.getMeshType(mesh);
        if (meshType === 'cartoon') {
            shouldBeVisible = this.showCartoon;
        } else if (meshType === 'backbone') {
            shouldBeVisible = this.showBackbone;
        } else if (meshType === 'sticks') {
            shouldBeVisible = this.showSticks;
        } else if (meshType === 'spheres') {
            shouldBeVisible = this.showSpheres;
        }

        // Apply LOD only if the representation is supposed to be visible
        if (shouldBeVisible) {
            switch (lodLevel) {
                case 'high':
                    mesh.isVisible = true;
                    break;
                case 'medium':
                    mesh.isVisible = true;
                    break;
                case 'low':
                    // Hide small meshes at distance
                    if (mesh.metadata && mesh.metadata.residueRange) {
                        const residueCount = mesh.metadata.residueRange.end - mesh.metadata.residueRange.start;
                        mesh.isVisible = residueCount > 5;
                    } else {
                        mesh.isVisible = true;
                    }
                    break;
            }
        } else {
            // If representation is disabled, keep it hidden
            mesh.isVisible = false;
        }
    }

    // Animation support
    animateToView(targetPosition, targetTarget, duration = 1000) {
        const startPosition = this.camera.position.clone();
        const startTarget = this.camera.getTarget().clone();

        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing
            const eased = 0.5 * (1 - Math.cos(progress * Math.PI));

            // Interpolate camera position and target
            this.camera.position = BABYLON.Vector3.Lerp(startPosition, targetPosition, eased);
            this.camera.setTarget(BABYLON.Vector3.Lerp(startTarget, targetTarget, eased));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Dispose all resources
    dispose() {
        this.clearProtein();
        this.ribbonGenerator.dispose();
        console.log('ProteinRenderer disposed');
    }
}