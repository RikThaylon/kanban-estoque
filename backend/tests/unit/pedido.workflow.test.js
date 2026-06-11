const {
  determinarStatusInicialPedido,
  determinarProximaAprovacao,
  resolverVinculoMaquina,
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

    it('permite gerente aprovar pedido escalado mesmo acima do limite legado de diretoria', () => {
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

      expect(result).toEqual({ novoStatus: 'APROVADO', aprovadoPor: 'ger-1' });
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
});
