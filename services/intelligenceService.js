const { getMemoryByCategory, saveIndustryNews, saveCompetitorsNews, saveCompetitor } = require('./supabaseService');
const { callLLM, callKimiWithWebSearch } = require('./aiService');

const extractCompanyDataAndBuildPrompts = async (companyData) => {
    const currentYear = 2026;
    const fullMetaPrompt = `Actúa como analista senior en inteligencia competitiva y estructuración de datos.

Recibirás contenido extraído de varias páginas de un sitio web corporativo.
Datos de la empresa:
${JSON.stringify(companyData)}

Tu tarea:
De la información contenida en Datos de la empresa, debes extraer la siguiente información estratégica y devolverla STRICTAMENTE en un objeto JSON. 

⚠️ Importante:
- No asumas información que no esté en el contenido.
- Debes inferir el contexto empresarial únicamente a partir de los datos proporcionados.

ESTRUCTURA DEL JSON A DEVOLVER:
{
  "nombre": "Nombre de la empresa",
  "web": "Sitio web principal o dominio detectado",
  "resumen": "Resumen claro de lo que hace la empresa, qué ofrece, tipo de clientes y propuesta de valor",
  "industria": "Industria principal identificada",
  "subsector": "Subsector o nicho específico",
  "modelo": "Modelo de negocio (B2B, B2C, SaaS, Marketplace, Servicios, etc.)",
  "paises": "Ubicación o mercados geográficos explícitos (países, ciudades, regiones)",
  "keywords": "5 a 10 palabras clave del sector separadas por comas"
}

REGLA DE ORO: Devuelve ÚNICAMENTE el objeto JSON válido. Sin formateo de markdown \`\`\`json, sin texto adicional, sin saludos.`;

    const extractionResponse = await callLLM('openai/gpt-4o', [{ role: 'user', content: fullMetaPrompt }], true);
    
    let extractedData;
    try {
        extractedData = JSON.parse(extractionResponse);
    } catch (e) {
        console.error("Error parseando el JSON de GPT-4o:", e);
        extractedData = { 
            nombre: "Empresa", web: "N/A", resumen: "N/A", industria: "Sector global", 
            subsector: "N/A", modelo: "N/A", paises: "Global", keywords: "negocios" 
        };
    }

    // AHORA construimos el prompt final para NOTICIAS
    const newsPrompt = `=============================
# Informe de Inteligencia Sectorial: ${extractedData.nombre}
**Elaborado por: Radikal IA**
**Año de Análisis: ${currentYear}**
=============================

Empresa objetivo
Nombre: ${extractedData.nombre}
Web: ${extractedData.web}

Contexto de la empresa
${extractedData.resumen}

Información estratégica detectada
- Industria principal: ${extractedData.industria}
- Subsector o nicho: ${extractedData.subsector}
- Modelo de negocio: ${extractedData.modelo}
- Ubicación o mercado geográfico: ${extractedData.paises}
- Palabras clave del sector: ${extractedData.keywords}

Instrucciones Críticas de Investigación:
Inicia una investigación profunda usando tu herramienta $web_search ahora mismo. 
Tu objetivo es identificar noticias estratégicas, tendencias sectoriales y cambios estructurales del año ${currentYear} que puedan afectar a la empresa.

DEBES SEGUIR ESTOS PASOS ESTRICTOS EN TU RESPUESTA (NO SALUDES NI PIDAS PERMISO, EJECUTA INMEDIATAMENTE Y ENTREGA TODO ESTE INFORME MARKDOWN):

Paso 1 – Identificación base
Muestra un breve párrafo confirmando la Industria y los Países sobre los cuales ejecutarás la búsqueda.

Paso 2 – Noticias estratégicas sectoriales (PRIORIDAD ALTA)
Busca noticias externas exclusivamente del año ${currentYear} que afecten la industria.
Requisito OBLIGATORIO: Cada noticia debe tener una FUENTE y URL DIRECTA Y CLICKABLE.
Formato: Titular | Medio | URL | Fecha | País | Impacto | Resumen del impacto.

Paso 3 – Tendencias estructurales del sector (${currentYear})
Identifica tendencias clave transformando el sector. Incluye: Nombre, Impacto esperado, y Fuente con URL confirmando.

Paso 4 – Fuentes consultadas
Lista de todas las fuentes.

EJECUTA ESTO AHORA MISMO. EN TU RESPUESTA SÓLO QUIERO VER EL REPORTE MARKDOWN FINALIZADO.`;

    // AHORA construimos el prompt final para COMPETIDORES
    const competitorsPrompt = `Actúa como analista estratégico senior especializado en inteligencia competitiva internacional.

=============================
# Informe de Inteligencia Competitiva: ${extractedData.nombre}
**Elaborado por: Radikal IA**
=============================

Empresa objetivo:
Nombre: ${extractedData.nombre}
Web: ${extractedData.web}
Contexto de la empresa: ${extractedData.resumen}

Información estratégica detectada:
- Industria principal: ${extractedData.industria}
- Subsector o nicho: ${extractedData.subsector}
- Modelo de negocio: ${extractedData.modelo}
- Ubicación o mercado geográfico: ${extractedData.paises}

INSTRUCCIONES DE INVESTIGACIÓN: INICIA TU HERRAMIENTA $web_search AHORA MISMO.
NO SALUDES NI EXPLIQUES, ENTREGA EL REPORTE FINAL DE INMEDIATO EN MARKDOWN AL FINALIZAR TUS BÚSQUEDAS.

Paso 1 – Determinar países válidos
Solo considera los países extraídos: ${extractedData.paises}. El análisis competitivo debe limitarse a estos países.

Proceso de investigación competitiva
Realiza la búsqueda guiándote por estas directrices:

Fase 1 – Identificación de competidores
Selecciona entre 5 y 10 competidores reales. Para cada uno incluye:
- Nombre
- Web oficial
- País sede
- País donde compite con la empresa
- Modelo de negocio
- Evidencia verificable de competencia (LINK OBLIGATORIO). Si no hay evidencia, no lo incluyas.

Fase 2 – Clasificación estratégica
Nivel 1 (Crítica), Nivel 2 (Diferenciada), Nivel 3 (Sustituto), Nivel 4 (Referente).

Fase 3 – Evaluación cuantitativa
Evalúa del 1 al 5: Participación estimada, Innovación, Fortaleza digital, Experiencia cliente, Poder de pricing, Escalabilidad. Calcula un score sobre 100.

Fase 4 – Análisis profundo (Top 3)
Analiza Modelo de negocio, Ventajas, Estrategia digital, Capacidad competitiva, Probabilidad de quitar cuota.

Fase 5 – Diagnóstico estratégico
Responde: amenaza real en 12 meses, mayor riesgo estructural, y propone 3 acciones estratégicas concretas para 90 días.

ENTREGA EXCLUSIVAMENTE EL REPORTE MARKDOWN COMPLETO. TE ESTÁ PROHIBIDO SALUDAR NI EXPLICAR QUÉ VAS A BUSCAR.`;

    return { newsPrompt, competitorsPrompt, extractedData };
};

const searchWithKimi = async (kimiPrompt) => {
    const messages = [
        { 
            role: 'system', 
            content: 'Eres un analista de inteligencia estratégica de Radikal IA. Tu misión es investigar exhaustivamente en la web utilizando tu herramienta $web_search y emitir el reporte final en ESPAÑOL. PROHIBIDO decir "voy a buscar" o "aquí tienes". Utiliza tus herramientas de inmediato, procesa los resultados y devuelve UNICAMENTE el reporte completo y profesional en formato Markdown con sus respectivas URL y enlaces.' 
        },
        { role: 'user', content: kimiPrompt }
    ];
    return await callKimiWithWebSearch(messages);
};

// Función para extraer competidores del reporte Markdown e insertarlos a BD
const parseAndSaveCompetitors = async (markdownReport, companyId, projectId) => {
    const extractPrompt = `Eres un extractor de datos. 
Tengo el siguiente reporte de competencia generado por IA:
\`\`\`
${markdownReport}
\`\`\`

Extrae el listado de competidores mencionados en la "Fase 1 - Identificación de competidores" (o en cualquier parte del texto).
Devuelve la información ESTRICTAMENTE en formato JSON plano sin markdown.
Debe ser un array de objetos con las siguientes llaves:
[
  { "name": "Nombre Competidor", "website_url": "www.competidor.com", "relevance_score": 50 }
]
El relevance_score debe ser su score numérico estimado sobre 100 si existe en el reporte, o un default de 50 si no lo encuentras. No inventes llaves nuevas, devuelve SÓLO JSON.`;

    try {
        const jsonResponse = await callLLM('openai/gpt-4o', [{ role: 'user', content: extractPrompt }], true);
        const competitorsArray = JSON.parse(jsonResponse);
        
        let savedCount = 0;
        for (const comp of competitorsArray) {
            await saveCompetitor({
                project_id: projectId,
                name: comp.name,
                website_url: comp.website_url,
                relevance_score: comp.relevance_score,
                is_active: true
            });
            savedCount++;
        }
        console.log(`[Intelligence] Guardados ${savedCount} competidores en base de datos.`);
    } catch (e) {
        console.error("Error extrayendo y guardando competidores individuales:", e);
    }
};

const onboardingIndustryNewsFlow = async (userId, projectId) => {
    console.log(`[Intelligence] Iniciando flujo paralelo de noticias de industria y reporte de competencia para User: ${userId}`);

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

    // 2. Extraer datos y generar ambos prompts
    console.log(`[Intelligence] Generando contexto base con GPT-4o...`);
    const { newsPrompt, competitorsPrompt, extractedData } = await extractCompanyDataAndBuildPrompts(companyData);

    // 3. Ejecutar ambas investigaciones con Kimi K2.5 en PANALELO
    console.log(`[Intelligence] Ejecutando investigaciones concurrentes con Kimi K2.5 (Noticias y Competencia)...`);
    
    const [newsResponse, competitorsResponse] = await Promise.all([
        searchWithKimi(newsPrompt),
        searchWithKimi(competitorsPrompt)
    ]);

    // 4. Guardar documento de noticias
    console.log(`[Intelligence] Guardando investigación de noticias...`);
    const newsTitle = `Investigación Sectorial - ${extractedData.nombre} - ${new Date().toLocaleDateString()}`;
    await saveIndustryNews({
        user_id: userId,
        project_id: projectId,
        title: newsTitle,
        full_content: newsResponse,
        saved_content: ''
    });

    // 5. Guardar documento de competencia
    console.log(`[Intelligence] Guardando investigación de competencia...`);
    const compTitle = `Análisis Competitivo - ${extractedData.nombre} - ${new Date().toLocaleDateString()}`;
    await saveCompetitorsNews({
        user_id: userId,
        project_id: projectId,
        title: compTitle,
        content: competitorsResponse
    });

    // 6. Extraer limpiamente los competidores a su tabla respectiva para futuro scraping
    console.log(`[Intelligence] Extrayendo entidades competidoras en segundo plano...`);
    await parseAndSaveCompetitors(competitorsResponse, userId, projectId);

    console.log(`[Intelligence] Flujo paralelo completado con éxito.`);

    return { 
        success: true, 
        title: newsTitle, // Compatibilidad con frontend antiguo
        full_content: newsResponse, // Compatibilidad con frontend antiguo
        newsTitle,
        newsContent: newsResponse,
        competitorsTitle: compTitle,
        competitorsContent: competitorsResponse
    };
};

const refreshCompetitorsFlow = async (userId, projectId) => {
    console.log(`[Intelligence] Iniciando refresco aislado de competencia para User: ${userId}`);

    const memories = await getMemoryByCategory(userId, 'Info_competencia_noticias', projectId);
    if (!memories || memories.length === 0) {
        throw new Error('No se encontró Info_competencia_noticias en BD.');
    }

    const infoPack = JSON.parse(memories[0].content);
    const companyData = infoPack.pages.map(p => ({
        url: p.url,
        title: p.title || '',
        text: p.text
    }));

    console.log(`[Intelligence] Generando contexto base con GPT-4o para Competidores...`);
    const { competitorsPrompt, extractedData } = await extractCompanyDataAndBuildPrompts(companyData);

    console.log(`[Intelligence] Ejecutando investigación con Kimi K2.5 (Solo Competencia)...`);
    const competitorsResponse = await searchWithKimi(competitorsPrompt);

    console.log(`[Intelligence] Guardando investigación de competencia...`);
    const compTitle = `Análisis Competitivo (Refresh) - ${extractedData.nombre} - ${new Date().toLocaleDateString()}`;
    await saveCompetitorsNews({
        user_id: userId,
        project_id: projectId,
        title: compTitle,
        content: competitorsResponse
    });

    console.log(`[Intelligence] Extrayendo entidades competidoras en segundo plano...`);
    await parseAndSaveCompetitors(competitorsResponse, userId, projectId);

    console.log(`[Intelligence] Refresco aislado completado con éxito.`);

    return { 
        success: true, 
        title: compTitle,
        content: competitorsResponse
    };
};

module.exports = { onboardingIndustryNewsFlow, refreshCompetitorsFlow };
