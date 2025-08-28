const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateProducer, optionalAuth } = require('../middleware/auth');

// Public routes (no authentication required)
router.get('/availability/check', bookingController.checkAvailability);
router.get('/qr/:qr_code', bookingController.verifyQRCode);
router.post('/create', bookingController.createBooking);

// Protected routes (authentication required)
router.use(authenticateProducer);
router.get('/', bookingController.getBookings);
router.get('/dashboard/stats', bookingController.getDashboardStats);
router.get('/:id', bookingController.getBookingById);
router.put('/:id/status', bookingController.updateBookingStatus);
router.delete('/:id/cancel', bookingController.cancelBooking);

module.exports = router;