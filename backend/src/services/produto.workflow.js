const { AppError } = require('../utils/errors');

/**
 * Campos que qualquer perfil autorizado pode editar.
 */
const CAMPOS_ATUALIZAVEIS_PRODUTO = [
  'nome',
  'descricao',
  'unidade',
  'categoria_id',
  'custo_unitario',
  'custo_pedido',
  'taxa_carregamento',
  'nivel_servico',
  'localizacao',
  'recorrente',
];

/**
 * Campos ADICIONAIS que apenas o admin pode editar.
 * O admin pode editar TODOS os campos acima + estes.
 */
const CAMPOS_EXCLUSIVOS_ADMIN = [
  'codigo',
  'sku',
  'estoque_atual',
  'estoque_minimo',
  'estoque_maximo',
  'ponto_reposicao_manual',
  'lead_time_padrao_dias',
  'observacoes',
  'ativo',
  'classificacao_abc',
];

/**
 * Conjunto completo de campos editáveis pelo admin.
 */
const CAMPOS_ATUALIZAVEIS_ADMIN = [...CAMPOS_ATUALIZAVEIS_PRODUTO, ...CAMPOS_EXCLUSIVOS_ADMIN];
const PRIORIDADE_FORNECEDOR_PADRAO = 1;
const CUSTO_PEDIDO_PADRAO = 100;
const SEMANAS_HISTORICO_PADRAO = 12;
const SEMANAS_HISTORICO_MAX = 52;

function valorFoiInformado(valor) {
  return valor !== undefined && valor !== null && valor !== '';
}

function resolverParametrosCadastroProduto(payload, defaultsKanban) {
  return {
    nivelServicoFinal: valorFoiInformado(payload.nivel_servico)
      ? Number(payload.nivel_servico)
      : defaultsKanban.nivel_servico_padrao,
    custoPedidoFinal: valorFoiInformado(payload.custo_pedido)
      ? Number(payload.custo_pedido)
      : CUSTO_PEDIDO_PADRAO,
    taxaCarregamentoFinal: valorFoiInformado(payload.taxa_carregamento)
      ? Number(payload.taxa_carregamento)
      : defaultsKanban.taxa_carregamento_padrao,
    cmdInicial: Number(payload.cmd_inicial || 0),
    leadTimeInicial: Number(payload.lead_time_inicial || 0),
  };
}

function montarAtualizacaoProduto(payload, camposPermitidos = CAMPOS_ATUALIZAVEIS_PRODUTO) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const campo of camposPermitidos) {
    if (payload[campo] !== undefined) {
      fields.push(`${campo} = $${idx++}`);
      values.push(payload[campo]);
    }
  }

  return { fields, values, nextIndex: idx };
}

function normalizarVinculoFornecedorProduto(vinculo = {}) {
  if (!vinculo.fornecedor_id) {
    throw new AppError('fornecedor_id obrigatorio', 400, 'VALIDATION_ERROR');
  }

  return {
    fornecedor_id: vinculo.fornecedor_id,
    prioridade: vinculo.prioridade || PRIORIDADE_FORNECEDOR_PADRAO,
    preco_acordado: vinculo.preco_acordado,
    lead_time_nominal_dias: vinculo.lead_time_nominal_dias,
  };
}

function normalizarListaFornecedoresProduto(fornecedores) {
  if (!Array.isArray(fornecedores)) {
    throw new AppError('fornecedores deve ser uma lista', 400, 'VALIDATION_ERROR');
  }
  return fornecedores.map(normalizarVinculoFornecedorProduto);
}

function limitarSemanasHistorico(semanas) {
  return Math.min(SEMANAS_HISTORICO_MAX, Math.max(1, parseInt(semanas, 10) || SEMANAS_HISTORICO_PADRAO));
}

module.exports = {
  CAMPOS_ATUALIZAVEIS_PRODUTO,
  CAMPOS_EXCLUSIVOS_ADMIN,
  CAMPOS_ATUALIZAVEIS_ADMIN,
  PRIORIDADE_FORNECEDOR_PADRAO,
  CUSTO_PEDIDO_PADRAO,
  SEMANAS_HISTORICO_PADRAO,
  SEMANAS_HISTORICO_MAX,
  valorFoiInformado,
  resolverParametrosCadastroProduto,
  montarAtualizacaoProduto,
  normalizarVinculoFornecedorProduto,
  normalizarListaFornecedoresProduto,
  limitarSemanasHistorico,
};
