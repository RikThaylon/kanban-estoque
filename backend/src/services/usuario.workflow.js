const { AppError } = require('../utils/errors');
const { PERFIS_VALIDOS } = require('../middleware/rbac');

const SENHA_MIN = 8;
const SENHA_MAX = 100;
const SENHA_REGEX = /^\S+$/;
const CAMPOS_PROPRIOS_USUARIO = ['nome'];
const CAMPOS_ADMIN_USUARIO = ['nome', 'username', 'perfil', 'ativo'];

function usuarioPodeEditar(usuario, usuarioIdAlvo) {
  return usuario?.perfil === 'admin' || usuario?.id === usuarioIdAlvo;
}

function camposAtualizaveisUsuario(isAdmin) {
  return isAdmin ? CAMPOS_ADMIN_USUARIO : CAMPOS_PROPRIOS_USUARIO;
}

function validarPermissaoEdicaoUsuario(usuario, usuarioIdAlvo) {
  if (!usuarioPodeEditar(usuario, usuarioIdAlvo)) {
    throw new AppError('Sem permissao', 403, 'FORBIDDEN');
  }
}

function validarPerfilUsuario(perfil) {
  if (perfil !== undefined && !PERFIS_VALIDOS.includes(perfil)) {
    throw new AppError('Perfil invalido', 400, 'VALIDATION_ERROR');
  }
}

function montarAtualizacaoUsuario(payload, usuario) {
  const isAdmin = usuario?.perfil === 'admin';
  if (isAdmin) validarPerfilUsuario(payload.perfil);

  const fields = [];
  const values = [];
  let idx = 1;

  for (const campo of camposAtualizaveisUsuario(isAdmin)) {
    if (payload[campo] !== undefined) {
      fields.push(`${campo} = $${idx++}`);
      values.push(payload[campo]);
    }
  }

  return { fields, values, nextIndex: idx };
}

function validarDesativacaoUsuario(usuario, usuarioIdAlvo) {
  if (usuario?.id === usuarioIdAlvo) {
    throw new AppError('Voce nao pode desativar seu proprio usuario', 400, 'VALIDATION_ERROR');
  }
}

function erroUsuarioDuplicado(err, message) {
  if (err.code !== '23505') return null;
  return new AppError(message, 409, 'CONFLICT');
}

module.exports = {
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
};
