const { OpenAI } = require('openai');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

const generateStructuralProfile = async (text) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [{ 
                role: 'user', 
                content: `Analiza la siguiente información extraída de una marca y devuelve UNICAMENTE un JSON estricto con el perfil estructural (valores, ventaja competitiva, esencia). Texto:\n\n${text}` 
            }],
            response_format: { type: 'json_object' }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('Error en generateStructuralProfile:', error.message);
        return null;
    }
};

const analyzeImageDirecting = async (imageUrl) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'google/gemini-2.0-flash-001',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Analiza la dirección de arte de esta imagen y devuelve UNICAMENTE un JSON estricto con paleta de colores, estilo fotográfico y vibra general.' },
                    { type: 'image_url', image_url: { url: imageUrl } }
                ]
            }],
            response_format: { type: 'json_object' }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error(`Error analizando imagen ${imageUrl}:`, error.message);
        return null;
    }
};

module.exports = { generateStructuralProfile, analyzeImageDirecting };