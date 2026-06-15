const { AppError } = require('../utils/errors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS_MOVIMENTACAO_DIRETA = ['ENTRADA', 'SAIDA'];
const TIPOS_REQUEREM_APROVACAO = ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCAO'];
const TIPOS_MOVIMENTACAO_VALIDOS = [...TIPOS_MOVIMENTACAO_DIRETA, ...TIPOS_REQUEREM_APROVACAO];
const PERFIS_APROVADORES_MOVIMENTACAO = ['admin', 'supervisor_turno', 'gerente_operacoes', 'plant_manager'];

function tipoRequerAprovacao(tipo) {
  return TIPOS_REQUEREM_APROVACAO.includes(tipo);
}

function aplicarDeltaEstoque(tipo, estoqueAntes, quantidade) {
  const estoque = Number(estoqueAntes);
  const qtd = Number(quantidade);

  switch (tipo) {
    case 'ENTRADA':
    case 'AJUSTE_POSITIVO':
    case 'DEVOLUCAO':
      return estoque + qtd;
    case 'SAIDA':
    case 'TRANSFERENCIA':
    case 'AJUSTE_NEGATIVO':
      return estoque - qtd;
    default:
      throw new AppError('Tipo de movimentacao invalido', 400, 'TIPO_INVALIDO');
  }
}

function validarEstoqueSuficiente(estoqueDepois, message = 'Estoque insuficiente para esta operacao') {
  if (Number(estoqueDepois) < 0) {
    throw new AppError(message, 400, 'ESTOQUE_INSUFICIENTE');
  }
}

function validarMovimentacaoPendente(movimentacao) {
  if (movimentacao.status !== 'PENDENTE') {
    throw new AppError(`Movimentacao nao esta pendente (status atual: ${movimentacao.status})`, 409, 'STATUS_INVALIDO');
  }
}

function validarAutoAprovacaoMovimentacao(movimentacao, usuario) {
  if (movimentacao.criado_por === usuario.id && usuario.perfil !== 'admin') {
    throw new AppError('Voce nao pode aprovar sua propria movimentacao', 403, 'AUTO_APROVACAO_PROIBIDA');
  }
}

function calcularExecucaoMovimentacao({ tipo, estoqueAtual, quantidade, contexto = 'criacao' }) {
  const estoqueDepois = aplicarDeltaEstoque(tipo, estoqueAtual, quantidade);
  const message = contexto === 'aprovacao'
    ? 'Estoque insuficiente no momento da aprovacao'
    : 'Estoque insuficiente para esta operacao';
  validarEstoqueSuficiente(estoqueDepois, message);
  return estoqueDepois;
}

module.exports = {
  UUID_REGEX,
  TIPOS_MOVIMENTACAO_DIRETA,
  TIPOS_REQUEREM_APROVACAO,
  TIPOS_MOVIMENTACAO_VALIDOS,
  PERFIS_APROVADORES_MOVIMENTACAO,
  tipoRequerAprovacao,
  aplicarDeltaEstoque,
  validarEstoqueSuficiente,
  validarMovimentacaoPendente,
  validarAutoAprovacaoMovimentacao,
  calcularExecucaoMovimentacao,
};
