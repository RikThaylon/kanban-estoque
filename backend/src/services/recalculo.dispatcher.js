function getLogger(logger) {
  if (logger) return logger;
  return require('../utils/logger');
}

function dispatchRecalculoKanban(recalcularKanban, produtoId, io = null, logger = null) {
  const log = getLogger(logger);
  try {
    const maybePromise = recalcularKanban(produtoId, io);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(err => log.error('Erro ao recalcular Kanban', {
        produtoId,
        error: err.message,
      }));
    }
    return maybePromise;
  } catch (err) {
    log.error('Erro ao agendar recalculo Kanban', {
      produtoId,
      error: err.message,
    });
    return null;
  }
}

module.exports = { dispatchRecalculoKanban };
