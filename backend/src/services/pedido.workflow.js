const { AppError } = require('../utils/errors');

const APROVADORES_PADRAO = {
  nivel1: ['supervisor_turno', 'gerente_operacoes', 'plant_manager', 'admin'],
  nivel2: ['gerente_operacoes', 'plant_manager', 'admin'],
  nivel3: ['plant_manager', 'admin'],
};
const PERFIS_SEM_APROVACAO_COMPRA = ['comprador', 'facilitador', 'visualizador'];
const STATUS_AGUARDANDO_APROVACAO = ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA'];
const STATUS_RECEBIVEIS = ['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL'];
const STATUS_RECEBIMENTO_VIA_ENDPOINT = ['CONCLUIDO', 'RECEBIDO', 'RECEBIDO_PARCIAL'];
const TRANSICOES_PEDIDO = {
  RASCUNHO: ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA', 'APROVADO', 'CANCELADO'],
  AGUARDANDO_APROVACAO: ['AGUARDANDO_GERENTE', 'APROVADO', 'CANCELADO', 'REJEITADO'],
  AGUARDANDO_GERENTE: ['APROVADO', 'CANCELADO', 'REJEITADO'],
  AGUARDANDO_DIRETORIA: ['APROVADO', 'CANCELADO', 'REJEITADO'],
  APROVADO: ['AGUARDANDO_CHEGADA', 'EMITIDO', 'CANCELADO'],
  AGUARDANDO_CHEGADA: ['EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO', 'CANCELADO'],
  EMITIDO: ['EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO', 'CANCELADO'],
  EM_TRANSITO: ['RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO', 'CANCELADO'],
  RECEBIDO_PARCIAL: ['CONCLUIDO', 'RECEBIDO', 'CANCELADO'],
  CONCLUIDO: [],
  RECEBIDO: [],
  CANCELADO: [],
  REJEITADO: [],
};

function perfilNoFluxo(perfil, perfis = []) {
  if (perfil === 'admin') return true;
  return Array.isArray(perfis) && perfis.includes(perfil);
}

function perfilPodeAprovarNivel(perfil, aprovadores, nivel) {
  if (perfil === 'admin') return true;
  return Array.isArray(aprovadores?.[nivel]) && aprovadores[nivel].includes(perfil);
}

function nivelAprovacaoDoStatus(statusAtual) {
  if (statusAtual === 'AGUARDANDO_GERENTE') return 'nivel2';
  if (statusAtual === 'AGUARDANDO_DIRETORIA') return 'nivel3';
  return 'nivel1';
}

function normalizarStatusPedido(status) {
  if (status === 'EMITIDO') return 'AGUARDANDO_CHEGADA';
  if (status === 'RECEBIDO') return 'CONCLUIDO';
  return status;
}

function podeAlterarStatusPedido(perfil, novoStatus, aprovadores, statusAtual, cargosFluxo = {}) {
  if (perfil === 'admin') return true;
  if (['CANCELADO', 'REJEITADO'].includes(novoStatus)) {
    return perfilPodeAprovarNivel(perfil, aprovadores, nivelAprovacaoDoStatus(statusAtual));
  }
  if (['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO'].includes(novoStatus)) {
    return perfilNoFluxo(perfil, cargosFluxo.compradores);
  }
  if (STATUS_RECEBIMENTO_VIA_ENDPOINT.includes(novoStatus)) {
    return perfilNoFluxo(perfil, cargosFluxo.recebedores);
  }
  return false;
}

function pedidoEstaAguardandoAprovacao(status) {
  return STATUS_AGUARDANDO_APROVACAO.includes(status);
}

function validarPedidoAguardandoAprovacao(pedido, acao = 'aprovar') {
  if (pedidoEstaAguardandoAprovacao(pedido.status)) return;
  const verbo = acao === 'rejeitar' ? 'pode ser rejeitado' : 'esta aguardando aprovacao';
  const code = 'STATUS_INVALIDO';
  if (acao === 'rejeitar') {
    throw new AppError(`Pedido nao ${verbo} neste status: ${pedido.status}`, 400, code);
  }
  throw new AppError(`Pedido nao ${verbo} (status atual: ${pedido.status})`, 400, code);
}

function validarRejeicaoPedido(pedido, usuario, aprovadores) {
  validarPedidoAguardandoAprovacao(pedido, 'rejeitar');

  if (pedido.status === 'AGUARDANDO_APROVACAO' && !perfilPodeAprovarNivel(usuario.perfil, aprovadores, 'nivel1')) {
    throw new AppError('Cargo nao autorizado para aprovacao interna N1. Ajuste em Configuracoes > Aprovacao de pedidos.', 403, 'FORBIDDEN');
  }
  if (
    pedido.status === 'AGUARDANDO_APROVACAO'
    && usuario.perfil === 'supervisor_turno'
    && pedido.aprovador_n1_id
    && pedido.aprovador_n1_id !== usuario.id
  ) {
    throw new AppError('Rejeicao restrita ao supervisor responsavel pelo departamento', 403, 'SUPERVISOR_RESPONSAVEL');
  }
  if (pedido.status === 'AGUARDANDO_GERENTE' && !perfilPodeAprovarNivel(usuario.perfil, aprovadores, 'nivel2')) {
    throw new AppError('Cargo nao autorizado para aprovacao interna N2. Ajuste em Configuracoes > Aprovacao de pedidos.', 403, 'FORBIDDEN');
  }
  if (pedido.status === 'AGUARDANDO_DIRETORIA' && !perfilPodeAprovarNivel(usuario.perfil, aprovadores, 'nivel3')) {
    throw new AppError('Cargo nao autorizado para aprovacao interna N3. Ajuste em Configuracoes > Aprovacao de pedidos.', 403, 'FORBIDDEN');
  }
}

function validarMudancaStatusPedido({
  statusAtual,
  novoStatus,
  usuario,
  aprovadores,
  cargosFluxo,
  numeroOcExterna,
  fornecedorIdAtual,
  fornecedorIdSolicitado,
}) {
  if (!TRANSICOES_PEDIDO[statusAtual]?.includes(novoStatus)) {
    throw new AppError(`Transicao invalida: ${statusAtual} -> ${novoStatus}`, 400, 'TRANSICAO_INVALIDA');
  }

  if (novoStatus === 'APROVADO' && usuario.perfil !== 'admin') {
    throw new AppError('Use POST /:id/aprovar para aprovar pedidos', 400, 'USE_APROVAR_ENDPOINT');
  }

  if (STATUS_RECEBIMENTO_VIA_ENDPOINT.includes(novoStatus)) {
    throw new AppError('Use POST /:id/receber para registrar recebimento com quantidade e NF', 400, 'USE_RECEBER_ENDPOINT');
  }

  if (!podeAlterarStatusPedido(usuario.perfil, novoStatus, aprovadores, statusAtual, cargosFluxo)) {
    throw new AppError('Seu perfil nao pode alterar pedido para este status', 403, 'FORBIDDEN');
  }

  if (novoStatus === 'AGUARDANDO_CHEGADA') {
    if (!numeroOcExterna) {
      throw new AppError('Informe o numero da OC criada no sistema externo', 400, 'OC_EXTERNA_OBRIGATORIA');
    }
    if (!fornecedorIdSolicitado && !fornecedorIdAtual) {
      throw new AppError('Comprador deve escolher o fornecedor antes de marcar como aguardando chegada', 400, 'FORNECEDOR_OBRIGATORIO');
    }
  }
}

function validarRecebedorPedido(usuario, cargosFluxo) {
  if (!perfilNoFluxo(usuario.perfil, cargosFluxo.recebedores)) {
    throw new AppError('Seu cargo nao pode registrar recebimento neste fluxo', 403, 'FORBIDDEN');
  }
}

function validarPedidoRecebivel(pedido) {
  if (!STATUS_RECEBIVEIS.includes(pedido.status)) {
    throw new AppError('Pedido nao pode ser recebido neste status', 400, 'STATUS_INVALIDO');
  }
}

function calcularStatusRecebimento({ quantidadePedida, quantidadeRecebidaAtual = 0, quantidadeRecebida }) {
  const totalRecebido = Number(quantidadeRecebidaAtual) + Number(quantidadeRecebida);
  const novoStatus = totalRecebido >= Number(quantidadePedida) ? 'CONCLUIDO' : 'RECEBIDO_PARCIAL';
  return { totalRecebido, novoStatus };
}

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
  TRANSICOES_PEDIDO,
  STATUS_AGUARDANDO_APROVACAO,
  STATUS_RECEBIVEIS,
  perfilNoFluxo,
  perfilPodeAprovarNivel,
  nivelAprovacaoDoStatus,
  normalizarStatusPedido,
  podeAlterarStatusPedido,
  pedidoEstaAguardandoAprovacao,
  validarPedidoAguardandoAprovacao,
  validarRejeicaoPedido,
  validarMudancaStatusPedido,
  validarRecebedorPedido,
  validarPedidoRecebivel,
  calcularStatusRecebimento,
  determinarStatusInicialPedido,
  determinarProximaAprovacao,
  normalizarAprovadores,
  normalizarLimites,
  resolverVinculoMaquina,
};
