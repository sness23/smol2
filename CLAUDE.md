# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A sophisticated protein cartoon/ribbon visualization application built with **Babylon.js** frontend and **Express.js** backend. Implements the same algorithms used in UCSF Chimera for high-quality molecular graphics.

## Development Commands

### Starting the Application
```bash
npm start              # Production server (node server.js)
npm run dev           # Development with auto-restart (nodemon)
```

The application runs on `http://localhost:3000`

### Installation
```bash
npm install           # Install all dependencies
```

## Architecture Overview

### Frontend Architecture (Babylon.js)
- **PDBParser** (`public/js/pdb-parser.js`) - Parses PDB molecular structure files
- **SecondaryStructureAnalyzer** (`public/js/secondary-structure.js`) - Geometric analysis for helix/sheet/coil assignment
- **BSplineCurve** (`public/js/spline-math.js`) - B-spline mathematics for smooth protein backbone curves
- **RibbonGeometryGenerator** (`public/js/ribbon-geometry.js`) - 3D mesh generation from splines using Frenet frames
- **ProteinRenderer** (`public/js/protein-renderer.js`) - Main orchestration class for protein visualization
- **ProteinViewer** (`public/js/app.js`) - UI application with command console interface

### Backend Architecture (Express.js)
- **Static File Server** - Serves web application assets from `public/`
- **PDB File API** - Handles file uploads and serves sample data from `data/`
- **Upload Handler** - Processes PDB file uploads via multer

### Data Flow
1. PDB files loaded via API (`/api/load-pdb/:filename` or `/api/upload-pdb`)
2. PDBParser extracts atoms, residues, and chains
3. SecondaryStructureAnalyzer assigns protein secondary structure
4. BSplineCurve creates smooth backbone interpolation
5. RibbonGeometryGenerator creates 3D meshes with proper cross-sections
6. ProteinRenderer applies materials and handles rendering state

## Key Technical Details

### Cartoon Rendering Pipeline
The application implements UCSF Chimera's cartoon rendering approach:
- **B-spline interpolation** through CA atoms for smooth backbone curves
- **Frenet frame calculation** for proper ribbon orientation (tangent/normal/binormal vectors)
- **Secondary structure-specific profiles**: tubes for helices, ribbons for sheets
- **Level of detail** with adaptive mesh complexity

### File Structure
```
protein-viewer/
├── server.js                    # Express server with PDB file APIs
├── package.json                # Node.js dependencies
├── data/                       # Sample PDB files (1erm.pdb, 2erm.pdb, 3erm.pdb)
├── public/
│   ├── index.html              # Main application page
│   └── js/
│       ├── pdb-parser.js       # PDB file parsing and structure extraction
│       ├── secondary-structure.js # Geometric secondary structure analysis
│       ├── spline-math.js      # B-spline mathematics for backbone curves
│       ├── ribbon-geometry.js  # 3D geometry generation with Frenet frames
│       ├── protein-renderer.js # Main rendering orchestration
│       └── app.js             # UI application with command console
└── uploads/                    # Temporary storage for uploaded files
```

### Dependencies
- **Backend**: express, cors, multer, nodemon (dev)
- **Frontend**: Babylon.js (CDN) - 3D graphics engine with materials and GUI libraries

### API Endpoints
- `GET /api/list-files` - List available PDB files in data directory
- `GET /api/load-pdb/:filename` - Load specific PDB file from data directory
- `POST /api/upload-pdb` - Upload PDB file for visualization
- `GET /api/protein-info/:filename` - Get metadata about protein structures

### Sample Data
The `data/` directory contains sample PDB files:
- **1erm.pdb** - TEM-1 Beta Lactamase (primary test structure)
- **2erm.pdb, 3erm.pdb** - Additional test structures

### User Interface
- **3D Viewer**: Babylon.js canvas with mouse/keyboard controls
- **Command Console**: Minecraft-style command interface (toggle with `/` key)
- **Keyboard Controls**: WASD movement, QE up/down, R reset camera, number keys for representations

## Development Guidelines

### Adding New Features
- **Color Schemes**: Extend `RibbonGeometryGenerator.applyColorScheme()`
- **Representations**: Add methods to `ProteinRenderer` class
- **File Formats**: Extend `PDBParser` or create new parser classes
- **Analysis Tools**: Add measurement/analysis functions to appropriate modules

### Code Conventions
- ES6 classes for main components
- Babylon.js for all 3D graphics operations
- Console logging for debugging and status updates
- Async/await for file operations and API calls
- Modular JavaScript architecture with clear separation of concerns

### Testing
No formal test framework is configured. Test by:
1. Loading sample proteins via the interface
2. Uploading custom PDB files
3. Verifying cartoon rendering quality and performance
4. Testing keyboard controls and command console functionality