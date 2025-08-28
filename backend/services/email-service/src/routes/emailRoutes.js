const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// Email sending routes
router.post('/booking-confirmation', emailController.sendBookingConfirmation);
router.post('/booking-notification', emailController.sendBookingNotification);
router.post('/payment-confirmation', emailController.sendPaymentConfirmation);
router.post('/send-custom', emailController.sendCustomEmail);

// Configuration and testing
router.get('/test-configuration', emailController.testEmailConfiguration);

module.exports = router;
