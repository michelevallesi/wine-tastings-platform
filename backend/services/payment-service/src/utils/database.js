const { Pool } = require('pg');

// Database configuration
const config = {
    user: process.env.DB_USER || 'vinbooking_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vinbooking_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    max: 15, // maximum number of clients in the pool for payment service
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 5000, // 5 seconds for payment operations
    query_timeout: 60000, // 60 seconds for complex payment queries
    statement_timeout: 60000, // 60 seconds
    application_name: 'vinbooking-payment-service'
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

// Function to check database health specifically for payment operations
const checkHealth = async () => {
    try {
        const start = Date.now();
        const result = await query(`
            SELECT 
                NOW() as current_time, 
                COUNT(*) as total_payments,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
            FROM payments 
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        `);
        const duration = Date.now() - start;
        
        return {
            healthy: true,
            response_time: duration,
            current_time: result.rows[0].current_time,
            payment_stats: {
                total_payments: parseInt(result.rows[0].total_payments),
                completed_payments: parseInt(result.rows[0].completed_payments),
                pending_payments: parseInt(result.rows[0].pending_payments),
                failed_payments: parseInt(result.rows[0].failed_payments)
            },
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

// Function to get payment-specific analytics
const getPaymentAnalytics = async (producerId, days = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const query = `
            SELECT 
                COUNT(*) as total_payments,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
                COUNT(CASE WHEN refunded_at IS NOT NULL THEN 1 END) as refunded_payments,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount END), 0) as total_revenue,
                COALESCE(SUM(refund_amount), 0) as total_refunds,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as avg_payment_amount,
                COUNT(CASE WHEN payment_method = 'stripe' THEN 1 END) as stripe_count,
                COUNT(CASE WHEN payment_method = 'paypal' THEN 1 END) as paypal_count
            FROM payments 
            WHERE producer_id = $1 AND created_at >= $2
        `;
        
        const result = await pool.query(query, [producerId, startDate]);
        return result.rows[0] || {};
    } catch (error) {
        console.error('Error getting payment analytics:', error);
        throw error;
    }
};

// Function to cleanup expired pending payments
const cleanupExpiredPayments = async () => {
    try {
        const result = await query(`
            UPDATE payments 
            SET status = 'expired', updated_at = CURRENT_TIMESTAMP
            WHERE status = 'pending' 
              AND expires_at < CURRENT_TIMESTAMP
              AND expires_at IS NOT NULL
            RETURNING id, booking_id
        `);
        
        if (result.rows.length > 0) {
            console.log(`Cleaned up ${result.rows.length} expired payments`);
            
            // Update associated bookings if needed
            for (const payment of result.rows) {
                await query(`
                    UPDATE bookings 
                    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND status = 'pending'
                `, [payment.booking_id]);
            }
        }
        
        return result.rows.length;
    } catch (error) {
        console.error('Error cleaning up expired payments:', error);
        throw error;
    }
};

// Function to get pending payments that are about to expire
const getPendingPaymentsNearExpiry = async (minutesUntilExpiry = 10) => {
    try {
        const result = await query(`
            SELECT 
                p.*,
                b.booking_date,
                b.booking_time,
                c.email as customer_email,
                pkg.name as package_name
            FROM payments p
            JOIN bookings b ON p.booking_id = b.id
            JOIN customers c ON b.customer_id = c.id
            JOIN packages pkg ON b.package_id = pkg.id
            WHERE p.status = 'pending' 
              AND p.expires_at > CURRENT_TIMESTAMP
              AND p.expires_at <= CURRENT_TIMESTAMP + INTERVAL '${minutesUntilExpiry} minutes'
        `);
        
        return result.rows;
    } catch (error) {
        console.error('Error getting pending payments near expiry:', error);
        throw error;
    }
};

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('Starting graceful shutdown of payment database connections...');
    
    pool.end(() => {
        console.log('Payment database pool has ended');
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
    getPaymentAnalytics,
    cleanupExpiredPayments,
    getPendingPaymentsNearExpiry,
    pool,
    end: () => pool.end()
};