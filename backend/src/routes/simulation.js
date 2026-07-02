const express = require('express');
const { authenticate } = require('../middleware/auth');
const { antiCsrf } = require('../middleware/csrf');
const simulationService = require('../services/simulation.service');
const kanbanCalc = require('../services/kanban.calc');
const { query } = require('../config/database');

const router = express.Router();

/**
 * POST /api/v1/simulations/run
 * Dispara uma simulação de Monte Carlo para um SKU.
 * Body: { sku_id, n_simulations? }
 */
router.post('/run', authenticate, antiCsrf, async (req, res, next) => {
  try {
    const { sku_id, n_simulations = 10000 } = req.body;
    if (!sku_id) return res.status(400).json({ error: 'sku_id é obrigatório' });

    // Buscar parâmetros Kanban já calculados do banco
    const kpRes = await query(
      `SELECT kp.*, p.classificacao_abc FROM kanban_parametros kp
       JOIN produtos p ON p.id = kp.produto_id
       WHERE kp.produto_id = $1`,
      [sku_id]
    );

    if (kpRes.rows.length === 0) {
      return res.status(404).json({ error: 'Parâmetros Kanban não encontrados. Recalcule o produto primeiro.' });
    }

    const kp = kpRes.rows[0];

    // Reconstrói estrutura kanbanParametros esperada pelo simulation.service
    const kanbanParametros = {
      ES: parseFloat(kp.estoque_seguranca) || 0,
      PR: parseFloat(kp.ponto_reposicao) || 0,
      intermediarios: {
        demandaDiariaMedia: parseFloat(kp.demanda_diaria_media) || 0,
        sigmaD: parseFloat(kp.sigma_demanda_diaria) || 0,
        ltPrevisto: parseFloat(kp.lead_time_previsto_dias) || 1,
        sigmaLT: parseFloat(kp.sigma_lead_time) || 0,
        sigmaDuranteLT: parseFloat(kp.sigma_durante_lt) || 0,
        Z: parseFloat(kp.fator_z) || 1.6449,
        tierDemanda: kp.tier_demanda || 'TIER_3_HOLT',
        cvConfidence: kp.cv_confidence || 'calculated',
      },
    };

    const runId = await simulationService.enqueueSimulation({
      skuId: sku_id,
      kanbanParametros,
      nSimulations: Math.min(50000, Math.max(1000, parseInt(n_simulations))),
    });

    res.status(202).json({
      message: 'Simulação enfileirada',
      run_id: runId,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/simulations/:runId
 * Consulta resultado de um run.
 */
router.get('/:runId', authenticate, async (req, res, next) => {
  try {
    const run = await simulationService.getSimulationResult(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run não encontrado' });
    res.json(run);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/simulations/sku/:skuId
 * Lista histórico de simulações de um SKU.
 */
router.get('/sku/:skuId', authenticate, async (req, res, next) => {
  try {
    const runs = await simulationService.listRunsForSku(req.params.skuId);
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
