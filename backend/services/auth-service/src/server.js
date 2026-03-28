const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');
const { randomUUID } = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.warn('JWT_SECRET is not set — using insecure fallback. Set JWT_SECRET in production!');
}
const secret = JWT_SECRET || 'dev-secret';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => logger.error('Unexpected pool error', { error: err.message }));

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => logger.error('Redis client error', { error: err.message }));

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), service: 'auth-service' });
});

// ── POST /api/login  (reached via gateway as POST /api/auth/login) ───────────
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required' });
    }

    // Normalize email to lowercase for case-insensitive lookup
    const normalizedEmail = email.toLowerCase().trim();

    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 AND is_active = true',
      [normalizedEmail]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    // Refresh token — random UUID stored in Redis with 7-day TTL
    const refreshToken = randomUUID();

    await Promise.all([
      redisClient.setEx(`session:${user.id}`, 86400, accessToken),
      redisClient.setEx(`refresh:${refreshToken}`, 7 * 86400, user.id),
      pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
    ]);

    logger.info('User logged in', { userId: user.id, tenantId: user.tenant_id });
    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id:        user.id,
          email:     user.email,
          name:      user.name,
          tenant_id: user.tenant_id,
          role:      user.role
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/refresh  (reached via gateway as POST /api/auth/refresh) ───────
app.post('/api/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken is required' });
    }

    const userId = await redisClient.get(`refresh:${refreshToken}`);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }

    const result = await pool.query(
      'SELECT id, email, name, tenant_id, role FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found or deactivated' });
    }

    const user = result.rows[0];
    const newAccessToken = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    await redisClient.setEx(`session:${user.id}`, 86400, newAccessToken);

    logger.info('Token refreshed', { userId: user.id });
    res.json({
      success: true,
      data: { token: newAccessToken },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Refresh error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/me  (reached via gateway as GET /api/auth/me) ───────────────────
app.get('/api/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const sessionToken = await redisClient.get(`session:${decoded.userId}`);
    if (!sessionToken || sessionToken !== token) {
      return res.status(401).json({ success: false, error: 'Session expired or revoked' });
    }

    const result = await pool.query(
      'SELECT id, email, name, tenant_id, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: { user: result.rows[0] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get me error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/logout  (reached via gateway as POST /api/auth/logout) ─────────
app.post('/api/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, secret);
        // Revoke access token and all refresh tokens for this user
        const keys = await redisClient.keys(`refresh:*`);
        const refreshDeletions = [];
        for (const key of keys) {
          const uid = await redisClient.get(key);
          if (uid === decoded.userId) refreshDeletions.push(redisClient.del(key));
        }
        await Promise.all([
          redisClient.del(`session:${decoded.userId}`),
          ...refreshDeletions
        ]);
      } catch {
        // Token already invalid — logout is still considered successful
      }
    }
    res.json({ success: true, message: 'Logged out successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/register  (reached via gateway as POST /api/auth/register) ─────
// Self-registration for new wine producers. Creates a tenant + producer account.
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, winery_name, location, phone, website } = req.body;

    if (!name || !email || !password || !winery_name) {
      return res.status(400).json({
        success: false,
        error: 'name, email, password e winery_name sono obbligatori',
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'La password deve avere almeno 8 caratteri' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email già registrata' });
    }

    // Derive a unique slug from the winery name
    const baseSlug = winery_name.toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugCheck = await pool.query("SELECT slug FROM tenants WHERE slug LIKE $1 || '%'", [baseSlug]);
    const slug = slugCheck.rows.length === 0 ? baseSlug : `${baseSlug}-${randomUUID().substring(0, 6)}`;

    const tenantId = randomUUID();
    const userId   = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO tenants (id, name, slug, location, phone, website, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [tenantId, winery_name.trim(), slug, location || null, phone || null, website || null]
    );
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, 'producer', true, false)`,
      [userId, tenantId, normalizedEmail, passwordHash, name.trim()]
    );

    const accessToken  = jwt.sign({ userId, tenantId, role: 'producer' }, secret, { expiresIn: '24h' });
    const refreshToken = randomUUID();
    await Promise.all([
      redisClient.setEx(`session:${userId}`, 86400, accessToken),
      redisClient.setEx(`refresh:${refreshToken}`, 7 * 86400, userId),
    ]);

    logger.info('Producer registered', { userId, tenantId });
    res.status(201).json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        user: { id: userId, email: normalizedEmail, name: name.trim(), tenant_id: tenantId, role: 'producer' },
      },
      message: 'Registrazione completata con successo',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Register error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start server only after Redis is connected
async function start() {
  await redisClient.connect();
  logger.info('Redis connected');

  const server = app.listen(PORT, () => {
    logger.info(`Auth service running on port ${PORT}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(async () => {
      await redisClient.quit();
      await pool.end();
      process.exit(0);
    });
  });
}

start().catch((err) => {
  logger.error('Failed to start auth service', { error: err.message });
  process.exit(1);
});

module.exports = app;
