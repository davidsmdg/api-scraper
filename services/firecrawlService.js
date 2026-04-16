const FirecrawlApp = require('@mendable/firecrawl-js').default;

// El motor de mapeo inicial para encontrar todas las subpáginas
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

const mapWebsiteLinks = async (url) => {
    try {
        console.log(`[Firecrawl] 🔍 Iniciando mapeo de URL: ${url}`);
        
        // En SDK v4+, el método es .map() y los parámetros han cambiado ligeramente
        const mapResult = await firecrawl.map(url, { 
            limit: 15,
            excludeExternalLinks: true 
        });
        
        if (!mapResult.success) {
            throw new Error(mapResult.error || 'Error desconocido en Firecrawl');
        }
        
        // En SDK v4+, links puede ser un array de objetos o strings dependiendo del endpoint
        const links = (mapResult.links || []).map(l => typeof l === 'object' ? l.url : l);
        
        console.log(`[Firecrawl] ✅ Mapeo completado. Encontrados ${links.length} enlaces relevantes.`);
        
        return links;
    } catch (error) {
        console.error('[Firecrawl] ❌ Error durante el mapeo:', error.message);
        // Si falla el mapeo, al menos devolvemos la URL principal para no detener el proceso
        return [url];
    }
};

module.exports = { mapWebsiteLinks };