const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../utils/webhookHandler');
const { handlePayPalWebhook } = require('../utils/webhookHandler');

// Stripe webhooks
router.post('/stripe', handleStripeWebhook);

// PayPal webhooks  
router.post('/paypal', handlePayPalWebhook);

module.exports = router;