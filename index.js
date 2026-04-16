const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const onboardingRoutes = require('./routes/onboardingRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURACIÓN DE SEGURIDAD Y CORS
// ==========================================
app.use(cors()); // Soporte básico de CORS para Easypanel
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// ==========================================
// 2. CONFIGURACIÓN DE LÍMITES (CRÍTICO)
// ==========================================
// Aumentamos el límite a 50mb para recibir HTMLs pesados de scraping
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('combined')); 

// ==========================================
// 3. RUTAS Y HEALTHCHECK
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    status: 'ONLINE', 
    timestamp: new Date().toISOString(),
    proxy_ready: true 
  });
});

app.use('/api', onboardingRoutes);

// ==========================================
// 4. INICIO DEL SERVIDOR Y CONFIGURACIÓN DE TIEMPO
// ==========================================
const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`[SYS] 🚀 Radikal Scraper API activo en puerto ${PORT}`);
    console.log(`[SYS] ⚡ Modo Asíncrono (Fire-and-Forget): HABILITADO`);
    console.log(`[SYS] ⌛ Límite de procesamiento: 10 minutos (600s)`);
    console.log(`======================================================\n`);
});

// CONFIGURACIÓN CRÍTICA PARA PROCESOS LARGOS: Aumentamos el tiempo de espera a 10 minutos
// Esto evita que el socket se cierre mientras Puppeteer y la IA trabajan en backend.
server.timeout = 600000;
server.keepAliveTimeout = 600000;
server.headersTimeout = 600000;