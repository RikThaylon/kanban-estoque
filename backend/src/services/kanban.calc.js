const { query, getClient } = require('../config/database');
const { calcularParametrosKanban } = require('./kanban.math');
const logger = require('../utils/logger');

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

  // Buscar consumo semanal das últimas 52 semanas
  const consumoRes = await query(`
    SELECT date_trunc('week', criado_em) AS semana,
           COALESCE(SUM(CASE WHEN tipo IN ('SAIDA','TRANSFERENCIA') THEN quantidade ELSE 0 END), 0) AS consumo
    FROM movimentacoes
    WHERE produto_id = $1 AND tipo IN ('SAIDA','TRANSFERENCIA')
      AND criado_em >= NOW() - INTERVAL '52 weeks'
    GROUP BY date_trunc('week', criado_em)
    ORDER BY semana ASC
  `, [produtoId]);

  const demandaSemanalSeries = consumoRes.rows.map(r => parseFloat(r.consumo));

  // Buscar lead times dos últimos 20 pedidos recebidos
  const ltRes = await query(`
    SELECT lead_time_real_dias
    FROM pedidos_compra
    WHERE produto_id = $1 AND status = 'RECEBIDO' AND lead_time_real_dias IS NOT NULL
    ORDER BY data_recebimento DESC
    LIMIT 20
  `, [produtoId]);

  const leadTimeSeries = ltRes.rows.map(r => r.lead_time_real_dias).reverse();

  // Calcular parâmetros
  const result = calcularParametrosKanban({
    demandaSemanalSeries,
    leadTimeSeries,
    custoUnitario: parseFloat(produto.custo_unitario),
    custoPedido: parseFloat(produto.custo_pedido),
    taxaCarregamento: parseFloat(produto.taxa_carregamento),
    nivelServico: produto.nivel_servico,
    estoqueAtual: parseFloat(produto.estoque_atual),
  });

  // Buscar faixa anterior
  const kpRes = await query('SELECT faixa_atual FROM kanban_parametros WHERE produto_id = $1', [produtoId]);
  const faixaAnterior = kpRes.rows[0]?.faixa_atual || 'SEM_DADOS';

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
    result.intermediarios.demandaDiariaMedia || 0,
    result.intermediarios.sigmaD || 0,
    result.intermediarios.ltPrevisto || 0,
    result.intermediarios.ltSeguro || 0,
    result.intermediarios.sigmaLT || 0,
    result.intermediarios.Z || 0,
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

module.exports = { recalcularKanban };
