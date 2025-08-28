const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateProducer, optionalAuth } = require('../middleware/auth');

// Public routes (customers can create payments)
router.post('/create', paymentController.createPayment);

// Mixed authentication routes (customers can view their own payments)
router.get('/:id', optionalAuth, paymentController.getPayment);

// Protected routes (producer authentication required)
router.use(authenticateProducer);
router.get('/', paymentController.getPayments);
router.post('/:id/refund', paymentController.processRefund);
router.get('/dashboard/stats', paymentController.getPaymentStats);

module.exports = router;
