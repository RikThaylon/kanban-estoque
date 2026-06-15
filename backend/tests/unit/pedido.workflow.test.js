const {
  determinarStatusInicialPedido,
  determinarProximaAprovacao,
  resolverVinculoMaquina,
  normalizarStatusPedido,
  podeAlterarStatusPedido,
  validarMudancaStatusPedido,
  validarRejeicaoPedido,
  validarRecebedorPedido,
  validarPedidoRecebivel,
  calcularStatusRecebimento,
} = require('../../src/services/pedido.workflow');

const limites = {
  supervisor: 5000,
  gerente: 50000,
};

describe('pedido.workflow', () => {
  describe('determinarStatusInicialPedido', () => {
    it('coloca solicitacao do facilitador abaixo do limite para aprovacao do supervisor', () => {
      expect(determinarStatusInicialPedido({
        perfil: 'facilitador',
        custoTotal: 4999,
        limites,
      })).toBe('AGUARDANDO_APROVACAO');
    });

    it('mantem solicitacao acima do limite com supervisor antes de escalar', () => {
      expect(determinarStatusInicialPedido({
        perfil: 'facilitador',
        custoTotal: 5000,
        limites,
      })).toBe('AGUARDANDO_APROVACAO');
    });

    it('mantem pedido do comprador no mesmo fluxo operacional', () => {
      expect(determinarStatusInicialPedido({
        perfil: 'comprador',
        custoTotal: 120,
        limites,
      })).toBe('AGUARDANDO_APROVACAO');
    });

    it('nao deixa pedido administrativo parado como rascunho', () => {
      expect(determinarStatusInicialPedido({
        perfil: 'admin',
        usuarioId: 'admin-1',
        custoTotal: 120,
        limites,
      })).toBe('AGUARDANDO_APROVACAO');
    });

    it('encaminha para gerente quando o supervisor responsavel cria a propria solicitacao', () => {
      expect(determinarStatusInicialPedido({
        perfil: 'supervisor_turno',
        usuarioId: 'sup-1',
        aprovadorN1Id: 'sup-1',
        custoTotal: 120,
        limites,
      })).toBe('AGUARDANDO_GERENTE');
    });
  });

  describe('resolverVinculoMaquina', () => {
    const maquinas = [
      { maquina_id: 'maq-1', departamento_id: 'dep-1', supervisor_id: 'sup-1' },
      { maquina_id: 'maq-2', departamento_id: 'dep-2', supervisor_id: 'sup-2' },
    ];

    it('resolve automaticamente quando o item esta vinculado a uma unica maquina', () => {
      expect(resolverVinculoMaquina({ maquinasDoProduto: [maquinas[0]] })).toEqual(maquinas[0]);
    });

    it('exige maquina quando o mesmo item esta em N maquinas', () => {
      expect(() => resolverVinculoMaquina({ maquinasDoProduto: maquinas })).toThrow('Selecione a maquina');
    });

    it('usa a maquina selecionada quando o item aparece em varias maquinas', () => {
      expect(resolverVinculoMaquina({ maquinasDoProduto: maquinas, maquinaId: 'maq-2' })).toEqual(maquinas[1]);
    });
  });

  describe('determinarProximaAprovacao', () => {
    it('permite que o supervisor responsavel aprove abaixo do limite', () => {
      const result = determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_APROVACAO',
          custo_total: 4999,
          criado_por: 'fac-1',
          aprovador_n1_id: 'sup-1',
        },
        usuario: { id: 'sup-1', perfil: 'supervisor_turno' },
        limites,
      });

      expect(result).toEqual({ novoStatus: 'APROVADO', aprovadoPor: 'sup-1' });
    });

    it('bloqueia supervisor de outro departamento', () => {
      expect(() => determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_APROVACAO',
          custo_total: 100,
          criado_por: 'fac-1',
          aprovador_n1_id: 'sup-1',
        },
        usuario: { id: 'sup-2', perfil: 'supervisor_turno' },
        limites,
      })).toThrow('supervisor responsavel');
    });

    it('escala para gerente quando supervisor aprova valor acima do limite', () => {
      const result = determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_APROVACAO',
          custo_total: 5000,
          criado_por: 'fac-1',
          aprovador_n1_id: 'sup-1',
        },
        usuario: { id: 'sup-1', perfil: 'supervisor_turno' },
        limites,
      });

      expect(result).toEqual({ novoStatus: 'AGUARDANDO_GERENTE', aprovadoPor: null });
    });

    it('permite gerente aprovar pedido escalado abaixo do limite de diretoria', () => {
      const result = determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_GERENTE',
          custo_total: 12000,
          criado_por: 'fac-1',
          aprovador_n1_id: 'sup-1',
        },
        usuario: { id: 'ger-1', perfil: 'gerente_operacoes' },
        limites,
      });

      expect(result).toEqual({ novoStatus: 'APROVADO', aprovadoPor: 'ger-1' });
    });

    it('gerente escala para diretoria quando pedido supera limite gerencial', () => {
      const result = determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_GERENTE',
          custo_total: 75000,
          criado_por: 'fac-1',
          aprovador_n1_id: 'sup-1',
        },
        usuario: { id: 'ger-1', perfil: 'gerente_operacoes' },
        limites,
      });

      expect(result).toEqual({ novoStatus: 'AGUARDANDO_DIRETORIA', aprovadoPor: null });
    });

    it('permite diretoria aprovar pedido em N3', () => {
      const result = determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_DIRETORIA',
          custo_total: 75000,
          criado_por: 'fac-1',
          aprovador_n1_id: 'sup-1',
        },
        usuario: { id: 'dir-1', perfil: 'plant_manager' },
        limites,
      });

      expect(result).toEqual({ novoStatus: 'APROVADO', aprovadoPor: 'dir-1' });
    });

    it('permite cargo customizado configurado aprovar internamente N1', () => {
      const result = determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_APROVACAO',
          custo_total: 100,
          criado_por: 'fac-1',
        },
        usuario: { id: 'eng-1', perfil: 'eng_producao' },
        limites,
        aprovadores: {
          nivel1: ['eng_producao'],
          nivel2: ['gerente_operacoes'],
          nivel3: ['plant_manager'],
        },
      });

      expect(result).toEqual({ novoStatus: 'APROVADO', aprovadoPor: 'eng-1' });
    });

    it('nao permite comprador aprovar mesmo se o cargo for salvo na configuracao', () => {
      expect(() => determinarProximaAprovacao({
        pedido: {
          status: 'AGUARDANDO_APROVACAO',
          custo_total: 100,
          criado_por: 'fac-1',
        },
        usuario: { id: 'comp-1', perfil: 'comprador' },
        limites,
        aprovadores: {
          nivel1: ['comprador'],
          nivel2: ['comprador'],
          nivel3: ['comprador'],
        },
      })).toThrow('Cargo nao autorizado');
    });
  });

  describe('transicoes e permissoes de status', () => {
    const cargosFluxo = {
      compradores: ['comprador'],
      recebedores: ['comprador', 'facilitador'],
    };

    it('normaliza status legados de emissao e recebimento', () => {
      expect(normalizarStatusPedido('EMITIDO')).toBe('AGUARDANDO_CHEGADA');
      expect(normalizarStatusPedido('RECEBIDO')).toBe('CONCLUIDO');
      expect(normalizarStatusPedido('CANCELADO')).toBe('CANCELADO');
    });

    it('permite comprador colocar pedido aprovado aguardando chegada', () => {
      expect(podeAlterarStatusPedido('comprador', 'AGUARDANDO_CHEGADA', null, 'APROVADO', cargosFluxo)).toBe(true);
    });

    it('bloqueia facilitador de emitir OC externa quando nao e comprador configurado', () => {
      expect(podeAlterarStatusPedido('facilitador', 'AGUARDANDO_CHEGADA', null, 'APROVADO', cargosFluxo)).toBe(false);
    });

    it('exige OC externa ao marcar pedido como aguardando chegada', () => {
      expect(() => validarMudancaStatusPedido({
        statusAtual: 'APROVADO',
        novoStatus: 'AGUARDANDO_CHEGADA',
        usuario: { perfil: 'comprador' },
        cargosFluxo,
        fornecedorIdAtual: 'forn-1',
      })).toThrow('OC criada');
    });

    it('exige fornecedor ao marcar pedido como aguardando chegada', () => {
      expect(() => validarMudancaStatusPedido({
        statusAtual: 'APROVADO',
        novoStatus: 'AGUARDANDO_CHEGADA',
        usuario: { perfil: 'comprador' },
        cargosFluxo,
        numeroOcExterna: 'OC-123',
      })).toThrow('fornecedor');
    });

    it('orienta a usar endpoint de receber para status de recebimento', () => {
      expect(() => validarMudancaStatusPedido({
        statusAtual: 'AGUARDANDO_CHEGADA',
        novoStatus: 'CONCLUIDO',
        usuario: { perfil: 'comprador' },
        cargosFluxo,
      })).toThrow('Use POST /:id/receber');
    });

    it('valida rejeicao por aprovador N1 configurado', () => {
      expect(() => validarRejeicaoPedido(
        { status: 'AGUARDANDO_APROVACAO', criado_por: 'fac-1', aprovador_n1_id: 'sup-1' },
        { id: 'sup-1', perfil: 'supervisor_turno' },
        { nivel1: ['supervisor_turno'], nivel2: ['gerente_operacoes'], nivel3: ['plant_manager'] }
      )).not.toThrow();
    });

    it('bloqueia rejeicao por supervisor de outro departamento', () => {
      expect(() => validarRejeicaoPedido(
        { status: 'AGUARDANDO_APROVACAO', criado_por: 'fac-1', aprovador_n1_id: 'sup-1' },
        { id: 'sup-2', perfil: 'supervisor_turno' },
        { nivel1: ['supervisor_turno'], nivel2: ['gerente_operacoes'], nivel3: ['plant_manager'] }
      )).toThrow('supervisor responsavel');
    });
  });

  describe('recebimento', () => {
    it('permite recebedor configurado', () => {
      expect(() => validarRecebedorPedido(
        { perfil: 'facilitador' },
        { recebedores: ['facilitador'] }
      )).not.toThrow();
    });

    it('bloqueia cargo fora dos recebedores', () => {
      expect(() => validarRecebedorPedido(
        { perfil: 'supervisor_turno' },
        { recebedores: ['facilitador'] }
      )).toThrow('registrar recebimento');
    });

    it('permite receber pedido em status aguardando chegada', () => {
      expect(() => validarPedidoRecebivel({ status: 'AGUARDANDO_CHEGADA' })).not.toThrow();
    });

    it('bloqueia recebimento em status aprovado', () => {
      expect(() => validarPedidoRecebivel({ status: 'APROVADO' })).toThrow('Pedido nao pode ser recebido');
    });

    it('calcula recebimento parcial', () => {
      expect(calcularStatusRecebimento({
        quantidadePedida: 100,
        quantidadeRecebidaAtual: 20,
        quantidadeRecebida: 30,
      })).toEqual({ totalRecebido: 50, novoStatus: 'RECEBIDO_PARCIAL' });
    });

    it('calcula recebimento concluido', () => {
      expect(calcularStatusRecebimento({
        quantidadePedida: 100,
        quantidadeRecebidaAtual: 40,
        quantidadeRecebida: 60,
      })).toEqual({ totalRecebido: 100, novoStatus: 'CONCLUIDO' });
    });
  });
});
