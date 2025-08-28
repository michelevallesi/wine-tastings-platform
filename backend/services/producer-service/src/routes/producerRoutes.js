const express = require('express');
const multer = require('multer');
const router = express.Router();
const producerController = require('../controllers/producerController');
const { authenticateProducer } = require('../middleware/auth');
const { validateImageUpload } = require('../middleware/uploadValidator');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_PROFILE_IMAGE_SIZE) || 5 * 1024 * 1024 // 5MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato immagine non supportato. Usa JPEG, PNG o WebP.'), false);
        }
    }
});

// Public routes (no authentication required)
router.get('/list', producerController.getAllProducers);
router.get('/:id', producerController.getProducerById);

// Protected routes (authentication required)
router.use(authenticateProducer);
router.get('/', producerController.getProfile);
router.put('/', producerController.updateProfile);
router.post('/upload-image', upload.single('image'), validateImageUpload, producerController.uploadProfileImage);
router.get('/dashboard/stats', producerController.getDashboardStats);
router.get('/dashboard/insights', producerController.getBusinessInsights);
router.post('/api/regenerate-key', producerController.updateTenantKey);
router.get('/api/usage', producerController.getApiUsageStats);

module.exports = router;