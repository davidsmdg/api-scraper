const express = require('express');
const router = express.Router();
const intelligenceController = require('../controllers/intelligenceController');

router.post('/industry-news', intelligenceController.getIndustryNews);

module.exports = router;
