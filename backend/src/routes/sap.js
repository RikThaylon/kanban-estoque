const express = require('express');
const { authenticate } = require('../middleware/auth');
const { env } = require('../config/env');
const { query } = require('../config/database');

const router = express.Router();

// GET /api/v1/sap/status
router.get('/status', authenticate, async (req, res, next) => {
  try {
    // Busca o último log de sincronização se existir tabela
    let lastSync = null;
    let workerStatus = env.SAP_MODE ? 'WAITING' : 'DISABLED';
    
    try {
      const result = await query(`
        SELECT started_at, finished_at, status, records_processed, errors 
        FROM sap_sync_logs 
        ORDER BY id DESC LIMIT 1
      `);
      if (result.rows.length > 0) {
        lastSync = result.rows[0];
      }
    } catch (err) {
      // Tabela pode não existir ainda se a migration não rodou
    }

    res.json({
      mode: env.SAP_MODE ? 'SAP_INTEGRATION' : 'STANDALONE',
      isSapMode: env.SAP_MODE,
      provider: 'Provider not configured.',
      workerStatus,
      lastSync
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sap/logs
router.get('/logs', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT * FROM sap_sync_logs 
      ORDER BY id DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    // Retorna vazio caso tabela não exista
    if (err.code === '42P01') return res.json([]);
    next(err);
  }
});

module.exports = router;
