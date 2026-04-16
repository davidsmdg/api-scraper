const { getMemoryByCategory, saveIndustryNews } = require('./supabaseService');
const { callLLM } = require('./aiService');

const generateIndustryNewsPrompt = async (companyData) => {
    const metaPrompt = `Actúa como analista senior en inteligencia competitiva y estructuración de prompts para investigación de mercado.

Recibirás contenido extraído de varias páginas de un sitio web corporativo.

Toda la información disponible viene en la siguiente variable:

Datos de la empresa:
${JSON.stringify(companyData)}

Tu tarea:
Debes analizar la información contenida en Datos de la empresa y generar un prompt optimizado para investigación sectorial profunda que será utilizado por un motor de investigación externa.

⚠️ Importante:
No asumas información que no esté en el contenido.
Las empresas pueden pertenecer a cualquier industria.
Debes inferir el contexto empresarial únicamente a partir de los datos proporcionados.

Paso 1 — Analizar el sitio web:
A partir de la información contenida en Datos de la empresa, identifica:
1. Nombre de la empresa
2. Sitio web principal
3. Resumen de la empresa
4. Industria (Principal y Subsector)
5. Modelo de negocio
6. Ubicación o mercado geográfico
7. Palabras clave del sector

Paso 2 — Generar el prompt de investigación sectorial:
Debes generar UN SOLO TEXTO que será utilizado directamente para realizar investigación estratégica externa.

Estructura obligatoria del prompt que debes generar:

Actúa como analista senior en inteligencia competitiva y monitoreo sectorial.

Empresa objetivo
Nombre: [nombre detectado]
Web: [dominio detectado]

Contexto de la empresa (extraído de su sitio web)
[Resumen claro de la empresa]

Información estratégica detectada
Industria principal: [industria]
Subsector o nicho: [subsector]
Modelo de negocio: [modelo]
Ubicación o mercado geográfico: [países o regiones detectadas]
Palabras clave del sector: [keywords]

Objetivo de la investigación:
Identificar noticias estratégicas, tendencias sectoriales y cambios estructurales que puedan afectar positiva o negativamente a la empresa o a su industria.

Paso 1 – Identificación base
... (resto de las instrucciones del paso 1, 2, 3 y 4 proporcionadas por el usuario) ...

REGLA DE ORO: Tu salida debe ser UNICAMENTE el prompt final generado. No expliques nada.`;

    // Usamos el texto completo de las instrucciones del usuario para el prompt final
    const fullMetaPrompt = `Actúa como analista senior en inteligencia competitiva y estructuración de prompts para investigación de mercado.

Recibirás contenido extraído de varias páginas de un sitio web corporativo.

Toda la información disponible viene en la siguiente variable:

Datos de la empresa:
${JSON.stringify(companyData)}

Tu tarea:
Debes analizar la información contenida en Datos de la empresa y generar un prompt optimizado para investigación sectorial profunda que será utilizado por un motor de investigación externa.

⚠️ Importante:
No asumas información que no esté en el contenido.
Las empresas pueden pertenecer a cualquier industria.
Debes inferir el contexto empresarial únicamente a partir de los datos proporcionados.

Paso 1 — Analizar el sitio web:
Identify Name, Website, Summary, Industry (Principal/Subsector), Business Model, Location, Keywords.

Paso 2 — Generar el prompt de investigación sectorial:
Genera el texto listo para Kimi.

[ESTRUCTURA DEL PROMPT PARA KIMI]
Actúa como analista senior en inteligencia competitiva y monitoreo sectorial.

Empresa objetivo
Nombre: [nombre]
Web: [web]

Contexto de la empresa (extraído de su sitio web)
[Resumen]

Información estratégica detectada
Industria principal: [industria]
Subsector o nicho: [subsector]
Modelo de negocio: [modelo]
Ubicación o mercado geográfico: [ubicación]
Palabras clave del sector: [keywords]

Objetivo de la investigación:
Identificar noticias estratégicas, tendencias sectoriales y cambios estructurales.

Paso 1 – Identificación base:
Identifica los países o ciudades donde la empresa opera.

Paso 2 – Noticias estratégicas sectoriales (PRIORIDAD ALTA):
Busca noticias externas del último año.
Cada noticia debe incluir: Titular, Medio, URL, Fecha, País, Resumen estratégico, Impacto esperado, Área afectada.

Paso 3 – Tendencias estructurales del sector:
...
Paso 4 – Proyecciones de crecimiento del sector:
...
Sección final obligatoria – Fuentes consultadas:
...

REGLA DE ORO: Tu salida debe ser ÚNICAMENTE el prompt final generado. Sin explicaciones. Sin bloques de código markdown. Solo el texto.`;

    return await callLLM('openai/gpt-4o', [{ role: 'user', content: fullMetaPrompt }]);
};

const searchIndustryNewsWithKimi = async (kimiPrompt) => {
    return await callLLM('moonshotai/kimi-k2.5', [{ role: 'user', content: kimiPrompt }]);
};

const parseKimiNews = (userId, projectId, text) => {
    const newsItems = [];
    
    // Regex para capturar los bloques de noticias basándonos en el formato solicitado
    // Titular, Medio, URL, Fecha, País, Resumen, Impacto, Área
    const newsBlocks = text.split(/Titular:?\s*/i).slice(1);

    for (const block of newsBlocks) {
        try {
            const lines = block.split('\n');
            const title = lines[0].trim();
            
            const mediaMatch = block.match(/Medio o publicación:?\s*(.*)/i);
            const urlMatch = block.match(/URL de la fuente:?\s*(.*)/i);
            const dateMatch = block.match(/Fecha:?\s*(.*)/i);
            const countryMatch = block.match(/País:?\s*(.*)/i);
            const summaryMatch = block.match(/Resumen estratégico:?\s*([\s\S]*?)(?=Impacto esperado|$)/i);
            const impactMatch = block.match(/Impacto esperado:?\s*(.*)/i);
            const areaMatch = block.match(/Área afectada:?\s*(.*)/i);

            if (title) {
                newsItems.push({
                    user_id: userId,
                    project_id: projectId,
                    title: title,
                    media: mediaMatch ? mediaMatch[1].trim() : null,
                    url: urlMatch ? urlMatch[1].trim() : null,
                    published_at: dateMatch ? dateMatch[1].trim() : null,
                    country: countryMatch ? countryMatch[1].trim() : null,
                    summary: summaryMatch ? summaryMatch[1].trim() : null,
                    impact: impactMatch ? impactMatch[1].trim() : null,
                    area_affected: areaMatch ? areaMatch[1].trim() : null,
                    is_saved: false
                });
            }
        } catch (e) {
            console.error('Error parseando bloque de noticia:', e.message);
        }
    }

    return newsItems;
};

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

    // 4. Parsear y Guardar
    console.log(`[Intelligence] Procesando y guardando noticias...`);
    const newsItems = parseKimiNews(userId, projectId, kimiResponse);
    
    if (newsItems.length > 0) {
        await saveIndustryNews(newsItems);
        console.log(`[Intelligence] ${newsItems.length} noticias guardadas con éxito.`);
    } else {
        console.warn(`[Intelligence] No se detectaron noticias estructuradas en la respuesta de Kimi.`);
    }

    return { 
        success: true, 
        newsCount: newsItems.length,
        rawOutput: kimiResponse // Por si queremos ver las tendencias/proyecciones que no guardamos en tabla estructurada todavía
    };
};

module.exports = { onboardingIndustryNewsFlow };
