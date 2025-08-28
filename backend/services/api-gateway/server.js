const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Troppe richieste da questo IP'
});
app.use('/api', limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        service: 'api-gateway', 
        timestamp: new Date(),
        version: '1.0.0'
    });
});

// Service routes with proxy
const services = {
    auth: {
        target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
        pathRewrite: { '^/api/auth': '/api/auth' }
    },
    producers: {
        target: process.env.PRODUCER_SERVICE_URL || 'http://producer-service:3002',
        pathRewrite: { '^/api/producers': '/api/producers' }
    },
    packages: {
        target: process.env.PACKAGE_SERVICE_URL || 'http://package-service:3003',
        pathRewrite: { '^/api/packages': '/api/packages' }
    },
    bookings: {
        target: process.env.BOOKING_SERVICE_URL || 'http://booking-service:3004',
        pathRewrite: { '^/api/bookings': '/api/bookings' }
    },
    payments: {
        target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3005',
        pathRewrite: { '^/api/payments': '/api/payments' }
    },
    email: {
        target: process.env.EMAIL_SERVICE_URL || 'http://email-service:3006',
        pathRewrite: { '^/api/email': '/api/email' }
    }
};

// Create proxy middlewares for each service
Object.keys(services).forEach(serviceName => {
    const serviceConfig = services[serviceName];

    app.use(`/api/${serviceName}`, createProxyMiddleware({
        target: serviceConfig.target,
        changeOrigin: true,
        pathRewrite: serviceConfig.pathRewrite,
        onError: (err, req, res) => {
            console.error(`Proxy error for ${serviceName}:`, err.message);
            res.status(503).json({ 
                error: `Servizio ${serviceName} temporaneamente non disponibile` 
            });
        },
        onProxyReq: (proxyReq, req, res) => {
            // Log requests in development
            if (process.env.NODE_ENV === 'development') {
                console.log(`Proxying ${req.method} ${req.path} to ${serviceName}`);
            }
        }
    }));
});

// Catch all for unknown routes
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint non trovato',
        path: req.originalUrl,
        method: req.method
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Gateway error:', error);
    res.status(500).json({ 
        error: 'Errore interno del gateway',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log('Configured services:');
    Object.keys(services).forEach(service => {
        console.log(`  - ${service}: ${services[service].target}`);
    });
});

module.exports = app;
