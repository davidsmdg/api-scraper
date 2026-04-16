const { mapWebsiteLinks } = require('../services/firecrawlService');
const { scrapeUrls } = require('../services/scraperService');
const { generateStructuralProfile, analyzeImageDirecting } = require('../services/aiService');
const { saveMemoryResource } = require('../services/supabaseService');

/**
 * Proceso pesado: Mapeo -> Scraping -> Análisis -> Persistencia
 * Todo se ejecuta en segundo plano para evitar que el request del cliente expire.
 */
const processBrandOnboardingBackground = async (urls, userId, projectId, jobId) => {
    try {
        console.log(`\n[Job ID: ${jobId}] 🚀 INICIANDO SECUENCIA COMPLETA DE ONBOARDING`);
        const mainUrl = urls[0];
        
        // 1. MAPEADO INICIAL (Firecrawl)
        console.log(`[Job ID: ${jobId}] 🔍 Mapeando estructura web de ${mainUrl}...`);
        const allLinks = await mapWebsiteLinks(mainUrl);
        
        // 2. GUARDADO INMEDIATO DE LINKS (Supabase)
        // Esto permite que el usuario vea progreso casi de inmediato
        console.log(`[Job ID: ${jobId}] 💾 Guardando ${allLinks.length} subpáginas descubiertas...`);
        for (const link of allLinks) {
            await saveMemoryResource(
                userId, 
                projectId, 
                'Estructura_Web', 
                `Subpágina Detectada: ${new URL(link).pathname || link}`, 
                link
            ).catch(err => console.error(`[Error] Falló guardado de link ${link}:`, err.message));
        }

        // 3. SCRAPING PROFUNDO (Puppeteer / Apify Fallback)
        // Tomamos la principal + las primeras 4 subpáginas más relevantes para el análisis
        const urlsToScrape = [mainUrl, ...allLinks.filter(l => l !== mainUrl).slice(0, 4)];
        console.log(`[Job ID: ${jobId}] 🕷️ Extrayendo contenido detallado de ${urlsToScrape.length} páginas...`);
        const scrapeResults = await scrapeUrls(urlsToScrape);
        
        const combinedText = scrapeResults
            .filter(r => r.success && r.html)
            .map(r => r.html)
            .join('\n\n')
            .substring(0, 60000); // Límite para no saturar el LLM

        // 4. ANÁLISIS DE IA (Vision / LLM)
        if (combinedText.length > 500) {
            console.log(`[Job ID: ${jobId}] 🧠 Analizando Perfil Estructural con IA...`);
            const structuralProfile = await generateStructuralProfile(combinedText);
            
            await saveMemoryResource(
                userId, 
                projectId, 
                'Info_competencia_noticias', 
                'Análisis Estructural Automático', 
                structuralProfile
            );

            // ANÁLISIS VISUAL: Buscamos imágenes relevantes en el HTML
            console.log(`[Job ID: ${jobId}] 🖼️ Ejecutando Análisis de Dirección de Arte...`);
            const imageMatches = combinedText.match(/<img[^>]+src=["']([^"'>]+)["']/ig) || [];
            const imageUrls = imageMatches
                .map(m => m.match(/src=["']([^"'>]+)["']/i)[1])
                .filter(url => url.startsWith('http'))
                .slice(0, 3); // Analizamos máximo 3 imágenes clave

            for (const imgUrl of imageUrls) {
                try {
                    const visualAnalysis = await analyzeImageDirecting(imgUrl);
                    if (visualAnalysis) {
                        await saveMemoryResource(
                            userId, 
                            projectId, 
                            'Identidad_Visual', 
                            'Análisis Visual de Referencia', 
                            { url: imgUrl, analysis: visualAnalysis }
                        );
                    }
                } catch (e) {
                    console.error(`[Error] Falló análisis de imagen ${imgUrl}:`, e.message);
                }
            }
        } else {
            console.warn(`[Job ID: ${jobId}] ⚠️ No se obtuvo suficiente contenido para análisis de IA.`);
        }

        console.log(`[Job ID: ${jobId}] 🏁 PROCESO FINALIZADO CON ÉXITO.`);

    } catch (error) {
        console.error(`[Job ID: ${jobId}] ❌ ERROR CRÍTICO EN SEGUNDO PLANO:`, error.message);
    }
};

module.exports = { processBrandOnboardingBackground };