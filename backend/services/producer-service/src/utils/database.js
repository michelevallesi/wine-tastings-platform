const { Pool } = require('pg');

// Database configuration
const config = {
    user: process.env.DB_USER || 'vinbooking_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vinbooking_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    max: 20, // maximum number of clients in the pool
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 2000, // 2 seconds
    query_timeout: 30000, // 30 seconds
    statement_timeout: 30000, // 30 seconds
    application_name: 'vinbooking-producer-service'
};

const pool = new Pool(config);

// Error handling for the pool
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Connection event logging
pool.on('connect', client => {
    if (process.env.NODE_ENV === 'development') {
        console.log('New client connected to database');
    }
});

pool.on('remove', client => {
    if (process.env.NODE_ENV === 'development') {
        console.log('Client removed from pool');
    }
});

// Utility function to execute queries with better error handling
const query = async (text, params = []) => {
    const start = Date.now();
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('Executed query', { 
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                duration,
                rows: result.rowCount
            });
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.error('Database query error', { 
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            duration,
            error: error.message,
            code: error.code
        });
        throw error;
    }
};

// Function to get a client from the pool for transactions
const getClient = async () => {
    return pool.connect();
};

// Function to check database health
const checkHealth = async () => {
    try {
        const start = Date.now();
        const result = await query('SELECT NOW() as current_time, version() as pg_version');
        const duration = Date.now() - start;
        
        return {
            healthy: true,
            response_time: duration,
            current_time: result.rows[0].current_time,
            pg_version: result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1],
            pool_stats: {
                total_count: pool.totalCount,
                idle_count: pool.idleCount,
                waiting_count: pool.waitingCount
            }
        };
    } catch (error) {
        return {
            healthy: false,
            error: error.message,
            code: error.code
        };
    }
};

// Function to get producer-specific analytics data
const getProducerStats = async (producerId, days = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const query = `
            SELECT 
                COUNT(DISTINCT p.id) as total_packages,
                COUNT(DISTINCT CASE WHEN p.is_active = true THEN p.id END) as active_packages,
                COUNT(DISTINCT b.id) as total_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as confirmed_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END) as cancelled_bookings,
                COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price END), 0) as total_revenue,
                COALESCE(AVG(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price END), 0) as avg_booking_value,
                COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.participants END), 0) as total_participants,
                COUNT(DISTINCT c.id) as unique_customers
            FROM producers pr
            LEFT JOIN packages p ON pr.id = p.producer_id
            LEFT JOIN bookings b ON pr.id = b.producer_id AND b.created_at >= $2
            LEFT JOIN customers c ON b.customer_id = c.id
            WHERE pr.id = $1
            GROUP BY pr.id
        `;
        
        const result = await pool.query(query, [producerId, startDate]);
        return result.rows[0] || {};
    } catch (error) {
        console.error('Error getting producer stats:', error);
        throw error;
    }
};

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('Starting graceful shutdown of database connections...');
    
    pool.end(() => {
        console.log('Database pool has ended');
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = {
    query,
    getClient,
    connect: getClient, // Alias for compatibility
    checkHealth,
    getProducerStats,
    pool,
    end: () => pool.end()
};