# Protein Cartoon Viewer - Babylon.js Implementation

A sophisticated protein cartoon/ribbon visualization application built with Babylon.js and Express.js, implementing the same algorithms used in UCSF Chimera for high-quality molecular graphics.

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
- **Interactive 3D Viewer**: Mouse controls for rotation, zoom, and pan
- **File Upload**: Support for PDB file upload and processing
- **Real-time Controls**: Toggle representations and color schemes on-the-fly
- **Keyboard Shortcuts**: Quick access to common functions

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
cd protein-viewer
npm install
npm start
```

The application will start on `http://localhost:3000`

### Controls
- **Mouse**: Look around (free look, like FPS games)
- **Movement Keys (Descent 2 style 6DOF)**:
  - `W` - Move forward
  - `S` - Move backward
  - `A` - Strafe left
  - `D` - Strafe right
  - `Q` - Move down
  - `E` - Move up
- **Other Keyboard Shortcuts**:
  - `R` - Reset camera view
  - `C` - Center structure
  - `1` - Toggle cartoon representation
  - `2` - Toggle backbone trace
  - `3` - Toggle atom spheres
  - `F` - Toggle fullscreen

### Loading Structures
1. **Sample Protein**: Click "Load Sample (1ERM)" to load TEM-1 Beta Lactamase
2. **Upload PDB**: Use file input to upload your own PDB files
3. **Supported Formats**: Standard PDB format files (.pdb extension)

## Sample Structure - TEM-1 Beta Lactamase (1ERM)

The included sample structure is TEM-1 Beta Lactamase, a well-characterized enzyme:
- **Resolution**: 1.70 Å
- **Technique**: X-ray crystallography
- **Organism**: Escherichia coli
- **Features**: Mixed α/β structure with clear secondary structure elements
- **Size**: ~290 residues, ideal for testing cartoon rendering

## API Endpoints

### GET /api/sample-pdb
Returns the sample 1ERM structure:
```json
{
  "filename": "1erm.pdb",
  "content": "HEADER    HYDROLASE...",
  "description": "TEM-1 Beta Lactamase - Sample protein structure"
}
```

### POST /api/upload-pdb
Upload PDB file for visualization:
- **Body**: multipart/form-data with 'pdbFile' field
- **Returns**: Same format as sample-pdb endpoint

### GET /api/protein-info/:filename
Get metadata about protein structures (extensible for future features)

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
protein-viewer/
├── server.js              # Express.js server
├── package.json           # Dependencies
├── public/
│   ├── index.html         # Main application page
│   └── js/
│       ├── pdb-parser.js      # PDB file parsing
│       ├── spline-math.js     # B-spline mathematics
│       ├── ribbon-geometry.js # 3D geometry generation
│       ├── protein-renderer.js # Main renderer class
│       ├── secondary-structure.js # Structure analysis
│       └── app.js            # UI application logic
└── uploads/               # Temporary file storage
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
debug.parser()   // PDB parser data
debug.stats()    // Rendering statistics
```

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