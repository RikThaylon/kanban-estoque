const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// GET /api/v1/dashboard/resumo
router.get('/resumo', authenticate, async (req, res, next) => {
  try {
    const totalRes = await query('SELECT COUNT(*) FROM produtos WHERE ativo = true');
    const faixaRes = await query(`
      SELECT kp.faixa_atual, COUNT(*) as count FROM produtos p
      LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
      WHERE p.ativo = true GROUP BY kp.faixa_atual
    `);
    const por_faixa = { verde: 0, amarelo: 0, vermelho: 0, sem_dados: 0 };
    faixaRes.rows.forEach(r => {
      por_faixa[(r.faixa_atual || 'SEM_DADOS').toLowerCase()] = parseInt(r.count);
    });

    const pedAbertosRes = await query(`SELECT COUNT(*) FROM pedidos_compra WHERE status NOT IN ('CONCLUIDO','RECEBIDO','CANCELADO','REJEITADO')`);
    const pedUrgRes = await query(`SELECT COUNT(*) FROM pedidos_compra WHERE status = 'AGUARDANDO_APROVACAO'`);
    const alertasRes = await query('SELECT COUNT(*) FROM alertas WHERE lido = false');
    const valorRes = await query('SELECT COALESCE(SUM(estoque_atual * custo_unitario), 0) AS valor FROM produtos WHERE ativo = true');

    const semMovRes = await query(`
      SELECT COUNT(*) FROM produtos p WHERE p.ativo = true
      AND NOT EXISTS (SELECT 1 FROM movimentacoes m WHERE m.produto_id = p.id AND m.criado_em >= NOW() - INTERVAL '30 days')
    `);

    const rupturaRes = await query(`
      SELECT p.id, p.codigo, p.nome, p.estoque_atual, kp.estoque_seguranca, kp.demanda_diaria_media,
        CASE WHEN kp.demanda_diaria_media > 0
          THEN ROUND(((p.estoque_atual - kp.estoque_seguranca) / kp.demanda_diaria_media)::NUMERIC, 1)
          ELSE NULL END AS dias_cobertura
      FROM produtos p JOIN kanban_parametros kp ON kp.produto_id = p.id
      WHERE p.ativo = true AND kp.demanda_diaria_media > 0
        AND (p.estoque_atual - kp.estoque_seguranca) / kp.demanda_diaria_media <= 7
      ORDER BY (p.estoque_atual - kp.estoque_seguranca) / kp.demanda_diaria_media ASC
    `);

    res.json({
      total_produtos: parseInt(totalRes.rows[0].count),
      por_faixa,
      pedidos_abertos: parseInt(pedAbertosRes.rows[0].count),
      pedidos_urgentes_aprovacao: parseInt(pedUrgRes.rows[0].count),
      alertas_nao_lidos: parseInt(alertasRes.rows[0].count),
      valor_estoque_total: parseFloat(valorRes.rows[0].valor),
      produtos_sem_movimento_30d: parseInt(semMovRes.rows[0].count),
      ruptura_iminente_7d: rupturaRes.rows,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/dashboard/evolucao-estoque
router.get('/evolucao-estoque', authenticate, async (req, res, next) => {
  try {
    const { produto_id, periodo_dias } = req.query;
    const dias = [30, 60, 90, 180].includes(parseInt(periodo_dias)) ? parseInt(periodo_dias) : 30;
    const params = [dias.toString()];
    let where = '';
    if (produto_id) { where = 'AND m.produto_id = $2'; params.push(produto_id); }

    const result = await query(`
      SELECT m.criado_em, m.tipo, m.quantidade, m.estoque_antes, m.estoque_depois,
             p.nome AS produto_nome, p.codigo AS produto_codigo
      FROM movimentacoes m JOIN produtos p ON p.id = m.produto_id
      WHERE m.criado_em >= NOW() - ($1 || ' days')::INTERVAL ${where}
      ORDER BY m.criado_em ASC
    `, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/v1/dashboard/desempenho-fornecedores
router.get('/desempenho-fornecedores', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT f.id, f.nome, f.avaliacao,
        COUNT(pc.id) AS total_pedidos,
        ROUND(AVG(pc.lead_time_real_dias)::NUMERIC, 1) AS lead_time_medio,
        ROUND(
          (COUNT(CASE WHEN pc.data_recebimento <= pc.data_prevista + INTERVAL '1 day' THEN 1 END)::NUMERIC
          / NULLIF(COUNT(pc.id), 0)) * 100, 1
        ) AS pontualidade,
        SUM(pc.quantidade_recebida) AS volume_total
      FROM fornecedores f
      LEFT JOIN pedidos_compra pc ON pc.fornecedor_id = f.id AND pc.status IN ('CONCLUIDO','RECEBIDO')
      WHERE f.ativo = true
      GROUP BY f.id, f.nome, f.avaliacao
      ORDER BY lead_time_medio ASC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/v1/dashboard/consumo-semanal
router.get('/consumo-semanal', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.id AS produto_id, p.codigo, p.nome,
        date_trunc('week', m.criado_em) AS semana,
        COALESCE(SUM(CASE WHEN m.tipo IN ('SAIDA','TRANSFERENCIA') THEN m.quantidade ELSE 0 END), 0) AS consumo
      FROM produtos p
      JOIN movimentacoes m ON m.produto_id = p.id
      WHERE m.criado_em >= NOW() - INTERVAL '12 weeks'
        AND m.tipo IN ('SAIDA','TRANSFERENCIA') AND p.ativo = true
      GROUP BY p.id, p.codigo, p.nome, date_trunc('week', m.criado_em)
      ORDER BY semana ASC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
