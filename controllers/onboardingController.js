const { mapWebsiteLinks } = require('../services/firecrawlService');
const { scrapeUrls } = require('../services/scraperService');
const { saveMemoryResource } = require('../services/supabaseService');
const { generateStructuralProfile, analyzeImageDirecting } = require('../services/aiService');

const startOnboarding = async (req, res) => {
    const { userId, projectId, website } = req.body;

    if (!userId || !website) {
        return res.status(400).json({ error: 'userId y website son obligatorios' });
    }

    console.log(`[Job INITIALIZED] ID: job_${userId}_${Date.now()} | User: ${userId} | URL: ${website}`);

    // Respondemos de inmediato para el patrón Fire-and-Forget
    res.status(200).json({ 
        message: 'Proceso de onboarding iniciado en segundo plano',
        jobId: `job_${userId}_${Date.now()}`
    });

    // Inicia el proceso asíncrono
    (async () => {
        try {
            console.log(`[Job ID: job_${userId}] 🚀 INICIANDO SECUENCIA COMPLETA DE ONBOARDING`);
            
            // 1. Mapeo (Firecrawl)
            console.log(`[Job ID: job_${userId}] 🌐 Mapeando estructura web de ${website}...`);
            const allLinks = await mapWebsiteLinks(website);
            
            // Guardamos inmediatamente los links descubiertos (máximo 15)
            console.log(`[Job ID: job_${userId}] 💾 Guardando ${allLinks.length} subpáginas descubiertas...`);
            for (const link of allLinks) {
                await saveMemoryResource(userId, projectId, 'market_analisis', `Link extraído: ${link}`, link, 'link');
            }

            // 2. Scraping profundo (solo las primeras 3 URLs relevantes para velocidad)
            const linksToScrape = allLinks.slice(0, 3);
            console.log(`[Job ID: job_${userId}] 🕷️ Extrayendo contenido detallado de ${linksToScrape.length} páginas...`);
            const scrapingResults = await scrapeUrls(linksToScrape);
            
            // Combinamos texto para análisis IA
            const combinedText = scrapingResults
                .filter(r => r.success)
                .map(r => r.html)
                .join('\n\n')
                .slice(0, 30000); // Límite para el LLM

            // 3. Análisis Estructural con IA
            console.log(`[Job ID: job_${userId}] 🧠 Analizando Perfil Estructural con IA...`);
            const brandProfile = await generateStructuralProfile(combinedText);
            
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

            // 4. Análisis de Imágenes (Dirección de Arte)
            console.log(`[Job ID: job_${userId}] 🎨 Ejecutando Análisis de Dirección de Arte...`);
            const imagesToAnalyze = [];
            
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
            for (const imageUrl of uniqueImages) {
                const analysis = await analyzeImageDirecting(imageUrl);
                if (analysis) {
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

            console.log(`[Job ID: job_${userId}] 🏁 PROCESO FINALIZADO CON ÉXITO.`);

        } catch (error) {
            console.error(`[Job ID: job_${userId}] ❌ ERROR CRÍTICO EN ONBOARDING:`, error.message);
        }
    })();
};

module.exports = { startOnboarding };