const express = require('express');
const router = express.Router();
const { startOnboarding } = require('../controllers/onboardingController');

router.post('/onboarding', startOnboarding);



module.exports = router;