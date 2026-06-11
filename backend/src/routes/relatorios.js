const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { classificacaoABC } = require('../services/kanban.math');

const router = express.Router();

// Helper: clausula de período aplicada à coluna criado_em
function buildPeriodoSQL(periodo, alias = 'm.criado_em') {
  const dias = parseInt(periodo, 10);
  if (Number.isFinite(dias) && dias > 0 && dias <= 3650) {
    return `${alias} >= NOW() - INTERVAL '${dias} days'`;
  }
  return `${alias} >= NOW() - INTERVAL '30 days'`;
}

// ─── GET /api/v1/relatorios/curva-abc ───────────────────────────────────────
router.get('/curva-abc', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.id AS produto_id, p.codigo, p.nome, p.custo_unitario, p.classificacao_abc,
        COALESCE(kp.demanda_diaria_media * 365, 0) AS demanda_anual
      FROM produtos p LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
      WHERE p.ativo = true
    `);
    const abc = classificacaoABC(result.rows.map(r => ({
      produto_id: r.produto_id, codigo: r.codigo, nome: r.nome,
      custo_unitario: parseFloat(r.custo_unitario), demanda_anual: parseFloat(r.demanda_anual),
    })));
    res.json(abc);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/giro-estoque ────────────────────────────────────
router.get('/giro-estoque', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.id, p.codigo, p.nome, p.estoque_atual, p.custo_unitario,
        COALESCE(kp.demanda_diaria_media * 365, 0) AS demanda_anual,
        CASE WHEN p.estoque_atual > 0
          THEN ROUND((COALESCE(kp.demanda_diaria_media * 365, 0) / p.estoque_atual)::NUMERIC, 2)
          ELSE 0 END AS giro
      FROM produtos p LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
      WHERE p.ativo = true ORDER BY giro DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/pedidos-periodo ─────────────────────────────────
router.get('/pedidos-periodo', authenticate, async (req, res, next) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const params = [];
    let where = "WHERE pc.status IN ('CONCLUIDO','RECEBIDO')";
    if (data_inicio) { params.push(data_inicio); where += ` AND pc.data_recebimento >= $${params.length}`; }
    if (data_fim) { params.push(data_fim); where += ` AND pc.data_recebimento <= $${params.length}`; }

    const result = await query(`
      SELECT pc.*, p.nome AS produto_nome, p.codigo AS produto_codigo, f.nome AS fornecedor_nome,
        CASE WHEN pc.data_prevista IS NOT NULL AND pc.data_recebimento IS NOT NULL
          THEN EXTRACT(DAY FROM pc.data_recebimento - pc.data_prevista::TIMESTAMPTZ)::INTEGER
          ELSE NULL END AS desvio_prazo_dias
      FROM pedidos_compra pc
      LEFT JOIN produtos p ON p.id = pc.produto_id
      LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
      ${where} ORDER BY pc.data_recebimento DESC
    `, params);

    const custoTotal = result.rows.reduce((s, r) => s + (parseFloat(r.custo_total) || 0), 0);
    res.json({ pedidos: result.rows, custo_total_periodo: custoTotal });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/rupturas-historico ──────────────────────────────
router.get('/rupturas-historico', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT m.criado_em, m.produto_id, p.codigo, p.nome, m.estoque_depois,
        kp.estoque_seguranca
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      JOIN kanban_parametros kp ON kp.produto_id = m.produto_id
      WHERE m.estoque_depois < kp.estoque_seguranca AND m.estoque_depois >= 0
        AND m.status = 'EXECUTADO'
      ORDER BY m.criado_em DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/top-solicitantes ────────────────────────────────
// Quem mais consome materiais (movimentações de SAIDA executadas)
router.get('/top-solicitantes', authenticate, async (req, res, next) => {
  try {
    const periodoSQL = buildPeriodoSQL(req.query.periodo);
    const limite = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const result = await query(`
      SELECT u.id AS usuario_id, u.nome, u.username, u.perfil,
        COUNT(*) AS total_movimentacoes,
        COALESCE(SUM(m.quantidade), 0) AS quantidade_total,
        COALESCE(SUM(m.quantidade * p.custo_unitario), 0) AS valor_total
      FROM movimentacoes m
      JOIN usuarios u ON u.id = m.criado_por
      JOIN produtos p ON p.id = m.produto_id
      WHERE m.tipo = 'SAIDA' AND m.status = 'EXECUTADO' AND ${periodoSQL}
      GROUP BY u.id, u.nome, u.username, u.perfil
      ORDER BY valor_total DESC
      LIMIT $1
    `, [limite]);

    res.json(result.rows.map(r => ({
      ...r,
      total_movimentacoes: parseInt(r.total_movimentacoes, 10),
      quantidade_total: parseFloat(r.quantidade_total),
      valor_total: parseFloat(r.valor_total),
    })));
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/top-produtos-saida ──────────────────────────────
// Quais materiais mais saem do estoque
router.get('/top-produtos-saida', authenticate, async (req, res, next) => {
  try {
    const periodoSQL = buildPeriodoSQL(req.query.periodo);
    const limite = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const result = await query(`
      SELECT p.id AS produto_id, p.codigo, p.nome, p.unidade, p.classificacao_abc,
        c.nome AS categoria_nome,
        COUNT(*) AS total_saidas,
        COALESCE(SUM(m.quantidade), 0) AS quantidade_total,
        COALESCE(SUM(m.quantidade * p.custo_unitario), 0) AS valor_total
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE m.tipo = 'SAIDA' AND m.status = 'EXECUTADO' AND ${periodoSQL}
      GROUP BY p.id, p.codigo, p.nome, p.unidade, p.classificacao_abc, c.nome
      ORDER BY valor_total DESC
      LIMIT $1
    `, [limite]);

    res.json(result.rows.map(r => ({
      ...r,
      total_saidas: parseInt(r.total_saidas, 10),
      quantidade_total: parseFloat(r.quantidade_total),
      valor_total: parseFloat(r.valor_total),
    })));
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/consumo-por-categoria ───────────────────────────
// Onde está sendo gasto (consumo agregado por categoria)
router.get('/consumo-por-categoria', authenticate, async (req, res, next) => {
  try {
    const periodoSQL = buildPeriodoSQL(req.query.periodo);

    const result = await query(`
      SELECT
        COALESCE(c.id::text, 'sem-categoria') AS categoria_id,
        COALESCE(c.nome, 'Sem categoria') AS categoria_nome,
        COALESCE(c.cor_hex, 'CBD5E1') AS cor_hex,
        COUNT(DISTINCT p.id) AS total_produtos,
        COUNT(*) AS total_movimentacoes,
        COALESCE(SUM(m.quantidade), 0) AS quantidade_total,
        COALESCE(SUM(m.quantidade * p.custo_unitario), 0) AS valor_total
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE m.tipo = 'SAIDA' AND m.status = 'EXECUTADO' AND ${periodoSQL}
      GROUP BY c.id, c.nome, c.cor_hex
      ORDER BY valor_total DESC
    `);

    const total = result.rows.reduce((s, r) => s + parseFloat(r.valor_total), 0);
    res.json(result.rows.map(r => ({
      ...r,
      total_produtos: parseInt(r.total_produtos, 10),
      total_movimentacoes: parseInt(r.total_movimentacoes, 10),
      quantidade_total: parseFloat(r.quantidade_total),
      valor_total: parseFloat(r.valor_total),
      percentual: total > 0 ? (parseFloat(r.valor_total) / total) * 100 : 0,
    })));
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/estatisticas-gerais ─────────────────────────────
// KPIs consolidados pra dashboard de relatórios
router.get('/estatisticas-gerais', authenticate, async (req, res, next) => {
  try {
    const periodoSQL = buildPeriodoSQL(req.query.periodo);

    const [movs, valores, pedidos, aprovacoes] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE m.tipo = 'SAIDA' AND m.status = 'EXECUTADO') AS total_saidas,
          COUNT(*) FILTER (WHERE m.tipo = 'ENTRADA' AND m.status = 'EXECUTADO') AS total_entradas,
          COUNT(*) FILTER (WHERE m.tipo IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO') AND m.status = 'EXECUTADO') AS total_ajustes,
          COUNT(*) FILTER (WHERE m.status = 'PENDENTE') AS total_pendentes
        FROM movimentacoes m
        WHERE ${periodoSQL}
      `),
      query(`
        SELECT
          COALESCE(SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade * p.custo_unitario ELSE 0 END), 0) AS valor_consumido,
          COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade * p.custo_unitario ELSE 0 END), 0) AS valor_recebido
        FROM movimentacoes m
        JOIN produtos p ON p.id = m.produto_id
        WHERE m.status = 'EXECUTADO' AND ${periodoSQL}
      `),
      query(`
        SELECT
          COUNT(*) AS total_pedidos,
          COUNT(*) FILTER (WHERE status IN ('CONCLUIDO','RECEBIDO')) AS pedidos_recebidos,
          COUNT(*) FILTER (WHERE status IN ('AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO')) AS pedidos_em_andamento,
          COALESCE(SUM(custo_total), 0) AS custo_pedidos_total
        FROM pedidos_compra
        WHERE ${buildPeriodoSQL(req.query.periodo, 'criado_em')}
      `),
      query(`
        SELECT COUNT(*) AS pendentes_aprovacao
        FROM movimentacoes
        WHERE status = 'PENDENTE'
      `),
    ]);

    res.json({
      movimentacoes: {
        saidas: parseInt(movs.rows[0].total_saidas, 10),
        entradas: parseInt(movs.rows[0].total_entradas, 10),
        ajustes: parseInt(movs.rows[0].total_ajustes, 10),
        pendentes_no_periodo: parseInt(movs.rows[0].total_pendentes, 10),
      },
      financeiro: {
        valor_consumido: parseFloat(valores.rows[0].valor_consumido),
        valor_recebido: parseFloat(valores.rows[0].valor_recebido),
      },
      pedidos: {
        total: parseInt(pedidos.rows[0].total_pedidos, 10),
        recebidos: parseInt(pedidos.rows[0].pedidos_recebidos, 10),
        em_andamento: parseInt(pedidos.rows[0].pedidos_em_andamento, 10),
        custo_total: parseFloat(pedidos.rows[0].custo_pedidos_total),
      },
      pendencias: {
        movimentacoes_aguardando_aprovacao: parseInt(aprovacoes.rows[0].pendentes_aprovacao, 10),
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/relatorios/previsao-gastos-mensal ──────────────────────────
// Agrupa pedidos APROVADOS / EMITIDOS / EM_TRANSITO / RECEBIDO_PARCIAL por
// data_chegada = COALESCE(data_prevista, data_emissao + lead_time_nominal_dias).
// Retorna previsão de saída de caixa por mês de chegada (não por data de emissão).
router.get('/previsao-gastos-mensal', authenticate, async (req, res, next) => {
  try {
    const meses = Math.min(parseInt(req.query.meses, 10) || 12, 24);

    // Status que ainda vão chegar (excluindo RECEBIDO total, CANCELADO, REJEITADO, RASCUNHO, AGUARDANDO_*)
    const result = await query(`
      WITH com_chegada AS (
        SELECT pc.id, pc.numero, pc.status, pc.custo_total,
               pc.quantidade_pedida, pc.quantidade_recebida,
               (pc.custo_total - COALESCE(pc.custo_total * pc.quantidade_recebida / NULLIF(pc.quantidade_pedida, 0), 0)) AS valor_aberto,
               COALESCE(
                 pc.data_prevista::TIMESTAMPTZ,
                 pc.data_emissao + (COALESCE(pf.lead_time_nominal_dias, 7) || ' days')::INTERVAL
               ) AS data_chegada,
               p.id AS produto_id, p.codigo AS produto_codigo, p.nome AS produto_nome,
               c.nome AS categoria_nome, c.cor_hex
        FROM pedidos_compra pc
        JOIN produtos p ON p.id = pc.produto_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN produto_fornecedor pf ON pf.produto_id = pc.produto_id AND pf.fornecedor_id = pc.fornecedor_id
        WHERE pc.status IN ('APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL')
          AND pc.data_emissao IS NOT NULL
      )
      SELECT TO_CHAR(date_trunc('month', data_chegada), 'YYYY-MM') AS mes_chegada,
             COUNT(*) AS qtd_ordens,
             SUM(valor_aberto) AS valor_total_previsto,
             SUM(custo_total) AS valor_total_bruto,
             jsonb_agg(jsonb_build_object(
               'pedido_id', id,
               'numero', numero,
               'status', status,
               'produto_codigo', produto_codigo,
               'produto_nome', produto_nome,
               'categoria_nome', categoria_nome,
               'cor_hex', cor_hex,
               'valor_aberto', valor_aberto,
               'data_chegada', data_chegada
             ) ORDER BY data_chegada) AS itens
      FROM com_chegada
      WHERE data_chegada <= NOW() + ($1 || ' months')::INTERVAL
      GROUP BY date_trunc('month', data_chegada)
      ORDER BY date_trunc('month', data_chegada) ASC
    `, [meses]);

    const linhas = result.rows.map(r => ({
      mes_chegada: r.mes_chegada,
      qtd_ordens: parseInt(r.qtd_ordens, 10),
      valor_total_previsto: parseFloat(r.valor_total_previsto || 0),
      valor_total_bruto: parseFloat(r.valor_total_bruto || 0),
      itens: r.itens || [],
    }));

    const totalPeriodo = linhas.reduce((s, l) => s + l.valor_total_previsto, 0);

    res.json({
      meses_horizonte: meses,
      total_previsto_periodo: totalPeriodo,
      linhas,
    });
  } catch (err) { next(err); }
});

module.exports = router;
