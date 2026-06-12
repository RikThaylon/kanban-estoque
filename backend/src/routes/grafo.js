const express = require('express');
const { query: validateQuery } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/database');
const { perfilTemPagina } = require('../services/configuracoes.service');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const router = express.Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAIXAS = ['VERDE', 'AMARELO', 'VERMELHO', 'SEM_DADOS'];
const STATUS_PEDIDO = [
  'RASCUNHO',
  'AGUARDANDO_APROVACAO',
  'AGUARDANDO_GERENTE',
  'AGUARDANDO_DIRETORIA',
  'APROVADO',
  'AGUARDANDO_CHEGADA',
  'EMITIDO',
  'EM_TRANSITO',
  'RECEBIDO_PARCIAL',
  'CONCLUIDO',
  'RECEBIDO',
  'CANCELADO',
  'REJEITADO',
];

function clampLimit(value, fallback = 120) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(200, Math.max(20, parsed));
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addNode(nodes, node) {
  if (!node?.id || nodes.has(node.id)) return;
  nodes.set(node.id, {
    metrics: {},
    ...node,
  });
}

function addEdge(edges, edge) {
  if (!edge?.source || !edge?.target || edges.has(edge.id)) return;
  edges.set(edge.id, edge);
}

function buildOptions(values, fields) {
  const map = new Map();
  values.forEach((row) => {
    const id = row[fields.id];
    if (!id || map.has(id)) return;
    map.set(id, {
      id,
      label: row[fields.label] || row[fields.codigo] || id,
      subtitle: row[fields.subtitle] || row[fields.codigo] || null,
    });
  });
  return Array.from(map.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function autorizarGrafo(req, res, next) {
  try {
    if (await perfilTemPagina(req.user?.perfil, 'grafo')) return next();
    throw new AppError('Seu cargo nao pode acessar o grafo de relacionamentos', 403, 'PERMISSAO_GRAFO');
  } catch (err) {
    next(err);
  }
}

function buildProductQuery(filters, limit) {
  const where = ['p.ativo = true'];
  const params = [];
  let idx = 1;

  if (filters.produto_id) {
    where.push(`p.id = $${idx++}`);
    params.push(filters.produto_id);
  }
  if (filters.busca) {
    where.push(`(p.codigo ILIKE $${idx} OR p.nome ILIKE $${idx})`);
    params.push(`%${filters.busca}%`);
    idx += 1;
  }
  if (filters.faixa) {
    where.push(`COALESCE(kp.faixa_atual, 'SEM_DADOS') = $${idx++}`);
    params.push(filters.faixa);
  }
  if (filters.estoque === 'critico') {
    where.push('kp.estoque_seguranca IS NOT NULL AND p.estoque_atual <= kp.estoque_seguranca');
  }
  if (filters.estoque === 'reposicao') {
    where.push('kp.ponto_reposicao IS NOT NULL AND p.estoque_atual <= kp.ponto_reposicao');
  }
  if (filters.maquina_id) {
    where.push(`EXISTS (
      SELECT 1 FROM maquina_produto mpf
      JOIN maquinas mf ON mf.id = mpf.maquina_id AND mf.ativo = true
      WHERE mpf.produto_id = p.id AND mf.id = $${idx++}
    )`);
    params.push(filters.maquina_id);
  }
  if (filters.departamento_id) {
    where.push(`EXISTS (
      SELECT 1 FROM maquina_produto mpf
      JOIN maquinas mf ON mf.id = mpf.maquina_id AND mf.ativo = true
      WHERE mpf.produto_id = p.id AND mf.departamento_id = $${idx++}
    )`);
    params.push(filters.departamento_id);
  }
  if (filters.supervisor_id) {
    where.push(`EXISTS (
      SELECT 1 FROM maquina_produto mpf
      JOIN maquinas mf ON mf.id = mpf.maquina_id AND mf.ativo = true
      JOIN departamentos df ON df.id = mf.departamento_id AND df.ativo = true
      WHERE mpf.produto_id = p.id AND df.supervisor_id = $${idx++}
    )`);
    params.push(filters.supervisor_id);
  }
  if (filters.fornecedor_id) {
    where.push(`EXISTS (
      SELECT 1 FROM produto_fornecedor pff
      JOIN fornecedores ff ON ff.id = pff.fornecedor_id AND ff.ativo = true
      WHERE pff.produto_id = p.id AND pff.ativo = true AND pff.fornecedor_id = $${idx++}
    )`);
    params.push(filters.fornecedor_id);
  }
  if (filters.status_pedido) {
    where.push(`EXISTS (
      SELECT 1 FROM pedidos_compra pcf
      WHERE pcf.produto_id = p.id AND pcf.status = $${idx++}
    )`);
    params.push(filters.status_pedido);
  }

  params.push(limit);

  return {
    text: `
      SELECT p.id, p.codigo, p.nome, p.unidade, p.estoque_atual, p.localizacao, p.classificacao_abc,
             kp.faixa_atual, kp.ponto_reposicao, kp.estoque_seguranca, kp.eoq, kp.estoque_maximo,
             kp.demanda_diaria_media
      FROM produtos p
      LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE COALESCE(kp.faixa_atual, 'SEM_DADOS')
          WHEN 'VERMELHO' THEN 0
          WHEN 'AMARELO' THEN 1
          WHEN 'VERDE' THEN 2
          ELSE 3
        END,
        p.codigo ASC
      LIMIT $${idx}
    `,
    params,
  };
}

async function fetchMachineLinks(produtoIds, filters) {
  const where = ['mp.produto_id = ANY($1::uuid[])', 'm.ativo = true'];
  const params = [produtoIds];
  let idx = 2;

  if (filters.maquina_id) {
    where.push(`m.id = $${idx++}`);
    params.push(filters.maquina_id);
  }
  if (filters.departamento_id) {
    where.push(`m.departamento_id = $${idx++}`);
    params.push(filters.departamento_id);
  }
  if (filters.supervisor_id) {
    where.push(`d.supervisor_id = $${idx++}`);
    params.push(filters.supervisor_id);
  }

  const result = await query(`
    SELECT mp.produto_id, mp.consumo_estimado_diario,
           m.id AS maquina_id, m.codigo AS maquina_codigo, m.nome AS maquina_nome, m.localizacao AS maquina_localizacao,
           d.id AS departamento_id, d.codigo AS departamento_codigo, d.nome AS departamento_nome,
           u.id AS supervisor_id, u.nome AS supervisor_nome, u.username AS supervisor_username
    FROM maquina_produto mp
    JOIN maquinas m ON m.id = mp.maquina_id
    LEFT JOIN departamentos d ON d.id = m.departamento_id AND d.ativo = true
    LEFT JOIN usuarios u ON u.id = d.supervisor_id AND u.ativo = true
    WHERE ${where.join(' AND ')}
    ORDER BY m.codigo ASC
  `, params);

  return result.rows;
}

async function fetchSupplierLinks(produtoIds, filters) {
  const where = ['pf.produto_id = ANY($1::uuid[])', 'pf.ativo = true', 'f.ativo = true'];
  const params = [produtoIds];
  let idx = 2;

  if (filters.fornecedor_id) {
    where.push(`f.id = $${idx++}`);
    params.push(filters.fornecedor_id);
  }

  const result = await query(`
    SELECT pf.produto_id, pf.prioridade, pf.preco_acordado, pf.lead_time_nominal_dias,
           f.id AS fornecedor_id, f.nome AS fornecedor_nome, f.cidade, f.estado, f.avaliacao,
           f.modal_padrao
    FROM produto_fornecedor pf
    JOIN fornecedores f ON f.id = pf.fornecedor_id
    WHERE ${where.join(' AND ')}
    ORDER BY pf.prioridade ASC, f.nome ASC
  `, params);

  return result.rows;
}

async function fetchPurchaseLinks(produtoIds, filters) {
  const where = ['pc.produto_id = ANY($1::uuid[])'];
  const params = [produtoIds];
  let idx = 2;

  if (filters.status_pedido) {
    where.push(`pc.status = $${idx++}`);
    params.push(filters.status_pedido);
  }
  if (filters.fornecedor_id) {
    where.push(`pc.fornecedor_id = $${idx++}`);
    params.push(filters.fornecedor_id);
  }
  if (filters.maquina_id) {
    where.push(`pc.maquina_id = $${idx++}`);
    params.push(filters.maquina_id);
  }
  if (filters.departamento_id) {
    where.push(`pc.departamento_id = $${idx++}`);
    params.push(filters.departamento_id);
  }
  if (filters.data_inicio) {
    where.push(`pc.criado_em >= $${idx++}`);
    params.push(filters.data_inicio);
  }
  if (filters.data_fim) {
    where.push(`pc.criado_em < ($${idx++}::date + INTERVAL '1 day')`);
    params.push(filters.data_fim);
  }

  params.push(clampLimit(filters.pedidos_limit, 80));

  const result = await query(`
    SELECT pc.id, pc.numero, pc.produto_id, pc.fornecedor_id, pc.maquina_id, pc.departamento_id,
           pc.quantidade_pedida, pc.quantidade_recebida, pc.custo_total, pc.status,
           pc.data_prevista, pc.criado_em,
           f.nome AS fornecedor_nome,
           m.codigo AS maquina_codigo, m.nome AS maquina_nome,
           d.codigo AS departamento_codigo, d.nome AS departamento_nome
    FROM pedidos_compra pc
    LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
    LEFT JOIN maquinas m ON m.id = pc.maquina_id
    LEFT JOIN departamentos d ON d.id = pc.departamento_id
    WHERE ${where.join(' AND ')}
    ORDER BY pc.criado_em DESC
    LIMIT $${idx}
  `, params);

  return result.rows;
}

router.get('/relacionamentos',
  authenticate,
  autorizarGrafo,
  [
    validateQuery('produto_id').optional().matches(UUID).withMessage('produto_id invalido'),
    validateQuery('maquina_id').optional().matches(UUID).withMessage('maquina_id invalido'),
    validateQuery('departamento_id').optional().matches(UUID).withMessage('departamento_id invalido'),
    validateQuery('supervisor_id').optional().matches(UUID).withMessage('supervisor_id invalido'),
    validateQuery('fornecedor_id').optional().matches(UUID).withMessage('fornecedor_id invalido'),
    validateQuery('faixa').optional().isIn(FAIXAS).withMessage('faixa invalida'),
    validateQuery('status_pedido').optional().isIn(STATUS_PEDIDO).withMessage('status_pedido invalido'),
    validateQuery('estoque').optional().isIn(['critico', 'reposicao']).withMessage('estoque invalido'),
    validateQuery('busca').optional().trim().isLength({ max: 120 }).withMessage('busca muito longa'),
    validateQuery('data_inicio').optional().isISO8601().withMessage('data_inicio invalida'),
    validateQuery('data_fim').optional().isISO8601().withMessage('data_fim invalida'),
    validateQuery('limit').optional().isInt({ min: 20, max: 200 }).withMessage('limit deve ficar entre 20 e 200'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const filters = {
        produto_id: req.query.produto_id || null,
        maquina_id: req.query.maquina_id || null,
        departamento_id: req.query.departamento_id || null,
        supervisor_id: req.query.supervisor_id || null,
        fornecedor_id: req.query.fornecedor_id || null,
        faixa: req.query.faixa || null,
        status_pedido: req.query.status_pedido || null,
        estoque: req.query.estoque || null,
        busca: req.query.busca ? String(req.query.busca).trim() : '',
        data_inicio: req.query.data_inicio || null,
        data_fim: req.query.data_fim || null,
        pedidos_limit: req.query.pedidos_limit,
      };

      const limit = clampLimit(req.query.limit);
      const productQuery = buildProductQuery(filters, limit);
      const productsResult = await query(productQuery.text, productQuery.params);
      const produtos = productsResult.rows;
      const produtoIds = produtos.map((produto) => produto.id);

      if (produtoIds.length === 0) {
        return res.json({
          nodes: [],
          edges: [],
          stats: { produtos: 0, maquinas: 0, departamentos: 0, supervisores: 0, fornecedores: 0, pedidos: 0, relacionamentos: 0 },
          opcoes: { maquinas: [], departamentos: [], supervisores: [], fornecedores: [] },
          filtros: { ...filters, limit },
        });
      }

      const [maquinas, fornecedores, pedidos] = await Promise.all([
        fetchMachineLinks(produtoIds, filters),
        fetchSupplierLinks(produtoIds, filters),
        fetchPurchaseLinks(produtoIds, filters),
      ]);

      const nodes = new Map();
      const edges = new Map();

      produtos.forEach((produto) => {
        const produtoId = `produto:${produto.id}`;
        const estoqueId = `estoque:${produto.id}`;
        const estoqueAtual = toNumber(produto.estoque_atual);
        const pontoReposicao = toNumber(produto.ponto_reposicao);
        const estoqueSeguranca = toNumber(produto.estoque_seguranca);

        addNode(nodes, {
          id: produtoId,
          type: 'produto',
          label: produto.codigo,
          subtitle: produto.nome,
          status: produto.faixa_atual || 'SEM_DADOS',
          href: `/produtos/${produto.id}`,
          refId: produto.id,
          metrics: {
            estoque_atual: estoqueAtual,
            unidade: produto.unidade,
            ponto_reposicao: pontoReposicao,
            estoque_seguranca: estoqueSeguranca,
            eoq: toNumber(produto.eoq),
            classificacao_abc: produto.classificacao_abc,
            localizacao: produto.localizacao,
          },
        });

        addNode(nodes, {
          id: estoqueId,
          type: 'estoque',
          label: `Estoque ${produto.codigo}`,
          subtitle: `${estoqueAtual ?? 0} ${produto.unidade || ''}`.trim(),
          status: produto.faixa_atual || 'SEM_DADOS',
          href: `/produtos/${produto.id}`,
          refId: produto.id,
          metrics: {
            estoque_atual: estoqueAtual,
            unidade: produto.unidade,
            ponto_reposicao: pontoReposicao,
            estoque_seguranca: estoqueSeguranca,
            estoque_maximo: toNumber(produto.estoque_maximo),
            demanda_diaria_media: toNumber(produto.demanda_diaria_media),
          },
        });

        addEdge(edges, {
          id: `${produtoId}->${estoqueId}`,
          source: produtoId,
          target: estoqueId,
          type: 'estoque',
          label: 'saldo atual',
        });
      });

      maquinas.forEach((row) => {
        const produtoId = `produto:${row.produto_id}`;
        const maquinaId = `maquina:${row.maquina_id}`;

        addNode(nodes, {
          id: maquinaId,
          type: 'maquina',
          label: row.maquina_codigo,
          subtitle: row.maquina_nome,
          status: row.departamento_id ? 'VINCULADA' : 'SEM_DEPARTAMENTO',
          refId: row.maquina_id,
          metrics: {
            localizacao: row.maquina_localizacao,
            consumo_estimado_diario: toNumber(row.consumo_estimado_diario),
          },
        });
        addEdge(edges, {
          id: `${produtoId}->${maquinaId}`,
          source: produtoId,
          target: maquinaId,
          type: 'consumo',
          label: 'usado em',
        });

        if (row.departamento_id) {
          const departamentoId = `departamento:${row.departamento_id}`;
          addNode(nodes, {
            id: departamentoId,
            type: 'departamento',
            label: row.departamento_codigo,
            subtitle: row.departamento_nome,
            status: row.supervisor_id ? 'SUPERVISIONADO' : 'SEM_SUPERVISOR',
            refId: row.departamento_id,
          });
          addEdge(edges, {
            id: `${maquinaId}->${departamentoId}`,
            source: maquinaId,
            target: departamentoId,
            type: 'localizacao',
            label: 'pertence a',
          });
        }

        if (row.supervisor_id && row.departamento_id) {
          const departamentoId = `departamento:${row.departamento_id}`;
          const supervisorId = `supervisor:${row.supervisor_id}`;
          addNode(nodes, {
            id: supervisorId,
            type: 'supervisor',
            label: row.supervisor_nome,
            subtitle: row.supervisor_username ? `@${row.supervisor_username}` : 'Supervisor',
            status: 'RESPONSAVEL',
            refId: row.supervisor_id,
          });
          addEdge(edges, {
            id: `${departamentoId}->${supervisorId}`,
            source: departamentoId,
            target: supervisorId,
            type: 'responsabilidade',
            label: 'supervisionado por',
          });
        }
      });

      fornecedores.forEach((row) => {
        const produtoId = `produto:${row.produto_id}`;
        const fornecedorId = `fornecedor:${row.fornecedor_id}`;
        addNode(nodes, {
          id: fornecedorId,
          type: 'fornecedor',
          label: row.fornecedor_nome,
          subtitle: [row.cidade, row.estado].filter(Boolean).join(' - ') || 'Fornecedor',
          status: row.prioridade === 1 ? 'PREFERENCIAL' : 'ALTERNATIVO',
          refId: row.fornecedor_id,
          metrics: {
            prioridade: row.prioridade,
            preco_acordado: toNumber(row.preco_acordado),
            lead_time_nominal_dias: row.lead_time_nominal_dias,
            avaliacao: toNumber(row.avaliacao),
            modal_padrao: row.modal_padrao,
          },
        });
        addEdge(edges, {
          id: `${produtoId}->${fornecedorId}`,
          source: produtoId,
          target: fornecedorId,
          type: 'suprimento',
          label: row.prioridade === 1 ? 'fornecedor preferencial' : 'fornecedor',
        });
      });

      pedidos.forEach((pedido) => {
        const produtoId = `produto:${pedido.produto_id}`;
        const pedidoId = `pedido:${pedido.id}`;
        addNode(nodes, {
          id: pedidoId,
          type: 'pedido',
          label: pedido.numero,
          subtitle: pedido.status,
          status: pedido.status,
          href: '/pedidos',
          refId: pedido.id,
          metrics: {
            quantidade_pedida: toNumber(pedido.quantidade_pedida),
            quantidade_recebida: toNumber(pedido.quantidade_recebida),
            custo_total: toNumber(pedido.custo_total),
            data_prevista: pedido.data_prevista,
            criado_em: pedido.criado_em,
          },
        });
        addEdge(edges, {
          id: `${pedidoId}->${produtoId}`,
          source: pedidoId,
          target: produtoId,
          type: 'compra',
          label: 'solicita',
        });

        if (pedido.fornecedor_id) {
          addNode(nodes, {
            id: `fornecedor:${pedido.fornecedor_id}`,
            type: 'fornecedor',
            label: pedido.fornecedor_nome || 'Fornecedor do pedido',
            subtitle: 'Vinculado ao pedido',
            status: 'PEDIDO',
            refId: pedido.fornecedor_id,
          });
          addEdge(edges, {
            id: `${pedidoId}->fornecedor:${pedido.fornecedor_id}`,
            source: pedidoId,
            target: `fornecedor:${pedido.fornecedor_id}`,
            type: 'compra',
            label: 'fornecedor',
          });
        }

        if (pedido.maquina_id) {
          addNode(nodes, {
            id: `maquina:${pedido.maquina_id}`,
            type: 'maquina',
            label: pedido.maquina_codigo || 'Maquina do pedido',
            subtitle: pedido.maquina_nome || 'Vinculada ao pedido',
            status: 'PEDIDO',
            refId: pedido.maquina_id,
          });
          addEdge(edges, {
            id: `${pedidoId}->maquina:${pedido.maquina_id}`,
            source: pedidoId,
            target: `maquina:${pedido.maquina_id}`,
            type: 'impacto',
            label: 'impacta',
          });
        }
      });

      const nodeList = Array.from(nodes.values());
      const edgeList = Array.from(edges.values());
      const countByType = (type) => nodeList.filter((node) => node.type === type).length;

      res.json({
        nodes: nodeList,
        edges: edgeList,
        stats: {
          produtos: countByType('produto'),
          maquinas: countByType('maquina'),
          departamentos: countByType('departamento'),
          supervisores: countByType('supervisor'),
          fornecedores: countByType('fornecedor'),
          pedidos: countByType('pedido'),
          relacionamentos: edgeList.length,
        },
        opcoes: {
          maquinas: buildOptions(maquinas, { id: 'maquina_id', label: 'maquina_codigo', subtitle: 'maquina_nome' }),
          departamentos: buildOptions(maquinas, { id: 'departamento_id', label: 'departamento_codigo', subtitle: 'departamento_nome' }),
          supervisores: buildOptions(maquinas, { id: 'supervisor_id', label: 'supervisor_nome', subtitle: 'supervisor_username' }),
          fornecedores: buildOptions(fornecedores, { id: 'fornecedor_id', label: 'fornecedor_nome', subtitle: 'cidade' }),
        },
        filtros: { ...filters, limit },
      });
    } catch (err) {
      logger.error('Erro ao carregar grafo de relacionamentos', {
        error: err.message,
        filtros: req.query,
      });
      next(err);
    }
  }
);

module.exports = router;
