const { AppError } = require('../utils/errors');

const PERFIS_NIVEL_1 = ['supervisor_turno', 'gerente_operacoes', 'plant_manager', 'admin'];
const PERFIS_NIVEL_2 = ['gerente_operacoes', 'plant_manager', 'admin'];
const PERFIS_NIVEL_3 = ['plant_manager', 'admin'];

function normalizarLimites(limites = {}) {
  return {
    supervisor: Number(limites.supervisor ?? 5000),
    gerente: Number(limites.gerente ?? 50000),
  };
}

function determinarStatusInicialPedido({ perfil, custoTotal, limites }) {
  const { supervisor } = normalizarLimites(limites);
  const custo = custoTotal === null || custoTotal === undefined ? null : Number(custoTotal);
  const isOperacional = ['comprador', 'facilitador'].includes(perfil);

  if (!isOperacional) return 'RASCUNHO';
  if (custo !== null && custo >= supervisor) return 'AGUARDANDO_GERENTE';
  return 'AGUARDANDO_APROVACAO';
}

function resolverVinculoMaquina({ maquinasDoProduto = [], maquinaId }) {
  if (maquinaId) {
    const selecionada = maquinasDoProduto.find((maquina) => maquina.maquina_id === maquinaId || maquina.id === maquinaId);
    if (!selecionada) {
      throw new AppError('Maquina selecionada nao esta vinculada ao produto', 400, 'MAQUINA_NAO_VINCULADA');
    }
    return selecionada;
  }

  if (maquinasDoProduto.length === 1) return maquinasDoProduto[0];
  if (maquinasDoProduto.length > 1) {
    throw new AppError('Selecione a maquina porque este item e usado em N maquinas', 400, 'MAQUINA_AMBIGUA');
  }

  return null;
}

function validarAutoAprovacao(pedido, usuario) {
  if (pedido.criado_por === usuario.id && usuario.perfil !== 'admin') {
    throw new AppError('Voce nao pode aprovar seu proprio pedido', 403, 'AUTO_APROVACAO_PROIBIDA');
  }
}

function validarSupervisorResponsavel(pedido, usuario) {
  if (
    usuario.perfil === 'supervisor_turno'
    && pedido.aprovador_n1_id
    && pedido.aprovador_n1_id !== usuario.id
  ) {
    throw new AppError('Aprovacao restrita ao supervisor responsavel pelo departamento', 403, 'SUPERVISOR_RESPONSAVEL');
  }
}

function determinarProximaAprovacao({ pedido, usuario, limites }) {
  const { supervisor, gerente } = normalizarLimites(limites);
  const custo = Number(pedido.custo_total || 0);

  validarAutoAprovacao(pedido, usuario);

  if (pedido.status === 'AGUARDANDO_APROVACAO') {
    if (!PERFIS_NIVEL_1.includes(usuario.perfil)) {
      throw new AppError('Necessario Supervisor de Turno ou superior', 403, 'FORBIDDEN');
    }

    validarSupervisorResponsavel(pedido, usuario);

    if (custo >= supervisor && !PERFIS_NIVEL_2.includes(usuario.perfil)) {
      return { novoStatus: 'AGUARDANDO_GERENTE', aprovadoPor: null };
    }
    if (custo >= gerente && !PERFIS_NIVEL_3.includes(usuario.perfil)) {
      return { novoStatus: 'AGUARDANDO_DIRETORIA', aprovadoPor: null };
    }

    return { novoStatus: 'APROVADO', aprovadoPor: usuario.id };
  }

  if (pedido.status === 'AGUARDANDO_GERENTE') {
    if (!PERFIS_NIVEL_2.includes(usuario.perfil)) {
      throw new AppError(
        `Pedido acima de R$ ${supervisor} exige aprovacao do Gerente de Operacoes`,
        403,
        'APROVACAO_INSUFICIENTE'
      );
    }
    if (custo >= gerente && !PERFIS_NIVEL_3.includes(usuario.perfil)) {
      return { novoStatus: 'AGUARDANDO_DIRETORIA', aprovadoPor: null };
    }
    return { novoStatus: 'APROVADO', aprovadoPor: usuario.id };
  }

  if (pedido.status === 'AGUARDANDO_DIRETORIA') {
    if (!PERFIS_NIVEL_3.includes(usuario.perfil)) {
      throw new AppError(
        `Pedido acima de R$ ${gerente} exige aprovacao da Diretoria`,
        403,
        'APROVACAO_INSUFICIENTE'
      );
    }
    return { novoStatus: 'APROVADO', aprovadoPor: usuario.id };
  }

  throw new AppError(`Pedido nao esta aguardando aprovacao (status atual: ${pedido.status})`, 400, 'STATUS_INVALIDO');
}

module.exports = {
  determinarStatusInicialPedido,
  determinarProximaAprovacao,
  normalizarLimites,
  resolverVinculoMaquina,
};
