const FirecrawlApp = require('@mendable/firecrawl-js').default;

// El motor de mapeo inicial para encontrar todas las subpáginas
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

const mapWebsiteLinks = async (url) => {
    try {
        console.log(`[Firecrawl] 🔍 Iniciando mapeo de URL: ${url}`);
        
        // Mapeamos hasta 15 subpáginas para tener una visión general sin saturar
        const mapResult = await firecrawl.mapUrl(url, { 
            params: { 
                limit: 15,
                excludeExternalLinks: true 
            } 
        });
        
        if (!mapResult.success) {
            throw new Error(mapResult.error || 'Error desconocido en Firecrawl');
        }
        
        const links = mapResult.links || [];
        console.log(`[Firecrawl] ✅ Mapeo completado. Encontrados ${links.length} enlaces relevantes.`);
        
        return links;
    } catch (error) {
        console.error('[Firecrawl] ❌ Error durante el mapeo:', error.message);
        // Si falla el mapeo, al menos devolvemos la URL principal para no detener el proceso
        return [url];
    }
};

module.exports = { mapWebsiteLinks };