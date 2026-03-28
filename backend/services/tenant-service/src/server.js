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
app.get('/api/tenants/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    // Delegate UUID vs slug detection to PostgreSQL to avoid fragile regex
    // Try UUID first; if the cast fails (invalid UUID format) fall through to slug lookup
    let result = await pool.query(
      `SELECT * FROM tenants WHERE id::text = $1 AND is_active = true`,
      [identifier]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        'SELECT * FROM tenants WHERE slug = $1 AND is_active = true',
        [identifier]
      );
    }

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
