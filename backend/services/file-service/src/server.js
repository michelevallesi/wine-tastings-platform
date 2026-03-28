const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3008;
const STORAGE_PATH = process.env.FILE_STORAGE_PATH || '/uploads';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date().toISOString() });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token', timestamp: new Date().toISOString() });
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

// Ensure upload directory exists at startup
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'
]);

const storage = multer.diskStorage({
  destination: STORAGE_PATH,
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'file-service' });
});

// Upload a file (protected)
app.post('/api/files/upload', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }
    const { tenant_id, user_id } = req.body;
    const result = await pool.query(
      `INSERT INTO files
         (tenant_id, uploaded_by, filename, original_name, mime_type, file_size, file_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        tenant_id   || null,
        user_id     || null,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path
      ]
    );
    logger.info('File uploaded', { filename: req.file.filename, size: req.file.size });
    res.status(201).json({
      success: true,
      data: { file: result.rows[0] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Upload error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get file metadata
app.get('/api/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.json({ success: true, data: { file: result.rows[0] }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Get file error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete file (protected)
app.delete('/api/files/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM files WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const filePath = result.rows[0].file_path;
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    logger.info('File deleted', { id });
    res.json({ success: true, message: 'File deleted', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Delete file error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  logger.info(`File service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
