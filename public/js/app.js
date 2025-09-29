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

        // Command console state
        this.consoleOpen = false;
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

        // Create UniversalCamera for 6DOF movement like Descent 2
        this.camera = new BABYLON.UniversalCamera(
            'camera',
            new BABYLON.Vector3(0, 0, -50),
            this.scene
        );

        // Set initial camera orientation to look at origin
        this.camera.setTarget(BABYLON.Vector3.Zero());

        // Configure movement speeds (like Descent 2)
        this.camera.speed = 2.0;          // Movement speed (increased for faster movement)
        this.camera.angularSensibility = 2000; // Mouse sensitivity

        // Set canvas as focusable for keyboard input
        this.canvas.tabIndex = 1;
        this.canvas.focus();

        // Setup mouse look controls manually
        this.setupMouseLook();

        // Track key states for smooth movement (all 6DOF keys)
        this.keyStates = {
            w: false,  // Move forward
            s: false,  // Move backward
            a: false,  // Strafe left
            d: false,  // Strafe right
            q: false,  // Move down
            e: false,  // Move up
            j: false,  // Mouse left (vi keys shifted one over)
            k: false,  // Mouse down
            l: false,  // Mouse right
            i: false,  // Mouse up (alternative to ;)
            ';': false // Mouse up
        };

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

    setupEventHandlers() {
        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Handle canvas focus for keyboard events
        this.canvas.addEventListener('click', () => {
            this.canvas.focus();
            console.log('Canvas focused for keyboard input');
        });

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Handle camera movement for LOD updates
        this.camera.onViewMatrixChangedObservable.add(() => {
            if (this.renderer) {
                this.renderer.updateLOD();
            }
        });
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();

        // Handle Enter key for console toggle (highest priority)
        if (event.key === 'Enter') {
            // Don't process Enter if console is open (let console handle it)
            if (!this.consoleOpen) {
                this.toggleConsole();
                event.preventDefault();
            }
            return;
        }

        // Handle Escape key to close console
        if (event.key === 'Escape') {
            if (this.consoleOpen) {
                this.toggleConsole();
                event.preventDefault();
            }
            return;
        }

        // Don't process other keys if console is open
        if (this.consoleOpen) {
            return;
        }

        console.log('Key pressed:', key);

        // Handle continuous movement keys
        if (key in this.keyStates) {
            this.keyStates[key] = true;
            console.log(`${key.toUpperCase()} key down`);
            event.preventDefault();
        }

        // Handle single-press actions
        switch (key) {
            case 'r':
                if (this.renderer) this.renderer.resetCamera();
                break;
            case 'c':
                if (this.renderer) this.renderer.centerStructure();
                break;
            case '1':
                this.toggleRepresentation('cartoon');
                break;
            case '2':
                this.toggleRepresentation('backbone');
                break;
            case '3':
                this.toggleRepresentation('atoms');
                break;
            case 'f':
                this.toggleFullscreen();
                break;
        }
    }

    handleKeyUp(event) {
        const key = event.key.toLowerCase();

        // Don't process keys if console is open
        if (this.consoleOpen) {
            return;
        }

        if (key in this.keyStates) {
            this.keyStates[key] = false;
            console.log(`${key.toUpperCase()} key up`);
            event.preventDefault();
        }
    }

    // Update camera position based on key states (called in render loop)
    updateMovement() {
        const moveSpeed = this.camera.speed * 0.3;

        // Get camera's forward direction based on current rotation
        const yaw = this.camera.rotation.y;
        const pitch = this.camera.rotation.x;

        // Calculate forward and right vectors based on camera rotation
        const forward = new BABYLON.Vector3(
            Math.sin(yaw) * Math.cos(pitch),
            -Math.sin(pitch),
            Math.cos(yaw) * Math.cos(pitch)
        );

        const right = new BABYLON.Vector3(
            Math.cos(yaw),
            0,
            -Math.sin(yaw)
        );

        const up = new BABYLON.Vector3(0, 1, 0); // World up

        if (this.keyStates.w) {
            // Move forward in the direction you're looking
            this.camera.position.addInPlace(forward.scale(moveSpeed));
        }
        if (this.keyStates.s) {
            // Move backward from the direction you're looking
            this.camera.position.addInPlace(forward.scale(-moveSpeed));
        }
        if (this.keyStates.a) {
            // Strafe left
            this.camera.position.addInPlace(right.scale(-moveSpeed));
        }
        if (this.keyStates.d) {
            // Strafe right
            this.camera.position.addInPlace(right.scale(moveSpeed));
        }
        if (this.keyStates.q) {
            // Move down (Descent 2 style)
            this.camera.position.addInPlace(up.scale(-moveSpeed));
        }
        if (this.keyStates.e) {
            // Move up (Descent 2 style)
            this.camera.position.addInPlace(up.scale(moveSpeed));
        }

        // Handle keyboard mouse movement (jkl; keys - vi keys shifted one over)
        this.updateKeyboardMouse();
    }

    // Update camera rotation based on keyboard mouse movement (jkl; keys)
    updateKeyboardMouse() {
        const mouseSensitivity = 0.017; // Sensitivity for keyboard mouse movement (1/3 of original 0.05)
        let deltaX = 0;
        let deltaY = 0;

        // Calculate mouse movement based on key states
        if (this.keyStates.j) {
            deltaX -= mouseSensitivity; // Look left
        }
        if (this.keyStates[';']) {
            deltaX += mouseSensitivity; // Look right
        }
        if (this.keyStates.k) {
            deltaY += mouseSensitivity; // Look down
        }
        if (this.keyStates.l || this.keyStates.i) {
            deltaY -= mouseSensitivity; // Look up
        }

        // Apply mouse movement if any keys are pressed
        if (deltaX !== 0 || deltaY !== 0) {
            // Get current rotation
            const yaw = this.camera.rotation.y;
            const pitch = this.camera.rotation.x;

            // Apply movement
            const newYaw = yaw + deltaX;
            const newPitch = pitch + deltaY;

            // Clamp pitch to prevent camera flipping
            const clampedPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, newPitch));

            // Set new rotation
            this.camera.rotation.y = newYaw;
            this.camera.rotation.x = clampedPitch;

            // Update camera direction for movement calculations
            this.updateCameraDirection();
        }
    }

    startRenderLoop() {
        this.engine.runRenderLoop(() => {
            // Update movement based on key states
            this.updateMovement();

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

    // Setup mouse look controls
    setupMouseLook() {
        this.mouseX = 0;
        this.mouseY = 0;
        this.isPointerLocked = false;

        // Click to enable pointer lock
        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
                                           this.canvas.mozRequestPointerLock ||
                                           this.canvas.webkitRequestPointerLock;
            if (this.canvas.requestPointerLock) {
                this.canvas.requestPointerLock();
            }
        });

        // Handle pointer lock changes
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange(), false);
        document.addEventListener('mozpointerlockchange', () => this.onPointerLockChange(), false);
        document.addEventListener('webkitpointerlockchange', () => this.onPointerLockChange(), false);

        // Mouse movement handling
        document.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
    }

    onPointerLockChange() {
        this.isPointerLocked = document.pointerLockElement === this.canvas ||
                              document.mozPointerLockElement === this.canvas ||
                              document.webkitPointerLockElement === this.canvas;

        if (this.isPointerLocked) {
            console.log('Mouse look enabled - move mouse to look around');
        } else {
            console.log('Mouse look disabled - click canvas to re-enable');
        }
    }

    onMouseMove(event) {
        if (!this.isPointerLocked || this.consoleOpen) return;

        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        // Apply mouse look - Descent/FPS style
        const sensitivity = 0.003;

        // Get current rotation
        const yaw = this.camera.rotation.y;
        const pitch = this.camera.rotation.x;

        // Apply mouse movement (reversed for natural feel)
        const newYaw = yaw + movementX * sensitivity;
        const newPitch = pitch + movementY * sensitivity;

        // Clamp pitch to prevent camera flipping
        const clampedPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, newPitch));

        // Set new rotation
        this.camera.rotation.y = newYaw;
        this.camera.rotation.x = clampedPitch;

        // Update camera direction for movement calculations
        this.updateCameraDirection();
    }

    updateCameraDirection() {
        // This ensures WASD movement works relative to where you're looking
        const direction = new BABYLON.Vector3(0, 0, 1);
        const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(this.camera.rotation.y, this.camera.rotation.x, this.camera.rotation.z);
        this.camera._cameraDirection = BABYLON.Vector3.TransformCoordinates(direction, rotationMatrix);
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

        commandInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const command = commandInput.value.trim();
                if (command === '') {
                    // Empty command - close console
                    this.toggleConsole();
                } else {
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
    }

    toggleConsole() {
        const console = document.getElementById('commandConsole');
        const commandInput = document.getElementById('commandInput');

        this.consoleOpen = !this.consoleOpen;

        if (this.consoleOpen) {
            console.style.display = 'block';
            commandInput.focus();
            this.addToConsole('Console opened. Type "help" for commands.', 'success');
        } else {
            console.style.display = 'none';
            this.canvas.focus(); // Return focus to canvas for movement
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
            case 'bg_color':
                if (args.length > 0) {
                    this.setBackgroundColor(args[0]);
                } else {
                    this.addToConsole('Usage: bg_color [black|white|gray|blue|red|green] or bg_color [r,g,b]', 'error');
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
            '  bg_color [color] - Set background color (black, white, gray, blue, red, green, darkblue, or r,g,b)',
            '',
            'Representations (PyMOL style):',
            '  cartoon - Toggle cartoon ribbons',
            '  backbone - Toggle backbone trace',
            '  sticks - Toggle ball-and-stick model (atoms + bonds)',
            '  spheres - Toggle space-filling spheres (CPK radii)',
            '  show [type] - Show specific representation',
            '  hide [type] - Hide specific representation',
            '',
            'Movement:',
            '  WASD - Move around',
            '  QE - Move up/down',
            '  Mouse - Look around',
            '  jkl; - Keyboard mouse look (vi keys shifted)',
            '  Up/Down arrows - Navigate command history',
            '  Enter - Open/close console',
            '  Escape - Close console'
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