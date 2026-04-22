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

    // AHORA construimos el prompt final para COMPETIDORES íntegro y exhaustivo
    const competitorsPrompt = `Actúa como analista estratégico senior especializado en inteligencia competitiva internacional.

Empresa objetivo:
Nombre: ${extractedData.nombre}
Web: ${extractedData.web}

Contexto de la empresa (extraído de su sitio web):
${extractedData.resumen}

Información estratégica detectada:
Industria principal:
${extractedData.industria}

Subsector o nicho:
${extractedData.subsector}

Modelo de negocio:
${extractedData.modelo}

Ubicación o mercado geográfico:
${extractedData.paises}

=======================================
INSTRUCCIONES CRÍTICAS: USA TU HERRAMIENTA $web_search Y EJECUTA EL ANÁLISIS EN LA WEB AHORA MISMO.
NO SALUDES. ENTREGA OBLIGATORIAMENTE SÓLO EL MARDOWN RESULTANTE.
=======================================

Paso 1 – Determinar países válidos
Antes de identificar competidores:
Extrae únicamente los países o ciudades donde la empresa opera que estén explícitamente mencionados en su sitio web (${extractedData.paises}).
Solo considera como válidos países que aparezcan en: sección “Dónde operamos”, oficinas o sedes, contactos por país, direcciones físicas, dominios o subdominios por país, mapa de presencia corporativa.
❗ No infieras países
❗ No asumas expansión futura
❗ No utilices países mencionados en noticias externas
Si no hay países explícitos, indica: "Sin países explícitos en el sitio web."

Alcance del análisis
El análisis competitivo debe limitarse a los países válidos identificados. 
No incluyas: mercados potenciales, regiones inferidas ni competidores que operen solo fuera de esos países.

Proceso de investigación competitiva
Realiza investigación exhaustiva estructurándola en la web así:

Etapa 1 — Descubrimiento de competidores
Identifica empresas que ofrezcan productos o servicios similares, resuelvan el mismo problema del cliente, compitan por el mismo segmento y tengan modelo de negocio comparable.
Incluye también: sustitutos directos, soluciones alternativas, plataformas tecnológicas que compitan por el mismo presupuesto del cliente. Genera una lista inicial amplia en tu memoria.

Etapa 2 — Validación geográfica
Para cada empresa identificada, verifica con $web_search si tiene presencia en al menos uno de los países válidos. 
La evidencia puede incluir: oficinas, operaciones comerciales, clientes en ese país, páginas locales, presencia en marketplaces o partners.
Elimina empresas sin evidencia de presencia en esos países.

Etapa 3 — Validación competitiva
Confirma que cada empresa restante: ofrece una solución realmente comparable, compite por el mismo problema del cliente, tiene modelo de negocio equivalente o sustituto relevante. Solo después de esta validación genera el listado final.

FORMATO DEL INFORME FINAL A ENTREGAR (Obligatorio respetar):

Fase 1 – Identificación de competidores
Selecciona entre 5 y 10 competidores reales resultantes.
Para cada competidor incluye obligatoriamente:
- Nombre
- Web oficial
- País sede
- País donde compite con la empresa (debe coincidir con países válidos)
- Modelo de negocio (máx 60 palabras)
- Evidencia verificable de competencia (INCLUYE OBLIGATORIAMENTE URL DIRECTA CLICKABLE a una página de producto comparable, servicio, pricing, etc. ⚠️ Si no hay evidencia clara, no incluyas el competidor).

Fase 2 – Clasificación estratégica
Clasifica cada competidor en uno de estos niveles:
- Nivel 1 — Competencia Directa Crítica
- Nivel 2 — Competencia Directa Diferenciada
- Nivel 3 — Sustituto o Disruptivo
- Nivel 4 — Referente Estratégico
La clasificación debe basarse únicamente en: similitud del producto, coincidencia de cliente objetivo y presencia en países válidos.

Fase 3 – Evaluación cuantitativa
Evalúa cada competidor del 1 al 5 en:
- Participación estimada en los países válidos
- Innovación observable
- Fortaleza digital
- Experiencia de cliente
- Diferenciación estratégica
- Poder de pricing
- Escalabilidad en esos países
- Crecimiento visible
Reglas: No asignar 5 sin evidencia clara. Justificar puntuaciones ≥4. Si falta información, usar valoración conservadora. No evaluar crecimiento en países no válidos. 
Calcula un score sobre 100 y genera un ranking descendente.

Fase 4 – Análisis profundo (Top 3)
Para los tres competidores con mayor score analiza: Modelo de negocio detallado, Ventajas estructurales, Debilidades, Estrategia digital, Uso de tecnología o IA, Capacidad competitiva en los países válidos, Probabilidad de quitar cuota de mercado en 12 meses (Alta / Media / Baja).

Fase 5 – Diagnóstico estratégico
Responde:
1. ¿Quién es la amenaza real en 12 meses en los países válidos?
2. ¿Quién puede escalar más fuerte en 3 años en esos mercados?
3. ¿Qué competidor representa mayor presión competitiva local?
4. ¿Cuál de los países válidos representa mayor riesgo competitivo?
5. ¿Cuál es el mayor riesgo estructural para la empresa analizada en sus mercados actuales?

Recomendaciones estratégicas
Propón 3 acciones estratégicas concretas para ejecutar en 90 días.
Las acciones deben: ser específicas, ser aplicables dentro de los países válidos, evitar recomendaciones genéricas.

Reglas de salida absolutas:
Tu respuesta debe ser únicamente el reporte técnico final generado de la investigación.
No expliques tu razonamiento. No incluyas comentarios adicionales preparatorios. No saludes.`;

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
