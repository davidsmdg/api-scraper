const { mapWebsiteLinks } = require('../services/firecrawlService');
const { scrapeUrls } = require('../services/scraperService');
const { saveMemoryResource } = require('../services/supabaseService');
const { generateStructuralProfile, analyzeImageDirecting } = require('../services/aiService');

// Funciones Auxiliares para asegurar manejo de URLs impecable
function getBaseDomain(fullUrl) {
    if (!fullUrl || typeof fullUrl !== "string") return "";
    const parts = fullUrl.split("/");
    if (parts.length >= 3 && fullUrl.startsWith("http")) {
        return parts[0] + "//" + parts[2];
    }
    if (!fullUrl.startsWith("http")) {
        return "https://" + fullUrl.split("/")[0];
    }
    return "";
}

function fixUrl(url, baseDomain) {
    if (typeof url !== "string") return null;
    let u = url.trim();
    if (!u || u.length < 2) return null;
    if (u === "null" || u === "undefined") return null;

    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("//")) return "https:" + u;

    const cleanBase = baseDomain.endsWith("/") ? baseDomain.slice(0, -1) : baseDomain;
    const cleanPath = u.startsWith("/") ? u : "/" + u;
    return cleanBase + cleanPath;
}

function isJunk(url) {
    const lower = url.toLowerCase();
    return lower.includes("facebook.com/tr") || 
           lower.includes("linkedin.com/collect") || 
           lower.includes("google-analytics.com") ||
           lower.includes("bat.bing.com");
}

function guessKind(pageUrl, alt) {
    const u = (pageUrl || "").toLowerCase();
    const a = (alt || "").toLowerCase();
    if (u.includes("/products/") || a.includes("product")) return "product";
    if (u === "/" || u.endsWith("/") || a.includes("hero")) return "home";
    if (a.includes("logo") || u.includes("logo") || u.includes("brand")) return "logo";
    return "other";
}

const startOnboarding = async (req, res) => {
    const urls = req.body.urls || (req.body.website ? [req.body.website] : []);
    const { userId, projectId } = req.body;

    if (!userId || urls.length === 0) {
        return res.status(400).json({ error: 'userId y urls/website son obligatorios' });
    }

    const mainUrl = urls[0];
    const jobId = `job_${userId}_${Date.now()}`;

    console.log(`[Job INITIALIZED] ID: ${jobId} | User: ${userId} | URL: ${mainUrl}`);

    res.status(200).json({ 
        success: true,
        message: 'Proceso de onboarding iniciado en segundo plano',
        jobId: jobId,
        status: 'PROCESSING'
    });

    (async () => {
        try {
            console.log(`[Job ID: ${jobId}] 🚀 INICIANDO SECUENCIA COMPLETA DE ONBOARDING`);
            
            // 1. Mapeo (Firecrawl)
            console.log(`[Job ID: ${jobId}] 🌐 Mapeando estructura web de ${mainUrl}...`);
            const allLinks = await mapWebsiteLinks(mainUrl);
            
            console.log(`[Job ID: ${jobId}] 💾 Guardando ${allLinks.length} subpáginas descubiertas...`);
            for (const link of allLinks) {
                await saveMemoryResource(userId, projectId, 'market_analisis', `Link extraído: ${link}`, link, 'link');
            }

            // 2. Scraping profundo
            const linksToScrape = allLinks.slice(0, 3);
            console.log(`[Job ID: ${jobId}] 🕷️ Extrayendo contenido detallado de ${linksToScrape.length} páginas...`);
            const scrapingResults = await scrapeUrls(linksToScrape);
            
            const candidates = [];
            const seen = new Set();
            const pagesPack = [];
            
            scrapingResults.forEach(r => {
                if (!r.success) return;
                const pageUrl = r.url;
                const baseDom = getBaseDomain(pageUrl);
                
                // Extracción más profunda y segura de imágenes
                const imgRegex = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi;
                let match;
                while ((match = imgRegex.exec(r.html)) !== null) {
                    const rawSrc = match[1];
                    const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
                    const alt = altMatch ? altMatch[1] : "";
                    
                    const fixedUrl = fixUrl(rawSrc, baseDom);
                    if (fixedUrl && !isJunk(fixedUrl) && !seen.has(fixedUrl)) {
                        seen.add(fixedUrl);
                        const kind = guessKind(pageUrl, alt);
                        candidates.push({ url: fixedUrl, kind, source_page: pageUrl });
                    }
                }
                
                // Empaquetamiento del texto html truncado y limpio
                pagesPack.push({
                    url: pageUrl,
                    text: r.html.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim().slice(0, 4000)
                });
            });

            // Lógica IMAGES_PICK_5: Scoring y límite de 15 candidatos
            const LIMIT = 15;
            const pageCount = new Map();
            function score(c) {
                let s = 0;
                if (c.kind === "logo") s += 100;
                if (c.kind === "product") s += 80;
                if (c.kind === "home") s += 60;
                const key = c.source_page || "unknown";
                s -= (pageCount.get(key) || 0) * 15;
                if (c.url.toLowerCase().endsWith(".svg") && c.kind !== "logo") s -= 70; // Penaliza SVG a menos que sea logo
                return s;
            }

            const selectedImages = [];
            while (selectedImages.length < LIMIT && candidates.length > 0) {
                let bestIdx = 0;
                let bestScore = -Infinity;
                for (let i = 0; i < candidates.length; i++) {
                    const sc = score(candidates[i]);
                    if (sc > bestScore) { bestScore = sc; bestIdx = i; }
                }
                const pick = candidates.splice(bestIdx, 1)[0];
                selectedImages.push(pick);
                const key = pick.source_page || "unknown";
                pageCount.set(key, (pageCount.get(key) || 0) + 1);
            }

            // 3. Extracción del Logo (Nodo EXTRACT_LOGO_URL)
            const bestLogo = selectedImages.find(img => img.kind === 'logo' || img.url.toLowerCase().includes('logo'));
            if (bestLogo) {
                console.log(`[Job ID: ${jobId}] 🎯 Logo oficial detectado: ${bestLogo.url}`);
                await saveMemoryResource(
                    userId, 
                    projectId, 
                    'logo', 
                    'Logo Oficial', 
                    bestLogo.url,
                    'image'
                );
            }

            // 4. Análisis de Imágenes
            console.log(`[Job ID: ${jobId}] 🎨 Evaluando Dirección de Arte en ${selectedImages.length} candidatas visuales...`);
            const imageAnalysesForProfile = [];
            const imagesPack = [];
            
            for (let i = 0; i < selectedImages.length; i++) {
                const imgInfo = selectedImages[i];
                const analysis = await analyzeImageDirecting(imgInfo.url);
                if (analysis) {
                    if (i < 5) {
                        // Solo mandamos las top 5 para alimentar el contexto del consultor y ahorrar tokens
                        imageAnalysesForProfile.push(`[Imagen ${i + 1}] - ${imgInfo.url}\n${JSON.stringify(analysis)}\n`);
                    }
                    imagesPack.push({
                        url: imgInfo.url,
                        kind: imgInfo.kind,
                        analysis: analysis
                    });
                    
                    // Categoría analisis_imagenes
                    await saveMemoryResource(
                        userId, 
                        projectId, 
                        'analisis_imagenes', 
                        imgInfo.url,
                        JSON.stringify(analysis),
                        'image'
                    );
                }
            }

            // 5. Consolidación de Inteligencia en Base de Datos (Nodo FINAL_PACK_SUMMARY2)
            const finalPackSummary = {
                version: "v1",
                generated_at: new Date().toISOString(),
                pages: pagesPack,
                images: imagesPack
            };

            console.log(`[Job ID: ${jobId}] 💾 Guardando Info_competencia_noticias...`);
            await saveMemoryResource(
                userId, 
                projectId, 
                'Info_competencia_noticias', 
                'Pack Analítico HTML y Visual Consolidado', 
                JSON.stringify(finalPackSummary),
                'text'
            );

            // 6. Análisis Estructural con IA
            console.log(`[Job ID: ${jobId}] 🧠 Consultor Senior: Analizando Perfil Estructural Estratégico...`);
            const combinedTextJSON = JSON.stringify(pagesPack, null, 2);
            const finalImageAnalysisText = imageAnalysesForProfile.join('\n');
            const brandProfile = await generateStructuralProfile(combinedTextJSON, finalImageAnalysisText);
            
            if (brandProfile) {
                await saveMemoryResource(
                    userId, 
                    projectId, 
                    'identidad_marca', 
                    'Identidad y Esencia', 
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