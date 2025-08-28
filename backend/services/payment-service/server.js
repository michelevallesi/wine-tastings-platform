const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();


const webhookRoutes = require('./src/routes/webhookRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');
const { initializePaymentServices } = require('./src/utils/paymentProviders');
const db = require('./src/utils/database');

const app = express();
const PORT = process.env.PORT || 3005;

// Initialize payment providers
initializePaymentServices();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // more restrictive for payment operations
    message: 'Troppe richieste di pagamento da questo IP',
    standardHeaders: true,
    legacyHeaders: false
});

// Webhook rate limiting (separate from main API)
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // webhooks can be frequent
    message: 'Troppi webhook da questo IP'
});

// Special handling for webhooks (raw body needed for signature verification)
app.use('/api/payments/webhooks', webhookLimiter);
app.use('/api/payments/webhooks', express.raw({ type: 'application/json' }));
app.use('/api/payments/webhooks', webhookRoutes);

// Regular JSON parsing for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to payment routes
app.use('/api/payments', paymentLimiter);

// Routes
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        service: 'payment-service', 
        timestamp: new Date(),
        version: '1.0.0',
        database: 'connected',
        payment_providers: {
            stripe: !!process.env.STRIPE_SECRET_KEY,
            paypal: !!process.env.PAYPAL_CLIENT_ID
        }
    });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    db.end(() => {
        console.log('Database connections closed.');
        process.exit(0);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Payment Service running on port ${PORT}`);
    console.log(`Stripe enabled: ${!!process.env.STRIPE_SECRET_KEY}`);
    console.log(`PayPal enabled: ${!!process.env.PAYPAL_CLIENT_ID}`);
    
    // Test database connection
    db.query('SELECT NOW() as current_time, COUNT(*) as total_payments FROM payments')
        .then(result => {
            console.log('Database connected successfully');
            console.log(`Current time: ${result.rows[0].current_time}`);
            console.log(`Total payments: ${result.rows[0].total_payments}`);
        })
        .catch(err => console.error('Database connection failed:', err.message));
});

module.exports = app;