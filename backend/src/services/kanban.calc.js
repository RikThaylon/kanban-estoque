const { query, getClient } = require('../config/database');
const { calcularParametrosKanban } = require('./kanban.math');
const { getKanbanSeries } = require('./kanban.repo');
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
    'SELECT id, custo_unitario, custo_pedido, taxa_carregamento, nivel_servico, estoque_atual FROM produtos WHERE id = $1 AND ativo = true',
    [produtoId]
  );
  if (prodRes.rows.length === 0) return null;
  const produto = prodRes.rows[0];

  // Obter séries temporais via repositório
  const { demandaSemanalSeries, leadTimeSeries, leadTimeFornecedor } = await getKanbanSeries(produtoId);

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
  });

  // Buscar faixa anterior
  const kpRes = await query('SELECT * FROM kanban_parametros WHERE produto_id = $1', [produtoId]);
  const parametrosAtuais = kpRes.rows[0] || {};
  const faixaAnterior = kpRes.rows[0]?.faixa_atual || 'SEM_DADOS';
  const estoqueAtual = parseFloat(produto.estoque_atual);

  if (result.insuficiente_historico) {
    result.ES = toNumberOrNull(parametrosAtuais.estoque_seguranca);
    result.PR = toNumberOrNull(parametrosAtuais.ponto_reposicao);
    result.EOQ = toNumberOrNull(parametrosAtuais.eoq);
    result.Emax = toNumberOrNull(parametrosAtuais.estoque_maximo);
    result.faixa = calcularFaixaPorParametros(estoqueAtual, result.ES, result.PR);
  }

  // Upsert kanban_parametros
  await query(`
    INSERT INTO kanban_parametros (produto_id, demanda_diaria_media, sigma_demanda_diaria,
      lead_time_previsto_dias, lead_time_seguro_dias, sigma_lead_time, fator_z,
      estoque_seguranca, ponto_reposicao, eoq, estoque_maximo, faixa_atual,
      semanas_historico_usadas, pedidos_historico_usados, calculado_em, proximo_calculo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW() + INTERVAL '12 hours')
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
  ]);

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
