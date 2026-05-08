const http = require('http');
const os = require('os');
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

/** Lista todos os IPv4 não-internos das interfaces de rede (Wi-Fi, Ethernet, etc.) */
function listarIPsLocais() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const [nome, addrs] of Object.entries(ifaces)) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) {
        ips.push({ interface: nome, address: a.address });
      }
    }
  }
  return ips;
}

const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────
// Mesma lógica do CORS HTTP em app.js: aceita LAN privada em dev pra permitir
// que celular/tablet conectem ao WebSocket via IP da LAN.
const corsOriginsLista = env.CORS_ORIGINS.split(',').map(o => o.trim());
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || corsOriginsLista.includes(origin)) return callback(null, true);
      if (env.NODE_ENV === 'development') {
        try {
          const h = new URL(origin).hostname;
          if (
            /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)
            || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
            || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)
            || h === 'localhost' || h === '127.0.0.1'
          ) return callback(null, true);
        } catch (_) { /* ignore */ }
      }
      callback(new Error('Bloqueado pelo CORS'));
    },
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

// Tratamento de erro do listen (porta ocupada, permissão, etc.)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('╭──────────────────────────────────────────────────────────╮');
    console.error(`│  ❌ Porta ${env.PORT} já está em uso                            │`);
    console.error('├──────────────────────────────────────────────────────────┤');
    console.error('│  Outra instância do backend pode estar rodando.          │');
    console.error('│                                                          │');
    console.error('│  Como resolver:                                          │');
    console.error('│   1) Pare o outro processo (PowerShell):                 │');
    console.error(`│      Get-NetTCPConnection -LocalPort ${env.PORT} -State Listen   │`);
    console.error('│      Stop-Process -Id <PID>                              │');
    console.error('│   2) Ou rode em outra porta:                             │');
    console.error(`│      $env:PORT = "${env.PORT + 1}"; npm run dev:backend          │`);
    console.error('╰──────────────────────────────────────────────────────────╯');
    console.error('');
  } else {
    logger.error('Erro no servidor HTTP', { code: err.code, message: err.message });
  }
  process.exit(1);
});

// ── Start Server ──────────────────────────────────────────
async function start() {
  await connectRedis();

  // 0.0.0.0 → escuta em TODAS as interfaces (localhost + LAN). Permite acesso
  // de celular/tablet na mesma rede WiFi (necessário pra teste mobile real).
  server.listen(env.PORT, '0.0.0.0', () => {
    const ips = listarIPsLocais();
    const conteudos = [
      '🚀 Kanban Estoque — Backend ativo',
      '',
      `Local:    http://localhost:${env.PORT}`,
      `          http://127.0.0.1:${env.PORT}`,
    ];
    if (ips.length > 0) {
      conteudos.push('');
      conteudos.push('Rede (LAN — acesso de celular/tablet na mesma WiFi):');
      for (const ip of ips) {
        conteudos.push(`  [${ip.interface}] http://${ip.address}:${env.PORT}`);
      }
    }
    // Largura dinâmica = maior linha + padding
    const larguraInterna = Math.max(...conteudos.map(c => c.length)) + 4;
    const horiz = '─'.repeat(larguraInterna);
    console.log('');
    console.log('╭' + horiz + '╮');
    conteudos.forEach((c, i) => {
      const linha = '  ' + c;
      console.log('│' + linha + ' '.repeat(larguraInterna - linha.length) + '│');
      // separador após o título
      if (i === 0) console.log('├' + horiz + '┤');
    });
    console.log('╰' + horiz + '╯');

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
