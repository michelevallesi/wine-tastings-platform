const db = require('./database');
const { v4: uuidv4 } = require('uuid');

/**
 * Log payment transaction for audit trail
 */
const logTransaction = async (transactionData) => {
    try {
        const {
            payment_id,
            action,
            provider,
            amount,
            currency,
            status,
            metadata = {},
            user_id = null,
            ip_address = null
        } = transactionData;

        const logId = uuidv4();

        await db.query(
            `INSERT INTO payment_transaction_logs (
                id, payment_id, action, provider, amount, currency,
                status, metadata, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                logId, payment_id, action, provider, amount, currency,
                status, JSON.stringify(metadata), user_id, ip_address
            ]
        );

        if (process.env.NODE_ENV === 'development') {
            console.log(`Transaction logged: ${action} for payment ${payment_id}`);
        }

        return logId;

    } catch (error) {
        console.error('Error logging transaction:', error);
        // Don't throw error to avoid breaking payment flow
    }
};

/**
 * Get transaction logs for a payment
 */
const getPaymentLogs = async (paymentId) => {
    try {
        const result = await db.query(
            `SELECT * FROM payment_transaction_logs 
             WHERE payment_id = $1 
             ORDER BY created_at DESC`,
            [paymentId]
        );

        return result.rows.map(row => ({
            id: row.id,
            payment_id: row.payment_id,
            action: row.action,
            provider: row.provider,
            amount: parseFloat(row.amount),
            currency: row.currency,
            status: row.status,
            metadata: row.metadata,
            user_id: row.user_id,
            ip_address: row.ip_address,
            created_at: row.created_at
        }));

    } catch (error) {
        console.error('Error getting payment logs:', error);
        return [];
    }
};

/**
 * Get transaction logs with filters
 */
const getTransactionLogs = async (filters = {}) => {
    try {
        const {
            payment_id,
            action,
            provider,
            status,
            date_from,
            date_to,
            limit = 100,
            offset = 0
        } = filters;

        let whereClause = 'WHERE 1=1';
        let params = [];
        let paramCount = 0;

        if (payment_id) {
            paramCount++;
            whereClause += ` AND payment_id = $${paramCount}`;
            params.push(payment_id);
        }

        if (action) {
            paramCount++;
            whereClause += ` AND action = $${paramCount}`;
            params.push(action);
        }

        if (provider) {
            paramCount++;
            whereClause += ` AND provider = $${paramCount}`;
            params.push(provider);
        }

        if (status) {
            paramCount++;
            whereClause += ` AND status = $${paramCount}`;
            params.push(status);
        }

        if (date_from) {
            paramCount++;
            whereClause += ` AND created_at >= $${paramCount}`;
            params.push(date_from);
        }

        if (date_to) {
            paramCount++;
            whereClause += ` AND created_at <= $${paramCount}::date + interval '1 day'`;
            params.push(date_to);
        }

        const query = `
            SELECT * FROM payment_transaction_logs 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        params.push(limit, offset);

        const result = await db.query(query, params);

        return result.rows.map(row => ({
            id: row.id,
            payment_id: row.payment_id,
            action: row.action,
            provider: row.provider,
            amount: row.amount ? parseFloat(row.amount) : null,
            currency: row.currency,
            status: row.status,
            metadata: row.metadata,
            user_id: row.user_id,
            ip_address: row.ip_address,
            created_at: row.created_at
        }));

    } catch (error) {
        console.error('Error getting transaction logs:', error);
        return [];
    }
};

/**
 * Log security event (suspicious activity, fraud attempts, etc.)
 */
const logSecurityEvent = async (eventData) => {
    try {
        const {
            event_type,
            severity = 'medium',
            description,
            ip_address,
            user_agent,
            payment_id = null,
            metadata = {}
        } = eventData;

        const logId = uuidv4();

        await db.query(
            `INSERT INTO payment_security_logs (
                id, event_type, severity, description, ip_address, user_agent,
                payment_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                logId, event_type, severity, description, ip_address, user_agent,
                payment_id, JSON.stringify(metadata)
            ]
        );

        // Log high severity events to console immediately
        if (severity === 'high' || severity === 'critical') {
            console.warn(`SECURITY ALERT [${severity.toUpperCase()}]: ${event_type} - ${description}`);
        }

        return logId;

    } catch (error) {
        console.error('Error logging security event:', error);
        // Security logging failures are critical
        throw error;
    }
};

/**
 * Log API access for rate limiting and monitoring
 */
const logApiAccess = async (accessData) => {
    try {
        const {
            endpoint,
            method,
            ip_address,
            user_agent,
            response_status,
            response_time,
            payment_id = null,
            user_id = null
        } = accessData;

        await db.query(
            `INSERT INTO payment_api_logs (
                endpoint, method, ip_address, user_agent, response_status,
                response_time, payment_id, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                endpoint, method, ip_address, user_agent, response_status,
                response_time, payment_id, user_id
            ]
        );

    } catch (error) {
        console.error('Error logging API access:', error);
        // Don't throw to avoid breaking API responses
    }
};

/**
 * Get payment statistics for monitoring
 */
const getPaymentStatistics = async (hours = 24) => {
    try {
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - hours);

        const result = await db.query(`
            SELECT 
                action,
                provider,
                status,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(AVG(amount), 0) as avg_amount
            FROM payment_transaction_logs 
            WHERE created_at >= $1 AND amount IS NOT NULL
            GROUP BY action, provider, status
            ORDER BY count DESC
        `, [startTime]);

        return result.rows.map(row => ({
            action: row.action,
            provider: row.provider,
            status: row.status,
            count: parseInt(row.count),
            total_amount: parseFloat(row.total_amount),
            avg_amount: parseFloat(row.avg_amount)
        }));

    } catch (error) {
        console.error('Error getting payment statistics:', error);
        return [];
    }
};

/**
 * Get error patterns for troubleshooting
 */
const getErrorPatterns = async (hours = 24) => {
    try {
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - hours);

        const result = await db.query(`
            SELECT 
                provider,
                status,
                metadata->>'error_code' as error_code,
                metadata->>'error_message' as error_message,
                COUNT(*) as occurrences,
                MAX(created_at) as last_occurrence
            FROM payment_transaction_logs 
            WHERE created_at >= $1 
              AND status IN ('failed', 'error', 'declined')
              AND metadata IS NOT NULL
            GROUP BY provider, status, metadata->>'error_code', metadata->>'error_message'
            HAVING COUNT(*) > 1
            ORDER BY occurrences DESC
            LIMIT 20
        `, [startTime]);

        return result.rows.map(row => ({
            provider: row.provider,
            status: row.status,
            error_code: row.error_code,
            error_message: row.error_message,
            occurrences: parseInt(row.occurrences),
            last_occurrence: row.last_occurrence
        }));

    } catch (error) {
        console.error('Error getting error patterns:', error);
        return [];
    }
};

/**
 * Clean up old logs (for maintenance)
 */
const cleanupOldLogs = async (daysToKeep = 90) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        // Clean transaction logs
        const transactionResult = await db.query(
            'DELETE FROM payment_transaction_logs WHERE created_at < $1',
            [cutoffDate]
        );

        // Clean API logs (keep for shorter period)
        const apiCutoff = new Date();
        apiCutoff.setDate(apiCutoff.getDate() - 30);
        
        const apiResult = await db.query(
            'DELETE FROM payment_api_logs WHERE created_at < $1',
            [apiCutoff]
        );

        // Keep security logs for longer (180 days)
        const securityCutoff = new Date();
        securityCutoff.setDate(securityCutoff.getDate() - 180);
        
        const securityResult = await db.query(
            'DELETE FROM payment_security_logs WHERE created_at < $1',
            [securityCutoff]
        );

        console.log(`Log cleanup completed:
            - Transaction logs: ${transactionResult.rowCount} deleted
            - API logs: ${apiResult.rowCount} deleted  
            - Security logs: ${securityResult.rowCount} deleted`);

        return {
            transaction_logs_deleted: transactionResult.rowCount,
            api_logs_deleted: apiResult.rowCount,
            security_logs_deleted: securityResult.rowCount
        };

    } catch (error) {
        console.error('Error cleaning up logs:', error);
        throw error;
    }
};

/**
 * Export logs for compliance/audit
 */
const exportLogs = async (filters = {}) => {
    try {
        const {
            start_date,
            end_date,
            payment_ids = [],
            log_types = ['transaction', 'security', 'api']
        } = filters;

        const exports = {};

        if (log_types.includes('transaction')) {
            exports.transaction_logs = await getTransactionLogs({
                date_from: start_date,
                date_to: end_date,
                limit: 10000
            });
        }

        if (log_types.includes('security')) {
            let securityQuery = `
                SELECT * FROM payment_security_logs 
                WHERE created_at >= $1 AND created_at <= $2::date + interval '1 day'
            `;
            let params = [start_date, end_date];

            if (payment_ids.length > 0) {
                securityQuery += ' AND payment_id = ANY($3)';
                params.push(payment_ids);
            }

            securityQuery += ' ORDER BY created_at DESC';

            const securityResult = await db.query(securityQuery, params);
            exports.security_logs = securityResult.rows;
        }

        if (log_types.includes('api')) {
            let apiQuery = `
                SELECT * FROM payment_api_logs 
                WHERE created_at >= $1 AND created_at <= $2::date + interval '1 day'
            `;
            let params = [start_date, end_date];

            if (payment_ids.length > 0) {
                apiQuery += ' AND payment_id = ANY($3)';
                params.push(payment_ids);
            }

            apiQuery += ' ORDER BY created_at DESC';

            const apiResult = await db.query(apiQuery, params);
            exports.api_logs = apiResult.rows;
        }

        return exports;

    } catch (error) {
        console.error('Error exporting logs:', error);
        throw error;
    }
};

module.exports = {
    logTransaction,
    getPaymentLogs,
    getTransactionLogs,
    logSecurityEvent,
    logApiAccess,
    getPaymentStatistics,
    getErrorPatterns,
    cleanupOldLogs,
    exportLogs
};