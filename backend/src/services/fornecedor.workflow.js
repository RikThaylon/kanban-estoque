const { AppError } = require('../utils/errors');

const MODAIS_VALIDOS = ['rodoviario', 'aereo', 'maritimo', 'ferroviario', 'expresso', 'motoboy', 'correios'];
const CAMPOS_ATUALIZAVEIS_FORNECEDOR = [
  'nome',
  'cnpj',
  'contato_nome',
  'contato_email',
  'contato_telefone',
  'cidade',
  'estado',
  'modal_padrao',
  'prazo_pagamento_dias',
  'avaliacao',
  'ativo',
];
const CAMPOS_NULL_SE_VAZIO = [
  'cnpj',
  'contato_nome',
  'contato_email',
  'contato_telefone',
  'cidade',
  'estado',
  'modal_padrao',
  'prazo_pagamento_dias',
  'avaliacao',
];

function nullSeVazio(valor) {
  return valor === '' || valor === undefined ? null : valor;
}

function normalizarCampoFornecedor(campo, valor) {
  if (campo === 'ativo') return valor;
  if (CAMPOS_NULL_SE_VAZIO.includes(campo)) return nullSeVazio(valor);
  return valor;
}

function normalizarFornecedorPayload(payload, campos = CAMPOS_ATUALIZAVEIS_FORNECEDOR) {
  return campos.reduce((normalizado, campo) => {
    if (payload[campo] !== undefined) {
      normalizado[campo] = normalizarCampoFornecedor(campo, payload[campo]);
    }
    return normalizado;
  }, {});
}

function montarAtualizacaoFornecedor(payload, camposPermitidos = CAMPOS_ATUALIZAVEIS_FORNECEDOR) {
  const normalizado = normalizarFornecedorPayload(payload, camposPermitidos);
  const fields = [];
  const values = [];
  let idx = 1;

  for (const campo of camposPermitidos) {
    if (Object.prototype.hasOwnProperty.call(normalizado, campo)) {
      fields.push(`${campo} = $${idx++}`);
      values.push(normalizado[campo]);
    }
  }

  return { fields, values, nextIndex: idx };
}

function erroFornecedorDoBanco(err) {
  if (err.code === '23505') {
    return new AppError('Fornecedor com este CNPJ ja existe', 409, 'CONFLICT');
  }
  if (err.code === '23514') {
    return new AppError('Dados do fornecedor invalidos', 400, 'VALIDATION_ERROR');
  }
  return null;
}

module.exports = {
  MODAIS_VALIDOS,
  CAMPOS_ATUALIZAVEIS_FORNECEDOR,
  nullSeVazio,
  normalizarFornecedorPayload,
  montarAtualizacaoFornecedor,
  erroFornecedorDoBanco,
};
