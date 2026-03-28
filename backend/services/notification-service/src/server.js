const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3006;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // retry failed notifications every 5 minutes
const MAX_RETRY_AGE_HOURS = 24;           // stop retrying after 24 hours

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

// Build transporter only when SMTP is configured
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

// Allowed tags for email HTML content — strips scripts, iframes, event handlers, etc.
const SANITIZE_OPTIONS = {
  allowedTags: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'blockquote', 'span', 'div', 'table',
    'thead', 'tbody', 'tr', 'th', 'td', 'img'
  ],
  allowedAttributes: {
    'a': ['href', 'title'],
    'img': ['src', 'alt', 'width', 'height'],
    '*': ['style']
  },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesByTag: { 'img': ['https', 'data'] }
};

async function deliverEmail(notifId, recipient_email, subject, safeHtml) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: recipient_email,
      subject,
      html: safeHtml
    });
    await pool.query(
      `UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [notifId]
    );
    logger.info('Email sent', { recipient_email, subject });
    return true;
  } catch (mailErr) {
    logger.error('Email delivery failed', { error: mailErr.message, recipient_email });
    await pool.query(`UPDATE notifications SET status = 'failed' WHERE id = $1`, [notifId]);
    return false;
  }
}

// Retry failed notifications that are still within the retry window
async function retryFailedNotifications() {
  if (!transporter) return;
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE status = 'failed'
         AND created_at > NOW() - INTERVAL '${MAX_RETRY_AGE_HOURS} hours'
       ORDER BY created_at ASC
       LIMIT 50`
    );
    if (result.rows.length === 0) return;
    logger.info('Retrying failed notifications', { count: result.rows.length });
    for (const notif of result.rows) {
      const safeHtml = sanitizeHtml(notif.content, SANITIZE_OPTIONS);
      await deliverEmail(notif.id, notif.recipient_email, notif.subject, safeHtml);
    }
  } catch (err) {
    logger.error('Retry job error', { error: err.message });
  }
}

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'notification-service' });
});

// Send notification (email)
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { tenant_id, booking_id, type, recipient_email, subject, content } = req.body;

    if (!recipient_email || !type || !subject || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: recipient_email, type, subject, content'
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient_email)) {
      return res.status(400).json({ success: false, error: 'Invalid recipient_email format' });
    }

    // Sanitize HTML content before storing and sending to prevent XSS in emails
    const safeHtml = sanitizeHtml(content, SANITIZE_OPTIONS);

    const notifResult = await pool.query(
      `INSERT INTO notifications
         (tenant_id, booking_id, type, recipient_email, subject, content, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [tenant_id || null, booking_id || null, type, recipient_email, subject, safeHtml]
    );
    const notifId = notifResult.rows[0].id;

    if (transporter) {
      await deliverEmail(notifId, recipient_email, subject, safeHtml);
    } else {
      logger.info('SMTP not configured — notification queued only', { recipient_email, subject });
    }

    res.json({
      success: true,
      data: { notification: notifResult.rows[0] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Send notification error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// List notifications (filterable by tenant or booking)
app.get('/api/notifications', async (req, res) => {
  try {
    const { tenant_id, booking_id } = req.query;
    const params = [];
    const conditions = [];

    if (tenant_id) { params.push(tenant_id); conditions.push(`tenant_id = $${params.length}`); }
    if (booking_id) { params.push(booking_id); conditions.push(`booking_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 100`,
      params
    );
    res.json({
      success: true,
      data: { notifications: result.rows },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('List notifications error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start retry job and HTTP server
const retryTimer = setInterval(retryFailedNotifications, RETRY_INTERVAL_MS);

const server = app.listen(PORT, () => {
  logger.info(`Notification service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  clearInterval(retryTimer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
