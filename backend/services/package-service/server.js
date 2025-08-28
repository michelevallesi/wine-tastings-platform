const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const packageRoutes = require('./src/routes/packageRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');
const db = require('./src/utils/database');

const app = express();
const PORT = process.env.PORT || 3003;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    message: 'Troppe richieste da questo IP'
});

const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // higher limit for public endpoints
    message: 'Troppe richieste da questo IP'
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for package images
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/packages', limiter, packageRoutes);
app.use('/api/public/packages', publicLimiter, publicRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        service: 'package-service', 
        timestamp: new Date(),
        version: '1.0.0',
        database: 'connected'
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
    console.log(`Package Service running on port ${PORT}`);
    
    // Test database connection
    db.query('SELECT NOW() as current_time, COUNT(*) as total_packages FROM packages WHERE is_active = true')
        .then(result => {
            console.log('Database connected successfully');
            console.log(`Current time: ${result.rows[0].current_time}`);
            console.log(`Active packages: ${result.rows[0].total_packages}`);
        })
        .catch(err => console.error('Database connection failed:', err.message));
});

module.exports = app;