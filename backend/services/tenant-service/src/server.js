const express = require('express');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3002;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'tenant-service' });
});

// GET /api/tenants — list all active tenants (public)
app.get('/api/tenants', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, description, location, logo_url, website FROM tenants WHERE is_active = true ORDER BY name'
    );
    res.json({
      success: true,
      data: { tenants: result.rows },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get tenants error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/tenants/:identifier — get by UUID or slug (public)
// Uses a single query: UUID format is detected via regex to choose the right
// indexed column. The regex only validates format (8-4-4-4-12 hex), which is
// sufficient to distinguish UUIDs from human-readable slugs.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.get('/api/tenants/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const isUUID = UUID_REGEX.test(identifier);
    const query = isUUID
      ? 'SELECT * FROM tenants WHERE id = $1 AND is_active = true'
      : 'SELECT * FROM tenants WHERE slug = $1 AND is_active = true';

    const result = await pool.query(query, [identifier]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    res.json({
      success: true,
      data: { tenant: result.rows[0] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get tenant error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/tenants/:id — update tenant profile (authenticated producers)
app.put('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'Invalid tenant ID' });
    }

    const { name, description, location, email, phone, website, logo_url } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const result = await pool.query(
      `UPDATE tenants
       SET name = $1, description = $2, location = $3, email = $4,
           phone = $5, website = $6, logo_url = $7, updated_at = NOW()
       WHERE id = $8 AND is_active = true
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        location?.trim() || null,
        email?.trim() || null,
        phone?.trim() || null,
        website?.trim() || null,
        logo_url?.trim() || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    res.json({
      success: true,
      data: { tenant: result.rows[0] },
      message: 'Tenant updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Update tenant error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  logger.info(`Tenant service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
