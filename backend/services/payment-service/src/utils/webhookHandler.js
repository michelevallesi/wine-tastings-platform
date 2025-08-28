const axios = require('axios');
const db = require('./database');
const { logTransaction } = require('./transactionLogger');
const { validateWebhookData } = require('./validation');
const { validateWebhookSignature } = require('./stripeService');
const { validateWebhook } = require('./paypalService');

const handleStripeWebhook = async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        const payload = req.body;

        // Validate webhook signature
        const validation = validateWebhookSignature(payload, signature);
        if (!validation.valid) {
            console.error('Stripe webhook signature validation failed:', validation.error);
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = validation.event;

        // Validate event data structure
        const { error } = validateWebhookData('stripe', event);
        if (error) {
            console.error('Invalid Stripe webhook data:', error);
            return res.status(400).json({ error: 'Invalid webhook data' });
        }

        console.log(`Received Stripe webhook: ${event.type}`);

        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;
            case 'payment_intent.canceled':
                await handlePaymentIntentCanceled(event.data.object);
                break;
            case 'charge.dispute.created':
                await handleChargeDisputeCreated(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(event.data.object);
                break;
            default:
                console.log(`Unhandled Stripe event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook handling error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

const handlePayPalWebhook = async (req, res) => {
    try {
        const headers = req.headers;
        const body = req.body;

        // Validate webhook signature
        const validation = await validateWebhook(headers, body);
        if (!validation.valid) {
            console.error('PayPal webhook validation failed:', validation.error);
            return res.status(400).json({ error: 'Invalid webhook' });
        }

        // Parse JSON body if it's a string
        const eventData = typeof body === 'string' ? JSON.parse(body) : body;

        // Validate event data structure
        const { error } = validateWebhookData('paypal', eventData);
        if (error) {
            console.error('Invalid PayPal webhook data:', error);
            return res.status(400).json({ error: 'Invalid webhook data' });
        }

        console.log(`Received PayPal webhook: ${eventData.event_type}`);

        switch (eventData.event_type) {
            case 'PAYMENT.SALE.COMPLETED':
                await handlePayPalSaleCompleted(eventData.resource);
                break;
            case 'PAYMENT.SALE.DENIED':
                await handlePayPalSaleDenied(eventData.resource);
                break;
            case 'PAYMENT.SALE.REFUNDED':
                await handlePayPalSaleRefunded(eventData.resource);
                break;
            case 'PAYMENT.SALE.REVERSED':
                await handlePayPalSaleReversed(eventData.resource);
                break;
            default:
                console.log(`Unhandled PayPal event type: ${eventData.event_type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('PayPal webhook handling error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

// Stripe webhook handlers
const handlePaymentIntentSucceeded = async (paymentIntent) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        // Find payment by provider_payment_id
        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE provider_payment_id = $1',
            [paymentIntent.id]
        );

        if (paymentResult.rows.length === 0) {
            console.error(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
            await client.query('ROLLBACK');
            return;
        }

        const payment = paymentResult.rows[0];

        // Update payment status to completed
        await client.query(
            `UPDATE payments 
             SET status = $1, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                 provider_data = $2
             WHERE id = $3`,
            ['completed', JSON.stringify(paymentIntent), payment.id]
        );

        // Update booking status to confirmed
        await client.query(
            'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['confirmed', payment.booking_id]
        );

        // Log transaction
        await logTransaction({
            payment_id: payment.id,
            action: 'payment_completed',
            provider: 'stripe',
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: 'completed',
            metadata: {
                stripe_payment_intent_id: paymentIntent.id,
                payment_method: paymentIntent.payment_method
            }
        });

        // Send payment confirmation notification
        await sendPaymentConfirmation(payment);

        await client.query('COMMIT');
        console.log(`Payment ${payment.id} marked as completed`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error handling payment_intent.succeeded:', error);
        throw error;
    } finally {
        client.release();
    }
};

const handlePaymentIntentFailed = async (paymentIntent) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE provider_payment_id = $1',
            [paymentIntent.id]
        );

        if (paymentResult.rows.length === 0) {
            console.error(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
            await client.query('ROLLBACK');
            return;
        }

        const payment = paymentResult.rows[0];

        // Update payment status to failed
        await client.query(
            `UPDATE payments 
             SET status = $1, failure_reason = $2, updated_at = CURRENT_TIMESTAMP,
                 provider_data = $3
             WHERE id = $4`,
            ['failed', paymentIntent.last_payment_error?.message || 'Payment failed', 
             JSON.stringify(paymentIntent), payment.id]
        );

        // Log transaction
        await logTransaction({
            payment_id: payment.id,
            action: 'payment_failed',
            provider: 'stripe',
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: 'failed',
            metadata: {
                stripe_payment_intent_id: paymentIntent.id,
                failure_reason: paymentIntent.last_payment_error?.message
            }
        });

        await client.query('COMMIT');
        console.log(`Payment ${payment.id} marked as failed`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error handling payment_intent.payment_failed:', error);
        throw error;
    } finally {
        client.release();
    }
};

const handlePaymentIntentCanceled = async (paymentIntent) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE provider_payment_id = $1',
            [paymentIntent.id]
        );

        if (paymentResult.rows.length === 0) {
            console.error(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
            await client.query('ROLLBACK');
            return;
        }

        const payment = paymentResult.rows[0];

        // Update payment status to cancelled
        await client.query(
            `UPDATE payments 
             SET status = $1, updated_at = CURRENT_TIMESTAMP,
                 provider_data = $2
             WHERE id = $3`,
            ['cancelled', JSON.stringify(paymentIntent), payment.id]
        );

        // Log transaction
        await logTransaction({
            payment_id: payment.id,
            action: 'payment_cancelled',
            provider: 'stripe',
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: 'cancelled',
            metadata: {
                stripe_payment_intent_id: paymentIntent.id
            }
        });

        await client.query('COMMIT');
        console.log(`Payment ${payment.id} marked as cancelled`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error handling payment_intent.canceled:', error);
        throw error;
    } finally {
        client.release();
    }
};

const handleChargeDisputeCreated = async (dispute) => {
    try {
        // Log dispute for manual review
        await logTransaction({
            payment_id: null, // Will be resolved by charge ID
            action: 'dispute_created',
            provider: 'stripe',
            amount: dispute.amount / 100,
            currency: dispute.currency,
            status: 'disputed',
            metadata: {
                dispute_id: dispute.id,
                charge_id: dispute.charge,
                reason: dispute.reason,
                evidence_due_by: dispute.evidence_details?.due_by
            }
        });

        // Send alert to operations team
        console.log(`ALERT: Chargeback dispute created for charge ${dispute.charge}`);
        
        // TODO: Send email notification to operations team
        
    } catch (error) {
        console.error('Error handling charge.dispute.created:', error);
    }
};

const handleInvoicePaymentSucceeded = async (invoice) => {
    try {
        // Log subscription payment success
        await logTransaction({
            payment_id: null,
            action: 'subscription_payment',
            provider: 'stripe',
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            status: 'completed',
            metadata: {
                invoice_id: invoice.id,
                customer_id: invoice.customer,
                subscription_id: invoice.subscription
            }
        });

        console.log(`Subscription payment succeeded for invoice ${invoice.id}`);

    } catch (error) {
        console.error('Error handling invoice.payment_succeeded:', error);
    }
};

// PayPal webhook handlers
const handlePayPalSaleCompleted = async (sale) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        // Find payment by provider_payment_id (PayPal payment ID)
        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE provider_payment_id = $1',
            [sale.parent_payment]
        );

        if (paymentResult.rows.length === 0) {
            console.error(`Payment not found for PayPal payment: ${sale.parent_payment}`);
            await client.query('ROLLBACK');
            return;
        }

        const payment = paymentResult.rows[0];

        // Update payment status to completed
        await client.query(
            `UPDATE payments 
             SET status = $1, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                 provider_data = $2
             WHERE id = $3`,
            ['completed', JSON.stringify(sale), payment.id]
        );

        // Update booking status to confirmed
        await client.query(
            'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['confirmed', payment.booking_id]
        );

        // Log transaction
        await logTransaction({
            payment_id: payment.id,
            action: 'payment_completed',
            provider: 'paypal',
            amount: parseFloat(sale.amount.total),
            currency: sale.amount.currency,
            status: 'completed',
            metadata: {
                paypal_sale_id: sale.id,
                parent_payment: sale.parent_payment
            }
        });

        // Send payment confirmation
        await sendPaymentConfirmation(payment);

        await client.query('COMMIT');
        console.log(`PayPal payment ${payment.id} marked as completed`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error handling PayPal sale completed:', error);
        throw error;
    } finally {
        client.release();
    }
};

const handlePayPalSaleDenied = async (sale) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE provider_payment_id = $1',
            [sale.parent_payment]
        );

        if (paymentResult.rows.length === 0) {
            console.error(`Payment not found for PayPal payment: ${sale.parent_payment}`);
            await client.query('ROLLBACK');
            return;
        }

        const payment = paymentResult.rows[0];

        // Update payment status to failed
        await client.query(
            `UPDATE payments 
             SET status = $1, failure_reason = $2, updated_at = CURRENT_TIMESTAMP,
                 provider_data = $3
             WHERE id = $4`,
            ['failed', 'PayPal payment denied', JSON.stringify(sale), payment.id]
        );

        // Log transaction
        await logTransaction({
            payment_id: payment.id,
            action: 'payment_failed',
            provider: 'paypal',
            amount: parseFloat(sale.amount.total),
            currency: sale.amount.currency,
            status: 'failed',
            metadata: {
                paypal_sale_id: sale.id,
                reason: 'Payment denied by PayPal'
            }
        });

        await client.query('COMMIT');
        console.log(`PayPal payment ${payment.id} marked as failed`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error handling PayPal sale denied:', error);
        throw error;
    } finally {
        client.release();
    }
};

const handlePayPalSaleRefunded = async (refund) => {
    try {
        // Log refund transaction
        await logTransaction({
            payment_id: null, // Will need to be resolved by sale ID
            action: 'refund_completed',
            provider: 'paypal',
            amount: parseFloat(refund.amount.total),
            currency: refund.amount.currency,
            status: 'completed',
            metadata: {
                paypal_refund_id: refund.id,
                sale_id: refund.sale_id,
                reason: refund.reason
            }
        });

        console.log(`PayPal refund completed: ${refund.id}`);

    } catch (error) {
        console.error('Error handling PayPal sale refunded:', error);
    }
};

const handlePayPalSaleReversed = async (reversal) => {
    try {
        // Log chargeback/reversal
        await logTransaction({
            payment_id: null,
            action: 'payment_reversed',
            provider: 'paypal',
            amount: parseFloat(reversal.amount.total),
            currency: reversal.amount.currency,
            status: 'reversed',
            metadata: {
                paypal_reversal_id: reversal.id,
                reason: reversal.reason
            }
        });

        console.log(`PayPal payment reversed: ${reversal.id}`);
        
        // Send alert for manual review
        console.log('ALERT: PayPal payment reversal requires manual review');

    } catch (error) {
        console.error('Error handling PayPal sale reversed:', error);
    }
};

// Helper function to send payment confirmation
const sendPaymentConfirmation = async (payment) => {
    try {
        // Get booking details
        const bookingResult = await db.query(
            `SELECT b.*, p.name as package_name, pr.name as producer_name,
                    c.name as customer_name, c.email as customer_email
             FROM bookings b
             JOIN packages p ON b.package_id = p.id
             JOIN producers pr ON b.producer_id = pr.id
             JOIN customers c ON b.customer_id = c.id
             WHERE b.id = $1`,
            [payment.booking_id]
        );

        if (bookingResult.rows.length === 0) {
            console.error(`Booking not found for payment confirmation: ${payment.booking_id}`);
            return;
        }

        const booking = bookingResult.rows[0];

        // Send confirmation to booking service (which will trigger email)
        await axios.post(`${process.env.BOOKING_SERVICE_URL}/api/bookings/payment-confirmed`, {
            booking_id: booking.id,
            payment_id: payment.id,
            amount: payment.amount,
            currency: payment.currency
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`Payment confirmation sent for booking ${booking.id}`);

    } catch (error) {
        console.error('Error sending payment confirmation:', error);
        // Don't throw error - payment was still successful
    }
};

module.exports = {
    handleStripeWebhook,
    handlePayPalWebhook,
    handlePaymentIntentSucceeded,
    handlePaymentIntentFailed,
    handlePaymentIntentCanceled,
    handleChargeDisputeCreated,
    handlePayPalSaleCompleted,
    handlePayPalSaleDenied,
    handlePayPalSaleRefunded,
    handlePayPalSaleReversed,
    sendPaymentConfirmation
};