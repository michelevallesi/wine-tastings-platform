const Stripe = require('stripe');

let stripe = null;

const initializeStripe = () => {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16'
        });
        console.log('Stripe initialized successfully');
    } else {
        console.warn('Stripe not configured - STRIPE_SECRET_KEY missing');
    }
};

const createPaymentIntent = async (paymentData) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: paymentData.amount, // Amount in cents
            currency: paymentData.currency,
            metadata: paymentData.metadata || {},
            automatic_payment_methods: {
                enabled: true
            },
            description: `VinBooking - ${paymentData.metadata?.package_name || 'Prenotazione'}`,
            receipt_email: paymentData.customer_details?.email,
            shipping: paymentData.customer_details?.address ? {
                name: paymentData.customer_details.name,
                address: {
                    line1: paymentData.customer_details.address.line1,
                    line2: paymentData.customer_details.address.line2,
                    city: paymentData.customer_details.address.city,
                    postal_code: paymentData.customer_details.address.postal_code,
                    country: paymentData.customer_details.address.country
                }
            } : undefined
        });

        return {
            id: paymentIntent.id,
            client_secret: paymentIntent.client_secret,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status
        };
    } catch (error) {
        console.error('Stripe payment intent creation error:', error);
        throw error;
    }
};

const retrievePaymentIntent = async (paymentIntentId) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        return paymentIntent;
    } catch (error) {
        console.error('Stripe payment intent retrieval error:', error);
        throw error;
    }
};

const processRefund = async (paymentIntentId, amount, reason) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amount, // Amount in cents
            reason: 'requested_by_customer',
            metadata: {
                refund_reason: reason
            }
        });

        return {
            id: refund.id,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            reason: refund.reason
        };
    } catch (error) {
        console.error('Stripe refund error:', error);
        throw error;
    }
};

const constructWebhookEvent = (payload, signature, endpointSecret) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const event = stripe.webhooks.constructEvent(
            payload,
            signature,
            endpointSecret || process.env.STRIPE_WEBHOOK_SECRET
        );
        return event;
    } catch (error) {
        console.error('Stripe webhook signature verification failed:', error);
        throw error;
    }
};

const getCustomer = async (customerId) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const customer = await stripe.customers.retrieve(customerId);
        return customer;
    } catch (error) {
        console.error('Stripe customer retrieval error:', error);
        throw error;
    }
};

const createCustomer = async (customerData) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const customer = await stripe.customers.create({
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            address: customerData.address,
            metadata: customerData.metadata || {}
        });
        return customer;
    } catch (error) {
        console.error('Stripe customer creation error:', error);
        throw error;
    }
};

const getBalance = async () => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const balance = await stripe.balance.retrieve();
        return balance;
    } catch (error) {
        console.error('Stripe balance retrieval error:', error);
        throw error;
    }
};

const listCharges = async (limit = 10) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const charges = await stripe.charges.list({ limit });
        return charges;
    } catch (error) {
        console.error('Stripe charges list error:', error);
        throw error;
    }
};

const createSetupIntent = async (customerId, paymentMethodTypes = ['card']) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: paymentMethodTypes,
            usage: 'off_session'
        });
        return setupIntent;
    } catch (error) {
        console.error('Stripe setup intent creation error:', error);
        throw error;
    }
};

const validateWebhookSignature = (payload, signature) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!endpointSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET non configurato');
        }

        const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
        return { valid: true, event };
    } catch (error) {
        console.error('Stripe webhook validation error:', error);
        return { valid: false, error: error.message };
    }
};

const getPaymentMethodDetails = async (paymentMethodId) => {
    if (!stripe) {
        throw new Error('Stripe non configurato');
    }

    try {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        return paymentMethod;
    } catch (error) {
        console.error('Stripe payment method retrieval error:', error);
        throw error;
    }
};

// Helper function to format amounts for Stripe (convert to cents)
const formatAmountForStripe = (amount, currency = 'eur') => {
    // Some currencies don't use decimal places
    const zeroDecimalCurrencies = ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
    
    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
        return Math.round(amount);
    }
    
    return Math.round(amount * 100);
};

// Helper function to format amounts from Stripe (convert from cents)
const formatAmountFromStripe = (amount, currency = 'eur') => {
    const zeroDecimalCurrencies = ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
    
    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
        return amount;
    }
    
    return amount / 100;
};

module.exports = {
    initializeStripe,
    createPaymentIntent,
    retrievePaymentIntent,
    processRefund,
    constructWebhookEvent,
    getCustomer,
    createCustomer,
    getBalance,
    listCharges,
    createSetupIntent,
    validateWebhookSignature,
    getPaymentMethodDetails,
    formatAmountForStripe,
    formatAmountFromStripe,
    stripe: () => stripe // Getter function for the stripe instance
};
