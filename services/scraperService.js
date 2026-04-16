const puppeteer = require('puppeteer');
const { ApifyClient } = require('apify-client');

const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

const scrapeUrls = async (urls) => {
    console.log('Iniciando extracción con Puppeteer...');
    const results = [];
    let browser;

    try {
        browser = await puppeteer.launch({
            // CONFIGURACIÓN PARA DOCKER (ghcr.io/puppeteer/puppeteer)
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote'
            ]
        });

        for (const url of urls) {
            let page;
            try {
                page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
                
                console.log(`Extrayendo: ${url}`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                const html = await page.content();
                
                const textOnly = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, '')
                                     .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, '');
                
                results.push({ url, html: textOnly, success: true });
            } catch (error) {
                console.error(`Error en Puppeteer para ${url}:`, error.message);
                results.push({ url, error: error.message, success: false });
            } finally {
                if (page) await page.close();
            }
        }
    } catch (error) {
        console.error('Error crítico en Puppeteer:', error.message);
    } finally {
        if (browser) await browser.close();
    }

    // Fallback con Apify
    const failedUrls = results.filter(r => !r.success).map(r => r.url);
    if (failedUrls.length > 0 && process.env.APIFY_API_TOKEN) {
        console.log(`Usando Apify como respaldo para ${failedUrls.length} URLs...`);
        try {
            const run = await apifyClient.actor('mtrunkat/url-list-download-html').call({ listUrls: failedUrls });
            const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
            
            items.forEach(item => {
                if (item.html) {
                    const index = results.findIndex(r => r.url === item.url);
                    if (index !== -1) {
                        results[index] = { url: item.url, html: item.html, success: true };
                    }
                }
            });
        } catch (apifyError) {
            console.error('Error en el fallback de Apify:', apifyError.message);
        }
    }

    return results;
};

module.exports = { scrapeUrls };