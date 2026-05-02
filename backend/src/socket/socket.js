const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Configura Socket.io com autenticação JWT
 * @param {import('socket.io').Server} io
 */
function configurarSocket(io) {
  // Middleware de autenticação no handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Token não fornecido'));
    }
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = { id: decoded.id, email: decoded.email, perfil: decoded.perfil, nome: decoded.nome };
      next();
    } catch (err) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket conectado: ${socket.user.nome} (${socket.id})`);

    // Subscribe a sala de produto específico
    socket.on('subscribe:produto', ({ produto_id }) => {
      if (produto_id) {
        socket.join(`produto:${produto_id}`);
        logger.debug(`Socket ${socket.id} entrou na sala produto:${produto_id}`);
      }
    });

    // Unsubscribe de sala de produto
    socket.on('unsubscribe:produto', ({ produto_id }) => {
      if (produto_id) {
        socket.leave(`produto:${produto_id}`);
        logger.debug(`Socket ${socket.id} saiu da sala produto:${produto_id}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Socket desconectado: ${socket.user.nome} (${reason})`);
    });

    socket.on('error', (err) => {
      logger.error('Socket erro', { error: err.message, socketId: socket.id });
    });
  });

  logger.info('✅ Socket.io configurado com autenticação JWT');
}

module.exports = { configurarSocket };
