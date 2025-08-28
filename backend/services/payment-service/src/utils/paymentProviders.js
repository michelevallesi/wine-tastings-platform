const { initializeStripe } = require('./stripeService');
const { initializePayPal } = require('./paypalService');

/**
 * Initialize all payment providers
 */
const initializePaymentServices = () => {
    console.log('Initializing payment providers...');
    
    try {
        // Initialize Stripe
        initializeStripe();
        
        // Initialize PayPal
        initializePayPal();
        
        console.log('Payment providers initialization completed');
        
    } catch (error) {
        console.error('Error initializing payment providers:', error);
        throw error;
    }
};

/**
 * Get available payment methods
 */
const getAvailablePaymentMethods = () => {
    const methods = [];
    
    if (process.env.STRIPE_SECRET_KEY) {
        methods.push({
            id: 'stripe',
            name: 'Stripe',
            description: 'Carta di credito/debito',
            supported_currencies: ['EUR', 'USD', 'GBP'],
            supported_countries: ['IT', 'US', 'GB', 'FR', 'DE', 'ES'],
            fees: {
                percentage: 2.9,
                fixed: 0.25 // EUR
            }
        });
    }
    
    if (process.env.PAYPAL_CLIENT_ID) {
        methods.push({
            id: 'paypal',
            name: 'PayPal',
            description: 'PayPal e carte principali',
            supported_currencies: ['EUR', 'USD', 'GBP'],
            supported_countries: ['IT', 'US', 'GB', 'FR', 'DE', 'ES'],
            fees: {
                percentage: 3.4,
                fixed: 0.35 // EUR
            }
        });
    }
    
    return methods;
};

/**
 * Get provider capabilities
 */
const getProviderCapabilities = (providerId) => {
    const capabilities = {
        stripe: {
            instant_payments: true,
            recurring_payments: true,
            refunds: true,
            partial_refunds: true,
            webhooks: true,
            fraud_protection: true,
            "3d_secure": true,
            apple_pay: true,
            google_pay: true,
            sepa_direct_debit: true
        },
        paypal: {
            instant_payments: true,
            recurring_payments: true,
            refunds: true,
            partial_refunds: true,
            webhooks: true,
            fraud_protection: true,
            "3d_secure": false,
            apple_pay: false,
            google_pay: false,
            paypal_credit: true
        }
    };
    
    return capabilities[providerId] || {};
};

/**
 * Calculate payment fees for a provider
 */
const calculatePaymentFees = (amount, currency, providerId) => {
    const methods = getAvailablePaymentMethods();
    const method = methods.find(m => m.id === providerId);
    
    if (!method) {
        throw new Error(`Provider ${providerId} not available`);
    }
    
    const percentageFee = (amount * method.fees.percentage) / 100;
    const fixedFee = method.fees.fixed;
    const totalFees = percentageFee + fixedFee;
    
    return {
        amount: amount,
        currency: currency,
        provider: providerId,
        fees: {
            percentage_fee: Math.round(percentageFee * 100) / 100,
            fixed_fee: fixedFee,
            total_fee: Math.round(totalFees * 100) / 100
        },
        net_amount: Math.round((amount - totalFees) * 100) / 100
    };
};

/**
 * Get recommended payment method based on amount and country
 */
const getRecommendedPaymentMethod = (amount, currency, country = 'IT') => {
    const availableMethods = getAvailablePaymentMethods();
    
    if (availableMethods.length === 0) {
        return null;
    }
    
    // Calculate fees for each method
    const methodsWithFees = availableMethods.map(method => {
        const feeCalc = calculatePaymentFees(amount, currency, method.id);
        return {
            ...method,
            calculated_fee: feeCalc.fees.total_fee,
            net_amount: feeCalc.net_amount
        };
    });
    
    // Sort by lowest fees
    methodsWithFees.sort((a, b) => a.calculated_fee - b.calculated_fee);
    
    // Apply business rules for recommendations
    let recommended = methodsWithFees[0];
    
    // For small amounts, prefer Stripe (lower fixed fee)
    if (amount < 20) {
        const stripe = methodsWithFees.find(m => m.id === 'stripe');
        if (stripe) {
            recommended = stripe;
        }
    }
    
    // For larger amounts, PayPal might be preferred in some regions
    if (amount > 100 && country === 'DE') {
        const paypal = methodsWithFees.find(m => m.id === 'paypal');
        if (paypal) {
            recommended = paypal;
        }
    }
    
    return {
        recommended: recommended,
        all_methods: methodsWithFees,
        recommendation_reason: amount < 20 ? 'Lower fees for small amounts' : 
                             amount > 100 ? 'Better for larger transactions' : 'Lowest overall fees'
    };
};

/**
 * Validate payment method availability
 */
const validatePaymentMethodAvailability = (providerId, amount, currency, country) => {
    const methods = getAvailablePaymentMethods();
    const method = methods.find(m => m.id === providerId);
    
    if (!method) {
        return {
            available: false,
            reason: `Payment method ${providerId} is not available`
        };
    }
    
    if (!method.supported_currencies.includes(currency)) {
        return {
            available: false,
            reason: `Currency ${currency} is not supported by ${method.name}`
        };
    }
    
    if (country && !method.supported_countries.includes(country)) {
        return {
            available: false,
            reason: `Country ${country} is not supported by ${method.name}`
        };
    }
    
    // Check amount limits (these would be configurable)
    const minAmount = 1.00;
    const maxAmount = 10000.00;
    
    if (amount < minAmount) {
        return {
            available: false,
            reason: `Minimum amount is ${currency} ${minAmount.toFixed(2)}`
        };
    }
    
    if (amount > maxAmount) {
        return {
            available: false,
            reason: `Maximum amount is ${currency} ${maxAmount.toFixed(2)}`
        };
    }
    
    return {
        available: true,
        method: method,
        capabilities: getProviderCapabilities(providerId)
    };
};

/**
 * Get provider health status
 */
const getProviderHealthStatus = async () => {
    const status = {
        stripe: {
            configured: !!process.env.STRIPE_SECRET_KEY,
            healthy: false,
            last_check: new Date(),
            error: null
        },
        paypal: {
            configured: !!process.env.PAYPAL_CLIENT_ID,
            healthy: false,
            last_check: new Date(),
            error: null
        }
    };
    
    // Test Stripe connection
    if (status.stripe.configured) {
        try {
            const stripe = require('./stripeService');
            if (stripe.stripe()) {
                await stripe.getBalance();
                status.stripe.healthy = true;
            }
        } catch (error) {
            status.stripe.error = error.message;
        }
    }
    
    // Test PayPal connection
    if (status.paypal.configured) {
        try {
            const paypal = require('./paypalService');
            if (paypal.isConfigured()) {
                await paypal.getAccessToken();
                status.paypal.healthy = true;
            }
        } catch (error) {
            status.paypal.error = error.message;
        }
    }
    
    return status;
};

/**
 * Get payment provider statistics
 */
const getProviderStatistics = async (days = 30) => {
    try {
        const db = require('./database');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const result = await db.query(`
            SELECT 
                payment_method as provider,
                COUNT(*) as total_payments,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount END), 0) as total_volume,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as avg_amount,
                COALESCE(SUM(refund_amount), 0) as total_refunds
            FROM payments 
            WHERE created_at >= $1
            GROUP BY payment_method
        `, [startDate]);
        
        const stats = {};
        
        result.rows.forEach(row => {
            const successRate = row.total_payments > 0 ? 
                (row.successful_payments / row.total_payments * 100).toFixed(1) : 0;
                
            stats[row.provider] = {
                total_payments: parseInt(row.total_payments),
                successful_payments: parseInt(row.successful_payments),
                failed_payments: parseInt(row.failed_payments),
                success_rate: parseFloat(successRate),
                total_volume: parseFloat(row.total_volume),
                avg_amount: parseFloat(row.avg_amount),
                total_refunds: parseFloat(row.total_refunds)
            };
        });
        
        return stats;
        
    } catch (error) {
        console.error('Error getting provider statistics:', error);
        return {};
    }
};

module.exports = {
    initializePaymentServices,
    getAvailablePaymentMethods,
    getProviderCapabilities,
    calculatePaymentFees,
    getRecommendedPaymentMethod,
    validatePaymentMethodAvailability,
    getProviderHealthStatus,
    getProviderStatistics
};