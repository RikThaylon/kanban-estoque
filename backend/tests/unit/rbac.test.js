/**
 * Testes unitÃ¡rios para RBAC (Role-Based Access Control)
 * @module tests/unit/rbac.test
 */

const {
  authorize,
  PERMISSIONS,
  PERFIS_VALIDOS,
  PERFIS_VISUALIZADORES,
  PERFIS_APROVADORES,
  PERFIS_EXECUTORES,
  isVisualizador,
  podeAprovarNivel1,
  podeAprovarNivel2,
  podeAprovarNivel3,
} = require('../../src/middleware/rbac');

describe('RBAC Module', () => {
  describe('Constantes', () => {
    it('deve ter 9 perfis vÃ¡lidos', () => {
      expect(PERFIS_VALIDOS).toHaveLength(10);
      expect(PERFIS_VALIDOS).toContain('admin');
      expect(PERFIS_VALIDOS).toContain('plant_manager');
      expect(PERFIS_VALIDOS).toContain('gerente_operacoes');
      expect(PERFIS_VALIDOS).toContain('supervisor_turno');
      expect(PERFIS_VALIDOS).toContain('comprador');
      expect(PERFIS_VALIDOS).toContain('facilitador');
      expect(PERFIS_VALIDOS).toContain('visualizador');
    });

    it('deve classificar visualizadores corretamente', () => {
      expect(PERFIS_VISUALIZADORES).toContain('plant_manager');
      expect(PERFIS_VISUALIZADORES).toContain('gerente_engenharia');
      expect(PERFIS_VISUALIZADORES).toContain('eng_processos');
      expect(PERFIS_VISUALIZADORES).toContain('visualizador');
      expect(PERFIS_VISUALIZADORES).not.toContain('admin');
      expect(PERFIS_VISUALIZADORES).not.toContain('comprador');
    });

    it('deve ter 3 nÃ­veis de aprovaÃ§Ã£o', () => {
      expect(PERFIS_APROVADORES.nivel1).toBeDefined();
      expect(PERFIS_APROVADORES.nivel2).toBeDefined();
      expect(PERFIS_APROVADORES.nivel3).toBeDefined();
    });

    it('nivel1 deve incluir supervisor_turno e admin', () => {
      expect(PERFIS_APROVADORES.nivel1).toContain('supervisor_turno');
      expect(PERFIS_APROVADORES.nivel1).toContain('admin');
      expect(PERFIS_APROVADORES.nivel1).not.toContain('gerente_operacoes');
    });

    it('nivel2 deve incluir gerente, admin (sem supervisor)', () => {
      expect(PERFIS_APROVADORES.nivel2).toContain('gerente_operacoes');
      expect(PERFIS_APROVADORES.nivel2).toContain('admin');
      expect(PERFIS_APROVADORES.nivel2).not.toContain('supervisor_turno');
    });

    it('nivel3 deve incluir plant_manager e admin', () => {
      expect(PERFIS_APROVADORES.nivel3).toContain('plant_manager');
      expect(PERFIS_APROVADORES.nivel3).toContain('admin');
      expect(PERFIS_APROVADORES.nivel3).not.toContain('gerente_operacoes');
    });

    it('executores devem ser comprador e facilitador', () => {
      expect(PERFIS_EXECUTORES).toEqual(['comprador', 'facilitador']);
    });

    it('todos os perfis vÃ¡lidos devem ter permissÃµes definidas', () => {
      for (const perfil of PERFIS_VALIDOS) {
        expect(PERMISSIONS[perfil]).toBeDefined();
        expect(Array.isArray(PERMISSIONS[perfil])).toBe(true);
        expect(PERMISSIONS[perfil].length).toBeGreaterThan(0);
      }
    });

    it('admin deve ter permissÃ£o wildcard', () => {
      expect(PERMISSIONS.admin).toEqual(['*']);
    });
  });

  describe('isVisualizador', () => {
    it('deve retornar true para perfis visualizadores', () => {
      expect(isVisualizador('plant_manager')).toBe(true);
      expect(isVisualizador('gerente_engenharia')).toBe(true);
      expect(isVisualizador('eng_processos')).toBe(true);
      expect(isVisualizador('visualizador')).toBe(true);
    });

    it('deve retornar false para perfis executores', () => {
      expect(isVisualizador('admin')).toBe(false);
      expect(isVisualizador('comprador')).toBe(false);
      expect(isVisualizador('supervisor_turno')).toBe(false);
    });
  });

  describe('podeAprovarNivel1', () => {
    it('deve permitir supervisor_turno', () => {
      expect(podeAprovarNivel1('supervisor_turno')).toBe(true);
    });

    it('deve negar gerente_operacoes no nivel 1 padrao', () => {
      expect(podeAprovarNivel1('gerente_operacoes')).toBe(false);
    });

    it('deve permitir admin', () => {
      expect(podeAprovarNivel1('admin')).toBe(true);
    });

    it('deve negar comprador', () => {
      expect(podeAprovarNivel1('comprador')).toBe(false);
    });

    it('deve negar facilitador', () => {
      expect(podeAprovarNivel1('facilitador')).toBe(false);
    });
  });

  describe('podeAprovarNivel2', () => {
    it('deve permitir gerente_operacoes', () => {
      expect(podeAprovarNivel2('gerente_operacoes')).toBe(true);
    });

    it('deve permitir admin', () => {
      expect(podeAprovarNivel2('admin')).toBe(true);
    });

    it('deve negar supervisor_turno', () => {
      expect(podeAprovarNivel2('supervisor_turno')).toBe(false);
    });
  });

  describe('podeAprovarNivel3', () => {
    it('deve permitir plant_manager', () => {
      expect(podeAprovarNivel3('plant_manager')).toBe(true);
    });

    it('deve permitir admin', () => {
      expect(podeAprovarNivel3('admin')).toBe(true);
    });

    it('deve negar gerente_operacoes', () => {
      expect(podeAprovarNivel3('gerente_operacoes')).toBe(false);
    });

    it('deve negar supervisor_turno', () => {
      expect(podeAprovarNivel3('supervisor_turno')).toBe(false);
    });
  });

  describe('authorize middleware', () => {
    const mockReq = (perfil) => ({ user: { perfil } });
    const mockRes = () => ({});
    const mockNext = jest.fn();

    beforeEach(() => {
      mockNext.mockClear();
    });

    it('admin deve sempre passar independente dos perfis listados', () => {
      const middleware = authorize('comprador');
      middleware(mockReq('admin'), mockRes(), mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('deve permitir perfil listado', () => {
      const middleware = authorize('comprador', 'facilitador');
      middleware(mockReq('comprador'), mockRes(), mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('deve negar perfil nÃ£o listado', () => {
      const middleware = authorize('comprador');
      middleware(mockReq('facilitador'), mockRes(), mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
      }));
    });

    it('deve negar quando nÃ£o hÃ¡ usuÃ¡rio autenticado', () => {
      const middleware = authorize('admin');
      middleware({ user: null }, mockRes(), mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
      }));
    });

    it('deve aceitar mÃºltiplos perfis', () => {
      const middleware = authorize('supervisor_turno', 'gerente_operacoes', 'comprador');
      middleware(mockReq('gerente_operacoes'), mockRes(), mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
