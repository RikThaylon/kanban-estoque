const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PERFIS_GESTAO_DEPARTAMENTO = ['admin', 'gerente_operacoes', 'plant_manager'];
const PERFIS_EXCLUIR_DEPARTAMENTO = ['admin', 'plant_manager'];
const PERFIS_ADMIN_MAQUINA = ['admin', 'plant_manager'];
const PERFIS_VINCULAR_MAQUINA = ['admin', 'plant_manager', 'gerente_operacoes', 'supervisor_turno'];

const CAMPOS_ATUALIZAVEIS_DEPARTAMENTO = ['nome', 'descricao', 'supervisor_id', 'ativo'];
const CAMPOS_ATUALIZAVEIS_MAQUINA = ['nome', 'descricao', 'departamento_id', 'localizacao', 'ativo'];

function normalizarCodigoOperacional(codigo) {
  return String(codigo || '').trim().toUpperCase();
}

function nullSeVazio(valor) {
  return valor === '' ? null : valor;
}

function montarAtualizacaoOperacional(payload, camposPermitidos) {
  const sets = [];
  const params = [];

  camposPermitidos.forEach((campo) => {
    if (payload[campo] !== undefined) {
      params.push(nullSeVazio(payload[campo]));
      sets.push(`${campo} = $${params.length}`);
    }
  });

  return { sets, params };
}

function normalizarVinculoMaquinaProduto(payload) {
  return {
    produto_id: payload.produto_id,
    consumo_estimado_diario: payload.consumo_estimado_diario || 0,
    observacao: payload.observacao,
  };
}

module.exports = {
  UUID_REGEX,
  PERFIS_GESTAO_DEPARTAMENTO,
  PERFIS_EXCLUIR_DEPARTAMENTO,
  PERFIS_ADMIN_MAQUINA,
  PERFIS_VINCULAR_MAQUINA,
  CAMPOS_ATUALIZAVEIS_DEPARTAMENTO,
  CAMPOS_ATUALIZAVEIS_MAQUINA,
  normalizarCodigoOperacional,
  nullSeVazio,
  montarAtualizacaoOperacional,
  normalizarVinculoMaquinaProduto,
};
