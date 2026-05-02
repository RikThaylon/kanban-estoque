const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const app = require('./app');
const { env } = require('./config/env');
const { connectRedis } = require('./config/redis');
const { configurarSocket } = require('./socket/socket');
const { executarRecalculoKanban } = require('./jobs/recalculo.job');
const { verificarPrazosVencidos } = require('./jobs/prazos.job');
const { limparTokensExpirados } = require('./jobs/limpeza.job');
const { recalcularABC } = require('./jobs/abc.job');
const logger = require('./utils/logger');

const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGINS.split(',').map(o => o.trim()),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

configurarSocket(io);
app.set('io', io);

// ── Cron Jobs ─────────────────────────────────────────────
// Recálculo Kanban: 06:00 e 18:00
cron.schedule('0 6,18 * * *', () => executarRecalculoKanban(io));

// Pedidos com prazo vencido: 08:00
cron.schedule('0 8 * * *', () => verificarPrazosVencidos(io));

// Limpeza de tokens: 03:00
cron.schedule('0 3 * * *', () => limparTokensExpirados());

// Classificação ABC: domingo 02:00
cron.schedule('0 2 * * 0', () => recalcularABC());

// ── Start Server ──────────────────────────────────────────
async function start() {
  await connectRedis();
  
  server.listen(env.PORT, () => {
    logger.info(`🚀 Servidor rodando em http://localhost:${env.PORT}`);
    logger.info(`📊 Ambiente: ${env.NODE_ENV}`);
    logger.info(`🔌 Socket.io ativo`);
    logger.info(`⏰ Jobs agendados: recálculo (06/18h), prazos (08h), limpeza (03h), ABC (dom 02h)`);
  });
}

start().catch(err => {
  logger.error('Falha ao iniciar servidor', { error: err.message });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, encerrando...');
  server.close(() => process.exit(0));
});
