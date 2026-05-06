const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { env } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ── Security Headers ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pelo CORS'));
    }
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
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

// ── API Routes ────────────────────────────────────────────
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/usuarios', require('./routes/usuarios'));
app.use('/api/v1/produtos', require('./routes/produtos'));
app.use('/api/v1/fornecedores', require('./routes/fornecedores'));
app.use('/api/v1/movimentacoes', require('./routes/movimentacoes'));
app.use('/api/v1/pedidos', require('./routes/pedidos'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/alertas', require('./routes/alertas'));
app.use('/api/v1/relatorios', require('./routes/relatorios'));

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não encontrada`, code: 404 });
});

// ── Error Handler ─────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
