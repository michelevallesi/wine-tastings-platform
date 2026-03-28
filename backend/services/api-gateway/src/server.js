const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'api-gateway'
  });
});

// Service registry
// Key = path prefix used in the public API (plural resource names)
// Value = downstream service base URL
const services = {
  // auth routes are action-based (/login, /me) so we rewrite /api/auth → /api
  auth:          process.env.AUTH_SERVICE_URL          || 'http://auth-service:3001',
  // all other services expose routes at /api/<plural-name>/... — no rewriting needed
  tenants:       process.env.TENANT_SERVICE_URL        || 'http://tenant-service:3002',
  tastings:      process.env.TASTING_SERVICE_URL       || 'http://tasting-service:3003',
  bookings:      process.env.BOOKING_SERVICE_URL       || 'http://booking-service:3004',
  payments:      process.env.PAYMENT_SERVICE_URL       || 'http://payment-service:3005',
  notifications: process.env.NOTIFICATION_SERVICE_URL  || 'http://notification-service:3006',
  analytics:     process.env.ANALYTICS_SERVICE_URL     || 'http://analytics-service:3007',
  files:         process.env.FILE_SERVICE_URL          || 'http://file-service:3008'
};

Object.entries(services).forEach(([name, target]) => {
  // auth-service registers routes as /api/login, /api/me — strip /api/auth prefix
  // all other services register routes with the full /api/<name>/... path — no rewrite
  const pathRewrite = name === 'auth'
    ? { '^/api/auth': '/api' }
    : undefined;

  app.use(`/api/${name}`, createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      proxyReq: (_proxyReq, req) => {
        logger.info('Proxying request', { service: name, method: req.method, path: req.url });
      },
      error: (err, _req, res) => {
        logger.error('Proxy error', { service: name, error: err.message });
        res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          timestamp: new Date().toISOString()
        });
      }
    }
  }));
});

const server = app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

module.exports = app;
