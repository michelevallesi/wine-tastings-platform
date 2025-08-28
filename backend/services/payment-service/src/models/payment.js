const db = require('../config/database');
const logger = require('../utils/logger');

class Payment {
  constructor(data) {
    this.id = data.id;
    this.booking_id = data.booking_id;
    this.user_id = data.user_id;
    this.amount = data.amount;
    this.currency = data.currency;
    this.status = data.status;
    this.payment_method = data.payment_method;
    this.provider_payment_id = data.provider_payment_id;
    this.metadata = data.metadata;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(paymentData) {
    const query = `
      INSERT INTO payments (
        id, booking_id, user_id, amount, currency, status, 
        payment_method, provider_payment_id, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;
    
    const values = [
      paymentData.id,
      paymentData.booking_id,
      paymentData.user_id,
      paymentData.amount,
      paymentData.currency,
      paymentData.status,
      paymentData.payment_method,
      paymentData.provider_payment_id,
      paymentData.metadata
    ];

    try {
      const result = await db.query(query, values);
      logger.info('Payment created', { paymentId: result.rows[0].id });
      return new Payment(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create payment', error);
      throw error;
    }
  }

  static async findById(paymentId) {
    const query = 'SELECT * FROM payments WHERE id = $1';
    
    try {
      const result = await db.query(query, [paymentId]);
      return result.rows[0] ? new Payment(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find payment by ID', error);
      throw error;
    }
  }

  static async findByBookingId(bookingId) {
    const query = 'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1';
    
    try {
      const result = await db.query(query, [bookingId]);
      return result.rows[0] ? new Payment(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find payment by booking ID', error);
      throw error;
    }
  }

  static async findByProviderPaymentId(providerPaymentId) {
    const query = 'SELECT * FROM payments WHERE provider_payment_id = $1';
    
    try {
      const result = await db.query(query, [providerPaymentId]);
      return result.rows[0] ? new Payment(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find payment by provider payment ID', error);
      throw error;
    }
  }

  static async findByFilters(filters, options = {}) {
    let query = `
      SELECT p.*, 
             u.name as user_name, u.email as user_email,
             b.confirmation_code as booking_confirmation_code,
             pkg.name as package_name,
             pr.name as producer_name
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN packages pkg ON b.package_id = pkg.id
      LEFT JOIN producers pr ON b.producer_id = pr.id
      WHERE 1=1
    `;
    
    const values = [];
    let valueIndex = 1;

    // Apply filters
    if (filters.user_id) {
      query += ` AND p.user_id = $${valueIndex}`;
      values.push(filters.user_id);
      valueIndex++;
    }

    if (filters.status) {
      query += ` AND p.status = $${valueIndex}`;
      values.push(filters.status);
      valueIndex++;
    }

    if (filters.payment_method) {
      query += ` AND p.payment_method = $${valueIndex}`;
      values.push(filters.payment_method);
      valueIndex++;
    }

    if (filters.producer_id) {
      query += ` AND b.producer_id = $${valueIndex}`;
      values.push(filters.producer_id);
      valueIndex++;
    }

    if (filters.dateFrom) {
      query += ` AND p.created_at >= $${valueIndex}`;
      values.push(filters.dateFrom);
      valueIndex++;
    }

    if (filters.dateTo) {
      query += ` AND p.created_at <= $${valueIndex}`;
      values.push(filters.dateTo);
      valueIndex++;
    }

    // Count total records
    const countQuery = query.replace(/SELECT p\\.\\*, .+? FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Apply ordering
    const orderBy = options.orderBy || 'p.created_at DESC';
    query += ` ORDER BY ${orderBy}`;

    // Apply pagination
    if (options.limit) {
      query += ` LIMIT $${valueIndex}`;
      values.push(options.limit);
      valueIndex++;
    }

    if (options.page && options.limit) {
      const offset = (options.page - 1) * options.limit;
      query += ` OFFSET $${valueIndex}`;
      values.push(offset);
      valueIndex++;
    }

    try {
      const result = await db.query(query, values);
      const payments = result.rows.map(row => ({
        ...new Payment(row),
        user_name: row.user_name,
        user_email: row.user_email,
        booking_confirmation_code: row.booking_confirmation_code,
        package_name: row.package_name,
        producer_name: row.producer_name
      }));

      return { payments, total };
    } catch (error) {
      logger.error('Failed to find payments by filters', error);
      throw error;
    }
  }

  async updateStatus(status, metadata = {}) {
    const query = `
      UPDATE payments 
      SET status = $1, metadata = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    // Merge existing metadata with new metadata
    const existingMetadata = this.metadata ? JSON.parse(this.metadata) : {};
    const updatedMetadata = JSON.stringify({ ...existingMetadata, ...metadata });

    try {
      const result = await db.query(query, [status, updatedMetadata, this.id]);
      
      // Update current instance
      this.status = status;
      this.metadata = updatedMetadata;
      this.updated_at = result.rows[0].updated_at;

      logger.info('Payment status updated', {
        paymentId: this.id,
        oldStatus: this.status,
        newStatus: status,
        metadata: metadata
      });

      return this;
    } catch (error) {
      logger.error('Failed to update payment status', error);
      throw error;
    }
  }

  static async getAnalytics(period, filters = {}) {
    const periodMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '1y': '1 year'
    };

    const intervalClause = periodMap[period] || '30 days';
    
    let query = `
      WITH payment_stats AS (
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
          AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as average_transaction_value,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*)::float * 100 as success_rate
        FROM payments p
        LEFT JOIN bookings b ON p.booking_id = b.id
        WHERE p.created_at >= NOW() - INTERVAL '${intervalClause}'
    `;

    const values = [];
    let valueIndex = 1;

    if (filters.producer_id) {
      query += ` AND b.producer_id = $${valueIndex}`;
      values.push(filters.producer_id);
      valueIndex++;
    }

    query += `
      ),
      payment_methods AS (
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue
        FROM payments p
        LEFT JOIN bookings b ON p.booking_id = b.id
        WHERE p.created_at >= NOW() - INTERVAL '${intervalClause}'
    `;

    if (filters.producer_id) {
      query += ` AND b.producer_id = $${valueIndex}`;
      values.push(filters.producer_id);
      valueIndex++;
    }

    query += `
        GROUP BY payment_method
      ),
      daily_revenue AS (
        SELECT 
          DATE(p.created_at) as date,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as transactions
        FROM payments p
        LEFT JOIN bookings b ON p.booking_id = b.id
        WHERE p.created_at >= NOW() - INTERVAL '${intervalClause}'
    `;

    if (filters.producer_id) {
      query += ` AND b.producer_id = $${valueIndex}`;
      values.push(filters.producer_id);
      valueIndex++;
    }

    query += `
        GROUP BY DATE(p.created_at)
        ORDER BY date DESC
        LIMIT 30
      ),
      top_packages AS (
        SELECT 
          pkg.name as package_name,
          pr.name as producer_name,
          COUNT(*) as bookings,
          SUM(p.amount) as revenue
        FROM payments p
        JOIN bookings b ON p.booking_id = b.id
        JOIN packages pkg ON b.package_id = pkg.id
        JOIN producers pr ON b.producer_id = pr.id
        WHERE p.created_at >= NOW() - INTERVAL '${intervalClause}'
          AND p.status = 'completed'
    `;

    if (filters.producer_id) {
      query += ` AND b.producer_id = $${valueIndex}`;
      values.push(filters.producer_id);
      valueIndex++;
    }

    query += `
        GROUP BY pkg.id, pkg.name, pr.name
        ORDER BY revenue DESC
        LIMIT 10
      )
      SELECT 
        (SELECT row_to_json(payment_stats) FROM payment_stats) as stats,
        (SELECT json_agg(payment_methods) FROM payment_methods) as payment_methods,
        (SELECT json_agg(daily_revenue ORDER BY date DESC) FROM daily_revenue) as daily_revenue,
        (SELECT json_agg(top_packages ORDER BY revenue DESC) FROM top_packages) as top_packages
    `;

    try {
      const result = await db.query(query, values);
      const row = result.rows[0];

      return {
        total_revenue: parseFloat(row.stats?.total_revenue || 0),
        total_transactions: parseInt(row.stats?.total_transactions || 0),
        average_transaction_value: parseFloat(row.stats?.average_transaction_value || 0),
        success_rate: parseFloat(row.stats?.success_rate || 0),
        payment_methods: row.payment_methods || [],
        daily_revenue: row.daily_revenue || [],
        top_packages: row.top_packages || []
      };
    } catch (error) {
      logger.error('Failed to get payment analytics', error);
      throw error;
    }
  }

  static async getDashboardStats() {
    const query = `
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' AND created_at >= CURRENT_DATE THEN amount ELSE 0 END) as today_revenue,
        SUM(CASE WHEN status = 'completed' AND created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN amount ELSE 0 END) as month_revenue
      FROM payments
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    try {
      const result = await db.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get dashboard stats', error);
      throw error;
    }
  }

  // Instance method to get decrypted metadata
  getDecryptedMetadata() {
    if (!this.metadata) return {};
    
    try {
      const encryptionUtils = require('../utils/encryption');
      return JSON.parse(encryptionUtils.decrypt(this.metadata));
    } catch (error) {
      logger.error('Failed to decrypt payment metadata', error);
      return {};
    }
  }

  // Instance method to check if payment can be refunded
  canBeRefunded() {
    if (this.status !== 'completed') return false;
    
    const refundDeadline = new Date(this.created_at);
    refundDeadline.setHours(refundDeadline.getHours() + (parseInt(process.env.REFUND_DEADLINE_HOURS) || 24));
    
    return new Date() <= refundDeadline;
  }

  // Instance method to get payment age in hours
  getAgeInHours() {
    return Math.floor((new Date() - new Date(this.created_at)) / (1000 * 60 * 60));
  }

  // Static method to clean up expired pending payments
  static async cleanupExpiredPayments() {
    const timeoutMinutes = parseInt(process.env.PAYMENT_TIMEOUT_MINUTES) || 30;
    
    const query = `
      UPDATE payments 
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' 
        AND created_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
      RETURNING id
    `;

    try {
      const result = await db.query(query);
      if (result.rows.length > 0) {
        logger.info('Expired payments cleaned up', {
          count: result.rows.length,
          paymentIds: result.rows.map(row => row.id)
        });
      }
      return result.rows.length;
    } catch (error) {
      logger.error('Failed to cleanup expired payments', error);
      throw error;
    }
  }
}

module.exports = Payment;