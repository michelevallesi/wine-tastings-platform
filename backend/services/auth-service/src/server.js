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
          id:       user.id,
          email:    user.email,
          name:     user.name,
          tenantId: user.tenant_id,
          role:     user.role
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
