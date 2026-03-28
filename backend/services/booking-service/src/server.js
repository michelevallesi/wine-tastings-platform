const express = require('express');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const { randomUUID } = require('crypto');
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
const PORT = process.env.PORT || 3004;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

app.use(helmet());
app.use(cors());
app.use(express.json());

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false, error: 'Authentication required', timestamp: new Date().toISOString()
    });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      success: false, error: 'Invalid or expired token', timestamp: new Date().toISOString()
    });
  }
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'booking-service' });
});

// ── GET /api/bookings/:id/qrcode  (public — customer scans QR) ───────────────
app.get('/api/bookings/:id/qrcode', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT qr_code FROM bookings WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    const qrImageData = await QRCode.toDataURL(`BOOKING:${id}:${result.rows[0].qr_code}`);
    res.json({ success: true, data: { qr_code_image: qrImageData }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('QR code error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/bookings  (public — customer self-service) ─────────────────────
// Uses a serializable transaction with SELECT FOR UPDATE on the tasting row
// to prevent concurrent overselling of the same time-slot.
app.post('/api/bookings', async (req, res) => {
  const {
    tasting_id, customer_name, customer_email, customer_phone,
    booking_date, booking_time, participants, special_requests
  } = req.body;

  // ── Validation (before acquiring DB connection) ──────────────────────────
  if (!tasting_id || !customer_name || !customer_email || !booking_date || !booking_time) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: tasting_id, customer_name, customer_email, booking_date, booking_time'
    });
  }
  if (!EMAIL_REGEX.test(customer_email)) {
    return res.status(400).json({ success: false, error: 'Invalid customer_email format' });
  }
  const numParticipants = parseInt(participants, 10);
  if (!numParticipants || numParticipants < 1) {
    return res.status(400).json({ success: false, error: 'participants must be a positive integer' });
  }
  const parsedDate = new Date(booking_date);
  if (isNaN(parsedDate.getTime()) || parsedDate < new Date(new Date().toDateString())) {
    return res.status(400).json({ success: false, error: 'booking_date must be today or a future date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the tasting row — prevents two concurrent requests from both
    // reading the same available capacity before either inserts.
    const tastingResult = await client.query(
      'SELECT * FROM tastings WHERE id = $1 AND is_active = true FOR UPDATE',
      [tasting_id]
    );
    if (tastingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Tasting not found or not available' });
    }
    const tasting = tastingResult.rows[0];

    if (numParticipants > tasting.max_participants) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `participants cannot exceed max allowed (${tasting.max_participants})`
      });
    }

    // Capacity check — runs inside the same transaction after the lock
    const capacityResult = await client.query(
      `SELECT COALESCE(SUM(participants), 0) AS booked
       FROM bookings
       WHERE tasting_id = $1 AND booking_date = $2 AND booking_time = $3
         AND status <> 'cancelled'`,
      [tasting_id, booking_date, booking_time]
    );
    const alreadyBooked = parseInt(capacityResult.rows[0].booked, 10);
    if (alreadyBooked + numParticipants > tasting.max_participants) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `Not enough capacity. Available: ${tasting.max_participants - alreadyBooked}`
      });
    }

    const total_price = parseFloat(tasting.price) * numParticipants;
    const qr_code = `QR-${randomUUID()}`;

    const result = await client.query(
      `INSERT INTO bookings
         (tasting_id, tenant_id, customer_name, customer_email, customer_phone,
          booking_date, booking_time, participants, total_price, currency, qr_code, special_requests)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        tasting_id, tasting.tenant_id, customer_name, customer_email, customer_phone || null,
        booking_date, booking_time, numParticipants, total_price, tasting.currency || 'EUR',
        qr_code, special_requests || null
      ]
    );

    await client.query('COMMIT');

    const booking = result.rows[0];

    // Generate QR image after commit — failure here doesn't roll back the booking
    let qr_code_image = null;
    try {
      qr_code_image = await QRCode.toDataURL(`BOOKING:${booking.id}:${qr_code}`);
    } catch (qrErr) {
      logger.error('QR image generation failed', { error: qrErr.message, bookingId: booking.id });
    }

    logger.info('Booking created', { bookingId: booking.id, tenantId: tasting.tenant_id });
    res.status(201).json({
      success: true,
      data: { booking, qr_code_image },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Create booking error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/bookings/:id  (protected) ───────────────────────────────────────
app.get('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT b.*, t.name AS tasting_name, tn.name AS tenant_name
       FROM bookings b
       JOIN tastings  t  ON b.tasting_id = t.id
       JOIN tenants   tn ON b.tenant_id  = tn.id
       WHERE b.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: { booking: result.rows[0] }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Get booking error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── PATCH /api/bookings/:id  (protected) ─────────────────────────────────────
app.patch('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const VALID_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }
    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: { booking: result.rows[0] }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Update booking error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/bookings/tenant/:tenantId  (protected) ──────────────────────────
app.get('/api/bookings/tenant/:tenantId', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { status, date } = req.query;
    const params = [tenantId];
    const conditions = ['b.tenant_id = $1'];
    if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
    if (date)   { params.push(date);   conditions.push(`b.booking_date = $${params.length}`); }

    const result = await pool.query(
      `SELECT b.*, t.name AS tasting_name
       FROM bookings b
       JOIN tastings t ON b.tasting_id = t.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.booking_date DESC, b.booking_time DESC`,
      params
    );
    res.json({ success: true, data: { bookings: result.rows }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('List bookings error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  logger.info(`Booking service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
