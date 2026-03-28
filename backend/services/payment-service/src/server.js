const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');
const { randomUUID } = require('crypto');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3005;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'payment-service' });
});

// Process payment
app.post('/api/payments/process', async (req, res) => {
  try {
    const { booking_id, amount, currency, payment_method, payment_provider } = req.body;

    if (!booking_id || amount == null || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: booking_id, amount, payment_method'
      });
    }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }

    const bookingResult = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [booking_id]
    );
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    if (bookingResult.rows[0].payment_status === 'paid') {
      return res.status(409).json({ success: false, error: 'Booking is already paid' });
    }

    const transaction_id = `TXN-${randomUUID()}`;

    const paymentResult = await pool.query(
      `INSERT INTO payments
         (booking_id, amount, currency, payment_method, payment_provider, transaction_id, status, processed_at)
       VALUES ($1,$2,$3,$4,$5,$6,'paid',NOW()) RETURNING *`,
      [booking_id, amount, currency || 'EUR', payment_method, payment_provider || 'manual', transaction_id]
    );

    await pool.query(
      `UPDATE bookings SET payment_status = 'paid', status = 'confirmed', payment_reference = $1
       WHERE id = $2`,
      [transaction_id, booking_id]
    );

    logger.info('Payment processed', { booking_id, transaction_id });
    res.json({
      success: true,
      data: { payment: paymentResult.rows[0] },
      message: 'Payment processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Process payment error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get payments by booking ID (protected)
app.get('/api/payments/:bookingId', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const result = await pool.query(
      'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC',
      [bookingId]
    );
    res.json({
      success: true,
      data: { payments: result.rows },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get payments error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Refund (protected)
app.post('/api/payments/refund', requireAuth, async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) {
      return res.status(400).json({ success: false, error: 'booking_id is required' });
    }

    const paymentResult = await pool.query(
      `SELECT * FROM payments WHERE booking_id = $1 AND status = 'paid'
       ORDER BY created_at DESC LIMIT 1`,
      [booking_id]
    );
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No paid payment found for this booking' });
    }

    await pool.query('UPDATE payments SET status = $1 WHERE id = $2', ['refunded', paymentResult.rows[0].id]);
    await pool.query(
      `UPDATE bookings SET payment_status = 'refunded', status = 'cancelled' WHERE id = $1`,
      [booking_id]
    );

    logger.info('Refund processed', { booking_id });
    res.json({
      success: true,
      message: 'Refund processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Refund error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  logger.info(`Payment service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
