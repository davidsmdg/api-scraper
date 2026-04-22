const FirecrawlApp = require('@mendable/firecrawl-js').default;

// El motor de mapeo inicial para encontrar todas las subpáginas
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

const mapWebsiteLinks = async (url) => {
    try {
        console.log(`[Firecrawl] 🔍 Iniciando mapeo de URL: ${url}`);
        
        // En SDK v4+, el método es .map()
        const mapResult = await firecrawl.map(url, { 
            limit: 15,
            excludeExternalLinks: true 
        });
        
        if (!mapResult || !mapResult.success) {
            console.warn(`[Firecrawl] ⚠️ Map falló o no fue exitoso. Usando URL base.`);
            return { 
                success: false, 
                links: [url], 
                error: mapResult?.error || 'No se recibieron enlaces de Firecrawl' 
            };
        }
        
        // Mapeamos objetos de link a strings de URL
        const links = (mapResult.links || []).map(l => typeof l === 'object' ? l.url : l);
        
        // Nos aseguramos de que la URL original esté en la lista
        if (!links.includes(url)) {
            links.unshift(url);
        }
        
        console.log(`[Firecrawl] ✅ Mapeo completado. Encontrados ${links.length} enlaces relevantes.`);
        return { 
            success: true, 
            links: links 
        };
    } catch (error) {
        console.error('[Firecrawl] ❌ Error durante el mapeo:', error.message);
        return { 
            success: false, 
            links: [url], 
            error: error.message 
        };
    }
};

module.exports = { mapWebsiteLinks };