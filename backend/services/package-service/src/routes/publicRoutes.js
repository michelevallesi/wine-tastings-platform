const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Public package discovery endpoints (no authentication required)
router.get('/', publicController.searchPackages);
router.get('/featured', publicController.getFeaturedPackages);
router.get('/categories', publicController.getPackageCategories);
router.get('/:id', publicController.getPackageDetails);
router.get('/producer/:producer_id', publicController.getPackagesByProducer);
router.get('/slug/:slug', publicController.getPackageBySlug);

module.exports = router;