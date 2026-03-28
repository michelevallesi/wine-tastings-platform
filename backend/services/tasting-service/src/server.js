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
const PORT = process.env.PORT || 3003;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'tasting-service' });
});

// List tastings by tenant
app.get('/api/tastings/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await pool.query(
      'SELECT * FROM tastings WHERE tenant_id = $1 AND is_active = true ORDER BY name',
      [tenantId]
    );
    res.json({ success: true, data: { tastings: result.rows }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('List tastings error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get single tasting
app.get('/api/tastings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM tastings WHERE id = $1 AND is_active = true',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tasting not found' });
    }
    res.json({ success: true, data: { tasting: result.rows[0] }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Get tasting error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create tasting
app.post('/api/tastings', async (req, res) => {
  try {
    const {
      tenant_id, name, slug, description, wines, price, currency,
      max_participants, duration_hours, available_days, time_slots, image_url
    } = req.body;

    if (!tenant_id || !name || !slug || price == null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenant_id, name, slug, price'
      });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ success: false, error: 'price must be a non-negative number' });
    }

    const result = await pool.query(
      `INSERT INTO tastings
         (tenant_id, name, slug, description, wines, price, currency,
          max_participants, duration_hours, available_days, time_slots, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        tenant_id, name, slug, description || null,
        JSON.stringify(wines || []), price, currency || 'EUR',
        max_participants || 10, duration_hours || 1.5,
        JSON.stringify(available_days || []), JSON.stringify(time_slots || []),
        image_url || null
      ]
    );
    res.status(201).json({
      success: true,
      data: { tasting: result.rows[0] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A tasting with this slug already exists for this tenant'
      });
    }
    logger.error('Create tasting error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update tasting
app.put('/api/tastings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, wines, price, currency,
      max_participants, duration_hours, available_days, time_slots, image_url, is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE tastings SET
         name            = COALESCE($1,  name),
         description     = COALESCE($2,  description),
         wines           = COALESCE($3,  wines),
         price           = COALESCE($4,  price),
         currency        = COALESCE($5,  currency),
         max_participants= COALESCE($6,  max_participants),
         duration_hours  = COALESCE($7,  duration_hours),
         available_days  = COALESCE($8,  available_days),
         time_slots      = COALESCE($9,  time_slots),
         image_url       = COALESCE($10, image_url),
         is_active       = COALESCE($11, is_active)
       WHERE id = $12 RETURNING *`,
      [
        name, description,
        wines != null ? JSON.stringify(wines) : null,
        price, currency, max_participants, duration_hours,
        available_days != null ? JSON.stringify(available_days) : null,
        time_slots     != null ? JSON.stringify(time_slots)     : null,
        image_url, is_active, id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tasting not found' });
    }
    res.json({ success: true, data: { tasting: result.rows[0] }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Update tasting error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Soft-delete tasting
app.delete('/api/tastings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE tastings SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tasting not found' });
    }
    res.json({ success: true, message: 'Tasting deactivated', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Delete tasting error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  logger.info(`Tasting service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
