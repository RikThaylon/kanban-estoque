const cron = require('node-cron');
const { env } = require('../config/env');
const logger = require('../utils/logger');

class SapSyncWorker {
  static start() {
    if (env.SAP_MODE !== true) {
      logger.info('[SapSyncWorker] SAP Mode desativado. Worker não iniciado.');
      return;
    }

    // Cron job placeholder (e.g., run every 15 minutes)
    cron.schedule('*/15 * * * *', async () => {
      try {
        await this.runSync();
      } catch (err) {
        logger.error('[SapSyncWorker] Erro na sincronização:', err);
      }
    });

    logger.info('[SapSyncWorker] Inicializado. Aguardando implementacao de integracao...');
  }

  static async runSync() {
    throw new Error('Not implemented: SAP integration is pending.');
  }
}

module.exports = { SapSyncWorker };
