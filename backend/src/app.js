const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { env } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { pool } = require('./config/database');
const { redis } = require('./config/redis');

const app = express();

// ── Security Headers ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────
// Em dev, aceitamos também qualquer origem da rede local privada (192.168.x.x,
// 10.x.x.x, 172.16-31.x.x) para permitir acesso de celular/tablet na mesma WiFi.
const allowedOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());
const isLanOrigin = (origin) => {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const h = url.hostname;
    // RFC1918: redes privadas
    return /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)
      || h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
};
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    if (env.NODE_ENV === 'development' && isLanOrigin(origin)) return callback(null, true);
    callback(new Error('Bloqueado pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ── Body Parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────
app.use(morgan('short', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Rate Limiting Global ──────────────────────────────────
app.use('/api', apiLimiter);

// ── Health Check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: env.BRAND_NAME + ' Kanban Estoque',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

app.get('/ready', async (req, res) => {
  const checks = { postgres: false, redis: false };

  try {
    await pool.query('SELECT 1');
    checks.postgres = true;
  } catch (err) {
    logger.error('Readiness Postgres falhou', { error: err.message });
  }

  try {
    if (redis.isStub) {
      checks.redis = env.NODE_ENV !== 'production';
    } else {
      await redis.ping();
      checks.redis = true;
    }
  } catch (err) {
    logger.error('Readiness Redis falhou', { error: err.message });
  }

  const ready = checks.postgres && checks.redis;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
});

// ── API Routes ────────────────────────────────────────────
const { sapGuard } = require('./middleware/sapGuard');

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/usuarios', require('./routes/usuarios'));
app.use('/api/v1/produtos', sapGuard, require('./routes/produtos'));
app.use('/api/v1/fornecedores', sapGuard, require('./routes/fornecedores'));
app.use('/api/v1/departamentos', sapGuard, require('./routes/departamentos'));
app.use('/api/v1/maquinas', sapGuard, require('./routes/maquinas'));
app.use('/api/v1/movimentacoes', sapGuard, require('./routes/movimentacoes'));
app.use('/api/v1/pedidos', sapGuard, require('./routes/pedidos'));
app.use('/api/v1/grafo', require('./routes/grafo'));
app.use('/api/v1/configuracoes', require('./routes/configuracoes'));
app.use('/api/v1/sap', require('./routes/sap'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/alertas', require('./routes/alertas'));
app.use('/api/v1/relatorios', require('./routes/relatorios'));
app.use('/api/v1/simulations', require('./routes/simulation'));

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não encontrada`, code: 404 });
});

// ── Error Handler ─────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
