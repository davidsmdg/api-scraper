const { getMemoryByCategory, saveIndustryNews } = require('./supabaseService');
const { callLLM } = require('./aiService');

const generateIndustryNewsPrompt = async (companyData) => {
    const currentYear = 2026;
    const fullMetaPrompt = `Actúa como analista senior en inteligencia competitiva y estructuración de prompts para investigación de mercado.

Recibirás contenido extraído de varias páginas de un sitio web corporativo.

Datos de la empresa:
${JSON.stringify(companyData)}

Tu tarea:
Analizar la información de la empresa y generar un prompt de investigación estratégica profunda optimizado para Kimi K2.5.

⚠️ REGLAS CRÍTICAS PARA EL PROMPT QUE DEBES GENERAR (PARA KIMI):
1. ACTUALIDAD TOTAL: Estamos en el año ${currentYear}. Todas las noticias, tendencias y datos deben ser actuales (2025-2026).
2. BRANDING: El reporte debe encabezarse obligatoriamente con "Elaborado por: Radikal IA".
3. FUENTES Y LINKS: Todas las noticias DEBEN tener el nombre del medio y el LINK (URL) directo a la fuente. No aceptes noticias sin respaldo de link clickable.
4. ALCANCE ESTRATÉGICO Y POLÍTICO: La investigación debe cubrir:
   - Decisiones de gobiernos y nuevas leyes sectoriales.
   - Tratados comerciales y acuerdos internacionales entre países que afecten el mercado.
   - Movimientos directos o indirectos de la competencia y la propia empresa en su región.
5. SIN DESCARGOS DE RESPONSABILIDAD: Prohibido incluir secciones de "Limitaciones del análisis", "Falta de estados financieros" o sugerencias de bases de datos externas. El informe debe ser conclusivo y profesional.
6. FORMATO: Utiliza Markdown con títulos (##), negritas y TABLAS comparativas para que la información sea clara de consumir.

[ESTRUCTURA DEL PROMPT FINAL PARA KIMI]
Actúa como analista senior en inteligencia estratégica de Radikal IA.

Empresa: [nombre]
Sector: [industria]
Contexto: [resumen]

Investiga y genera un reporte de inteligencia para ${currentYear} con las siguientes secciones:
## Informe de Inteligencia Estratégica: [Nombre Empresa]
**Elaborado por: Radikal IA**

- ## Análisis del Entorno Político y Legal: (Leyes, tratados, decretos gubernamentales de impacto).
- ## Noticias Estratégicas y Movimientos del Mercado: (M&A, expansión, nuevos competidores).
- ## Tabla de Tendencias y Disrupciones: (Tendencia | Fuente | Link | Impacto).
- ## Hallazgos Clave: (Lista detallada con Fuente, Link y análisis de impacto).

REGLA DE ORO: Tu salida debe ser ÚNICAMENTE el prompt final generado. Sin explicaciones. Solo el texto.`;

    return await callLLM('openai/gpt-4o', [{ role: 'user', content: fullMetaPrompt }]);
};

const searchIndustryNewsWithKimi = async (kimiPrompt) => {
    return await callLLM('moonshotai/kimi-k2.5', [{ role: 'user', content: kimiPrompt }]);
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
