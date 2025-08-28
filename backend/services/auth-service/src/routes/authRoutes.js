const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateProducer } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authenticateProducer, authController.logout);
router.get('/verify', authController.verifyToken);

module.exports = router;
