require('../setup');

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

const {
  PERFIS_APROVADORES_CONFIGURAVEIS,
  PERFIS_FLUXO_COMPRA_CONFIGURAVEIS,
  formatarRespostaPedidos,
  montarConfiguracoesPedidos,
  montarConfiguracoesKanban,
  montarConfiguracoesTurnos,
  montarConfiguracoesPermissoes,
} = require('../../src/services/configuracoes.service');

describe('configuracoes.service regras de negocio', () => {
  describe('perfis configuraveis', () => {
    it('remove perfis que nao devem ser escolhidos para aprovacao interna', () => {
      expect(PERFIS_APROVADORES_CONFIGURAVEIS).not.toEqual(expect.arrayContaining(['admin', 'comprador', 'facilitador', 'visualizador']));
      expect(PERFIS_APROVADORES_CONFIGURAVEIS).toEqual(expect.arrayContaining(['supervisor_turno', 'gerente_operacoes', 'plant_manager']));
    });

    it('remove admin e visualizador dos papeis executores do fluxo de compra', () => {
      expect(PERFIS_FLUXO_COMPRA_CONFIGURAVEIS).not.toEqual(expect.arrayContaining(['admin', 'visualizador']));
      expect(PERFIS_FLUXO_COMPRA_CONFIGURAVEIS).toEqual(expect.arrayContaining(['facilitador', 'comprador']));
    });
  });

  describe('configuracoes de pedidos', () => {
    it('monta payload persistivel e filtra admin das listas configuraveis', () => {
      const { configuracoes, limites } = montarConfiguracoesPedidos({
        limite_supervisor: '5000',
        limite_gerente: '50000',
        solicitantes: ['admin', 'facilitador', 'comprador', 'comprador'],
        aprovadores_nivel_1: ['admin', 'supervisor_turno'],
        compradores: ['admin', 'comprador'],
      });

      expect(limites).toEqual({ supervisor: 5000, gerente: 50000 });
      expect(configuracoes).toMatchObject({
        'pedidos.limite_supervisor': 5000,
        'pedidos.limite_gerente': 50000,
        'pedidos.solicitantes': 'facilitador,comprador',
        'pedidos.aprovadores_nivel_1': 'supervisor_turno',
        'pedidos.compradores': 'comprador',
      });
    });

    it('bloqueia limite do gerente menor que limite do supervisor', () => {
      expect(() => montarConfiguracoesPedidos({
        limite_supervisor: 10000,
        limite_gerente: 5000,
      })).toThrow('Limite do gerente');
    });

    it('formata resposta publica de pedidos', () => {
      const resposta = formatarRespostaPedidos(
        { supervisor: 5000, gerente: 50000 },
        {
          solicitantes: ['facilitador'],
          aprovadores: { nivel1: ['supervisor_turno'], nivel2: ['gerente_operacoes'], nivel3: ['plant_manager'] },
          compradores: ['comprador'],
          recebedores: ['comprador', 'facilitador'],
        }
      );

      expect(resposta).toEqual({
        limite_supervisor: 5000,
        limite_gerente: 50000,
        solicitantes: ['facilitador'],
        aprovadores_nivel_1: ['supervisor_turno'],
        aprovadores_nivel_2: ['gerente_operacoes'],
        aprovadores_nivel_3: ['plant_manager'],
        compradores: ['comprador'],
        recebedores: ['comprador', 'facilitador'],
      });
    });
  });

  describe('kanban, turnos e permissoes', () => {
    it('normaliza numeros da configuracao Kanban', () => {
      const { configuracoes, resposta } = montarConfiguracoesKanban({
        nivel_servico_padrao: '95',
        ciclos_estimativa_inicial: '10',
        taxa_carregamento_padrao: '0.25',
      });

      expect(configuracoes['kanban.nivel_servico_padrao']).toBe(95);
      expect(configuracoes['kanban.ciclos_estimativa_inicial']).toBe(10);
      expect(configuracoes['kanban.taxa_carregamento_padrao']).toBe(0.25);
      expect(resposta.taxa_carregamento_padrao).toBe(0.25);
    });

    it('bloqueia turnos com codigo duplicado apos normalizacao', () => {
      expect(() => montarConfiguracoesTurnos({
        turnos: [
          { id: '1T', nome: '1T', inicio: '06:00', fim: '14:00' },
          { id: '1T', nome: 'Primeiro turno', inicio: '14:00', fim: '22:00' },
        ],
      })).toThrow('codigo unico');
    });

    it('salva matriz de permissoes incluindo paginas vazias informadas', () => {
      const configuracoes = montarConfiguracoesPermissoes({
        cadastrar_item: ['comprador'],
        editar_curva_abc: ['eng_producao'],
        paginas: {
          dashboard: [],
          produtos: ['comprador', 'visualizador'],
        },
      });

      expect(configuracoes).toMatchObject({
        'permissoes.cadastrar_item': 'comprador',
        'permissoes.editar_curva_abc': 'eng_producao',
        'permissoes.paginas.dashboard': '',
        'permissoes.paginas.produtos': 'comprador,visualizador',
      });
    });
  });
});
