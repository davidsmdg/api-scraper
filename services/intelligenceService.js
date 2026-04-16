const { getMemoryByCategory, saveIndustryNews } = require('./supabaseService');
const { callLLM, callKimiWithWebSearch } = require('./aiService');

const generateIndustryNewsPrompt = async (companyData) => {
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
  "paises": "Ubicación o mercados geográficos (países, ciudades, regiones)",
  "keywords": "5 a 10 palabras clave del sector separadas por comas"
}

REGLA DE ORO: Devuelve ÚNICAMENTE el objeto JSON válido. Sin formateo de markdown \`\`\`json, sin texto adicional, sin saludos.`;

    // Usamos jsonMode en callLLM para garantizar que gpt-4o responda en JSON puro
    const extractionResponse = await callLLM('openai/gpt-4o', [{ role: 'user', content: fullMetaPrompt }], true);
    
    let extractedData;
    try {
        extractedData = JSON.parse(extractionResponse);
    } catch (e) {
        console.error("Error parseando el JSON de GPT-4o:", e);
        // Fallback básico si falla el parseo
        extractedData = { 
            nombre: "Empresa", web: "N/A", resumen: "N/A", industria: "Sector global", 
            subsector: "N/A", modelo: "N/A", paises: "Global", keywords: "negocios" 
        };
    }

    // AHORA construimos el prompt final e impecable para Kimi desde el backend, a prueba de fallos.
    const finalKimiPrompt = `=============================
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

DEBES SEGUIR ESTOS PASOS ESTRICTOS EN TU RESPUESTA (NO SALUDES NI PIDAS PERMISO, EJECUTA INMEDIATAMENTE Y ENTREGA TODO ESTE INFORME):

Paso 1 – Identificación base
Muestra un breve párrafo confirmando la Industria y los Países sobre los cuales ejecutarás la búsqueda.

Paso 2 – Noticias estratégicas sectoriales (PRIORIDAD ALTA)
Busca noticias externas exclusivamente del año ${currentYear} que afecten:
la industria principal, regulaciones, M&A, tecnología o expansión.
Requisito OBLIGATORIO: Cada noticia debe tener una FUENTE y URL DIRECTA Y CLICKABLE.

Formato para cada noticia (Usa tablas de ser posible):
- Titular | Medio | URL | Fecha | País | Impacto (Positivo/Negativo) | Resumen del impacto.

Paso 3 – Tendencias estructurales del sector (${currentYear})
Identifica tendencias clave transformando el sector (digitalización, sostenibilidad, regulaciones, etc.).
Para cada tendencia incluye: Nombre, Impacto esperado, y Fuente con URL confirmando la tendencia.

Paso 4 – Fuentes consultadas
Lista de todas las fuentes: Medio | Título | URL completa

EJECUTA ESTO AHORA MISMO. EN TU RESPUESTA SÓLO QUIERO VER EL REPORTE MARKDOWN FINALIZADO.`;

    return finalKimiPrompt;
};

const searchIndustryNewsWithKimi = async (kimiPrompt) => {
    // Forzamos el idioma español y el rol de experto en el sistema de Kimi
    const messages = [
        { 
            role: 'system', 
            content: 'Eres un analista de inteligencia estratégica de Radikal IA. Tu misión es investigar exhaustivamente en la web utilizando tu herramienta $web_search y emitir el reporte final en ESPAÑOL. Estamos en el año 2026 y necesitas datos actuales. PROHIBIDO decir "voy a buscar" o "aquí tienes". Utiliza tus herramientas de inmediato, procesa los resultados y devuelve UNICAMENTE el reporte completo y profesional en formato Markdown con sus respectivas URL y enlaces.' 
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
