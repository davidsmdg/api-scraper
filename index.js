require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const onboardingRoutes = require('./routes/onboardingRoutes');
const intelligenceRoutes = require('./routes/intelligenceRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURACIÓN DE SEGURIDAD Y CORS
// ==========================================
app.use(cors()); 
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// ==========================================
// 2. CONFIGURACIÓN DE LÍMITES (CRÍTICO)
// ==========================================
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
app.use('/api/intelligence', intelligenceRoutes);

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

server.timeout = 600000;
server.keepAliveTimeout = 600000;
server.headersTimeout = 600000;