const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to list available PDB files
app.get('/api/list-files', (req, res) => {
    const dataDir = path.join(__dirname, 'data');

    fs.readdir(dataDir, (err, files) => {
        if (err) {
            console.error('Error reading data directory:', err);
            return res.status(500).json({ error: 'Failed to read data directory' });
        }

        // Filter for PDB files and get file info
        const pdbFiles = files
            .filter(file => file.toLowerCase().endsWith('.pdb'))
            .map(file => {
                const filePath = path.join(dataDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        nameWithoutExt: file.replace(/\.pdb$/i, ''),
                        size: stats.size,
                        modified: stats.mtime,
                        sizeFormatted: formatFileSize(stats.size)
                    };
                } catch (statErr) {
                    console.warn(`Failed to get stats for ${file}:`, statErr);
                    return {
                        name: file,
                        nameWithoutExt: file.replace(/\.pdb$/i, ''),
                        size: 0,
                        modified: null,
                        sizeFormatted: 'Unknown'
                    };
                }
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            files: pdbFiles,
            count: pdbFiles.length,
            directory: 'data/'
        });
    });
});

// Helper function to format file sizes
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// API endpoint to load specific PDB files
app.get('/api/load-pdb/:filename', (req, res) => {
    const filename = req.params.filename;
    const pdbPath = path.join(__dirname, 'data', `${filename}.pdb`);

    fs.readFile(pdbPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading PDB file:', err);
            return res.status(500).json({ error: 'Failed to load sample PDB file' });
        }

        res.json({
            filename: `${filename}.pdb`,
            content: data,
            description: `Loaded protein structure: ${filename}`
        });
    });
});

// API endpoint to upload PDB files
app.post('/api/upload-pdb', upload.single('pdbFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    fs.readFile(req.file.path, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading uploaded file:', err);
            return res.status(500).json({ error: 'Failed to read uploaded file' });
        }

        // Clean up uploaded file
        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
        });

        res.json({
            filename: req.file.originalname,
            content: data,
            description: 'Uploaded protein structure'
        });
    });
});

// API endpoint to get protein info
app.get('/api/protein-info/:filename', (req, res) => {
    // This could be extended to provide metadata about known proteins
    const proteinInfo = {
        '1erm.pdb': {
            name: 'TEM-1 Beta Lactamase',
            organism: 'Escherichia coli',
            description: 'Beta-lactamase enzyme with boronic acid inhibitor',
            resolution: '1.70 Å',
            chains: ['A'],
            technique: 'X-ray diffraction'
        }
    };

    const info = proteinInfo[req.params.filename] || {
        name: 'Unknown Protein',
        description: 'User uploaded structure'
    };

    res.json(info);
});

app.listen(PORT, () => {
    console.log(`Protein Cartoon Viewer server running on http://localhost:${PORT}`);
    console.log('Sample protein: TEM-1 Beta Lactamase (1erm.pdb)');
});
