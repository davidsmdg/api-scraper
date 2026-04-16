const express = require('express');
const router = express.Router();
const { processBrandOnboardingBackground } = require('../controllers/onboardingController');

router.post('/onboarding', (req, res) => {
  try {
    const { urls, userId, projectId } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, error: 'El array "urls" es requerido.' });
    }
    if (!userId || !projectId) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos: "userId" y "projectId".' });
    }

    const jobId = `job_${userId}_${Date.now()}`;
    
    // Respuesta inmediata al Frontend (Fire-and-Forget)
    res.status(200).json({
      success: true,
      message: 'El flujo de Onboarding ha comenzado en segundo plano.',
      jobId,
      status: 'PROCESSING'
    });

    console.log(`[JOB INITIALIZED] ID: ${jobId} | User: ${userId} | URLs: ${urls.length}`);
    
    // Ejecución asíncrona (sin await para no bloquear)
    processBrandOnboardingBackground(urls, userId, projectId, jobId).catch(err => {
        console.error(`[BACKGROUND JOB FAILED] Job: ${jobId} | Error:`, err.message);
    });

  } catch (error) {
    console.error('[ROUTER ERROR] Error en endpoint /onboarding:', error);
    res.status(500).json({ success: false, error: 'Error del servidor al procesar la solicitud.' });
  }
});

module.exports = router;