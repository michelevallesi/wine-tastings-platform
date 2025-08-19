const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3004;

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
    service: 'booking-service'
  });
});

// Create booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { tasting_id, customer_name, customer_email, booking_date, booking_time, participants } = req.body;

    // Validation
    if (!tasting_id || !customer_name || !customer_email || !booking_date || !booking_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get tasting details
    const tastingResult = await pool.query(
      'SELECT * FROM tastings WHERE id = $1 AND is_active = true',
      [tasting_id]
    );

    if (tastingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tasting not found' });
    }

    const tasting = tastingResult.rows[0];
    const total_price = tasting.price * participants;

    // Generate QR code
    const qr_code = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create booking
    const result = await pool.query(
      `INSERT INTO bookings (tasting_id, tenant_id, customer_name, customer_email, 
       booking_date, booking_time, participants, total_price, qr_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tasting_id, tasting.tenant_id, customer_name, customer_email, 
       booking_date, booking_time, participants, total_price, qr_code]
    );

    const booking = result.rows[0];

    // Generate QR code image
    const qrCodeData = await QRCode.toDataURL(`BOOKING:${booking.id}:${qr_code}`);

    res.json({
      success: true,
      data: {
        booking,
        qr_code_image: qrCodeData
      }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get booking by ID
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT b.*, t.name as tasting_name, tn.name as tenant_name
       FROM bookings b
       JOIN tastings t ON b.tasting_id = t.id
       JOIN tenants tn ON b.tenant_id = tn.id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      data: { booking: result.rows[0] }
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Booking service running on port ${PORT}`);
});

module.exports = app;
