const { mapWebsiteLinks } = require('../services/firecrawlService');
const { scrapeUrls } = require('../services/scraperService');
const { saveMemoryResource, updateProjectLogo } = require('../services/supabaseService');
const { generateStructuralProfile, analyzeImageDirecting } = require('../services/aiService');
const { onboardingIndustryNewsFlow } = require('../services/intelligenceService');

// --- NUEVOS HELPERS PARA EXTRACCIÓN DE LOGO (REFINADOS) ---
function toStr(v) { return v == null ? "" : String(v); }

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

function normalizeUrl(raw, baseUrl) {
    const s = toStr(raw).trim().replace(/&/g, "&");
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return "https:" + s;

    let safeBase = toStr(baseUrl).trim();
    if (safeBase && !/^https?:\/\//i.test(safeBase)) {
        safeBase = "https://" + safeBase;
    }
    const domain = getBaseDomain(safeBase);
    if (!domain) return s;

    const cleanBase = domain.endsWith("/") ? domain.slice(0, -1) : domain;
    const cleanPath = s.startsWith("/") ? s : "/" + s;
    return cleanBase + cleanPath;
}

function pickMeta(html, prop) {
    const re = new RegExp(`<meta\\b[^>]*\\b(property|name)\\s*=\\s*["']${prop}["'][^>]*>`, "i");
    const m = html.match(re);
    if (!m) return "";
    const c = m[0].match(/\bcontent\s*=\s*["']([\s\S]*?)["']/i);
    return c ? c[1].trim() : "";
}

function pickLinkRel(html, rel) {
    const re = new RegExp(`<link\\b[^>]*\\brel\\s*=\\s*["'][^"']*${rel}[^"']*["'][^>]*>`, "i");
    const m = html.match(re);
    if (!m) return "";
    const h = m[0].match(/\bhref\s*=\s*["']([\s\S]*?)["']/i);
    return h ? h[1].trim() : "";
}

function isJunk(url) {
    const lower = toStr(url).toLowerCase();
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
            const mapResult = await mapWebsiteLinks(mainUrl);
            const allLinks = mapResult.links;
            
            if (mapResult.success) {
                console.log(`[Job ID: ${jobId}] ✅ Firecrawl mapeó exitosamente ${allLinks.length} enlaces.`);
            } else {
                console.warn(`[Job ID: ${jobId}] ⚠️ Firecrawl falló (${mapResult.error || 'error desconocido'}). Usando URL base como respaldo.`);
            }
            
            console.log(`[Job ID: ${jobId}] 💾 Guardando subpáginas descubiertas...`);
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
                const html = r.html;
                const baseDom = getBaseDomain(pageUrl);
                
                // Si es la home, buscamos metas especiales de logo
                if (pageUrl === mainUrl || pageUrl === mainUrl + "/" || mainUrl === pageUrl + "/") {
                    const ogLogo = pickMeta(html, "og:logo");
                    const appleIcon = pickLinkRel(html, "apple-touch-icon");
                    const favicon = pickLinkRel(html, "icon") || pickLinkRel(html, "shortcut icon");
                    
                    let ogImageCandidate = pickMeta(html, "og:image");
                    // Evitar usar la URL de la web como imagen si viene en og:image por error
                    if (ogImageCandidate === mainUrl || ogImageCandidate === mainUrl + "/") ogImageCandidate = "";

                    [ogLogo, ogImageCandidate, appleIcon, favicon].forEach(u => {

                        const fixed = normalizeUrl(u, baseDom);
                        if (fixed && !seen.has(fixed)) {
                            seen.add(fixed);
                            candidates.push({ url: fixed, kind: 'logo', source_page: pageUrl, priority: true });
                        }
                    });
                }

                // Extracción de imágenes normales
                const imgRegex = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi;
                let match;
                while ((match = imgRegex.exec(html)) !== null) {
                    const rawSrc = match[1];
                    const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
                    const alt = altMatch ? altMatch[1] : "";
                    
                    const fixedUrl = normalizeUrl(rawSrc, baseDom);
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
                const u = c.url.toLowerCase();
                
                if (c.kind === "logo") s += 100;
                if (c.priority) s += 50;
                if (u.includes("logo")) s += 50;
                if (u.includes("brand")) s += 20;
                if (u.endsWith(".png")) s += 30;
                if (u.endsWith(".jpg") || u.endsWith(".jpeg")) s += 15;
                if (u.includes("apple-touch-icon")) s -= 10;
                if (u.includes("favicon") || u.endsWith(".ico")) s -= 50;
                
                if (c.kind === "product") s += 80;
                if (c.kind === "home") s += 60;
                
                const key = c.source_page || "unknown";
                s -= (pageCount.get(key) || 0) * 15;
                
                // Penaliza SVG a menos que sea explícitamente logo o tenga "logo" en la URL
                if (u.endsWith(".svg") && c.kind !== "logo" && !u.includes("logo")) s -= 70;
                
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

            // 3. Extracción del Logo
            const logoCandidate = selectedImages.sort((a,b) => score(b) - score(a))[0];
            if (logoCandidate) {
                console.log(`[Job ID: ${jobId}] 🎯 Logo oficial detectado: ${logoCandidate.url}`);
                await saveMemoryResource(userId, projectId, 'logo', 'Logo Oficial', logoCandidate.url, 'image');
                
                // ACTUALIZAR TABLA PROJECTS PARA QUE SE VEA EN LA PLATAFORMA
                console.log(`[Job ID: ${jobId}] 💾 Actualizando logo en tabla projects...`);
                await updateProjectLogo(projectId, logoCandidate.url);
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

            // 7. Búsqueda de Noticias de Industria (NUEVO)
            console.log(`[Job ID: ${jobId}] 📰 Iniciando investigación sectorial con Kimi K2.5...`);
            try {
                await onboardingIndustryNewsFlow(userId, projectId);
            } catch (newsError) {
                console.error(`[Job ID: ${jobId}] ⚠️ Error no fatal en búsqueda de noticias:`, newsError.message);
            }

            console.log(`[Job ID: ${jobId}] 🏁 PROCESO FINALIZADO CON ÉXITO.`);

        } catch (error) {
            console.error(`[Job ID: ${jobId}] ❌ ERROR CRÍTICO EN ONBOARDING:`, error.message);
        }
    })();
};

module.exports = { startOnboarding };