const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { classificacaoABC } = require('../services/kanban.math');

const router = express.Router();

// GET /api/v1/relatorios/curva-abc
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

// GET /api/v1/relatorios/giro-estoque
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

// GET /api/v1/relatorios/pedidos-periodo
router.get('/pedidos-periodo', authenticate, async (req, res, next) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const params = [];
    let where = "WHERE pc.status = 'RECEBIDO'";
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

// GET /api/v1/relatorios/rupturas-historico
router.get('/rupturas-historico', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT m.criado_em, m.produto_id, p.codigo, p.nome, m.estoque_depois,
        kp.estoque_seguranca
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      JOIN kanban_parametros kp ON kp.produto_id = m.produto_id
      WHERE m.estoque_depois < kp.estoque_seguranca AND m.estoque_depois >= 0
      ORDER BY m.criado_em DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
