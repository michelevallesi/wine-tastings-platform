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
const PORT = process.env.PORT || 3007;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'analytics-service' });
});

// Overall summary for a tenant
app.get('/api/analytics/summary/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const [bookings, revenue, tastings] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)                                          AS total,
           COUNT(*) FILTER (WHERE status = 'confirmed')     AS confirmed,
           COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
           COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled
         FROM bookings WHERE tenant_id = $1`,
        [tenantId]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(total_price), 0)                               AS total_revenue,
           COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid'), 0) AS collected
         FROM bookings WHERE tenant_id = $1`,
        [tenantId]
      ),
      pool.query(
        `SELECT
           COUNT(*)                                 AS total,
           COUNT(*) FILTER (WHERE is_active = true) AS active
         FROM tastings WHERE tenant_id = $1`,
        [tenantId]
      )
    ]);

    res.json({
      success: true,
      data: {
        bookings: bookings.rows[0],
        revenue:  revenue.rows[0],
        tastings: tastings.rows[0]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Summary analytics error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Daily booking counts for the last 30 days
app.get('/api/analytics/bookings/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await pool.query(
      `SELECT
         booking_date::text AS date,
         COUNT(*)           AS count,
         SUM(total_price)   AS revenue
       FROM bookings
       WHERE tenant_id = $1
         AND booking_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY booking_date
       ORDER BY booking_date`,
      [tenantId]
    );
    res.json({
      success: true,
      data: { stats: result.rows },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Booking stats error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Monthly revenue for the last 12 months
app.get('/api/analytics/revenue/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await pool.query(
      `SELECT
         DATE_TRUNC('month', booking_date)::text AS month,
         SUM(total_price)                                                    AS total,
         COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid'), 0) AS collected
       FROM bookings
       WHERE tenant_id = $1
         AND booking_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', booking_date)
       ORDER BY month`,
      [tenantId]
    );
    res.json({
      success: true,
      data: { revenue: result.rows },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Revenue stats error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  logger.info(`Analytics service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
