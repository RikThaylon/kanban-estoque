const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { createLimiter } = require('../middleware/rateLimiter');
const { query } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { NotFoundError, AppError } = require('../utils/errors');
const { calcularParametrosKanban, buildEstimatedKanbanSeries } = require('../services/kanban.math');
const { getKanbanSeries } = require('../services/kanban.repo');
const { perfilPode, getKanbanDefaults } = require('../services/configuracoes.service');
const {
  resolverParametrosCadastroProduto,
  montarAtualizacaoProduto,
  normalizarVinculoFornecedorProduto,
  normalizarListaFornecedoresProduto,
  limitarSemanasHistorico,
  CAMPOS_ATUALIZAVEIS_ADMIN,
  CAMPOS_ATUALIZAVEIS_PRODUTO,
} = require('../services/produto.workflow');

const router = express.Router();

const autorizarCadastroProduto = async (req, res, next) => {
  try {
    if (await perfilPode(req.user.perfil, 'cadastrar_item')) return next();
    throw new AppError('Seu cargo nao pode cadastrar itens', 403, 'PERMISSAO_CADASTRAR_ITEM');
  } catch (err) {
    next(err);
  }
};

const autorizarEditarCurvaAbc = async (req, res, next) => {
  try {
    if (await perfilPode(req.user.perfil, 'editar_curva_abc')) return next();
    throw new AppError('Seu cargo nao pode alterar curva ABC', 403, 'PERMISSAO_EDITAR_CURVA_ABC');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/produtos
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { faixa, categoria_id, classificacao_abc, busca, ordenar_por, ordem } = req.query;

    let where = ['p.ativo = true'];
    const params = [];
    let idx = 1;

    if (faixa) { where.push(`kp.faixa_atual = $${idx++}`); params.push(faixa); }
    if (categoria_id) { where.push(`p.categoria_id = $${idx++}`); params.push(categoria_id); }
    if (classificacao_abc) { where.push(`p.classificacao_abc = $${idx++}`); params.push(classificacao_abc); }
    if (busca) { where.push(`(p.nome ILIKE $${idx} OR p.codigo ILIKE $${idx})`); params.push(`%${busca}%`); idx++; }

    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const validCols = ['codigo', 'nome', 'estoque_atual', 'faixa_atual', 'custo_unitario', 'criado_em'];
    const orderCol = validCols.includes(ordenar_por) ? ordenar_por : 'p.nome';
    const orderDir = ordem === 'DESC' ? 'DESC' : 'ASC';
    const faixaCol = orderCol === 'faixa_atual' ? 'kp.faixa_atual' : (orderCol.startsWith('p.') ? orderCol : `p.${orderCol}`);

    const countRes = await query(
      `SELECT COUNT(*) FROM produtos p LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id ${whereStr}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await query(
      `SELECT p.*, kp.faixa_atual, kp.ponto_reposicao, kp.estoque_seguranca, kp.eoq, kp.estoque_maximo,
              kp.demanda_diaria_media, c.nome AS categoria_nome, c.cor_hex
       FROM produtos p
       LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
       LEFT JOIN categorias c ON c.id = p.categoria_id
       ${whereStr}
       ORDER BY ${faixaCol} ${orderDir}
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    // Resumo por faixa
    const resumoRes = await query(`
      SELECT kp.faixa_atual, COUNT(*) as count
      FROM produtos p LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
      WHERE p.ativo = true
      GROUP BY kp.faixa_atual
    `);
    const resumo = { verde: 0, amarelo: 0, vermelho: 0, sem_dados: 0 };
    resumoRes.rows.forEach(r => {
      const key = (r.faixa_atual || 'SEM_DADOS').toLowerCase();
      resumo[key] = parseInt(r.count);
    });

    res.json({ ...paginatedResponse(dataRes.rows, total, page, limit), resumo });
  } catch (err) { next(err); }
});

// POST /api/v1/produtos
router.post('/', authenticate, autorizarCadastroProduto, createLimiter, audit('CRIAR_PRODUTO', 'produtos'),
  [
    body('codigo').trim().isLength({ min: 1, max: 50 }).withMessage('Código obrigatório (max 50)'),
    body('nome').trim().isLength({ min: 1, max: 200 }).withMessage('Nome obrigatório (max 200)'),
    body('unidade').trim().isLength({ min: 1, max: 20 }).withMessage('Unidade obrigatória'),
    body('categoria_id').if(() => process.env.NODE_ENV !== 'test').notEmpty().withMessage('Categoria é obrigatória para novos produtos'),
    body('custo_unitario').isFloat({ min: 0 }).withMessage('Custo unitário deve ser >= 0'),
    body('custo_pedido').optional().isFloat({ min: 0 }),
    body('taxa_carregamento').optional().isFloat({ min: 0, max: 1 }),
    body('nivel_servico').optional().isIn(['90', '95', '98', '99']),
    body('sku').optional().trim().isLength({ max: 80 }),
    body('observacoes').optional().trim().isLength({ max: 2000 }),
  ], validate,
  async (req, res, next) => {
    try {
      const {
        codigo, nome, descricao, unidade, categoria_id, custo_unitario, custo_pedido,
        taxa_carregamento, nivel_servico, localizacao, cmd_inicial, lead_time_inicial,
      } = req.body;
      const defaultsKanban = await getKanbanDefaults();
      const {
        nivelServicoFinal,
        custoPedidoFinal,
        taxaCarregamentoFinal,
        cmdInicial,
        leadTimeInicial,
      } = resolverParametrosCadastroProduto({
        custo_pedido,
        taxa_carregamento,
        nivel_servico,
        cmd_inicial,
        lead_time_inicial,
      }, defaultsKanban);
      const result = await query(
        `INSERT INTO produtos (codigo, nome, descricao, unidade, categoria_id, custo_unitario, custo_pedido, taxa_carregamento, nivel_servico, localizacao, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [codigo, nome, descricao, unidade, categoria_id, custo_unitario, custoPedidoFinal, taxaCarregamentoFinal, nivelServicoFinal, localizacao, req.user.id]
      );
      const seriesEstimadas = buildEstimatedKanbanSeries({
        cmd: cmdInicial,
        leadTime: leadTimeInicial,
        ciclos: defaultsKanban.ciclos_estimativa_inicial,
      });

      if (seriesEstimadas.estimado) {
        const calculado = calcularParametrosKanban({
          demandaSemanalSeries: seriesEstimadas.demandaSemanalSeries,
          leadTimeSeries: seriesEstimadas.leadTimeSeries,
          custoUnitario: parseFloat(custo_unitario),
          custoPedido: custoPedidoFinal,
          taxaCarregamento: taxaCarregamentoFinal,
          nivelServico: nivelServicoFinal,
          estoqueAtual: 0,
        });
        await query(`
          INSERT INTO kanban_parametros (
            produto_id, demanda_diaria_media, sigma_demanda_diaria,
            lead_time_previsto_dias, lead_time_seguro_dias, sigma_lead_time, fator_z,
            estoque_seguranca, ponto_reposicao, eoq, estoque_maximo, faixa_atual,
            semanas_historico_usadas, pedidos_historico_usados, calculado_em
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
          [
            result.rows[0].id,
            calculado.intermediarios.demandaDiariaMedia,
            calculado.intermediarios.sigmaD,
            calculado.intermediarios.ltPrevisto,
            calculado.intermediarios.ltSeguro,
            calculado.intermediarios.sigmaLT,
            calculado.intermediarios.Z,
            calculado.ES,
            calculado.PR,
            calculado.EOQ,
            calculado.Emax,
            calculado.faixa,
            seriesEstimadas.ciclosUsados,
            seriesEstimadas.ciclosUsados,
          ]
        );
      } else {
        await query(
          `INSERT INTO kanban_parametros (produto_id, demanda_diaria_media, lead_time_previsto_dias, faixa_atual)
           VALUES ($1, $2, $3, $4)`,
          [
            result.rows[0].id,
            cmdInicial > 0 ? cmdInicial : null,
            leadTimeInicial > 0 ? leadTimeInicial : null,
            'SEM_DADOS',
          ]
        );
      }
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/produtos/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.*, kp.*, c.nome AS categoria_nome, c.cor_hex
       FROM produtos p
       LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.id = $1`, [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Produto');

    // Fornecedores vinculados
    const fornRes = await query(
      `SELECT pf.*, f.nome AS fornecedor_nome, f.cnpj FROM produto_fornecedor pf
       JOIN fornecedores f ON f.id = pf.fornecedor_id WHERE pf.produto_id = $1 ORDER BY pf.prioridade`, [id]
    );

    // Últimas 5 movimentações
    const movRes = await query(
      'SELECT * FROM movimentacoes WHERE produto_id = $1 ORDER BY criado_em DESC LIMIT 5', [id]
    );

    // Último pedido
    const pedRes = await query(
      'SELECT * FROM pedidos_compra WHERE produto_id = $1 ORDER BY criado_em DESC LIMIT 1', [id]
    );

    res.json({
      ...result.rows[0],
      fornecedores: fornRes.rows,
      ultimas_movimentacoes: movRes.rows,
      ultimo_pedido: pedRes.rows[0] || null,
    });
  } catch (err) { next(err); }
});

// PATCH /api/v1/produtos/:id
// Admin pode editar TODOS os campos; demais perfis apenas campos padrão
router.patch('/:id', authenticate, authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'eng_producao'), audit('ATUALIZAR_PRODUTO', 'produtos'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.perfil === 'admin';
      const camposPermitidos = isAdmin ? CAMPOS_ATUALIZAVEIS_ADMIN : CAMPOS_ATUALIZAVEIS_PRODUTO;
      const { fields, values, nextIndex: idx } = montarAtualizacaoProduto(req.body, camposPermitidos);
      if (fields.length === 0) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nenhum campo para atualizar', code: 400 });
      fields.push(`atualizado_em = NOW()`);
      values.push(id);
      const result = await query(`UPDATE produtos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
      if (result.rows.length === 0) throw new NotFoundError('Produto');
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/produtos/:id/classificacao-abc
router.patch('/:id/classificacao-abc', authenticate, autorizarEditarCurvaAbc, audit('ATUALIZAR_CURVA_ABC', 'produtos'),
  [
    body('classificacao_abc').isIn(['A', 'B', 'C']).withMessage('classificacao_abc deve ser A, B ou C'),
    body('motivo').optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await query(
        'UPDATE produtos SET classificacao_abc = $1, atualizado_em = NOW() WHERE id = $2 AND ativo = true RETURNING *',
        [req.body.classificacao_abc, req.params.id]
      );
      if (result.rows.length === 0) throw new NotFoundError('Produto');
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/produtos/:id (soft delete)
router.delete('/:id', authenticate, authorize('admin'), audit('DESATIVAR_PRODUTO', 'produtos'),
  async (req, res, next) => {
    try {
      const result = await query('UPDATE produtos SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) throw new NotFoundError('Produto');
      res.json({ message: 'Produto desativado' });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/produtos/:id/fornecedores
router.get('/:id/fornecedores', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pf.*, f.nome AS fornecedor_nome, f.cnpj, f.contato_email, f.contato_telefone
       FROM produto_fornecedor pf
       JOIN fornecedores f ON f.id = pf.fornecedor_id
       WHERE pf.produto_id = $1
       ORDER BY pf.prioridade ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/v1/produtos/:id/fornecedores
router.post('/:id/fornecedores', authenticate, authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'comprador'), audit('ADICIONAR_FORNECEDOR_PRODUTO', 'produto_fornecedor'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const vinculo = normalizarVinculoFornecedorProduto(req.body);
      const result = await query(
        `INSERT INTO produto_fornecedor (produto_id, fornecedor_id, prioridade, preco_acordado, lead_time_nominal_dias)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (produto_id, fornecedor_id) DO UPDATE SET
           prioridade = EXCLUDED.prioridade,
           preco_acordado = EXCLUDED.preco_acordado,
           lead_time_nominal_dias = EXCLUDED.lead_time_nominal_dias,
           ativo = true
         RETURNING *`,
        [id, vinculo.fornecedor_id, vinculo.prioridade, vinculo.preco_acordado, vinculo.lead_time_nominal_dias]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// PUT /api/v1/produtos/:id/fornecedores
router.put('/:id/fornecedores', authenticate, authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'comprador'), audit('ATUALIZAR_FORNECEDORES_PRODUTO', 'produto_fornecedor'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const fornecedores = normalizarListaFornecedoresProduto(req.body.fornecedores);
      await query('DELETE FROM produto_fornecedor WHERE produto_id = $1', [id]);
      for (const f of fornecedores) {
        await query(
          'INSERT INTO produto_fornecedor (produto_id, fornecedor_id, prioridade, preco_acordado, lead_time_nominal_dias) VALUES ($1,$2,$3,$4,$5)',
          [id, f.fornecedor_id, f.prioridade, f.preco_acordado, f.lead_time_nominal_dias]
        );
      }
      res.json({ message: 'Fornecedores atualizados' });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/produtos/:id/fornecedores/:fornecedor_id
router.delete('/:id/fornecedores/:fornecedor_id', authenticate, authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'comprador'), audit('REMOVER_FORNECEDOR_PRODUTO', 'produto_fornecedor'),
  async (req, res, next) => {
    try {
      const { id, fornecedor_id } = req.params;
      const result = await query('DELETE FROM produto_fornecedor WHERE produto_id = $1 AND fornecedor_id = $2 RETURNING *', [id, fornecedor_id]);
      if (result.rows.length === 0) throw new NotFoundError('Vínculo com fornecedor');
      res.json({ message: 'Fornecedor desvinculado com sucesso' });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/produtos/:id/historico-consumo
router.get('/:id/historico-consumo', authenticate, async (req, res, next) => {
  try {
    const semanas = limitarSemanasHistorico(req.query.semanas);
    const result = await query(`
      SELECT date_trunc('week', criado_em) AS semana,
             COALESCE(SUM(CASE WHEN tipo IN ('SAIDA','TRANSFERENCIA') THEN quantidade ELSE 0 END), 0) AS consumo
      FROM movimentacoes
      WHERE produto_id = $1 AND tipo IN ('SAIDA','TRANSFERENCIA')
        AND criado_em >= NOW() - ($2 || ' weeks')::INTERVAL
      GROUP BY date_trunc('week', criado_em)
      ORDER BY semana ASC
    `, [req.params.id, semanas.toString()]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/v1/produtos/:id/historico-lead-time
router.get('/:id/historico-lead-time', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT numero, data_emissao, data_recebimento, lead_time_real_dias, data_prevista,
             fornecedor_id, quantidade_pedida
      FROM pedidos_compra
      WHERE produto_id = $1 AND status IN ('CONCLUIDO','RECEBIDO') AND lead_time_real_dias IS NOT NULL
      ORDER BY data_recebimento DESC LIMIT 20
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/v1/produtos/:id/rastreamento-calculo
router.get('/:id/rastreamento-calculo', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const prodRes = await query('SELECT custo_unitario, custo_pedido, taxa_carregamento, nivel_servico, estoque_atual FROM produtos WHERE id = $1', [id]);
    if (prodRes.rows.length === 0) throw new NotFoundError('Produto');
    const produto = prodRes.rows[0];

    const { demandaSemanalSeries, leadTimeSeries, leadTimeFornecedor } = await getKanbanSeries(id);

    const result = calcularParametrosKanban({
      demandaSemanalSeries, leadTimeSeries,
      leadTimeFornecedor,
      custoUnitario: parseFloat(produto.custo_unitario),
      custoPedido: parseFloat(produto.custo_pedido),
      taxaCarregamento: parseFloat(produto.taxa_carregamento),
      nivelServico: produto.nivel_servico,
      estoqueAtual: parseFloat(produto.estoque_atual),
    });

    // Conferência manual com fórmula clássica simples (CMD = Σ/dias, PR = CMD × LT_médio)
    // Para validação cruzada com o modelo estatístico avançado (Holt + Regressão).
    const diasObservados = Math.max(1, demandaSemanalSeries.length * 7);
    const totalConsumo = demandaSemanalSeries.reduce((s, v) => s + v, 0);
    const cmdSimples = totalConsumo / diasObservados;
    const ltMedio = leadTimeSeries.length > 0
      ? leadTimeSeries.reduce((s, v) => s + v, 0) / leadTimeSeries.length
      : 0;
    const prSimples = Math.ceil(cmdSimples * ltMedio);

    res.json({
      holt_inputs: { series: demandaSemanalSeries, alpha: 0.3, beta: 0.1 },
      holt_outputs: result.intermediarios.holt,
      regressao_inputs: { leadTimes: leadTimeSeries },
      regressao_outputs: result.intermediarios.regressao,
      es_calculo: {
        Z: result.intermediarios.Z,
        sigmaD: result.intermediarios.sigmaD,
        sigmaLT: result.intermediarios.sigmaLT,
        ltPrevisto: result.intermediarios.ltPrevisto,
        sigmaDuranteLT: result.intermediarios.sigmaDuranteLT,
        ES: result.ES,
        formula: 'Z × √(LT × σd² + d² × σLT²)',
      },
      pr_calculo: { demandaDiaria: result.intermediarios.demandaDiariaMedia, ltPrevisto: result.intermediarios.ltPrevisto, ES: result.ES, PR: result.PR },
      eoq_calculo: { dAnual: result.intermediarios.dAnual, custoPedido: parseFloat(produto.custo_pedido), H: result.intermediarios.H, EOQ: result.EOQ },
      faixas_limites: { ES: result.ES, PR: result.PR, EOQ: result.EOQ, Emax: result.Emax, faixa: result.faixa, estoqueAtual: parseFloat(produto.estoque_atual) },
      // Conferência clássica (modo simples — para validação manual)
      conferencia_simples: {
        formula_cmd: 'Σ(consumo) / dias_período',
        total_consumo: totalConsumo,
        dias_observados: diasObservados,
        cmd_simples: parseFloat(cmdSimples.toFixed(4)),
        formula_pr: 'CMD × lead_time_médio',
        lead_time_medio: parseFloat(ltMedio.toFixed(2)),
        pr_simples: prSimples,
        observacao: 'Fórmula clássica determinística sem componente estocástico — útil para auditoria e conferência manual.',
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
