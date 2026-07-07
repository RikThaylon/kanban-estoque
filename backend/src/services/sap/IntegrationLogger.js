const { query } = require('../../config/database');

class IntegrationLogger {
  static async logSync(data) {
    // Expected data: { started_at, finished_at, status, records_processed, errors, duration_ms, message }
    throw new Error('Not implemented: SAP integration is pending.');
  }

  static async getLogs(limit = 50) {
    throw new Error('Not implemented: SAP integration is pending.');
  }
}

module.exports = { IntegrationLogger };
