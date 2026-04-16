const { getMemoryByCategory, saveIndustryNews } = require('./supabaseService');
const { callLLM, callKimiWithWebSearch } = require('./aiService');

const generateIndustryNewsPrompt = async (companyData) => {
    const currentYear = 2026;
    const fullMetaPrompt = `Actúa como analista senior en inteligencia competitiva y estructuración de prompts para investigación de mercado.

Recibirás contenido extraído de varias páginas de un sitio web corporativo.

Toda la información disponible viene en la siguiente variable:
Datos de la empresa:
${JSON.stringify(companyData)}

Tu tarea:
Debes analizar la información contenida en Datos de la empresa y generar un prompt optimizado para investigación sectorial profunda que será utilizado por un motor de investigación externa, para obtener datos y eventos enfocados estrictamente en el año ${currentYear}.

⚠️ Importante:
- No asumas información que no esté en el contenido.
- Las empresas pueden pertenecer a cualquier industria.
- Debes inferir el contexto empresarial únicamente a partir de los datos proporcionados.

Paso 1 — Analizar el sitio web
A partir de la información contenida en Datos de la empresa, identifica:
1. Nombre de la empresa: (títulos, encabezados, repeticiones)
2. Sitio web principal: (dominio)
3. Resumen de la empresa: (qué hace, qué ofrece, tipo de clientes, propuesta de valor)
4. Industria: (Principal, Subsector o nicho)
5. Modelo de negocio: (B2B, B2C, B2B2C, SaaS, Marketplace, Servicios, Manufactura, Otro)
6. Ubicación o mercado geográfico: (países, ciudades, regiones)
7. Palabras clave del sector: (entre 5 y 10 keywords)

Paso 2 — Generar el prompt de investigación sectorial
Debes generar UN SOLO TEXTO que será utilizado directamente para realizar investigación estratégica externa.
El prompt debe incluir: contexto, industria, modelo de negocio, ubicación, y palabras clave.

Estructura obligatoria del prompt que debes generar:

Actúa como investigador senior de Radikal IA en inteligencia competitiva y monitoreo sectorial. 

=============================
# Informe de Inteligencia Sectorial: [nombre detectado]
**Elaborado por: Radikal IA**
**Año de Análisis: ${currentYear}**
=============================

Empresa objetivo
Nombre: [nombre detectado]
Web: [dominio detectado]

Contexto de la empresa
[Resumen claro de la empresa]

Información estratégica detectada
- Industria principal: [industria]
- Subsector o nicho: [subsector]
- Modelo de negocio: [modelo]
- Ubicación o mercado geográfico: [países o regiones]
- Palabras clave del sector: [keywords]

Objetivo de la investigación
Identificar noticias estratégicas, tendencias sectoriales y cambios estructurales del año ${currentYear} que puedan afectar positiva o negativamente a la empresa o a su industria.

Paso 1 – Identificación base
Confirma o ajusta si es necesario: Industria, Subsector, Modelo de negocio.
Muestra brevemente la Industria detectada y Lista de países válidos.

Paso 2 – Noticias estratégicas sectoriales (PRIORIDAD ALTA)
Busca noticias externas exclusivamente del año ${currentYear} que afecten:
la industria principal, sector económico, regulaciones o leyes, decisiones gubernamentales, cambios impositivos, tendencias de crecimiento/contracción, inversiones, M&A, competencia, innovaciones tecnológicas, cambios de consumidor, expansión internacional.
Las noticias deben estar relacionadas con la industria global o los países válidos.
⚠️ Si no hay noticias específicas del país, incluye sectoriales globales.
⚠️ No incluyas noticias íntimas o puramente internas de la empresa, enfócate en el ENTORNO Y SECTOR donde la empresa se mueve.

Requisito obligatorio de fuentes:
Cada noticia debe incluir SIEMPRE una fuente verificable con URL directa y clickeable. No se permite incluir noticias sin fuente.

Formato obligatorio por noticia (Usa Tablas o Listas Claras):
- Titular
- Medio o publicación
- URL de la fuente (Clickable)
- Fecha
- País (o Global)
- Resumen estratégico (máx 120 palabras)
- Impacto esperado (Positivo / Negativo / Mixto)
- Área afectada (Regulación, Crecimiento, Costos, Demanda, Competencia, etc.)

Paso 3 – Tendencias estructurales del sector (${currentYear})
Identifica tendencias clave transformando el sector (digitalización, automatización, sostenibilidad, regulaciones, etc.).
Para cada tendencia: Nombre, Descripción, Impacto esperado, y siempre Fuente con URL.

Paso 4 – Proyecciones de crecimiento del sector
Si existen datos, incluye: País o Global, Fuente con URL, Tasa de crecimiento (%), Horizonte temporal, Implicación estratégica.

Sección final – Fuentes consultadas
Lista de todas las fuentes: Medio | Título | URL completa

Reglas de calidad:
- Prioriza noticias con datos cuantitativos. No inventes cifras ni fuentes.
- Si no hay fuentes confiables, dilo explícitamente. No pedir disculpas ni escribir "Limitaciones".

Reglas importantes para tu respuesta:
Tu salida debe ser ÚNICAMENTE el prompt final generado ("Actúa como investigador senior de Radikal IA...").
No expliques tu razonamiento. No me hables a mí. No saludes. El texto debe estar listo para enviarse al motor de Kimi.`;

    return await callLLM('openai/gpt-4o', [{ role: 'user', content: fullMetaPrompt }]);
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
