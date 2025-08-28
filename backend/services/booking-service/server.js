const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const bookingRoutes = require('./src/routes/bookingRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');
const db = require('./src/utils/database');

const app = express();
const PORT = process.env.PORT || 3004;

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
app.use('/api/bookings', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/bookings', bookingRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        service: 'booking-service', 
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
    console.log(`Booking Service running on port ${PORT}`);
    
    // Test database connection
    db.query('SELECT NOW() as current_time, COUNT(*) as total_bookings FROM bookings')
        .then(result => {
            console.log('Database connected successfully');
            console.log(`Current time: ${result.rows[0].current_time}`);
            console.log(`Total bookings: ${result.rows[0].total_bookings}`);
        })
        .catch(err => console.error('Database connection failed:', err.message));
});

module.exports = app;