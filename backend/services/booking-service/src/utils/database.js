const { Pool } = require('pg');

// Database configuration
const config = {
    user: process.env.DB_USER || 'vinbooking_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vinbooking_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    max: 25, // maximum number of clients in the pool
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 2000, // 2 seconds
    query_timeout: 30000, // 30 seconds
    statement_timeout: 30000, // 30 seconds
    application_name: 'vinbooking-booking-service'
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
    pool,
    end: () => pool.end()
};