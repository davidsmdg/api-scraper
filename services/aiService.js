const { OpenAI } = require('openai');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Genera el perfil de marca completo compatible con el frontend de Radikal IA.
 * Sigue el esquema exacto de BrandTab.tsx y MemoryPage.tsx
 */
const generateStructuralProfile = async (text) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [{ 
                role: 'system',
                content: 'Actúa como un Consultor Senior de Estrategia de Marca y Especialista en Identidad Visual. Tu objetivo es destilar la esencia de una marca a partir de texto extraído de su web.'
            }, { 
                role: 'user', 
                content: `Analiza la siguiente información y genera un perfil de marca exhaustivo. 
                
                Debes devolver UNICAMENTE un objeto JSON con la siguiente estructura exacta:
                {
                  "identidad_esencia": "Descripción profunda de la misión, visión y propósito central.",
                  "portafolio_productos": "Resumen de lo que ofrecen (productos/servicios).",
                  "ventaja_competitiva": "Qué los hace únicos frente a otros.",
                  "tono_comunicacion": "Cómo habla la marca (ej: Formal, disruptivo, amigable).",
                  "sistema_cromatico": {
                    "colores_acento_marca": ["#HEX1", "#HEX2"],
                    "colores_neutros_funcionales": ["#HEX3", "#HEX4"],
                    "analisis": "Breve explicación de por qué usan estos colores."
                  },
                  "direccion_visual_imagenes": "Estilo visual predominante (fotografía, ilustración, minimalismo, etc.).",
                  "perfil_audiencia": "A quién se dirigen (demografía y psicografía).",
                  "presencia_ubicaciones": "Dónde están físicamente o alcance geográfico si es digital.",
                  "canales_contacto": "Redes sociales, whatsapp, email detectados.",
                  "oportunidades_mejora": "Qué áreas pueden potenciar según su presencia actual."
                }

                Texto extraído:
                ${text}` 
            }],
            response_format: { type: 'json_object' }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('Error en generateStructuralProfile:', error.message);
        return null;
    }
};

/**
 * Analiza la dirección de arte de una imagen individual.
 */
const analyzeImageDirecting = async (imageUrl) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'google/gemini-2.0-flash-001',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Analiza la dirección de arte de esta imagen. Devuelve UNICAMENTE un JSON con: {"url": "URL_DE_LA_IMAGEN", "analysis": "Descripción del estilo, composición y elementos clave", "colors": ["#HEX1", "#HEX2"]}' },
                    { type: 'image_url', image_url: { url: imageUrl } }
                ]
            }],
            response_format: { type: 'json_object' }
        });
        const result = JSON.parse(response.choices[0].message.content);
        // Nos aseguramos de incluir la URL por si la IA no la puso
        result.url = imageUrl;
        return result;
    } catch (error) {
        console.error(`Error analizando imagen ${imageUrl}:`, error.message);
        return null;
    }
};

module.exports = { generateStructuralProfile, analyzeImageDirecting };