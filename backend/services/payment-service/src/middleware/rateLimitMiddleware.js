const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');
const logger = require('../utils/logger');

// Create rate limiting middleware with different configs for payment operations
const createRateLimiter = (config) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: 'Rate limit exceeded',
      message: config.message,
      retryAfter: Math.ceil(config.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === 'admin';
    },
    onLimitReached: (req, res) => {
      logger.warn('Payment rate limit exceeded', {
        user: req.user?.id || 'anonymous',
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
    },
    store: process.env.REDIS_HOST ? undefined : undefined // Use default memory store for now
  });
};

// Payment creation rate limiting (very strict)
const paymentCreation = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 payment attempts per 15 minutes
  message: 'Too many payment attempts. Please wait before trying again.'
});

// Payment confirmation rate limiting (strict)
const paymentConfirmation = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 confirmation attempts per 15 minutes
  message: 'Too many payment confirmation attempts. Please wait.'
});

// Payment refund rate limiting (moderate)
const paymentRefund = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 refund requests per hour
  message: 'Too many refund requests. Please wait before requesting another refund.'
});

// General payment operations rate limiting
const paymentOperations = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 general payment operations per 15 minutes
  message: 'Too many payment-related requests. Please wait.'
});

// Webhook rate limiting (very permissive for legitimate webhooks)
const webhookRequests = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook requests per minute
  message: 'Webhook rate limit exceeded.',
  keyGenerator: (req) => {
    // Use IP for webhooks since they don't have user context
    return `webhook:${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for webhooks with valid signatures
    // This would be implemented based on the webhook signature validation
    return false;
  }
});

// Burst protection for suspicious activity
const burstProtection = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many requests in a short time. Please slow down.',
  keyGenerator: (req) => {
    return req.user ? `burst:user:${req.user.id}` : `burst:ip:${req.ip}`;
  }
});

// IP-based rate limiting for public endpoints
const ipBasedLimiting = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per 15 minutes
  message: 'Too many requests from this IP address.',
  keyGenerator: (req) => {
    return `ip:${req.ip}`;
  }
});

module.exports = {
  paymentCreation,
  paymentConfirmation,
  paymentRefund,
  paymentOperations,
  webhookRequests,
  burstProtection,
  ipBasedLimiting
};
