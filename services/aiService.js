const { OpenAI } = require('openai');
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Genera el perfil de marca completo compatible con el frontend de Radikal IA.
 * Utilizando el esquema mejorado y crítico de n8n para análisis estratégico profundo.
 */
const generateStructuralProfile = async (text, imagesAnalysisText = "") => {
    try {
        const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o', 
            messages: [{ 
                role: 'system',
                content: 'Rol: Eres un experto Analista Estratégico de Negocios, Especialista en Branding y Diseñador UX/UI. Tu objetivo es analizar datos extraídos de una página web y el análisis visual de sus imágenes para generar un reporte de hallazgos (insights) integral, estructurado y de alto valor.'
            }, { 
                role: 'user', 
                content: `ENTRADAS DE DATOS DINÁMICOS:
Datos Web: ${text.slice(0, 30000)}
Análisis de Imágenes: ${imagesAnalysisText}

INSTRUCCIONES DE ANÁLISIS Y REDACCIÓN:
1. Analiza los datos web para entender el modelo de negocio completo y los datos de imágenes para definir la dirección de arte.
2. Evalúa las estadísticas de color: asume que los colores frecuentes son funcionales y busca en 'brand_colors_guess' los de identidad. Extrae obligatoriamente los códigos HEX. (De no encontrar, infiere colores principales por tu análisis).
3. EXTENSIÓN OBLIGATORIA: En cada campo de texto descriptivo/analítico, debes escribir entre 5 y 7 líneas de texto.
4. ENFOQUE CRÍTICO: En cada análisis, además de describir, debes identificar explícitamente una oportunidad de mejora, una brecha detectada o una crítica constructiva relacionada con ese punto.

⚠️ DIRECTRICES DE SISTEMA CRÍTICAS (NIVEL MÁQUINA A MÁQUINA) ⚠️
Tu respuesta será procesada directamente por un script automatizado. Cualquier violación a las siguientes reglas causará un error fatal en el sistema.

- REGLA 1 (CERO TEXTO ADICIONAL): No incluyas saludos, introducciones, explicaciones, ni notas finales. Tu respuesta debe comenzar con el carácter "{" y terminar con el carácter "}".
- REGLA 2 (PROHIBIDO MARKDOWN): ESTÁ ESTRICTAMENTE PROHIBIDO usar bloques de código Markdown. NO uses \`\`\`json, ni \`\`\` al principio o al final de tu respuesta.
- REGLA 3 (MINIFICACIÓN OBLIGATORIA): Devuelve el JSON en UNA SOLA LÍNEA DE TEXTO. No uses saltos de línea literales (ni presiones "Enter"). Todo debe ser continuo.
- REGLA 4 (ESCAPADO CORRECTO): Si necesitas usar comillas dobles dentro de tus textos analíticos, debes escaparlas obligatoriamente (ejemplo: \\"texto\\").
- REGLA 5 (ESTRUCTURA INMUTABLE): Usa EXACTAMENTE las claves proporcionadas en el esquema base. No inventes claves nuevas, ni agregues arrays u objetos anidados que no se hayan solicitado.

ESQUEMA BASE REQUERIDO (REPLICAR EXACTAMENTE ESTA ESTRUCTURA EN UNA SOLA LÍNEA):
{"identidad_esencia": "Resumen de historia/origen y propuesta de valor + Crítica sobre la claridad/relevancia del mensaje actual.","portafolio_productos": "Categorías principales y líneas de negocio + Análisis crítico de la arquitectura del portafolio o brechas en la oferta.","ventaja_competitiva": "Tecnologías y diferenciadores clave + Evaluación de si la ventaja es sostenible o bien comunicada.","tono_comunicacion": "Personalidad y voz de la marca + Crítica sobre la coherencia o el nivel de engagement del tono.","sistema_cromatico": {"colores_neutros_funcionales": ["#HEX1", "#HEX2", "#HEX3"],"colores_acento_marca": ["#HEX4", "#HEX5"],"analisis": "Análisis de contraste, accesibilidad o psicología del color basado en los códigos extraídos + Crítica sobre el uso del color y coherencia. (Debe cumplir la regla de 5 a 7 líneas)."},"direccion_visual_imagenes": "Estilo fotográfico, empaques y composición + Mejoras sugeridas en dirección de arte o consistencia.","presencia_ubicaciones": "Formatos físicos y geografía + Análisis de cobertura o estrategia de localización.","perfil_audiencia": "Segmentación deducida + Identificación de nichos desatendidos o audiencias potenciales.","canales_contacto": "Ecosistema de atención + Crítica sobre la fricción en la experiencia de contacto (CX).","oportunidades_mejora": "Sugerencias estratégicas macro (visual, navegación, comunicación) + Priorización de acciones de alto impacto."}` 
            }]
        });
        
        let rawContent = response.choices[0].message.content.trim();
        
        if (rawContent.startsWith('```json')) {
            rawContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (rawContent.startsWith('```')) {
            rawContent = rawContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        return JSON.parse(rawContent);
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
                    { type: 'text', text: 'Analiza la dirección de arte de esta imagen. Devuelve UNICAMENTE un JSON con: {"url": "URL_DE_LA_IMAGEN", "analysis": "Descripción del estilo, composición y elementos clave", "colors": ["#HEX1", "#HEX2"]}' },
                    { type: 'image_url', image_url: { url: imageUrl } }
                ]
            }],
            response_format: { type: 'json_object' }
        });
        const result = JSON.parse(response.choices[0].message.content);
        result.url = imageUrl;
        return result;
    } catch (error) {
        console.error(`Error analizando imagen ${imageUrl}:`, error.message);
        return null;
    }
};

const callLLM = async (model, messages, jsonMode = false, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const options = {
                model: model,
                messages: messages
            };
            
            if (jsonMode) {
                options.response_format = { type: 'json_object' };
            }

            const response = await openai.chat.completions.create(options);
            return response.choices[0].message.content.trim();
        } catch (error) {
            lastError = error;
            console.error(`Intento ${attempt}/${maxRetries} fallido llamando a LLM (${model}):`, error.message);
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s...
                console.log(`Reintentando en ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    console.error(`Error definitivo tras ${maxRetries} intentos en LLM (${model}):`, lastError.message);
    throw lastError;
};

/**
 * Función especializada para Kimi usando la API nativa de Moonshot,
 * habilitando explícitamente $web_search y deshabilitando "thinking"
 * según la documentación oficial para evitar problemas de razonamiento.
 */
const callKimiWithWebSearch = async (messages) => {
    try {
        console.log("[Intelligence] Iniciando investigación profunda en la web con la API nativa de Kimi...");
        
        // Inicialización dinámica para garantizar la lectura de process.env.MOONSHOT_API_KEY
        // y usando la URL exacta proporcionada en el ejemplo: api.moonshot.ai
        const moonshotClient = new OpenAI({
            baseURL: 'https://api.moonshot.ai/v1',
            apiKey: process.env.MOONSHOT_API_KEY,
        });

        const tools = [
            {
                "type": "builtin_function",
                "function": {
                    "name": "$web_search",
                }
            }
        ];

        let finishReason = null;
        let currentMessages = [...messages];
        
        while (finishReason === null || finishReason === "tool_calls") {
            const completion = await moonshotClient.chat.completions.create({
                model: "kimi-k2.5", 
                messages: currentMessages,
                temperature: 0.6,
                tools: tools,
                thinking: {"type": "disabled"} // Crítico según la documentación
            });

            const choice = completion.choices[0];
            finishReason = choice.finish_reason;

            if (finishReason === "tool_calls") {
                console.log("[Intelligence] Kimi solicitó ejecutar una herramienta (búsqueda web)...");
                currentMessages.push(choice.message);

                for (const toolCall of choice.message.tool_calls) {
                    const toolCallName = toolCall.function.name;
                    const toolCallArguments = JSON.parse(toolCall.function.arguments);
                    
                    let toolResult = null;
                    if (toolCallName === "$web_search") {
                        console.log("[Intelligence] Procesando argumentos para la búsqueda web de Moonshot...");
                        toolResult = toolCallArguments; // Se devuelve tal cual
                    } else {
                        toolResult = "no tool found";
                    }

                    // Inyectar contexto de la herramienta
                    currentMessages.push({
                        "role": "tool",
                        "tool_call_id": toolCall.id,
                        "name": toolCallName,
                        "content": JSON.stringify(toolResult),
                    });
                }
            } else {
                console.log("[Intelligence] Búsqueda y análisis completados por Kimi.");
                return choice.message.content.trim();
            }
        }
    } catch (error) {
        console.error("Error en callKimiWithWebSearch:", error.message);
        throw error;
    }
};

module.exports = { generateStructuralProfile, analyzeImageDirecting, callLLM, callKimiWithWebSearch };
