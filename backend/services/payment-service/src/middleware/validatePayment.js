const Joi = require('joi');
const logger = require('../utils/logger');

// Validation schemas
const schemas = {
  createPayment: Joi.object({
    bookingId: Joi.string().required(),
    amount: Joi.number().min(parseFloat(process.env.MIN_PAYMENT_AMOUNT) || 5).max(parseFloat(process.env.MAX_PAYMENT_AMOUNT) || 5000).required(),
    currency: Joi.string().valid('EUR', 'USD', 'GBP').default('EUR'),
    paymentMethod: Joi.string().valid('stripe', 'paypal').default('stripe'),
    customerDetails: Joi.object({
      stripeCustomerId: Joi.string(),
      email: Joi.string().email(),
      name: Joi.string()
    }),
    metadata: Joi.object().default({})
  }),

  paymentId: Joi.object({
    paymentId: Joi.string().required()
  }),

  refundRequest: Joi.object({
    amount: Joi.number().min(0.01).optional(),
    reason: Joi.string().max(500).required()
  }),

  cancellationReason: Joi.object({
    reason: Joi.string().max(500).required()
  }),

  addPaymentMethod: Joi.object({
    type: Joi.string().valid('card', 'bank_account').required(),
    token: Joi.string().required(),
    makeDefault: Joi.boolean().default(false)
  }),

  paymentMethodId: Joi.object({
    methodId: Joi.string().required()
  })
};

// Middleware factory
const validate = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      logger.error('Validation schema not found', { schemaName });
      return res.status(500).json({
        error: 'Internal validation error'
      });
    }

    const data = source === 'params' ? req.params : 
                 source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Payment validation failed', {
        errors,
        data: source === 'body' ? req.body : data
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace the source data with validated data
    if (source === 'params') {
      req.params = { ...req.params, ...value };
    } else if (source === 'query') {
      req.query = { ...req.query, ...value };
    } else {
      req.body = value;
    }

    next();
  };
};

// Export individual validators
module.exports = {
  createPayment: validate('createPayment'),
  paymentId: validate('paymentId', 'params'),
  refundRequest: validate('refundRequest'),
  cancellationReason: validate('cancellationReason'),
  addPaymentMethod: validate('addPaymentMethod'),
  paymentMethodId: validate('paymentMethodId', 'params'),

  // Custom validators
  validateAmount: (req, res, next) => {
    const { amount } = req.body;
    const minAmount = parseFloat(process.env.MIN_PAYMENT_AMOUNT) || 5;
    const maxAmount = parseFloat(process.env.MAX_PAYMENT_AMOUNT) || 5000;

    if (!amount || amount < minAmount || amount > maxAmount) {
      return res.status(400).json({
        error: 'Invalid payment amount',
        message: `Amount must be between €${minAmount} and €${maxAmount}`
      });
    }

    next();
  },

  validateCurrency: (req, res, next) => {
    const { currency = 'EUR' } = req.body;
    const supportedCurrencies = ['EUR', 'USD', 'GBP'];

    if (!supportedCurrencies.includes(currency)) {
      return res.status(400).json({
        error: 'Unsupported currency',
        supported: supportedCurrencies
      });
    }

    next();
  },

  validatePaymentMethod: (req, res, next) => {
    const { paymentMethod = 'stripe' } = req.body;
    const supportedMethods = ['stripe', 'paypal'];

    if (!supportedMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Unsupported payment method',
        supported: supportedMethods
      });
    }

    next();
  }
};
