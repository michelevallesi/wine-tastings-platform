const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const redis = require('redis');
const winston = require('winston');

// Logger setup
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

// Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'api-gateway'
  });
});

// Service proxy configurations
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  tenant: process.env.TENANT_SERVICE_URL || 'http://tenant-service:3002',
  tasting: process.env.TASTING_SERVICE_URL || 'http://tasting-service:3003',
  booking: process.env.BOOKING_SERVICE_URL || 'http://booking-service:3004',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3005',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3007',
  file: process.env.FILE_SERVICE_URL || 'http://file-service:3008'
};

// Setup proxies
Object.entries(services).forEach(([name, target]) => {
  app.use(`/api/${name}`, createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      [`^/api/${name}`]: '/api'
    },
    onProxyReq: (proxyReq, req) => {
      logger.info(`Proxying request to ${name} service`, {
        method: req.method,
        url: req.url,
        target
      });
    },
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${name} service`, { error: err.message });
      res.status(503).json({ error: 'Service temporarily unavailable' });
    }
  }));
});

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info('Service routes:', services);
});

module.exports = app;
