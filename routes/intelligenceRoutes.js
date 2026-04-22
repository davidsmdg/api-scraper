const express = require('express');
const router = express.Router();
const intelligenceController = require('../controllers/intelligenceController');

router.post('/industry-news', intelligenceController.getIndustryNews);
router.post('/save-selected', intelligenceController.saveSelectedNews);
router.post('/competitors-analysis', intelligenceController.refreshCompetitorsAnalysis);

module.exports = router;
