const express = require('express');
const multer = require('multer');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { authenticateProducer } = require('../middleware/auth');
const { validateImageUpload } = require('../middleware/uploadValidator');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024, // 10MB default
        files: parseInt(process.env.MAX_IMAGES_PER_PACKAGE) || 10
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

// All routes require producer authentication
router.use(authenticateProducer);

// Package CRUD operations
router.get('/', packageController.getPackages);
router.get('/analytics', packageController.getPackageAnalytics);
router.get('/:id', packageController.getPackageById);
router.post('/', upload.array('images', parseInt(process.env.MAX_IMAGES_PER_PACKAGE) || 10), validateImageUpload, packageController.createPackage);
router.put('/:id', upload.array('images', parseInt(process.env.MAX_IMAGES_PER_PACKAGE) || 10), validateImageUpload, packageController.updatePackage);
router.delete('/:id', packageController.deletePackage);

// Special operations
router.post('/:id/duplicate', packageController.duplicatePackage);

module.exports = router;