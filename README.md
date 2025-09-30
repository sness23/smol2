# smol2 - PyMOL-style Protein Viewer

A sophisticated protein cartoon/ribbon visualization application built with Babylon.js and Express.js, featuring PyMOL-style mouse controls and a command-line interface. Implements the same algorithms used in UCSF Chimera for high-quality molecular graphics.

## Features

### Core Visualization
- **Cartoon/Ribbon Representation**: Smooth B-spline based ribbons with proper secondary structure styling
- **Secondary Structure Detection**: Geometric analysis of protein backbone for helix/sheet/coil assignment
- **Multiple Representations**: Cartoon ribbons, backbone traces, and atom spheres
- **Color Schemes**: Secondary structure, chain-based, rainbow, and uniform coloring

### Advanced Graphics
- **High-Quality Rendering**: PBR materials with proper lighting and anti-aliasing
- **Smooth Splines**: Cubic B-spline interpolation through protein backbone
- **Level of Detail**: Adaptive mesh complexity based on viewing distance
- **Frenet Frames**: Proper ribbon orientation using tangent/normal/binormal vectors

### User Interface
- **PyMOL-style Mouse Controls**: Click-drag rotation, right-click pan, scroll zoom
- **Command Console**: Always-visible bottom console for text commands
- **File Management**: Support for PDB file upload and multiple protein loading
- **Real-time Controls**: Toggle representations and color schemes via commands
- **Command History**: Persistent command history with arrow key navigation

## Technical Implementation

### Architecture
```
Frontend (Babylon.js):
├── PDB Parser          - Parse molecular structure files
├── Secondary Structure - Geometric analysis algorithms
├── Spline Math         - B-spline mathematics for smooth curves
├── Ribbon Geometry     - 3D mesh generation from splines
├── Protein Renderer    - Main orchestration class
└── UI Application      - User interface and interactions

Backend (Express.js):
├── Static File Server  - Serve web application assets
├── PDB File API       - Handle file uploads and sample data
└── Sample Data        - Includes 1ERM.pdb test structure
```

### Key Algorithms

#### 1. Secondary Structure Detection
- **Geometric Analysis**: CA-CA distances, turn angles, and backbone curvature
- **Helix Detection**: ~3.8Å spacing with consistent ~100° turns
- **Sheet Detection**: Extended conformation with minimal turning
- **Smoothing**: Minimum length constraints and gap filling

#### 2. Ribbon Geometry Generation
- **Backbone Extraction**: CA atoms as guide curve
- **B-Spline Creation**: Smooth interpolation with phantom end points
- **Frenet Frames**: Local coordinate systems for cross-section orientation
- **Profile Extrusion**: Different profiles for helices (tubes) vs sheets (ribbons)

#### 3. Rendering Pipeline
- **Mesh Generation**: Triangle-based geometry with proper normals
- **Material Application**: PBR materials with structure-based coloring
- **Level of Detail**: Distance-based mesh simplification
- **Performance**: Instancing and batching for large structures

## Installation & Usage

### Prerequisites
- Node.js 16+
- Modern web browser with WebGL 2.0 support

### Setup
```bash
cd smol2
npm install
npm start          # Production mode
npm run dev        # Development mode with auto-restart
```

The application will start on `http://localhost:3000`

### Mouse Controls (PyMOL-style)
- **Left Click + Drag**: Rotate protein around center
- **Right Click + Drag**: Pan (translate view)
- **Scroll Wheel**: Zoom in/out

### Keyboard Input
- **All typing goes to console** - Just start typing commands
- `Up/Down Arrows` - Navigate command history
- No keyboard shortcuts - use console commands instead (e.g., `reset`, `center`)

### Command Console
The console is always visible at the bottom of the screen. Type commands directly:

```
> load 1erm              # Load protein from data directory
> cartoon                # Toggle cartoon representation
> show sticks            # Show ball-and-stick model
> bg_color white         # Set background to white
> center                 # Center structure
> help                   # Show all commands
```

### Loading Structures
1. **From data directory**: `load 1erm` (or any file in data/ folder)
2. **List available files**: `ls` or `dir`
3. **Upload PDB**: Use the file upload endpoint or add to data/ directory
4. **Multiple proteins**: Use `load` multiple times without clearing

## Sample Structure - TEM-1 Beta Lactamase (1ERM)

The included sample structure is TEM-1 Beta Lactamase, a well-characterized enzyme:
- **Resolution**: 1.70 Å
- **Technique**: X-ray crystallography
- **Organism**: Escherichia coli
- **Features**: Mixed α/β structure with clear secondary structure elements
- **Size**: ~290 residues, ideal for testing cartoon rendering

## Console Commands

Type `help` in the console for a full list of commands. Key commands:

### File Management
- `ls` / `dir` - List available PDB files in data directory
- `load [name]` - Load protein (e.g., `load 1erm`)
- `proteins` / `list` - List currently loaded proteins
- `count` - Show number of loaded proteins
- `delete all` - Remove all proteins
- `delete [name]` - Remove specific protein

### Representations
- `cartoon` - Toggle cartoon ribbons
- `backbone` - Toggle backbone trace
- `sticks` - Toggle ball-and-stick model
- `spheres` - Toggle space-filling spheres
- `show [type]` - Show specific representation
- `hide [type]` - Hide specific representation

### View Control
- `reset` - Reset camera to default position
- `center` - Center structure in view
- `bg_color [color]` - Set background (black, white, gray, blue, red, green, darkblue, or r,g,b values)

### Utilities
- `clear console` - Clear console output
- `history` - Show command history
- `history clear` - Clear saved history

## API Endpoints

### GET /api/list-files
List all PDB files in the data directory

### GET /api/load-pdb/:filename
Load specific PDB file from data directory

### POST /api/upload-pdb
Upload PDB file for visualization:
- **Body**: multipart/form-data with 'pdbFile' field
- **Returns**: Protein content for rendering

### GET /api/protein-info/:filename
Get metadata about protein structures

## Implementation Details

### Cartoon Rendering Algorithm

1. **Parse PDB Structure**:
   ```javascript
   const parser = new PDBParser();
   parser.parse(pdbText);
   ```

2. **Assign Secondary Structure**:
   ```javascript
   const analyzer = new SecondaryStructureAnalyzer();
   analyzer.analyzeChain(residues);
   ```

3. **Create Backbone Spline**:
   ```javascript
   const spline = BSplineCurve.createProteinBackbone(caAtoms);
   ```

4. **Generate Ribbon Geometry**:
   ```javascript
   const generator = new RibbonGeometryGenerator(scene);
   const meshes = generator.generateRibbon(parser, chainId);
   ```

### Performance Optimizations

- **Geometry Batching**: Group ribbon segments to reduce draw calls
- **Level of Detail**: Adaptive mesh complexity based on camera distance
- **Material Sharing**: Reuse materials for same secondary structure types
- **Culling**: Frustum culling for off-screen geometry
- **Instancing**: Efficient rendering of repeated elements

### Browser Compatibility

- **Chrome 90+**: Full support with hardware acceleration
- **Firefox 88+**: Full support with hardware acceleration
- **Safari 14+**: Full support (may require WebGL 2.0 enabling)
- **Edge 90+**: Full support with hardware acceleration

### Memory Usage

Typical memory usage for medium-sized proteins (~300 residues):
- **Geometry**: ~2-5 MB for ribbon meshes
- **Textures**: ~1 MB for materials and environments
- **Total**: ~10-20 MB including Babylon.js engine

## Development

### Project Structure
```
smol2/
├── server.js                      # Express.js server
├── package.json                   # Dependencies
├── data/                          # Sample PDB files
│   ├── 1erm.pdb
│   ├── 2erm.pdb
│   └── 3erm.pdb
├── public/
│   ├── index.html                 # Main application page
│   └── js/
│       ├── pdb-parser.js          # PDB file parsing
│       ├── secondary-structure.js # Structure analysis
│       ├── spline-math.js         # B-spline mathematics
│       ├── ribbon-geometry.js     # 3D geometry generation
│       ├── protein-renderer.js    # Main renderer class
│       └── app.js                 # UI with command console
└── uploads/                       # Temporary file storage
```

### Adding New Features

1. **New Color Schemes**: Extend `RibbonGeometryGenerator.applyColorScheme()`
2. **Additional Representations**: Add methods to `ProteinRenderer`
3. **File Formats**: Extend `PDBParser` or create new parsers
4. **Analysis Tools**: Add measurement/analysis functions

### Debugging

Access debug utilities in browser console:
```javascript
debug.app()      // Application instance
debug.scene()    // Babylon.js scene
debug.renderer() // Protein renderer
debug.parser()   // PDB parser data
debug.stats()    // Rendering statistics
```

### Key Differences from Original Version

**smol2** is a major architectural redesign:
- **Camera**: ArcRotateCamera (PyMOL-style) instead of UniversalCamera (FPS-style)
- **Input**: All keyboard input goes to console, no keyboard shortcuts at all
- **Console**: Always visible at bottom (5 lines) instead of full-screen toggle
- **Mouse**: Click-drag rotation instead of pointer-lock FPS controls
- **Philosophy**: Pure command-driven workflow like PyMOL, no game-style navigation or hotkeys

## Comparison with Chimera

This implementation closely follows Chimera's cartoon rendering pipeline:

| Feature | Chimera | This Implementation |
|---------|---------|-------------------|
| Spline Type | Cubic B-spline | Cubic B-spline |
| Secondary Structure | DSSP + Geometry | Geometry-based |
| Ribbon Profiles | Multiple shapes | Helix/Sheet/Coil |
| Frame Calculation | Frenet frames | Frenet frames |
| LOD Support | Yes | Yes |
| Material System | OpenGL | PBR (Babylon.js) |

## Future Enhancements

- **DSSP Integration**: More sophisticated secondary structure assignment
- **Surface Rendering**: Molecular surface visualization
- **Animation Support**: Conformational change animations
- **Stereo Rendering**: VR/AR support
- **Advanced Analysis**: Geometric measurements and analysis tools
- **Export Features**: High-resolution image and model export

## License

MIT License - See LICENSE file for details

## Acknowledgments

- **UCSF Chimera**: Algorithm inspiration and reference implementation
- **Babylon.js**: Excellent 3D graphics framework
- **PDB Format**: Standard format for molecular structure data
- **1ERM Structure**: Strynadka et al., Nature Structural Biology (1996)