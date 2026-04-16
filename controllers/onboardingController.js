const { mapWebsiteLinks } = require('../services/firecrawlService');
const { scrapeUrls } = require('../services/scraperService');
const { saveMemoryResource } = require('../services/supabaseService');
const { generateStructuralProfile, analyzeImageDirecting } = require('../services/aiService');

const startOnboarding = async (req, res) => {
    // Aceptamos urls o website por compatibilidad con el frontend previo y el actual
    const urls = req.body.urls || (req.body.website ? [req.body.website] : []);
    const { userId, projectId } = req.body;

    if (!userId || urls.length === 0) {
        return res.status(400).json({ error: 'userId y urls/website son obligatorios' });
    }

    const mainUrl = urls[0];
    const jobId = `job_${userId}_${Date.now()}`;

    console.log(`[Job INITIALIZED] ID: ${jobId} | User: ${userId} | URL: ${mainUrl}`);

    // Respondemos de inmediato para el patrón Fire-and-Forget
    res.status(200).json({ 
        success: true,
        message: 'Proceso de onboarding iniciado en segundo plano',
        jobId: jobId,
        status: 'PROCESSING'
    });

    // Inicia el proceso asíncrono
    (async () => {
        try {
            console.log(`[Job ID: ${jobId}] 🚀 INICIANDO SECUENCIA COMPLETA DE ONBOARDING`);
            
            // 1. Mapeo (Firecrawl)
            console.log(`[Job ID: ${jobId}] 🌐 Mapeando estructura web de ${mainUrl}...`);
            const allLinks = await mapWebsiteLinks(mainUrl);
            
            // Guardamos inmediatamente los links descubiertos (máximo 15)
            console.log(`[Job ID: ${jobId}] 💾 Guardando ${allLinks.length} subpáginas descubiertas...`);
            for (const link of allLinks) {
                await saveMemoryResource(userId, projectId, 'market_analisis', `Link extraído: ${link}`, link, 'link');
            }

            // 2. Scraping profundo (solo las primeras 3 URLs relevantes para velocidad)
            const linksToScrape = allLinks.slice(0, 3);
            console.log(`[Job ID: ${jobId}] 🕷️ Extrayendo contenido detallado de ${linksToScrape.length} páginas...`);
            const scrapingResults = await scrapeUrls(linksToScrape);
            
            // Combinamos texto para análisis IA
            const combinedText = scrapingResults
                .filter(r => r.success)
                .map(r => r.html)
                .join('\n\n')
                .slice(0, 30000); // Límite para el LLM

            // 3. Análisis de Imágenes (Dirección de Arte) - SE EJECUTA ANTES PARA ALIMENTAR EL PERFIL ESTRUCTURAL
            console.log(`[Job ID: ${jobId}] 🎨 Ejecutando Análisis de Dirección de Arte...`);
            const imagesToAnalyze = [];
            const imageAnalysesForProfile = [];
            
            // Buscamos imágenes en el HTML (primeras 5 relevantes)
            scrapingResults.forEach(r => {
                if (r.success) {
                    const imgMatches = r.html.match(/src="([^"]+\.(?:jpg|jpeg|png|webp))"/gi) || [];
                    imgMatches.forEach(m => {
                        const url = m.match(/src="([^"]+)"/i)[1];
                        if (url.startsWith('http') && !imagesToAnalyze.includes(url)) {
                            imagesToAnalyze.push(url);
                        }
                    });
                }
            });

            const uniqueImages = [...new Set(imagesToAnalyze)].slice(0, 5);
            for (let i = 0; i < uniqueImages.length; i++) {
                const imageUrl = uniqueImages[i];
                const analysis = await analyzeImageDirecting(imageUrl);
                if (analysis) {
                    // Preparamos el texto del análisis visual para pasárselo al agente estructural
                    imageAnalysesForProfile.push(`[Imagen ${i + 1}] - ${imageUrl}\n${JSON.stringify(analysis)}\n`);
                    
                    // CATEGORÍA CRÍTICA: analisis_imagenes
                    await saveMemoryResource(
                        userId, 
                        projectId, 
                        'analisis_imagenes', 
                        imageUrl, // El título suele ser la URL de la imagen
                        JSON.stringify(analysis),
                        'image'
                    );
                }
            }

            const finalImageAnalysisText = imageAnalysesForProfile.join('\n');

            // 4. Análisis Estructural con IA (Ahora recibe el texto combinado Y los análisis de imagen)
            console.log(`[Job ID: ${jobId}] 🧠 Analizando Perfil Estructural Estratégico con IA...`);
            const brandProfile = await generateStructuralProfile(combinedText, finalImageAnalysisText);
            
            if (brandProfile) {
                // CATEGORÍA CRÍTICA: identidad_marca (para que aparezca en el perfil central)
                await saveMemoryResource(
                    userId, 
                    projectId, 
                    'identidad_marca', 
                    'Identidad y Esencia', // Título que el frontend reconoce
                    JSON.stringify(brandProfile),
                    'text'
                );
            }

            console.log(`[Job ID: ${jobId}] 🏁 PROCESO FINALIZADO CON ÉXITO.`);

        } catch (error) {
            console.error(`[Job ID: ${jobId}] ❌ ERROR CRÍTICO EN ONBOARDING:`, error.message);
        }
    })();
};

module.exports = { startOnboarding };