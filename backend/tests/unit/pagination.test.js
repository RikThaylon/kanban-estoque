/**
 * Testes unitários para utilitários de paginação
 * @module tests/unit/pagination.test
 */

const { parsePagination, paginatedResponse } = require('../../src/utils/pagination');

describe('Pagination Utils', () => {
  describe('parsePagination', () => {
    it('deve retornar valores padrão quando query está vazia', () => {
      const result = parsePagination({});
      expect(result).toEqual({ limit: 20, offset: 0, page: 1 });
    });

    it('deve calcular offset corretamente para página 2', () => {
      const result = parsePagination({ page: '2', limit: '10' });
      expect(result).toEqual({ limit: 10, offset: 10, page: 2 });
    });

    it('deve calcular offset para página 5 com limit 25', () => {
      const result = parsePagination({ page: '5', limit: '25' });
      expect(result).toEqual({ limit: 25, offset: 100, page: 5 });
    });

    it('deve limitar o máximo a 100 itens por página', () => {
      const result = parsePagination({ limit: '500' });
      expect(result.limit).toBe(100);
    });

    it('deve usar default quando limit é 0 (parseInt 0 é falsy)', () => {
      const result = parsePagination({ limit: '0' });
      expect(result.limit).toBe(20); // 0 || defaultLimit = 20
    });

    it('deve garantir mínimo de 1 para limite negativo', () => {
      const result = parsePagination({ limit: '-5' });
      expect(result.limit).toBe(1);
    });

    it('deve tratar page negativa como 1', () => {
      const result = parsePagination({ page: '-1' });
      expect(result.page).toBe(1);
      expect(result.offset).toBe(0);
    });

    it('deve tratar page 0 como 1', () => {
      const result = parsePagination({ page: '0' });
      expect(result.page).toBe(1);
    });

    it('deve tratar valores não numéricos como padrão', () => {
      const result = parsePagination({ page: 'abc', limit: 'xyz' });
      expect(result).toEqual({ limit: 20, offset: 0, page: 1 });
    });

    it('deve aceitar defaultLimit customizado', () => {
      const result = parsePagination({}, 50);
      expect(result.limit).toBe(50);
    });
  });

  describe('paginatedResponse', () => {
    it('deve formatar resposta corretamente', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = paginatedResponse(data, 50, 1, 20);
      
      expect(result).toEqual({
        data: [{ id: 1 }, { id: 2 }],
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      });
    });

    it('deve calcular totalPages corretamente (arredondamento para cima)', () => {
      const result = paginatedResponse([], 51, 1, 20);
      expect(result.totalPages).toBe(3); // ceil(51/20) = 3
    });

    it('deve retornar 1 página quando total = limit', () => {
      const result = paginatedResponse([], 20, 1, 20);
      expect(result.totalPages).toBe(1);
    });

    it('deve retornar 0 páginas quando total = 0', () => {
      const result = paginatedResponse([], 0, 1, 20);
      expect(result.totalPages).toBe(0);
    });

    it('deve preservar dados intactos', () => {
      const data = [{ id: 'abc', nome: 'Teste', nested: { key: 'val' } }];
      const result = paginatedResponse(data, 1, 1, 10);
      expect(result.data).toBe(data); // mesma referência
    });
  });
});
