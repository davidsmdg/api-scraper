const { getMemoryByCategory, saveIndustryNews } = require('./supabaseService');
const { callLLM, callKimiWithWebSearch } = require('./aiService');

const generateIndustryNewsPrompt = async (companyData) => {
    const currentYear = 2026;
    const fullMetaPrompt = `Actúa como analista senior en inteligencia competitiva y estructuración de prompts para investigación de mercado.

Recibirás contenido extraído de varias páginas de un sitio web corporativo.

Datos de la empresa:
${JSON.stringify(companyData)}

Recibirás datos brutos de una empresa. Tu única misión es extraer el contexto y redactar un PROMPT INSTRUCCIONAL en ESPAÑOL para que otra IA (Kimi K2.5) realice una búsqueda en la web.

Datos de la empresa:
${JSON.stringify(companyData)}

[REGLAS DEL PROMPT QUE DEBES REDACTAR PARA KIMI]
1. ACTUALIDAD: Centrado en el año ${currentYear}.
2. IDIOMA: El prompt debe ordenarle a Kimi investigar y responder ÚNICAMENTE en ESPAÑOL.
3. BRANDING: El reporte final debe decir "Elaborado por: Radikal IA".
4. LINKS: Obligatorio incluir URLs directas de las fuentes.
5. GEOPOLÍTICA: Incluir búsqueda de leyes, tratados y decisiones de gobierno.
6. SIN COMENTARIOS: No incluyas "Limitaciones" ni disculpas por falta de datos.

[ESTRUCTURA DEL PROMPT QUE DEBES ENTREGAR]
Actúa como investigador senior de Radikal IA. Tu objetivo es redactar un informe de inteligencia en ESPAÑOL sobre la empresa [Nombre].
Investiga en la web noticias de ${currentYear} sobre:
- Cambios legales y políticos en [Ubicación].
- Tendencias de mercado en [Sector].
Importante: Cada hallazgo debe llevar su Fuente y Link clickable.
Formato: Markdown con tablas y títulos.

REGLA DE ORO: Tu salida debe ser ÚNICAMENTE el texto del prompt para la otra IA. No me hables a mí. No saludes. No expliques. Solo el prompt.`;

    return await callLLM('openai/gpt-4o', [{ role: 'user', content: fullMetaPrompt }]);
};

const searchIndustryNewsWithKimi = async (kimiPrompt) => {
    // Forzamos el idioma español y el rol de experto en el sistema de Kimi
    const messages = [
        { 
            role: 'system', 
            content: 'Eres un analista de inteligencia estratégica de Radikal IA. Tu misión es investigar la web y entregar reportes de alto valor en ESPAÑOL. Tienes acceso a herramientas de navegación en tiempo real para obtener datos de 2026. Siempre incluye links directos a las fuentes.' 
        },
        { role: 'user', content: kimiPrompt }
    ];
    
    // Usamos el cliente nativo con soporte oficial de tools (web_search)
    return await callKimiWithWebSearch(messages);
};

// Ya no es necesario parsear noticias individuales, guardamos el bloque completo.

const onboardingIndustryNewsFlow = async (userId, projectId) => {
    console.log(`[Intelligence] Iniciando flujo de noticias de industria para User: ${userId}`);

    // 1. Obtener contexto del onboarding
    const memories = await getMemoryByCategory(userId, 'Info_competencia_noticias', projectId);
    if (!memories || memories.length === 0) {
        throw new Error('No se encontró Info_competencia_noticias en la base de datos.');
    }

    const infoPack = JSON.parse(memories[0].content);
    const companyData = infoPack.pages.map(p => ({
        url: p.url,
        title: p.title || '',
        text: p.text
    }));

    // 2. Generar el prompt para Kimi usando GPT-4o
    console.log(`[Intelligence] Generando prompt de investigación con GPT-4o...`);
    const kimiPrompt = await generateIndustryNewsPrompt(companyData);

    // 3. Ejecutar investigación con Kimi K2.5
    console.log(`[Intelligence] Ejecutando investigación con Kimi K2.5...`);
    const kimiResponse = await searchIndustryNewsWithKimi(kimiPrompt);

    // 4. Guardar documento completo
    console.log(`[Intelligence] Guardando investigación completa...`);
    
    // Extraer un título simple del contexto o usar uno genérico
    const mainTitle = `Investigación Estratégica Sectorial - ${new Date().toLocaleDateString()}`;

    const newsData = {
        user_id: userId,
        project_id: projectId,
        title: mainTitle,
        full_content: kimiResponse,
        saved_content: ''
    };

    await saveIndustryNews(newsData);
    console.log(`[Intelligence] Investigación guardada con éxito.`);

    return { 
        success: true, 
        title: mainTitle,
        full_content: kimiResponse
    };
};

module.exports = { onboardingIndustryNewsFlow };
