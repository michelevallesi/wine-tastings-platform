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
    application_name: 'vinbooking-package-service'
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

// Function to check database health specifically for package operations
const checkHealth = async () => {
    try {
        const start = Date.now();
        const result = await query(`
            SELECT 
                NOW() as current_time, 
                COUNT(*) as total_packages,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_packages,
                AVG(price) as avg_package_price,
                MAX(created_at) as latest_package
            FROM packages
        `);
        const duration = Date.now() - start;
        
        return {
            healthy: true,
            response_time: duration,
            current_time: result.rows[0].current_time,
            package_stats: {
                total_packages: parseInt(result.rows[0].total_packages),
                active_packages: parseInt(result.rows[0].active_packages),
                avg_package_price: parseFloat(result.rows[0].avg_package_price) || 0,
                latest_package: result.rows[0].latest_package
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

// Function to get package analytics for a producer
const getPackageAnalytics = async (producerId, days = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const query = `
            SELECT 
                COUNT(DISTINCT p.id) as total_packages,
                COUNT(DISTINCT CASE WHEN p.is_active = true THEN p.id END) as active_packages,
                COUNT(DISTINCT b.id) as total_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
                COALESCE(AVG(p.price), 0) as avg_package_price,
                COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price END), 0) as total_revenue,
                COALESCE(AVG(b.participants), 0) as avg_participants_per_booking
            FROM packages p
            LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= $2
            WHERE p.producer_id = $1
        `;
        
        const result = await pool.query(query, [producerId, startDate]);
        return result.rows[0] || {};
    } catch (error) {
        console.error('Error getting package analytics:', error);
        throw error;
    }
};

// Function to get popular packages
const getPopularPackages = async (limit = 10, days = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const query = `
            SELECT 
                p.id,
                p.name,
                p.slug,
                p.price,
                p.images,
                pr.name as producer_name,
                COUNT(b.id) as booking_count,
                AVG(CASE WHEN b.status = 'completed' THEN 5.0 END) as avg_rating
            FROM packages p
            JOIN producers pr ON p.producer_id = pr.id
            LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= $2
            WHERE p.is_active = true AND pr.is_active = true
            GROUP BY p.id, p.name, p.slug, p.price, p.images, pr.name
            HAVING COUNT(b.id) > 0
            ORDER BY COUNT(b.id) DESC, AVG(CASE WHEN b.status = 'completed' THEN 5.0 END) DESC NULLS LAST
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limit, startDate]);
        return result.rows;
    } catch (error) {
        console.error('Error getting popular packages:', error);
        throw error;
    }
};

// Function to clean up inactive packages
const cleanupInactivePackages = async (days = 180) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        // Mark old inactive packages as archived (soft delete)
        const result = await query(`
            UPDATE packages 
            SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"archived": true, "archived_at": "${new Date().toISOString()}"}'
            WHERE is_active = false 
              AND updated_at < $1
              AND (metadata->>'archived' IS NULL OR metadata->>'archived' = 'false')
            RETURNING id, name
        `, [cutoffDate]);
        
        if (result.rows.length > 0) {
            console.log(`Archived ${result.rows.length} inactive packages older than ${days} days`);
        }
        
        return result.rows;
    } catch (error) {
        console.error('Error cleaning up inactive packages:', error);
        throw error;
    }
};

// Function to get package statistics by difficulty level
const getPackageStatsByDifficulty = async () => {
    try {
        const query = `
            SELECT 
                difficulty_level,
                COUNT(*) as package_count,
                AVG(price) as avg_price,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
                SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 ELSE 0 END) as total_bookings
            FROM packages p
            LEFT JOIN bookings b ON p.id = b.package_id
            GROUP BY difficulty_level
            ORDER BY package_count DESC
        `;
        
        const result = await pool.query(query);
        return result.rows.map(row => ({
            difficulty_level: row.difficulty_level,
            package_count: parseInt(row.package_count),
            active_count: parseInt(row.active_count),
            avg_price: parseFloat(row.avg_price) || 0,
            total_bookings: parseInt(row.total_bookings) || 0
        }));
    } catch (error) {
        console.error('Error getting package stats by difficulty:', error);
        return [];
    }
};

// Function to search packages with advanced filters
const searchPackagesAdvanced = async (filters, limit = 20, offset = 0) => {
    try {
        const {
            search,
            producer_id,
            price_min,
            price_max,
            difficulty_level,
            languages,
            max_participants_min,
            wine_types,
            location
        } = filters;

        let whereClause = 'WHERE p.is_active = true AND pr.is_active = true';
        const params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            whereClause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (producer_id) {
            paramCount++;
            whereClause += ` AND p.producer_id = $${paramCount}`;
            params.push(producer_id);
        }

        if (price_min) {
            paramCount++;
            whereClause += ` AND p.price >= $${paramCount}`;
            params.push(price_min);
        }

        if (price_max) {
            paramCount++;
            whereClause += ` AND p.price <= $${paramCount}`;
            params.push(price_max);
        }

        if (difficulty_level) {
            paramCount++;
            whereClause += ` AND p.difficulty_level = $${paramCount}`;
            params.push(difficulty_level);
        }

        if (languages) {
            paramCount++;
            whereClause += ` AND p.languages::text ILIKE $${paramCount}`;
            params.push(`%${languages}%`);
        }

        if (max_participants_min) {
            paramCount++;
            whereClause += ` AND p.max_participants >= $${paramCount}`;
            params.push(max_participants_min);
        }

        if (wine_types) {
            paramCount++;
            whereClause += ` AND p.wines::text ILIKE $${paramCount}`;
            params.push(`%${wine_types}%`);
        }

        if (location) {
            paramCount++;
            whereClause += ` AND pr.address ILIKE $${paramCount}`;
            params.push(`%${location}%`);
        }

        const queryText = `
            SELECT 
                p.*,
                pr.name as producer_name,
                pr.address as producer_address,
                COUNT(b.id) as booking_count,
                COALESCE(AVG(CASE WHEN b.status = 'completed' THEN 5.0 END), 0) as avg_rating
            FROM packages p
            JOIN producers pr ON p.producer_id = pr.id
            LEFT JOIN bookings b ON p.id = b.package_id
            ${whereClause}
            GROUP BY p.id, pr.name, pr.address
            ORDER BY booking_count DESC, p.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        params.push(limit, offset);

        const result = await pool.query(queryText, params);
        return result.rows;
    } catch (error) {
        console.error('Error in advanced package search:', error);
        throw error;
    }
};

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('Starting graceful shutdown of package database connections...');
    
    pool.end(() => {
        console.log('Package database pool has ended');
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
    getPackageAnalytics,
    getPopularPackages,
    cleanupInactivePackages,
    getPackageStatsByDifficulty,
    searchPackagesAdvanced,
    pool,
    end: () => pool.end()
};