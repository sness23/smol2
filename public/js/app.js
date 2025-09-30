/**
 * Main Application - Protein Cartoon Viewer
 * Initializes Babylon.js scene and handles user interactions
 */

class ProteinViewer {
    constructor() {
        this.canvas = null;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Command console state (always visible in smol2)
        this.commandHistory = this.loadCommandHistory();
        this.historyIndex = -1;

        this.init();
    }

    async init() {
        console.log('Initializing Protein Cartoon Viewer...');

        // Initialize Babylon.js
        this.initBabylon();

        // Setup scene
        this.setupScene();

        // Initialize protein renderer
        this.renderer = new ProteinRenderer(this.scene, this.camera);

        // Setup event handlers
        this.setupEventHandlers();

        // Setup command console
        this.setupCommandConsole();

        // Start render loop
        this.startRenderLoop();

        console.log('Protein Cartoon Viewer initialized successfully');
    }

    initBabylon() {
        // Get canvas
        this.canvas = document.getElementById('renderCanvas');

        // Create engine with hardware scaling to maintain quality at browser zoom
        this.engine = new BABYLON.Engine(this.canvas, true, {
            antialias: true,
            preserveDrawingBuffer: true,
            stencil: true
        });

        // Set hardware scaling to render at higher resolution
        this.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

        // Handle resize and zoom changes
        window.addEventListener('resize', () => {
            this.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
            this.engine.resize();
        });
    }

    setupScene() {
        // Create scene
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color3(0, 0, 0);

        // Create ArcRotateCamera for PyMOL-style rotation around protein
        this.camera = new BABYLON.ArcRotateCamera(
            'camera',
            Math.PI / 2,      // alpha (horizontal rotation)
            Math.PI / 3,      // beta (vertical rotation)
            50,               // radius (distance from target)
            BABYLON.Vector3.Zero(), // target point (origin)
            this.scene
        );

        // Attach camera controls to canvas
        this.camera.attachControl(this.canvas, true);

        // Configure camera behavior for PyMOL-style interaction
        this.camera.lowerRadiusLimit = 5;    // Minimum zoom distance
        this.camera.upperRadiusLimit = 500;  // Maximum zoom distance
        this.camera.wheelPrecision = 10;     // Zoom sensitivity (lower = more zoom per tick)
        this.camera.panningSensibility = 50; // Pan sensitivity (right-click drag)
        this.camera.angularSensibilityX = 1000; // Rotation sensitivity horizontal
        this.camera.angularSensibilityY = 1000; // Rotation sensitivity vertical

        // Enable panning with right mouse button
        this.camera.panningMouseButton = 2; // Right mouse button for panning

        // Implement accelerated mouse wheel zoom
        this.wheelDeltaAccumulator = 0;
        this.lastWheelTime = 0;
        this.setupAcceleratedZoom();

        // Lighting setup
        this.setupLighting();

        // Environment
        this.setupEnvironment();
    }

    setupLighting() {
        // Hemisphere light for overall illumination
        const hemisphereLight = new BABYLON.HemisphericLight(
            'hemisphereLight',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        hemisphereLight.intensity = 1.5;
        hemisphereLight.diffuse = new BABYLON.Color3(1, 1, 1);
        hemisphereLight.groundColor = new BABYLON.Color3(0.8, 0.8, 0.8);

        // Directional light for shadows and definition
        const directionalLight = new BABYLON.DirectionalLight(
            'directionalLight',
            new BABYLON.Vector3(-1, -1, -0.5),
            this.scene
        );
        directionalLight.intensity = 1.5;
        directionalLight.diffuse = new BABYLON.Color3(1, 1, 1);

        // Point light for highlights
        const pointLight = new BABYLON.PointLight(
            'pointLight',
            new BABYLON.Vector3(10, 10, 10),
            this.scene
        );
        pointLight.intensity = 0.8;
        pointLight.diffuse = new BABYLON.Color3(1, 1, 1);
    }

    setupEnvironment() {
        // Enable HDR
        this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
        this.scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        this.scene.imageProcessingConfiguration.exposure = 1.0;

        // Enable anti-aliasing
        this.scene.imageProcessingConfiguration.samples = 4;

        // Setup default rendering pipeline for better visuals
        try {
            if (BABYLON.DefaultRenderingPipeline) {
                const pipeline = new BABYLON.DefaultRenderingPipeline(
                    'defaultPipeline',
                    true,
                    this.scene,
                    [this.camera]
                );

                pipeline.fxaaEnabled = true;
                if (pipeline.bloomEnabled !== undefined) {
                    pipeline.bloomEnabled = true;
                    pipeline.bloomScale = 0.5;
                    pipeline.bloomKernel = 64;
                    pipeline.bloomWeight = 0.15;
                }
            }
        } catch (error) {
            console.warn('Advanced rendering pipeline not available:', error);
        }
    }

    setupAcceleratedZoom() {
        // Custom wheel event handler for accelerated zooming
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();

            const currentTime = Date.now();
            const timeDelta = currentTime - this.lastWheelTime;

            // Reset accumulator if it's been more than 200ms since last scroll
            if (timeDelta > 200) {
                this.wheelDeltaAccumulator = 0;
            }

            // Accumulate wheel delta for acceleration
            this.wheelDeltaAccumulator += Math.abs(event.deltaY);

            // Calculate acceleration factor (increases with rapid scrolling)
            const accelerationFactor = Math.min(1 + (this.wheelDeltaAccumulator / 500), 3.0);

            // Calculate zoom amount with acceleration
            const zoomDirection = event.deltaY > 0 ? 1 : -1;
            const baseZoomAmount = this.camera.radius * 0.05; // 5% of current radius
            const zoomAmount = baseZoomAmount * accelerationFactor * zoomDirection;

            // Apply zoom
            this.camera.radius += zoomAmount;

            // Clamp to limits
            this.camera.radius = Math.max(
                this.camera.lowerRadiusLimit,
                Math.min(this.camera.upperRadiusLimit, this.camera.radius)
            );

            this.lastWheelTime = currentTime;

            // Decay accumulator over time
            setTimeout(() => {
                this.wheelDeltaAccumulator *= 0.8;
            }, 100);
        }, { passive: false });
    }

    setupEventHandlers() {
        // Prevent context menu on canvas (we use right-click for panning)
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // All keyboard input should go to console
        const commandInput = document.getElementById('commandInput');

        // Capture all keydown events globally and redirect to console
        window.addEventListener('keydown', (e) => {
            // F2 toggles console visibility
            if (e.key === 'F2') {
                this.toggleConsoleVisibility();
                e.preventDefault();
                return;
            }

            // Don't interfere with special keys (arrows, etc.) when console already has focus
            if (document.activeElement === commandInput) {
                return; // Let console handle it normally
            }

            // For any printable character or special input keys, focus the console
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                commandInput.focus();
                // Let the browser handle the key in the now-focused input
            }
        });

        // Handle camera movement for LOD updates
        this.camera.onViewMatrixChangedObservable.add(() => {
            if (this.renderer) {
                this.renderer.updateLOD();
            }
        });
    }


    startRenderLoop() {
        this.engine.runRenderLoop(() => {
            // Render the scene
            this.scene.render();
        });
    }

    // Public API methods for UI interaction

    async loadSampleProtein() {
        try {
            console.log('Loading sample protein...');

            const response = await fetch('/api/sample-pdb');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            await this.renderer.addProtein(data.content, data.filename, false);

            // Position camera to view all proteins
            setTimeout(() => {
                if (this.renderer) {
                    this.renderer.centerAndScaleProtein();
                    this.centerStructure();
                }
            }, 500);

        } catch (error) {
            console.error('Error loading sample protein:', error);
            this.renderer.showError(`Failed to load sample protein: ${error.message}`);
        }
    }

    async handleFileUpload(file) {
        if (!file || !file.name.toLowerCase().endsWith('.pdb')) {
            this.renderer.showError('Please select a valid PDB file');
            return;
        }

        try {
            console.log(`Loading uploaded file: ${file.name}`);

            const formData = new FormData();
            formData.append('pdbFile', file);

            const response = await fetch('/api/upload-pdb', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            await this.renderer.addProtein(data.content, data.filename, false);

            // Position camera to view all proteins
            setTimeout(() => {
                if (this.renderer) {
                    this.renderer.centerAndScaleProtein();
                    this.centerStructure();
                }
            }, 500);

        } catch (error) {
            console.error('Error uploading file:', error);
            this.renderer.showError(`Failed to upload file: ${error.message}`);
        }
    }

    toggleRepresentation(type, forceState = null) {
        // Since we removed the GUI checkboxes, work directly with the renderer
        if (!this.renderer) {
            this.addToConsole('No protein loaded', 'error');
            return;
        }

        let currentState, newState;

        // Get current state from renderer
        switch (type) {
            case 'cartoon':
                currentState = this.renderer.showCartoon;
                break;
            case 'backbone':
                currentState = this.renderer.showBackbone;
                break;
            case 'sticks':
                currentState = this.renderer.showSticks;
                break;
            case 'spheres':
                currentState = this.renderer.showSpheres;
                break;
            default:
                this.addToConsole(`Unknown representation type: ${type}`, 'error');
                return;
        }

        // Determine new state
        newState = forceState !== null ? forceState : !currentState;

        // Apply the change
        this.renderer.toggleRepresentation(type, newState);

        // Provide console feedback
        const action = newState ? 'shown' : 'hidden';
        this.addToConsole(`${type.charAt(0).toUpperCase() + type.slice(1)} representation ${action}`, 'success');
    }

    changeColorScheme(scheme) {
        if (this.renderer) {
            this.renderer.applyColorScheme(scheme);
        }
    }

    resetCamera() {
        // Reset camera to initial position for FreeCamera
        this.camera.position = new BABYLON.Vector3(0, 0, -50);
        this.camera.setTarget(BABYLON.Vector3.Zero());

        if (this.renderer) {
            this.renderer.resetCamera();
        }
    }

    centerStructure() {
        if (this.renderer) {
            this.renderer.centerStructure();
        }
    }

    setBackgroundColor(colorArg) {
        let color;

        // Parse common color names
        switch (colorArg.toLowerCase()) {
            case 'black':
                color = new BABYLON.Color3(0, 0, 0);
                break;
            case 'white':
                color = new BABYLON.Color3(1, 1, 1);
                break;
            case 'gray':
            case 'grey':
                color = new BABYLON.Color3(0.5, 0.5, 0.5);
                break;
            case 'blue':
                color = new BABYLON.Color3(0, 0, 1);
                break;
            case 'red':
                color = new BABYLON.Color3(1, 0, 0);
                break;
            case 'green':
                color = new BABYLON.Color3(0, 1, 0);
                break;
            case 'darkblue':
                color = new BABYLON.Color3(0.1, 0.1, 0.15);
                break;
            default:
                // Try to parse as RGB values (e.g., "0.5,0.2,0.8" or "128,64,192")
                const rgbMatch = colorArg.match(/^(\d*\.?\d+),\s*(\d*\.?\d+),\s*(\d*\.?\d+)$/);
                if (rgbMatch) {
                    let r = parseFloat(rgbMatch[1]);
                    let g = parseFloat(rgbMatch[2]);
                    let b = parseFloat(rgbMatch[3]);

                    // If values are > 1, assume they're in 0-255 range
                    if (r > 1 || g > 1 || b > 1) {
                        r /= 255;
                        g /= 255;
                        b /= 255;
                    }

                    color = new BABYLON.Color3(r, g, b);
                } else {
                    this.addToConsole(`Unknown color: ${colorArg}. Use: black, white, gray, blue, red, green, darkblue, or r,g,b values`, 'error');
                    return;
                }
        }

        this.scene.clearColor = color;
        this.addToConsole(`Background color set to ${colorArg}`, 'success');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // Export functionality
    async exportImage() {
        if (!this.renderer) return;

        try {
            const blob = await this.renderer.exportImage();
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'protein-structure.png';
            link.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting image:', error);
            this.renderer.showError('Failed to export image');
        }
    }


    // Command History Management
    loadCommandHistory() {
        try {
            const history = localStorage.getItem('proteinViewer_commandHistory');
            if (history) {
                const parsed = JSON.parse(history);
                console.log(`Loaded ${parsed.length} commands from history`);
                return parsed;
            }
        } catch (error) {
            console.warn('Failed to load command history:', error);
        }
        return [];
    }

    saveCommandHistory() {
        try {
            // Keep only the last 100 commands to avoid localStorage limits
            const historyToSave = this.commandHistory.slice(-100);
            localStorage.setItem('proteinViewer_commandHistory', JSON.stringify(historyToSave));
        } catch (error) {
            console.warn('Failed to save command history:', error);
        }
    }

    addCommandToHistory(command) {
        // Don't add duplicate consecutive commands
        if (this.commandHistory.length === 0 || this.commandHistory[this.commandHistory.length - 1] !== command) {
            this.commandHistory.push(command);
            this.saveCommandHistory();
        }
    }

    // Command Console Methods
    setupCommandConsole() {
        const commandInput = document.getElementById('commandInput');

        // Console is always visible, just process commands
        commandInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const command = commandInput.value.trim();
                if (command !== '') {
                    // Process command
                    this.processCommand(command);
                    commandInput.value = '';
                    // Reset history index when new command is entered
                    this.historyIndex = -1;
                }
                event.preventDefault();
            } else if (event.key === 'ArrowUp') {
                // Navigate up in command history
                if (this.commandHistory.length > 0) {
                    if (this.historyIndex === -1) {
                        this.historyIndex = this.commandHistory.length - 1;
                    } else if (this.historyIndex > 0) {
                        this.historyIndex--;
                    }
                    commandInput.value = this.commandHistory[this.historyIndex];
                    // Move cursor to end
                    setTimeout(() => commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length), 0);
                }
                event.preventDefault();
            } else if (event.key === 'ArrowDown') {
                // Navigate down in command history
                if (this.historyIndex !== -1) {
                    if (this.historyIndex < this.commandHistory.length - 1) {
                        this.historyIndex++;
                        commandInput.value = this.commandHistory[this.historyIndex];
                    } else {
                        this.historyIndex = -1;
                        commandInput.value = '';
                    }
                    // Move cursor to end
                    setTimeout(() => commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length), 0);
                }
                event.preventDefault();
            }
        });

        // Show welcome message
        this.addToConsole('smol2 - Type "help" for commands. Press F2 to hide/show console.', 'success');
    }

    toggleConsoleVisibility() {
        const consoleElement = document.getElementById('commandConsole');
        if (consoleElement.style.display === 'none') {
            consoleElement.style.display = 'block';
        } else {
            consoleElement.style.display = 'none';
        }
    }

    addToConsole(text, type = 'output') {
        const history = document.getElementById('consoleHistory');
        const line = document.createElement('div');
        line.className = `console-line console-${type}`;
        line.textContent = text;
        history.appendChild(line);
        history.scrollTop = history.scrollHeight;
    }

    processCommand(command) {
        // Add command to history display
        this.addToConsole(command, 'command');

        // Add to persistent command history
        this.addCommandToHistory(command);

        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
            case 'list':
            case 'proteins':
                this.listLoadedProteins();
                break;
            case 'count':
                this.addToConsole(`${this.renderer.getProteinCount()} proteins loaded`, 'output');
                break;
            case 'load':
                if (args.length > 0) {
                    this.loadProteinByName(args[0]);
                } else {
                    this.addToConsole('Usage: load [filename] (e.g., "load 1erm")', 'error');
                }
                break;
            case 'delete':
                if (args.length > 0) {
                    if (args[0] === 'all') {
                        this.renderer.clearAllProteins();
                        this.addToConsole('All proteins deleted', 'success');
                    } else {
                        // Try to remove specific protein
                        const removed = this.renderer.removeProtein(args[0]);
                        if (removed) {
                            this.addToConsole(`Protein ${args[0]} deleted`, 'success');
                        } else {
                            this.addToConsole(`Protein ${args[0]} not found`, 'error');
                        }
                    }
                } else {
                    this.addToConsole('Usage: delete all | delete [filename] (e.g., "delete all" or "delete 1erm.pdb")', 'error');
                }
                break;
            case 'ls':
            case 'dir':
                this.listFiles();
                break;
            case 'clear':
                if (args.length > 0) {
                    if (args[0] === 'console') {
                        document.getElementById('consoleHistory').innerHTML = '';
                        this.addToConsole('Console cleared', 'success');
                    } else if (args[0] === 'all') {
                        this.renderer.clearAllProteins();
                        this.addToConsole('All proteins cleared', 'success');
                    } else {
                        // Try to remove specific protein
                        const removed = this.renderer.removeProtein(args[0]);
                        if (removed) {
                            this.addToConsole(`Protein ${args[0]} removed`, 'success');
                        } else {
                            this.addToConsole(`Protein ${args[0]} not found`, 'error');
                        }
                    }
                } else {
                    // Default to clearing console for backwards compatibility
                    document.getElementById('consoleHistory').innerHTML = '';
                }
                break;
            case 'history':
                if (args.length > 0 && args[0] === 'clear') {
                    this.commandHistory = [];
                    this.saveCommandHistory();
                    this.addToConsole('Command history cleared', 'success');
                } else {
                    this.addToConsole(`Command history (${this.commandHistory.length} commands):`, 'output');
                    this.commandHistory.slice(-10).forEach((cmd, i) => {
                        this.addToConsole(`  ${this.commandHistory.length - 10 + i + 1}: ${cmd}`, 'output');
                    });
                }
                break;
            case 'reset':
                this.resetCamera();
                this.addToConsole('Camera reset to default position', 'success');
                break;
            case 'center':
                this.centerStructure();
                this.addToConsole('Structure centered', 'success');
                break;
            case 'cartoon':
                this.toggleRepresentation('cartoon');
                break;
            case 'backbone':
                this.toggleRepresentation('backbone');
                break;
            case 'sticks':
                this.toggleRepresentation('sticks');
                break;
            case 'spheres':
                this.toggleRepresentation('spheres');
                break;
            case 'show':
                if (args.length > 0) {
                    this.toggleRepresentation(args[0], true);
                } else {
                    this.addToConsole('Usage: show [cartoon|backbone|sticks|spheres]', 'error');
                }
                break;
            case 'hide':
                if (args.length > 0) {
                    this.toggleRepresentation(args[0], false);
                } else {
                    // Hide all representations (PyMOL style)
                    this.toggleRepresentation('cartoon', false);
                    this.toggleRepresentation('backbone', false);
                    this.toggleRepresentation('sticks', false);
                    this.toggleRepresentation('spheres', false);
                    this.addToConsole('All representations hidden', 'success');
                }
                break;
            case 'set':
                if (args.length >= 2 && args[0].toLowerCase() === 'bgcolor') {
                    this.setBackgroundColor(args[1]);
                } else if (args.length < 2) {
                    this.addToConsole('Usage: set bgColor [color]', 'error');
                } else {
                    this.addToConsole(`Unknown set command: ${args[0]}`, 'error');
                }
                break;
            default:
                this.addToConsole(`Unknown command: ${cmd}. Type "help" for available commands.`, 'error');
        }
    }

    showHelp() {
        const commands = [
            'Available commands:',
            '  ls / dir - List available PDB files',
            '  load [name] - Load PDB file (e.g., "load 1erm")',
            '  proteins / list - List currently loaded proteins',
            '  count - Show number of loaded proteins',
            '  delete all - Remove all proteins',
            '  delete [name] - Remove specific protein (e.g., "delete 1erm.pdb")',
            '  clear console - Clear console display',
            '  help - Show this help message',
            '  history - Show command history',
            '  history clear - Clear saved command history',
            '  reset - Reset camera to default position',
            '  center - Center structure in view',
            '  set bgColor [color] - Set background color (black, white, gray, blue, red, green, darkblue, or r,g,b)',
            '',
            'Representations (PyMOL style):',
            '  cartoon - Toggle cartoon ribbons',
            '  backbone - Toggle backbone trace',
            '  sticks - Toggle ball-and-stick model (atoms + bonds)',
            '  spheres - Toggle space-filling spheres (CPK radii)',
            '  show [type] - Show specific representation',
            '  hide [type] - Hide specific representation',
            '',
            'Mouse Controls (PyMOL style):',
            '  Left click + drag - Rotate around protein',
            '  Right click + drag - Pan (translate view)',
            '  Scroll wheel - Zoom in/out',
            '',
            'Keyboard:',
            '  F2 - Hide/show console',
            '  Up/Down arrows - Navigate command history',
            '  Type any text - Goes directly to console input'
        ];

        commands.forEach(cmd => this.addToConsole(cmd, 'output'));
    }

    async listFiles() {
        try {
            this.addToConsole('Listing files in data directory...', 'output');

            const response = await fetch('/api/list-files');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.files.length === 0) {
                this.addToConsole('No PDB files found in data directory', 'output');
                return;
            }

            this.addToConsole(`Found ${data.count} PDB file(s) in ${data.directory}:`, 'output');
            this.addToConsole('', 'output'); // Empty line

            // Format file listing like Unix ls -l
            data.files.forEach(file => {
                const modDate = file.modified ? new Date(file.modified).toLocaleDateString() : 'Unknown';
                const line = `${file.sizeFormatted.padEnd(8)} ${modDate.padEnd(12)} ${file.name}`;
                this.addToConsole(`  ${line}`, 'output');
            });

            this.addToConsole('', 'output'); // Empty line
            this.addToConsole(`Use "load [filename]" to load a file (e.g., "load ${data.files[0].nameWithoutExt}")`, 'output');

        } catch (error) {
            console.error('Error listing files:', error);
            this.addToConsole(`Failed to list files: ${error.message}`, 'error');
        }
    }

    async loadProteinByName(name) {
        try {
            this.addToConsole(`Loading ${name}.pdb...`, 'output');

            const response = await fetch(`/api/load-pdb/${name}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            await this.renderer.addProtein(data.content, data.filename, false); // Don't clear existing

            // Position camera to view all proteins
            setTimeout(() => {
                if (this.renderer) {
                    this.renderer.centerAndScaleProtein();
                    this.centerStructure();
                }
            }, 500);

            this.addToConsole(`Successfully loaded ${data.filename}`, 'success');
            this.addToConsole(`Total proteins: ${this.renderer.getProteinCount()}`, 'output');

        } catch (error) {
            console.error('Error loading protein:', error);
            this.addToConsole(`Failed to load ${name}.pdb: ${error.message}`, 'error');
        }
    }


    listLoadedProteins() {
        const proteins = this.renderer.getLoadedProteins();
        if (proteins.length === 0) {
            this.addToConsole('No proteins loaded', 'output');
        } else {
            this.addToConsole(`Loaded proteins (${proteins.length}):`, 'output');
            proteins.forEach((name, index) => {
                this.addToConsole(`  ${index + 1}. ${name}`, 'output');
            });
        }
    }

    // Cleanup
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }

        if (this.engine) {
            this.engine.dispose();
        }
    }
}

// Global application instance
let app;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new ProteinViewer();
});

// Global functions are no longer needed - using command interface

// Handle unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.dispose();
    }
});

// Error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (app && app.renderer) {
        app.renderer.showError('An unexpected error occurred');
    }
});

// Debug utilities (available in console)
window.debug = {
    app: () => app,
    scene: () => app ? app.scene : null,
    renderer: () => app ? app.renderer : null,
    parser: () => app && app.renderer ? app.renderer.parser : null,
    stats: () => app && app.renderer ? app.renderer.getProteinInfo() : null
};