const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');
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

// POST /api/login  (reached via gateway as POST /api/auth/login)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'email and password are required'
      });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    // Store session in Redis (24 h TTL)
    await redisClient.setEx(`session:${user.id}`, 86400, token);

    // Update last login timestamp
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    logger.info('User logged in', { userId: user.id, tenantId: user.tenant_id });
    res.json({
      success: true,
      data: {
        token,
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

// GET /api/me  (reached via gateway as GET /api/auth/me)
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

    // Verify session still exists in Redis
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

// POST /api/logout  (reached via gateway as POST /api/auth/logout)
app.post('/api/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, secret);
        await redisClient.del(`session:${decoded.userId}`);
      } catch {
        // Token already invalid — logout is still successful
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
