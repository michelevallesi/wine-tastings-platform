const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const producerRoutes = require('./src/routes/producerRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');
const db = require('./src/utils/database');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per windowMs
    message: 'Troppe richieste da questo IP'
});
app.use('/api/producers', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for images (if serving directly)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/producers', producerRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        service: 'producer-service', 
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
    console.log(`Producer Service running on port ${PORT}`);
    
    // Test database connection
    db.query('SELECT NOW() as current_time, COUNT(*) as total_producers FROM producers WHERE is_active = true')
        .then(result => {
            console.log('Database connected successfully');
            console.log(`Current time: ${result.rows[0].current_time}`);
            console.log(`Active producers: ${result.rows[0].total_producers}`);
        })
        .catch(err => console.error('Database connection failed:', err.message));
});

module.exports = app;