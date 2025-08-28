const Joi = require('joi');
const moment = require('moment');

const validateCreatePayment = (data) => {
    const schema = Joi.object({
        booking_id: Joi.string().uuid().required(),
        amount: Joi.number()
            .positive()
            .precision(2)
            .min(parseFloat(process.env.MIN_PAYMENT_AMOUNT) || 5.00)
            .max(parseFloat(process.env.MAX_PAYMENT_AMOUNT) || 5000.00)
            .required(),
        currency: Joi.string()
            .valid('EUR', 'USD', 'GBP')
            .default('EUR')
            .optional(),
        payment_method: Joi.string()
            .valid('stripe', 'paypal')
            .required(),
        customer_details: Joi.object({
            name: Joi.string().min(2).max(100).required(),
            email: Joi.string().email().required(),
            phone: Joi.string().min(8).max(20).optional(),
            address: Joi.object({
                line1: Joi.string().max(200).optional(),
                line2: Joi.string().max(200).optional(),
                city: Joi.string().max(100).optional(),
                postal_code: Joi.string().max(20).optional(),
                country: Joi.string().length(2).optional()
            }).optional()
        }).required(),
        metadata: Joi.object().optional()
    });

    return schema.validate(data, { abortEarly: false });
};

const validateRefundRequest = (data) => {
    const schema = Joi.object({
        amount: Joi.number()
            .positive()
            .precision(2)
            .optional(), // If not provided, full refund
        reason: Joi.string()
            .min(5)
            .max(500)
            .required()
    });

    return schema.validate(data);
};

const validatePaymentFilters = (data) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        status: Joi.string()
            .valid('pending', 'processing', 'completed', 'failed', 'expired', 'cancelled')
            .optional(),
        payment_method: Joi.string()
            .valid('stripe', 'paypal')
            .optional(),
        date_from: Joi.date()
            .max('now')
            .optional(),
        date_to: Joi.date()
            .min(Joi.ref('date_from'))
            .max('now')
            .optional(),
        booking_id: Joi.string().uuid().optional(),
        sort_by: Joi.string()
            .valid('created_at', 'amount', 'status', 'processed_at')
            .optional(),
        sort_order: Joi.string()
            .valid('ASC', 'DESC', 'asc', 'desc')
            .optional()
    });

    return schema.validate(data);
};

const validateWebhookData = (provider, data) => {
    if (provider === 'stripe') {
        const schema = Joi.object({
            id: Joi.string().required(),
            type: Joi.string().required(),
            data: Joi.object({
                object: Joi.object().required()
            }).required(),
            created: Joi.number().required()
        });
        return schema.validate(data);
    } else if (provider === 'paypal') {
        const schema = Joi.object({
            id: Joi.string().required(),
            event_type: Joi.string().required(),
            resource: Joi.object().required(),
            create_time: Joi.string().required()
        });
        return schema.validate(data);
    }
    
    return { error: new Error('Provider non supportato') };
};

const validatePaymentAmount = (amount, currency = 'EUR') => {
    const errors = [];
    
    if (typeof amount !== 'number' || amount <= 0) {
        errors.push('Importo deve essere un numero positivo');
        return { valid: false, errors };
    }

    const minAmount = parseFloat(process.env.MIN_PAYMENT_AMOUNT) || 5.00;
    const maxAmount = parseFloat(process.env.MAX_PAYMENT_AMOUNT) || 5000.00;
    
    if (amount < minAmount) {
        errors.push(`Importo minimo: ${currency} ${minAmount.toFixed(2)}`);
    }
    
    if (amount > maxAmount) {
        errors.push(`Importo massimo: ${currency} ${maxAmount.toFixed(2)}`);
    }

    // Check decimal places (max 2)
    if (Number(amount.toFixed(2)) !== amount) {
        errors.push('Importo non può avere più di 2 decimali');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

const validateRefundWindow = (bookingDate, refundDeadlineHours = null) => {
    if (!bookingDate) {
        return { valid: false, reason: 'Data prenotazione mancante' };
    }

    const deadline = refundDeadlineHours || parseInt(process.env.REFUND_DEADLINE_HOURS) || 24;
    const bookingMoment = moment(bookingDate);
    const refundDeadline = bookingMoment.subtract(deadline, 'hours');
    const now = moment();

    if (now.isAfter(refundDeadline)) {
        return { 
            valid: false, 
            reason: `Rimborsi possibili fino a ${deadline} ore prima della prenotazione` 
        };
    }

    const hoursRemaining = refundDeadline.diff(now, 'hours');
    return { 
        valid: true, 
        hours_remaining: hoursRemaining 
    };
};

const sanitizeCustomerDetails = (customerDetails) => {
    const sanitized = {
        name: customerDetails.name?.trim(),
        email: customerDetails.email?.toLowerCase().trim(),
        phone: customerDetails.phone?.replace(/\\D/g, '') || null
    };

    if (customerDetails.address) {
        sanitized.address = {
            line1: customerDetails.address.line1?.trim() || null,
            line2: customerDetails.address.line2?.trim() || null,
            city: customerDetails.address.city?.trim() || null,
            postal_code: customerDetails.address.postal_code?.replace(/\\s/g, '') || null,
            country: customerDetails.address.country?.toUpperCase() || null
        };
    }

    return sanitized;
};

const validateCardNumber = (cardNumber) => {
    // Basic Luhn algorithm validation
    if (!cardNumber || typeof cardNumber !== 'string') {
        return { valid: false, reason: 'Numero carta non valido' };
    }

    // Remove spaces and non-digits
    const cleaned = cardNumber.replace(/\\D/g, '');
    
    // Check length (13-19 digits for major card types)
    if (cleaned.length < 13 || cleaned.length > 19) {
        return { valid: false, reason: 'Lunghezza numero carta non valida' };
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned.charAt(i), 10);
        
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        isEven = !isEven;
    }

    const isValid = sum % 10 === 0;
    return { 
        valid: isValid, 
        reason: isValid ? null : 'Numero carta non valido (checksum)' 
    };
};

const validateExpiryDate = (month, year) => {
    const errors = [];
    
    if (!month || !year) {
        errors.push('Mese e anno di scadenza richiesti');
        return { valid: false, errors };
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (monthNum < 1 || monthNum > 12) {
        errors.push('Mese non valido (1-12)');
    }
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
        errors.push('Carta scaduta');
    }
    
    if (yearNum > currentYear + 20) {
        errors.push('Anno di scadenza troppo lontano');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

const validateBusinessRules = (paymentData) => {
    const errors = [];
    
    // Check payment timeout
    const timeoutMinutes = parseInt(process.env.PAYMENT_TIMEOUT_MINUTES) || 30;
    const maxTime = moment().add(timeoutMinutes, 'minutes');
    
    // Validate currency support
    const supportedCurrencies = ['EUR', 'USD', 'GBP'];
    if (!supportedCurrencies.includes(paymentData.currency?.toUpperCase())) {
        errors.push(`Valuta non supportata. Valute supportate: ${supportedCurrencies.join(', ')}`);
    }

    // Validate payment method availability
    if (paymentData.payment_method === 'stripe' && !process.env.STRIPE_SECRET_KEY) {
        errors.push('Stripe non configurato');
    }
    
    if (paymentData.payment_method === 'paypal' && !process.env.PAYPAL_CLIENT_ID) {
        errors.push('PayPal non configurato');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

module.exports = {
    validateCreatePayment,
    validateRefundRequest,
    validatePaymentFilters,
    validateWebhookData,
    validatePaymentAmount,
    validateRefundWindow,
    sanitizeCustomerDetails,
    validateCardNumber,
    validateExpiryDate,
    validateBusinessRules
};