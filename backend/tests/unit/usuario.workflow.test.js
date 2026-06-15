const {
  SENHA_MIN,
  SENHA_MAX,
  SENHA_REGEX,
  CAMPOS_PROPRIOS_USUARIO,
  CAMPOS_ADMIN_USUARIO,
  usuarioPodeEditar,
  camposAtualizaveisUsuario,
  validarPermissaoEdicaoUsuario,
  validarPerfilUsuario,
  montarAtualizacaoUsuario,
  validarDesativacaoUsuario,
  erroUsuarioDuplicado,
} = require('../../src/services/usuario.workflow');

describe('usuario.workflow', () => {
  describe('politica de senha', () => {
    it('expoe limites e regra de espacos', () => {
      expect(SENHA_MIN).toBe(8);
      expect(SENHA_MAX).toBe(100);
      expect(SENHA_REGEX.test('SenhaForte123')).toBe(true);
      expect(SENHA_REGEX.test('senha com espaco')).toBe(false);
    });
  });

  describe('edicao de usuario', () => {
    it('permite admin editar qualquer usuario e usuario comum editar apenas a si mesmo', () => {
      expect(usuarioPodeEditar({ id: 'admin-1', perfil: 'admin' }, 'user-1')).toBe(true);
      expect(usuarioPodeEditar({ id: 'user-1', perfil: 'comprador' }, 'user-1')).toBe(true);
      expect(usuarioPodeEditar({ id: 'user-1', perfil: 'comprador' }, 'user-2')).toBe(false);
    });

    it('bloqueia edicao de outro usuario sem perfil admin', () => {
      expect(() => validarPermissaoEdicaoUsuario({ id: 'user-1', perfil: 'comprador' }, 'user-2')).toThrow('Sem permissao');
    });

    it('separa campos atualizaveis por escopo', () => {
      expect(camposAtualizaveisUsuario(false)).toEqual(CAMPOS_PROPRIOS_USUARIO);
      expect(camposAtualizaveisUsuario(true)).toEqual(CAMPOS_ADMIN_USUARIO);
      expect(CAMPOS_PROPRIOS_USUARIO).toEqual(['nome']);
      expect(CAMPOS_ADMIN_USUARIO).toEqual(expect.arrayContaining(['nome', 'username', 'perfil', 'ativo']));
    });

    it('monta atualizacao de usuario comum ignorando perfil e ativo', () => {
      const atualizacao = montarAtualizacaoUsuario({
        nome: 'Usuario QA',
        perfil: 'admin',
        ativo: false,
      }, { id: 'user-1', perfil: 'comprador' });

      expect(atualizacao.fields).toEqual(['nome = $1']);
      expect(atualizacao.values).toEqual(['Usuario QA']);
      expect(atualizacao.nextIndex).toBe(2);
    });

    it('monta atualizacao admin com campos administrativos', () => {
      const atualizacao = montarAtualizacaoUsuario({
        nome: 'Usuario QA',
        username: 'usuario.qa',
        perfil: 'comprador',
        ativo: true,
      }, { id: 'admin-1', perfil: 'admin' });

      expect(atualizacao.fields).toEqual(['nome = $1', 'username = $2', 'perfil = $3', 'ativo = $4']);
      expect(atualizacao.values).toEqual(['Usuario QA', 'usuario.qa', 'comprador', true]);
      expect(atualizacao.nextIndex).toBe(5);
    });

    it('valida perfil informado por admin', () => {
      expect(() => validarPerfilUsuario('perfil_inexistente')).toThrow('Perfil invalido');
      expect(() => validarPerfilUsuario('comprador')).not.toThrow();
      expect(() => validarPerfilUsuario(undefined)).not.toThrow();
    });
  });

  describe('desativacao e conflitos', () => {
    it('impede autodesativacao', () => {
      expect(() => validarDesativacaoUsuario({ id: 'user-1' }, 'user-1')).toThrow('desativar');
    });

    it('traduz duplicidade conhecida para conflito operacional', () => {
      const erro = erroUsuarioDuplicado({ code: '23505' }, 'Username ja existe');
      expect(erro.statusCode).toBe(409);
      expect(erro.code).toBe('CONFLICT');
      expect(erro.message).toBe('Username ja existe');
      expect(erroUsuarioDuplicado({ code: '42P01' }, 'x')).toBeNull();
    });
  });
});
