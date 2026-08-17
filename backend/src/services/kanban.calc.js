const { query, getClient } = require('../config/database');
const { calcularParametrosKanban } = require('./kanban.math');
const { getKanbanSeries } = require('./kanban.repo');
const { getForecastDefaults } = require('./configuracoes.service');
const { analyzeDemand } = require('./forecast/forecast.engine');
const { analyzeLeadTime } = require('./forecast/lead-time.engine');
const logger = require('../utils/logger');

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function calcularFaixaPorParametros(estoqueAtual, estoqueSeguranca, pontoReposicao) {
  const es = toNumberOrNull(estoqueSeguranca);
  const pr = toNumberOrNull(pontoReposicao);
  if (es === null || pr === null) return 'SEM_DADOS';
  if (estoqueAtual <= es) return 'VERMELHO';
  if (estoqueAtual <= pr) return 'AMARELO';
  return 'VERDE';
}

/**
 * Orquestra o recálculo dos parâmetros Kanban para um produto
 * @param {string} produtoId - UUID do produto
 * @param {object} [io] - Instância Socket.io para emitir eventos
 * @returns {object} Parâmetros calculados
 */
async function recalcularKanban(produtoId, io = null) {
  // Buscar dados do produto
  const prodRes = await query(
    'SELECT id, custo_unitario, custo_pedido, taxa_carregamento, nivel_servico, estoque_atual, classificacao_abc, categoria_id FROM produtos WHERE id = $1 AND ativo = true',
    [produtoId]
  );
  if (prodRes.rows.length === 0) return null;
  const produto = prodRes.rows[0];

  // Obter séries temporais via repositório
  const {
    demandaSemanalSeries,
    demandaDiariaSeries,
    demandaDiariaObservations,
    leadTimeSeries,
    leadTimeFornecedor,
    dataQuality,
  } = await getKanbanSeries(produtoId);

  // Buscar faixa anterior e parametros estimados, quando existirem
  const kpRes = await query('SELECT * FROM kanban_parametros WHERE produto_id = $1', [produtoId]);
  const parametrosAtuais = kpRes.rows[0] || {};
  const faixaAnterior = kpRes.rows[0]?.faixa_atual || 'SEM_DADOS';
  const previousDriftDetected = Boolean(parametrosAtuais.demand_profile?.drift?.detected);

  const forecastDefaults = await getForecastDefaults();
  const nominalLeadTime = leadTimeFornecedor
    ?? toNumberOrNull(parametrosAtuais.lead_time_previsto_dias);
  const leadTimeAnalysis = (leadTimeSeries.length > 0 || nominalLeadTime)
    ? analyzeLeadTime(leadTimeSeries, {
      nominal: nominalLeadTime,
      config: forecastDefaults.engineConfig,
    })
    : null;
  const forecastHorizon = Math.min(90, Math.max(1, Math.ceil(
    leadTimeAnalysis?.distribution?.expected || nominalLeadTime || 1
  )));
  const forecastAnalysis = demandaDiariaSeries.length > 0
    ? analyzeDemand(demandaDiariaSeries, {
      horizon: forecastHorizon,
      dates: demandaDiariaObservations.map(observation => observation.date),
      trainedUntil: demandaDiariaObservations.at(-1)?.date || null,
      dataQuality,
      missingPeriodTreatment: dataQuality.missingPeriodTreatment,
      config: forecastDefaults.engineConfig,
    })
    : null;

  // Obter CV Dinâmico da categoria
  let dynamicCv = null;
  if (produto.categoria_id) {
    const cvRes = await query(`
      SELECT AVG(sigma_demanda_diaria / NULLIF(demanda_diaria_media, 0)) as avg_cv
      FROM kanban_parametros kp
      JOIN produtos p ON p.id = kp.produto_id
      WHERE p.categoria_id = $1 AND kp.semanas_historico_usadas >= 12
    `, [produto.categoria_id]);
    dynamicCv = cvRes.rows[0]?.avg_cv ? parseFloat(cvRes.rows[0].avg_cv) : null;
  }

  // Calcular parâmetros
  const result = calcularParametrosKanban({
    demandaSemanalSeries,
    leadTimeSeries,
    leadTimeFornecedor,
    custoUnitario: parseFloat(produto.custo_unitario),
    custoPedido: parseFloat(produto.custo_pedido),
    taxaCarregamento: parseFloat(produto.taxa_carregamento),
    nivelServico: produto.nivel_servico,
    estoqueAtual: parseFloat(produto.estoque_atual),
    classificacaoAbc: produto.classificacao_abc,
    expectedDemand: parametrosAtuais.demanda_diaria_media ? parseFloat(parametrosAtuais.demanda_diaria_media) : null,
    dynamicCv,
    forecastAnalysis,
    leadTimeAnalysis,
  });

  const estoqueAtual = parseFloat(produto.estoque_atual);

  if (result.insuficiente_historico) {
    result.ES = toNumberOrNull(parametrosAtuais.estoque_seguranca);
    result.PR = toNumberOrNull(parametrosAtuais.ponto_reposicao);
    result.EOQ = toNumberOrNull(parametrosAtuais.eoq);
    result.Emax = toNumberOrNull(parametrosAtuais.estoque_maximo);
    result.faixa = calcularFaixaPorParametros(estoqueAtual, result.ES, result.PR);
  }

  let forecastRunId = null;
  if (forecastAnalysis) {
    const run = await query(`
      INSERT INTO forecast_runs (
        produto_id, engine_version, model_type, model_version, status,
        frequency, horizon_periods, parameters, demand_profile, metrics,
        challengers, forecast_result, data_quality, drift, confidence,
        trained_until, evaluated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
      ) RETURNING id
    `, [
      produtoId,
      forecastAnalysis.engineVersion,
      forecastAnalysis.modelSelection.selected,
      forecastAnalysis.modelSelection.version,
      forecastAnalysis.confidence === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'CHAMPION',
      forecastAnalysis.forecast.frequency,
      forecastAnalysis.forecast.horizon,
      JSON.stringify(forecastAnalysis.modelSelection.parameters || {}),
      JSON.stringify(forecastAnalysis.profile),
      JSON.stringify(forecastAnalysis.metrics),
      JSON.stringify(forecastAnalysis.modelSelection.challengers),
      JSON.stringify(forecastAnalysis.forecast),
      JSON.stringify(forecastAnalysis.profile.dataQuality || {}),
      JSON.stringify(forecastAnalysis.drift || {}),
      forecastAnalysis.confidence,
      forecastAnalysis.trainedUntil,
      forecastAnalysis.evaluatedAt,
    ]);
    forecastRunId = run.rows[0]?.id || null;
    logger.info('Forecast model selected', {
      event: 'forecast.model.selected',
      materialId: produtoId,
      model: forecastAnalysis.modelSelection.selected,
      historyLength: forecastAnalysis.profile.historyLength,
      wape: forecastAnalysis.metrics.wape,
      confidence: forecastAnalysis.confidence,
    });
  }

  // Upsert kanban_parametros
  await query(`
    INSERT INTO kanban_parametros (produto_id, demanda_diaria_media, sigma_demanda_diaria,
      lead_time_previsto_dias, lead_time_seguro_dias, sigma_lead_time, fator_z,
      estoque_seguranca, ponto_reposicao, eoq, estoque_maximo, faixa_atual,
      semanas_historico_usadas, pedidos_historico_usados, sigma_durante_lt, tier_demanda, cv_confidence,
      forecast_run_id, forecast_model, forecast_version, forecast_confidence,
      forecast_metrics, demand_profile, forecast_result, forecast_treinado_ate, forecast_avaliado_em,
      calculado_em, proximo_calculo)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW() + INTERVAL '12 hours')
    ON CONFLICT (produto_id) DO UPDATE SET
      demanda_diaria_media = EXCLUDED.demanda_diaria_media,
      sigma_demanda_diaria = EXCLUDED.sigma_demanda_diaria,
      lead_time_previsto_dias = EXCLUDED.lead_time_previsto_dias,
      lead_time_seguro_dias = EXCLUDED.lead_time_seguro_dias,
      sigma_lead_time = EXCLUDED.sigma_lead_time,
      fator_z = EXCLUDED.fator_z,
      estoque_seguranca = EXCLUDED.estoque_seguranca,
      ponto_reposicao = EXCLUDED.ponto_reposicao,
      eoq = EXCLUDED.eoq,
      estoque_maximo = EXCLUDED.estoque_maximo,
      faixa_atual = EXCLUDED.faixa_atual,
      semanas_historico_usadas = EXCLUDED.semanas_historico_usadas,
      pedidos_historico_usados = EXCLUDED.pedidos_historico_usados,
      sigma_durante_lt = EXCLUDED.sigma_durante_lt,
      tier_demanda = EXCLUDED.tier_demanda,
      cv_confidence = EXCLUDED.cv_confidence,
      forecast_run_id = COALESCE(EXCLUDED.forecast_run_id, kanban_parametros.forecast_run_id),
      forecast_model = COALESCE(EXCLUDED.forecast_model, kanban_parametros.forecast_model),
      forecast_version = COALESCE(EXCLUDED.forecast_version, kanban_parametros.forecast_version),
      forecast_confidence = COALESCE(EXCLUDED.forecast_confidence, kanban_parametros.forecast_confidence),
      forecast_metrics = COALESCE(EXCLUDED.forecast_metrics, kanban_parametros.forecast_metrics),
      demand_profile = COALESCE(EXCLUDED.demand_profile, kanban_parametros.demand_profile),
      forecast_result = COALESCE(EXCLUDED.forecast_result, kanban_parametros.forecast_result),
      forecast_treinado_ate = COALESCE(EXCLUDED.forecast_treinado_ate, kanban_parametros.forecast_treinado_ate),
      forecast_avaliado_em = COALESCE(EXCLUDED.forecast_avaliado_em, kanban_parametros.forecast_avaliado_em),
      calculado_em = NOW(),
      proximo_calculo = NOW() + INTERVAL '12 hours'
  `, [
    produtoId,
    result.intermediarios.demandaDiariaMedia ?? parametrosAtuais.demanda_diaria_media ?? null,
    result.intermediarios.sigmaD ?? parametrosAtuais.sigma_demanda_diaria ?? null,
    result.intermediarios.ltPrevisto ?? parametrosAtuais.lead_time_previsto_dias ?? leadTimeFornecedor ?? null,
    result.intermediarios.ltSeguro ?? parametrosAtuais.lead_time_seguro_dias ?? leadTimeFornecedor ?? null,
    result.intermediarios.sigmaLT ?? parametrosAtuais.sigma_lead_time ?? null,
    result.intermediarios.Z ?? parametrosAtuais.fator_z ?? null,
    result.ES,
    result.PR,
    result.EOQ,
    result.Emax,
    result.faixa,
    demandaSemanalSeries.length,
    leadTimeSeries.length,
    result.intermediarios.sigmaDuranteLT ?? null,
    result.intermediarios.tierDemanda ?? null,
    result.intermediarios.cvConfidence ?? null,
    forecastRunId,
    forecastAnalysis?.modelSelection?.selected ?? null,
    forecastAnalysis?.modelSelection?.version ?? null,
    forecastAnalysis?.confidence ?? null,
    forecastAnalysis ? JSON.stringify(forecastAnalysis.metrics) : null,
    forecastAnalysis ? JSON.stringify(forecastAnalysis.profile) : null,
    forecastAnalysis ? JSON.stringify(forecastAnalysis.forecast) : null,
    forecastAnalysis?.trainedUntil ?? null,
    forecastAnalysis?.evaluatedAt ?? null,
  ]);

  if (forecastAnalysis?.drift?.detected && !previousDriftDetected) {
    await query(
      `INSERT INTO alertas (produto_id, tipo, titulo, mensagem, severidade)
       VALUES ($1, 'FORECAST_DRIFT', 'Mudança no padrão de demanda', $2, 'AVISO')`,
      [
        produtoId,
        `A média recente mudou ${(forecastAnalysis.drift.meanRatio * 100).toFixed(1)}% (${forecastAnalysis.drift.direction}). O modelo foi reavaliado automaticamente.`,
      ]
    );
    if (io) {
      io.emit('forecast:drift', {
        produto_id: produtoId,
        direction: forecastAnalysis.drift.direction,
        mean_ratio: forecastAnalysis.drift.meanRatio,
        model: forecastAnalysis.modelSelection.selected,
      });
    }
  }

  // Se faixa mudou, criar alerta e emitir evento
  if (faixaAnterior !== result.faixa && result.faixa !== 'SEM_DADOS') {
    const prodNome = (await query('SELECT nome FROM produtos WHERE id = $1', [produtoId])).rows[0]?.nome;

    const severidade = result.faixa === 'VERMELHO' ? 'CRITICO' : result.faixa === 'AMARELO' ? 'AVISO' : 'INFO';
    await query(
      `INSERT INTO alertas (produto_id, tipo, titulo, mensagem, severidade)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        produtoId,
        `FAIXA_${result.faixa}`,
        `${prodNome} mudou para faixa ${result.faixa}`,
        `Faixa alterada de ${faixaAnterior} para ${result.faixa}. Estoque: ${produto.estoque_atual}, PR: ${result.PR}, ES: ${result.ES}`,
        severidade,
      ]
    );

    if (io) {
      io.emit('faixa:mudou', {
        produto_id: produtoId,
        faixa_anterior: faixaAnterior,
        faixa_nova: result.faixa,
        produto_nome: prodNome,
        estoque_atual: parseFloat(produto.estoque_atual),
        pr: result.PR,
      });
    }
  }

  if (io) {
    io.emit('kanban:recalculado', {
      produto_id: produtoId,
      faixa_anterior: faixaAnterior,
      faixa_atual: result.faixa,
      estoque_atual: parseFloat(produto.estoque_atual),
      pr: result.PR,
      es: result.ES,
      eoq: result.EOQ,
    });
  }

  return result;
}

const kanbanDebounceMap = new Map();

/**
 * Versão com debounce do recálculo Kanban (evita concorrência e chamadas múltiplas na mesma janela de tempo)
 * @param {string} produtoId - UUID do produto
 * @param {object} [io] - Instância Socket.io
 */
function debouncedRecalcularKanban(produtoId, io = null) {
  if (kanbanDebounceMap.has(produtoId)) {
    clearTimeout(kanbanDebounceMap.get(produtoId));
  }
  
  kanbanDebounceMap.set(produtoId, setTimeout(() => {
    recalcularKanban(produtoId, io)
      .catch(err => logger.error(`[Kanban] Erro ao recalcular para ${produtoId}:`, err))
      .finally(() => kanbanDebounceMap.delete(produtoId));
  }, 2000)); // Debounce de 2 segundos
}

module.exports = { recalcularKanban: debouncedRecalcularKanban, _recalcularKanbanSync: recalcularKanban };
