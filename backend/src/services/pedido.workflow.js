const { AppError } = require('../utils/errors');

const APROVADORES_PADRAO = {
  nivel1: ['supervisor_turno', 'gerente_operacoes', 'plant_manager', 'admin'],
  nivel2: ['gerente_operacoes', 'plant_manager', 'admin'],
  nivel3: ['plant_manager', 'admin'],
};
const PERFIS_SEM_APROVACAO_COMPRA = ['comprador', 'facilitador', 'visualizador'];

function normalizarLimites(limites = {}) {
  return {
    supervisor: Number(limites.supervisor ?? 5000),
    gerente: Number(limites.gerente ?? 50000),
  };
}

function normalizarAprovadores(aprovadores = {}) {
  const normalizarNivel = (nivel) => {
    const configurados = Array.isArray(aprovadores[nivel])
      ? aprovadores[nivel].filter(Boolean)
      : APROVADORES_PADRAO[nivel];

    const elegiveis = configurados.filter((perfil) => !PERFIS_SEM_APROVACAO_COMPRA.includes(perfil));
    return [...new Set([...elegiveis, 'admin'])];
  };

  return {
    nivel1: normalizarNivel('nivel1'),
    nivel2: normalizarNivel('nivel2'),
    nivel3: normalizarNivel('nivel3'),
  };
}

function determinarStatusInicialPedido({ perfil, usuarioId, aprovadorN1Id }) {
  if (perfil === 'supervisor_turno' && usuarioId && aprovadorN1Id && usuarioId === aprovadorN1Id) {
    return 'AGUARDANDO_GERENTE';
  }

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

function determinarProximaAprovacao({ pedido, usuario, limites, aprovadores }) {
  const { supervisor, gerente } = normalizarLimites(limites);
  const aprovadoresCompra = normalizarAprovadores(aprovadores);
  const custo = Number(pedido.custo_total || 0);

  validarAutoAprovacao(pedido, usuario);

  if (pedido.status === 'AGUARDANDO_APROVACAO') {
    if (!aprovadoresCompra.nivel1.includes(usuario.perfil)) {
      throw new AppError('Cargo nao autorizado para aprovacao interna N1. Ajuste em Configuracoes > Aprovacao de pedidos.', 403, 'FORBIDDEN');
    }

    validarSupervisorResponsavel(pedido, usuario);

    if (custo >= supervisor) {
      if (!aprovadoresCompra.nivel2.includes(usuario.perfil)) {
        return { novoStatus: 'AGUARDANDO_GERENTE', aprovadoPor: null };
      }
      if (custo >= gerente && !aprovadoresCompra.nivel3.includes(usuario.perfil)) {
        return { novoStatus: 'AGUARDANDO_DIRETORIA', aprovadoPor: null };
      }
    }
    return { novoStatus: 'APROVADO', aprovadoPor: usuario.id };
  }

  if (pedido.status === 'AGUARDANDO_GERENTE') {
    if (!aprovadoresCompra.nivel2.includes(usuario.perfil)) {
      throw new AppError(
        `Pedido acima de R$ ${supervisor} exige aprovacao interna N2 configurada`,
        403,
        'APROVACAO_INSUFICIENTE'
      );
    }
    if (custo >= gerente && !aprovadoresCompra.nivel3.includes(usuario.perfil)) {
      return { novoStatus: 'AGUARDANDO_DIRETORIA', aprovadoPor: null };
    }
    return { novoStatus: 'APROVADO', aprovadoPor: usuario.id };
  }

  if (pedido.status === 'AGUARDANDO_DIRETORIA') {
    if (!aprovadoresCompra.nivel3.includes(usuario.perfil)) {
      throw new AppError(
        `Pedido acima de R$ ${gerente} exige aprovacao interna N3 configurada`,
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
  normalizarAprovadores,
  normalizarLimites,
  resolverVinculoMaquina,
};
