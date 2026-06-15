const {
  MODAIS_VALIDOS,
  CAMPOS_ATUALIZAVEIS_FORNECEDOR,
  nullSeVazio,
  normalizarFornecedorPayload,
  montarAtualizacaoFornecedor,
  erroFornecedorDoBanco,
} = require('../../src/services/fornecedor.workflow');

describe('fornecedor.workflow', () => {
  describe('constantes de dominio', () => {
    it('mantem modais suportados pelo cadastro de fornecedor', () => {
      expect(MODAIS_VALIDOS).toEqual(expect.arrayContaining(['rodoviario', 'aereo', 'motoboy', 'correios']));
    });

    it('explicita os campos atualizaveis de fornecedor', () => {
      expect(CAMPOS_ATUALIZAVEIS_FORNECEDOR).toEqual(expect.arrayContaining(['nome', 'cnpj', 'modal_padrao', 'ativo']));
    });
  });

  describe('normalizacao de payload', () => {
    it('converte vazios opcionais para null', () => {
      const payload = normalizarFornecedorPayload({
        nome: 'Fornecedor QA',
        cnpj: '',
        contato_email: '',
        modal_padrao: 'motoboy',
        ativo: false,
      });

      expect(payload).toEqual({
        nome: 'Fornecedor QA',
        cnpj: null,
        contato_email: null,
        modal_padrao: 'motoboy',
        ativo: false,
      });
    });

    it('preserva valores booleanos e numericos validos', () => {
      expect(nullSeVazio(0)).toBe(0);
      expect(nullSeVazio(false)).toBe(false);
      expect(nullSeVazio('')).toBeNull();
      expect(nullSeVazio(undefined)).toBeNull();
    });

    it('monta atualizacao apenas com campos permitidos e informados', () => {
      const atualizacao = montarAtualizacaoFornecedor({
        nome: 'Fornecedor QA',
        cnpj: '',
        ativo: true,
        campo_ignorado: 'x',
      });

      expect(atualizacao.fields).toEqual(['nome = $1', 'cnpj = $2', 'ativo = $3']);
      expect(atualizacao.values).toEqual(['Fornecedor QA', null, true]);
      expect(atualizacao.nextIndex).toBe(4);
    });
  });

  describe('erros conhecidos do banco', () => {
    it('traduz CNPJ duplicado para conflito de negocio', () => {
      const erro = erroFornecedorDoBanco({ code: '23505' });

      expect(erro.statusCode).toBe(409);
      expect(erro.code).toBe('CONFLICT');
      expect(erro.message).toContain('CNPJ');
    });

    it('traduz violacao de check para erro de validacao', () => {
      const erro = erroFornecedorDoBanco({ code: '23514' });

      expect(erro.statusCode).toBe(400);
      expect(erro.code).toBe('VALIDATION_ERROR');
    });

    it('ignora erros desconhecidos', () => {
      expect(erroFornecedorDoBanco({ code: '42P01' })).toBeNull();
    });
  });
});
