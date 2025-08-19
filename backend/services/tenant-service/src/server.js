const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'tenant-service'
  });
});

// Get all tenants (public)
app.get('/api/tenants', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, description, location, logo_url, website FROM tenants WHERE is_active = true ORDER BY name'
    );

    res.json({
      success: true,
      data: { tenants: result.rows }
    });

  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tenant by ID or slug
app.get('/api/tenants/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    // Check if identifier is UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const query = isUUID 
      ? 'SELECT * FROM tenants WHERE id = $1 AND is_active = true'
      : 'SELECT * FROM tenants WHERE slug = $1 AND is_active = true';

    const result = await pool.query(query, [identifier]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      success: true,
      data: { tenant: result.rows[0] }
    });

  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Tenant service running on port ${PORT}`);
});

module.exports = app;
