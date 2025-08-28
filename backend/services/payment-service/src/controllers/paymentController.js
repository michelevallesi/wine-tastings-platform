const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const axios = require('axios');
const db = require('../utils/database');
const { 
    validateCreatePayment, 
    validateRefundRequest,
    validatePaymentFilters
} = require('../utils/validation');
const { createStripePaymentIntent } = require('../utils/stripeService');
const { createPayPalPayment } = require('../utils/paypalService');
const { logTransaction } = require('../utils/transactionLogger');
const { encryptSensitiveData, decryptSensitiveData } = require('../utils/encryption');

class PaymentController {
    async createPayment(req, res) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            const { error } = validateCreatePayment(req.body);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: error.details[0].message });
            }

            const {
                booking_id,
                amount,
                currency = 'EUR',
                payment_method,
                customer_details,
                metadata = {}
            } = req.body;

            // Validate amount limits
            const minAmount = parseFloat(process.env.MIN_PAYMENT_AMOUNT) || 5.00;
            const maxAmount = parseFloat(process.env.MAX_PAYMENT_AMOUNT) || 5000.00;
            
            if (amount < minAmount || amount > maxAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Importo deve essere tra €${minAmount} e €${maxAmount}` 
                });
            }

            // Get booking details
            const bookingResult = await client.query(
                `SELECT b.*, p.name as package_name, pr.name as producer_name,
                        c.name as customer_name, c.email as customer_email
                 FROM bookings b
                 JOIN packages p ON b.package_id = p.id
                 JOIN producers pr ON b.producer_id = pr.id
                 JOIN customers c ON b.customer_id = c.id
                 WHERE b.id = $1`,
                [booking_id]
            );

            if (bookingResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Prenotazione non trovata' });
            }

            const booking = bookingResult.rows[0];

            // Check if booking already has a successful payment
            const existingPaymentResult = await client.query(
                'SELECT id, status FROM payments WHERE booking_id = $1 AND status IN ($2, $3)',
                [booking_id, 'completed', 'processing']
            );

            if (existingPaymentResult.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ 
                    error: 'Prenotazione già pagata o pagamento in corso' 
                });
            }

            // Validate booking amount matches payment amount
            if (Math.abs(parseFloat(booking.total_price) - amount) > 0.01) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Importo pagamento non corrisponde al totale prenotazione' 
                });
            }

            // Create payment record
            const paymentId = uuidv4();
            const expiresAt = moment().add(parseInt(process.env.PAYMENT_TIMEOUT_MINUTES) || 30, 'minutes');

            let paymentProvider = null;
            let providerPaymentId = null;
            let clientSecret = null;

            // Create payment with selected provider
            if (payment_method === 'stripe') {
                try {
                    const stripePayment = await createStripePaymentIntent({
                        amount: Math.round(amount * 100), // Stripe uses cents
                        currency: currency.toLowerCase(),
                        metadata: {
                            payment_id: paymentId,
                            booking_id: booking_id,
                            package_name: booking.package_name,
                            ...metadata
                        },
                        customer_details
                    });

                    paymentProvider = 'stripe';
                    providerPaymentId = stripePayment.id;
                    clientSecret = stripePayment.client_secret;
                } catch (stripeError) {
                    await client.query('ROLLBACK');
                    console.error('Stripe payment creation error:', stripeError);
                    return res.status(500).json({ 
                        error: 'Errore nella creazione del pagamento Stripe' 
                    });
                }
            } else if (payment_method === 'paypal') {
                try {
                    const paypalPayment = await createPayPalPayment({
                        amount: amount,
                        currency: currency.toUpperCase(),
                        description: `VinBooking - ${booking.package_name}`,
                        booking_id: booking_id,
                        return_url: `${process.env.FRONTEND_URL}/payment/success`,
                        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
                    });

                    paymentProvider = 'paypal';
                    providerPaymentId = paypalPayment.id;
                    clientSecret = paypalPayment.approval_url;
                } catch (paypalError) {
                    await client.query('ROLLBACK');
                    console.error('PayPal payment creation error:', paypalError);
                    return res.status(500).json({ 
                        error: 'Errore nella creazione del pagamento PayPal' 
                    });
                }
            } else {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Metodo di pagamento non supportato' 
                });
            }

            // Encrypt sensitive data before storing
            const encryptedCustomerDetails = encryptSensitiveData(JSON.stringify(customer_details));

            // Insert payment record
            const paymentResult = await client.query(
                `INSERT INTO payments (
                    id, booking_id, producer_id, customer_id, amount, currency,
                    payment_method, provider_payment_id, status, expires_at,
                    customer_details_encrypted, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *`,
                [
                    paymentId, booking_id, booking.producer_id, booking.customer_id,
                    amount, currency, paymentProvider, providerPaymentId, 'pending',
                    expiresAt, encryptedCustomerDetails, JSON.stringify(metadata)
                ]
            );

            const payment = paymentResult.rows[0];

            // Log transaction
            await logTransaction({
                payment_id: paymentId,
                action: 'payment_created',
                provider: paymentProvider,
                amount: amount,
                currency: currency,
                status: 'pending',
                metadata: {
                    booking_id: booking_id,
                    provider_payment_id: providerPaymentId
                }
            });

            await client.query('COMMIT');

            res.status(201).json({
                payment: {
                    id: payment.id,
                    booking_id: payment.booking_id,
                    amount: parseFloat(payment.amount),
                    currency: payment.currency,
                    payment_method: payment.payment_method,
                    status: payment.status,
                    expires_at: payment.expires_at,
                    created_at: payment.created_at
                },
                client_secret: clientSecret,
                provider: paymentProvider,
                booking: {
                    id: booking.id,
                    package_name: booking.package_name,
                    producer_name: booking.producer_name,
                    booking_date: booking.booking_date,
                    booking_time: booking.booking_time,
                    participants: booking.participants
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Create payment error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }

    async getPayment(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT 
                    p.*,
                    b.booking_date, b.booking_time, b.participants,
                    pkg.name as package_name,
                    pr.name as producer_name,
                    c.name as customer_name, c.email as customer_email
                 FROM payments p
                 JOIN bookings b ON p.booking_id = b.id
                 JOIN packages pkg ON b.package_id = pkg.id
                 JOIN producers pr ON b.producer_id = pr.id
                 JOIN customers c ON b.customer_id = c.id
                 WHERE p.id = $1`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Pagamento non trovato' });
            }

            const payment = result.rows[0];

            // Decrypt customer details if needed
            let customerDetails = null;
            if (payment.customer_details_encrypted) {
                try {
                    const decrypted = decryptSensitiveData(payment.customer_details_encrypted);
                    customerDetails = JSON.parse(decrypted);
                } catch (decryptError) {
                    console.error('Error decrypting customer details:', decryptError);
                }
            }

            res.json({
                id: payment.id,
                booking_id: payment.booking_id,
                amount: parseFloat(payment.amount),
                currency: payment.currency,
                payment_method: payment.payment_method,
                provider_payment_id: payment.provider_payment_id,
                status: payment.status,
                processed_at: payment.processed_at,
                expires_at: payment.expires_at,
                failure_reason: payment.failure_reason,
                refund_amount: payment.refund_amount ? parseFloat(payment.refund_amount) : null,
                refunded_at: payment.refunded_at,
                metadata: payment.metadata,
                created_at: payment.created_at,
                updated_at: payment.updated_at,
                booking: {
                    booking_date: payment.booking_date,
                    booking_time: payment.booking_time,
                    participants: payment.participants,
                    package_name: payment.package_name,
                    producer_name: payment.producer_name,
                    customer_name: payment.customer_name,
                    customer_email: payment.customer_email
                },
                customer_details: customerDetails
            });

        } catch (error) {
            console.error('Get payment error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getPayments(req, res) {
        try {
            const { error } = validatePaymentFilters(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { 
                page = 1, 
                limit = 20, 
                status,
                payment_method,
                date_from,
                date_to,
                booking_id,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Build dynamic WHERE clause for producer's payments only
            let whereClause = 'WHERE p.producer_id = $1';
            let params = [req.producer.id];
            let paramCount = 1;

            if (status) {
                paramCount++;
                whereClause += ` AND p.status = $${paramCount}`;
                params.push(status);
            }

            if (payment_method) {
                paramCount++;
                whereClause += ` AND p.payment_method = $${paramCount}`;
                params.push(payment_method);
            }

            if (date_from) {
                paramCount++;
                whereClause += ` AND p.created_at >= $${paramCount}`;
                params.push(date_from);
            }

            if (date_to) {
                paramCount++;
                whereClause += ` AND p.created_at <= $${paramCount}::date + interval '1 day'`;
                params.push(date_to);
            }

            if (booking_id) {
                paramCount++;
                whereClause += ` AND p.booking_id = $${paramCount}`;
                params.push(booking_id);
            }

            // Validate sort parameters
            const allowedSortColumns = ['created_at', 'amount', 'status', 'processed_at'];
            const allowedSortOrders = ['ASC', 'DESC'];
            
            const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
            const sortOrderVal = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

            const query = `
                SELECT 
                    p.id, p.booking_id, p.amount, p.currency, p.payment_method,
                    p.status, p.processed_at, p.expires_at, p.failure_reason,
                    p.refund_amount, p.refunded_at, p.created_at, p.updated_at,
                    pkg.name as package_name,
                    b.booking_date, b.booking_time, b.participants,
                    c.name as customer_name, c.email as customer_email
                FROM payments p
                JOIN bookings b ON p.booking_id = b.id
                JOIN packages pkg ON b.package_id = pkg.id
                JOIN customers c ON b.customer_id = c.id
                ${whereClause}
                ORDER BY p.${sortColumn} ${sortOrderVal}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            params.push(parseInt(limit), offset);

            const result = await db.query(query, params);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM payments p
                ${whereClause}
            `;
            const countResult = await db.query(countQuery, params.slice(0, -2));
            const total = parseInt(countResult.rows[0].total);

            res.json({
                payments: result.rows.map(row => ({
                    id: row.id,
                    booking_id: row.booking_id,
                    amount: parseFloat(row.amount),
                    currency: row.currency,
                    payment_method: row.payment_method,
                    status: row.status,
                    processed_at: row.processed_at,
                    expires_at: row.expires_at,
                    failure_reason: row.failure_reason,
                    refund_amount: row.refund_amount ? parseFloat(row.refund_amount) : null,
                    refunded_at: row.refunded_at,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    booking: {
                        booking_date: row.booking_date,
                        booking_time: row.booking_time,
                        participants: row.participants,
                        package_name: row.package_name,
                        customer_name: row.customer_name,
                        customer_email: row.customer_email
                    }
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Get payments error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async processRefund(req, res) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');

            const { error } = validateRefundRequest(req.body);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: error.details[0].message });
            }

            const { id } = req.params;
            const { amount, reason } = req.body;

            // Get payment details
            const paymentResult = await client.query(
                `SELECT p.*, b.booking_date 
                 FROM payments p
                 JOIN bookings b ON p.booking_id = b.id
                 WHERE p.id = $1 AND p.producer_id = $2`,
                [id, req.producer.id]
            );

            if (paymentResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Pagamento non trovato' });
            }

            const payment = paymentResult.rows[0];

            if (payment.status !== 'completed') {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Solo i pagamenti completati possono essere rimborsati' 
                });
            }

            if (payment.refunded_at) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Pagamento già rimborsato' 
                });
            }

            // Check refund deadline
            const bookingDate = moment(payment.booking_date);
            const refundDeadline = bookingDate.subtract(parseInt(process.env.REFUND_DEADLINE_HOURS) || 24, 'hours');
            const now = moment();

            if (now.isAfter(refundDeadline)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Rimborsi possibili fino a ${process.env.REFUND_DEADLINE_HOURS || 24} ore prima della prenotazione` 
                });
            }

            // Validate refund amount
            const maxRefundAmount = parseFloat(payment.amount) - (parseFloat(payment.refund_amount) || 0);
            const refundAmount = amount || maxRefundAmount;

            if (refundAmount > maxRefundAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Importo rimborso non può superare €${maxRefundAmount.toFixed(2)}` 
                });
            }

            // Process refund with payment provider
            let refundResult;
            try {
                if (payment.payment_method === 'stripe') {
                    const stripe = require('../utils/stripeService');
                    refundResult = await stripe.processRefund(
                        payment.provider_payment_id, 
                        Math.round(refundAmount * 100),
                        reason
                    );
                } else if (payment.payment_method === 'paypal') {
                    const paypal = require('../utils/paypalService');
                    refundResult = await paypal.processRefund(
                        payment.provider_payment_id,
                        refundAmount,
                        payment.currency,
                        reason
                    );
                }
            } catch (providerError) {
                await client.query('ROLLBACK');
                console.error('Provider refund error:', providerError);
                return res.status(500).json({ 
                    error: 'Errore durante il rimborso presso il provider' 
                });
            }

            // Update payment record
            const totalRefunded = (parseFloat(payment.refund_amount) || 0) + refundAmount;
            const updateResult = await client.query(
                `UPDATE payments 
                 SET refund_amount = $1, refunded_at = CURRENT_TIMESTAMP, 
                     refund_reason = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 
                 RETURNING *`,
                [totalRefunded, reason, id]
            );

            // Log transaction
            await logTransaction({
                payment_id: id,
                action: 'refund_processed',
                provider: payment.payment_method,
                amount: refundAmount,
                currency: payment.currency,
                status: 'completed',
                metadata: {
                    refund_reason: reason,
                    provider_refund_id: refundResult.id,
                    total_refunded: totalRefunded
                }
            });

            // Update booking status if fully refunded
            if (totalRefunded >= parseFloat(payment.amount)) {
                await client.query(
                    'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    ['cancelled', payment.booking_id]
                );

                // Send cancellation notification (async)
                try {
                    await axios.post(`${process.env.EMAIL_SERVICE_URL}/api/email/send-custom`, {
                        to: payment.customer_email || '',
                        subject: 'Rimborso Prenotazione - VinBooking',
                        htmlContent: `
                            <div style="font-family: Arial, sans-serif;">
                                <h2>Rimborso Completato</h2>
                                <p>Il rimborso di €${refundAmount.toFixed(2)} per la sua prenotazione è stato processato con successo.</p>
                                <p>Motivo: ${reason}</p>
                                <p>I fondi dovrebbero essere visibili nel suo conto entro 3-5 giorni lavorativi.</p>
                            </div>
                        `
                    });
                } catch (emailError) {
                    console.error('Refund notification email error:', emailError);
                }
            }

            await client.query('COMMIT');

            res.json({
                message: 'Rimborso processato con successo',
                refund: {
                    payment_id: id,
                    refund_amount: refundAmount,
                    total_refunded: totalRefunded,
                    refund_reason: reason,
                    provider_refund_id: refundResult.id,
                    refunded_at: updateResult.rows[0].refunded_at
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Process refund error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }

    async getPaymentStats(req, res) {
        try {
            const producerId = req.producer.id;
            const { period = '30' } = req.query;

            const periodDays = parseInt(period);
            const startDate = moment().subtract(periodDays, 'days').format('YYYY-MM-DD');

            const statsQuery = `
                SELECT 
                    COUNT(*) as total_payments,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
                    COUNT(CASE WHEN refunded_at IS NOT NULL THEN 1 END) as refunded_payments,
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue,
                    COALESCE(SUM(CASE WHEN refunded_at IS NOT NULL THEN refund_amount ELSE 0 END), 0) as total_refunds,
                    COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as avg_payment_amount,
                    COUNT(CASE WHEN payment_method = 'stripe' THEN 1 END) as stripe_payments,
                    COUNT(CASE WHEN payment_method = 'paypal' THEN 1 END) as paypal_payments
                FROM payments 
                WHERE producer_id = $1 AND created_at >= $2
            `;

            const statsResult = await db.query(statsQuery, [producerId, startDate]);
            const stats = statsResult.rows[0];

            // Get daily trends
            const trendsQuery = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as payment_count,
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as daily_revenue,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
                FROM payments
                WHERE producer_id = $1 AND created_at >= $2
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `;

            const trendsResult = await db.query(trendsQuery, [producerId, startDate]);

            // Calculate success rate
            const totalPayments = parseInt(stats.total_payments) || 0;
            const completedPayments = parseInt(stats.completed_payments) || 0;
            const successRate = totalPayments > 0 ? 
                ((completedPayments / totalPayments) * 100).toFixed(1) : 0;

            // Calculate net revenue (after refunds)
            const netRevenue = parseFloat(stats.total_revenue) - parseFloat(stats.total_refunds);

            res.json({
                period_days: periodDays,
                summary: {
                    total_payments: totalPayments,
                    completed_payments: completedPayments,
                    pending_payments: parseInt(stats.pending_payments) || 0,
                    failed_payments: parseInt(stats.failed_payments) || 0,
                    refunded_payments: parseInt(stats.refunded_payments) || 0,
                    total_revenue: parseFloat(stats.total_revenue) || 0,
                    total_refunds: parseFloat(stats.total_refunds) || 0,
                    net_revenue: netRevenue,
                    avg_payment_amount: parseFloat(stats.avg_payment_amount) || 0,
                    success_rate: parseFloat(successRate),
                    payment_methods: {
                        stripe: parseInt(stats.stripe_payments) || 0,
                        paypal: parseInt(stats.paypal_payments) || 0
                    }
                },
                trends: trendsResult.rows.map(row => ({
                    date: row.date,
                    payment_count: parseInt(row.payment_count),
                    daily_revenue: parseFloat(row.daily_revenue),
                    completed_count: parseInt(row.completed_count),
                    failed_count: parseInt(row.failed_count)
                }))
            });

        } catch (error) {
            console.error('Get payment stats error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }
}

module.exports = new PaymentController();