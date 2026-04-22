const intelligenceService = require('../services/intelligenceService');

const getIndustryNews = async (req, res) => {
    const { userId, projectId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId es obligatorio' });
    }

    try {
        // Iniciamos en segundo plano para no bloquear el socket si Kimi tarda mucho
        // (Aunque el servidor tiene un timeout de 10 min, es mejor ser asíncrono si el front lo soporta)
        
        // Pero para el onboarding inicial, a veces queremos que sea síncrono para confirmar.
        // El usuario dijo "Continuar", así que lo haremos síncrono por ahora ya que el socket aguanta.
        
        const result = await intelligenceService.onboardingIndustryNewsFlow(userId, projectId);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error en getIndustryNews Controller:', error.message);
        return res.status(500).json({ error: error.message });
    }
};

const { appendSavedNews } = require('../services/supabaseService');

const saveSelectedNews = async (req, res) => {
    const { newsId, contentToSave } = req.body;

    if (!newsId || !contentToSave) {
        return res.status(400).json({ error: 'newsId y contentToSave son obligatorios' });
    }

    try {
        const result = await appendSavedNews(newsId, contentToSave);
        return res.status(200).json({ success: true, message: 'Noticia concatenada con éxito', result });
    } catch (error) {
        console.error('Error en saveSelectedNews Controller:', error.message);
        return res.status(500).json({ error: error.message });
    }
};

const refreshCompetitorsAnalysis = async (req, res) => {
    const { userId, projectId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId es obligatorio' });
    }

    try {
        const result = await intelligenceService.refreshCompetitorsFlow(userId, projectId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error en refreshCompetitorsAnalysis Controller:', error.message);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { getIndustryNews, saveSelectedNews, refreshCompetitorsAnalysis };
