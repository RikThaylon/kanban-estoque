/**
 * @module simulation.service
 * @description Gerencia simulações de Monte Carlo com Piscina (worker_threads).
 * Persiste progresso e resultado em `simulation_runs` no PostgreSQL.
 */

'use strict';

const os = require('os');
const path = require('path');
const Piscina = require('piscina');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { Z_TABLE } = require('./kanban.math');

// Pool limitado a N-1 CPUs para não bloquear o event loop
const WORKER_CONCURRENCY = Math.max(1, os.cpus().length - 1);

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Piscina({
      filename: path.resolve(__dirname, '../workers/montecarlo.worker.js'),
      maxThreads: WORKER_CONCURRENCY,
      idleTimeout: 30000, // libera threads ociosas após 30s
    });
  }
  return pool;
}

/**
 * Dispara uma simulação para um SKU.
 * Persiste o run com status 'queued', depois roda assincronamente e atualiza com o resultado.
 *
 * @param {object} params
 * @param {string} params.skuId
 * @param {object} params.kanbanParametros - resultado de calcularParametrosKanban()
 * @param {number} params.nSimulations
 * @returns {Promise<string>} runId
 */
async function enqueueSimulation({ skuId, kanbanParametros, nSimulations = 10000 }) {
  // Verificar se já existe run recente (< 1h) para esse SKU
  const existing = await query(
    `SELECT id FROM simulation_runs WHERE sku_id = $1 AND status IN ('queued','running') AND started_at > NOW() - INTERVAL '1 hour'`,
    [skuId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Criar run com status queued
  const runRes = await query(
    `INSERT INTO simulation_runs (sku_id, status, n_simulations, fill_rate_theoretical, cv_confidence)
     VALUES ($1, 'queued', $2, NULL, $3)
     RETURNING id`,
    [skuId, nSimulations, kanbanParametros.intermediarios?.cvConfidence || 'default']
  );
  const runId = runRes.rows[0].id;

  const inter = kanbanParametros.intermediarios || {};
  const Z = inter.Z || Z_TABLE[95];
  const intermitente = inter.tierDemanda === 'TIER_2_INTERMITENTE';

  const task = {
    demandaDiariaMedia: inter.demandaDiariaMedia || 0,
    sigmaD: inter.sigmaD || 0,
    ltPrevisto: inter.ltPrevisto || 1,
    sigmaLT: inter.sigmaLT || 0,
    estoqueSeguranca: kanbanParametros.ES || 0,
    pontoReposicao: kanbanParametros.PR || 0,
    nSimulations,
    Z,
    intermitente,
  };

  // Calcular fill rate teórico analítico (Normal)
  const sigmaDuranteLT = inter.sigmaDuranteLT || 0;
  const fillRateTheorical = sigmaDuranteLT > 0
    ? normalCDF(Z)
    : 1.0;

  // Marcar como running
  await query(
    `UPDATE simulation_runs SET status = 'running', fill_rate_theoretical = $1 WHERE id = $2`,
    [fillRateTheorical, runId]
  );

  // Rodar no pool sem bloquear
  getPool().run(task).then(async (result) => {
    await query(
      `UPDATE simulation_runs
       SET status = 'completed', progress = 100,
           fill_rate_simulated = $1, result_json = $2, finished_at = NOW()
       WHERE id = $3`,
      [result.fillRateSimulated, JSON.stringify(result), runId]
    );
    logger.info(`[MonteCarloService] Run ${runId} concluído. Fill rate: ${result.fillRateSimulated}`);
  }).catch(async (err) => {
    await query(
      `UPDATE simulation_runs SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
      [err.message, runId]
    );
    logger.error(`[MonteCarloService] Run ${runId} falhou:`, err);
  });

  return runId;
}

/**
 * Busca resultado de um run pelo ID.
 */
async function getSimulationResult(runId) {
  const res = await query(
    'SELECT * FROM simulation_runs WHERE id = $1',
    [runId]
  );
  return res.rows[0] || null;
}

/**
 * Lista os últimos runs de um SKU.
 */
async function listRunsForSku(skuId, limit = 10) {
  const res = await query(
    `SELECT id, status, progress, n_simulations, fill_rate_theoretical, fill_rate_simulated,
            cv_confidence, started_at, finished_at
     FROM simulation_runs WHERE sku_id = $1 ORDER BY started_at DESC LIMIT $2`,
    [skuId, limit]
  );
  return res.rows;
}

/**
 * Aproximação da CDF Normal padrão (Abramowitz & Stegun 26.2.17)
 */
function normalCDF(z) {
  if (z < -6) return 0;
  if (z > 6) return 1;
  const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937;
  const a4 = -1.821255978, a5 = 1.330274429;
  const p = 0.2316419;
  const t = 1 / (1 + p * Math.abs(z));
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

module.exports = { enqueueSimulation, getSimulationResult, listRunsForSku };
