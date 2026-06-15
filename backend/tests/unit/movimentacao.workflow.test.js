const {
  UUID_REGEX,
  TIPOS_MOVIMENTACAO_VALIDOS,
  PERFIS_APROVADORES_MOVIMENTACAO,
  tipoRequerAprovacao,
  aplicarDeltaEstoque,
  validarMovimentacaoPendente,
  validarAutoAprovacaoMovimentacao,
  calcularExecucaoMovimentacao,
} = require('../../src/services/movimentacao.workflow');

describe('movimentacao.workflow', () => {
  describe('constantes de negocio', () => {
    it('expoe regex de UUID usada nas rotas de movimentacao', () => {
      expect(UUID_REGEX.test('11111111-1111-4111-8111-111111111111')).toBe(true);
      expect(UUID_REGEX.test('mov-1')).toBe(false);
    });

    it('mantem apenas tipos permitidos para novo lancamento', () => {
      expect(TIPOS_MOVIMENTACAO_VALIDOS).toEqual([
        'ENTRADA',
        'SAIDA',
        'AJUSTE_POSITIVO',
        'AJUSTE_NEGATIVO',
        'DEVOLUCAO',
      ]);
    });

    it('define aprovadores de movimentacao pendente', () => {
      expect(PERFIS_APROVADORES_MOVIMENTACAO).toEqual([
        'admin',
        'supervisor_turno',
        'gerente_operacoes',
        'plant_manager',
      ]);
    });
  });

  describe('tipoRequerAprovacao', () => {
    it('exige aprovacao para ajustes e devolucao', () => {
      expect(tipoRequerAprovacao('AJUSTE_POSITIVO')).toBe(true);
      expect(tipoRequerAprovacao('AJUSTE_NEGATIVO')).toBe(true);
      expect(tipoRequerAprovacao('DEVOLUCAO')).toBe(true);
    });

    it('nao exige aprovacao para entrada e saida diretas', () => {
      expect(tipoRequerAprovacao('ENTRADA')).toBe(false);
      expect(tipoRequerAprovacao('SAIDA')).toBe(false);
    });
  });

  describe('aplicarDeltaEstoque', () => {
    it('aumenta estoque para entrada, ajuste positivo e devolucao', () => {
      expect(aplicarDeltaEstoque('ENTRADA', 10, 5)).toBe(15);
      expect(aplicarDeltaEstoque('AJUSTE_POSITIVO', 10, 5)).toBe(15);
      expect(aplicarDeltaEstoque('DEVOLUCAO', 10, 5)).toBe(15);
    });

    it('reduz estoque para saida, transferencia historica e ajuste negativo', () => {
      expect(aplicarDeltaEstoque('SAIDA', 10, 5)).toBe(5);
      expect(aplicarDeltaEstoque('TRANSFERENCIA', 10, 5)).toBe(5);
      expect(aplicarDeltaEstoque('AJUSTE_NEGATIVO', 10, 5)).toBe(5);
    });

    it('rejeita tipo invalido', () => {
      expect(() => aplicarDeltaEstoque('INVENTARIO', 10, 1)).toThrow('Tipo de movimentacao invalido');
    });
  });

  describe('validacoes', () => {
    it('exige status pendente para aprovar ou rejeitar', () => {
      expect(() => validarMovimentacaoPendente({ status: 'PENDENTE' })).not.toThrow();
      expect(() => validarMovimentacaoPendente({ status: 'EXECUTADO' })).toThrow('nao esta pendente');
    });

    it('bloqueia autoaprovacao para nao-admin', () => {
      expect(() => validarAutoAprovacaoMovimentacao(
        { criado_por: 'user-1' },
        { id: 'user-1', perfil: 'supervisor_turno' }
      )).toThrow('aprovar sua propria movimentacao');
    });

    it('permite autoaprovacao para admin', () => {
      expect(() => validarAutoAprovacaoMovimentacao(
        { criado_por: 'admin-1' },
        { id: 'admin-1', perfil: 'admin' }
      )).not.toThrow();
    });
  });

  describe('calcularExecucaoMovimentacao', () => {
    it('calcula estoque final quando operacao e possivel', () => {
      expect(calcularExecucaoMovimentacao({
        tipo: 'SAIDA',
        estoqueAtual: 20,
        quantidade: 5,
      })).toBe(15);
    });

    it('bloqueia estoque negativo na criacao', () => {
      expect(() => calcularExecucaoMovimentacao({
        tipo: 'SAIDA',
        estoqueAtual: 2,
        quantidade: 5,
      })).toThrow('Estoque insuficiente para esta operacao');
    });

    it('bloqueia estoque negativo na aprovacao com mensagem propria', () => {
      expect(() => calcularExecucaoMovimentacao({
        tipo: 'AJUSTE_NEGATIVO',
        estoqueAtual: 2,
        quantidade: 5,
        contexto: 'aprovacao',
      })).toThrow('Estoque insuficiente no momento da aprovacao');
    });
  });
});
