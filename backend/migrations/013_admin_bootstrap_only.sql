-- Primeiro acesso: somente o perfil admin fica ativo.
-- O admin inicial cria/ativa os demais usuarios conforme a implantacao.

DELETE FROM refresh_tokens;

UPDATE usuarios
SET ativo = false,
    atualizado_em = NOW()
WHERE perfil <> 'admin';

INSERT INTO usuarios (id, nome, username, senha_hash, perfil, ativo)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Administrador',
  'admin',
  '$2b$12$o68hhAjwRwrcCSej64eBZ.rv7W8w1s/yWgSua738gNVg4jWlXEJ12',
  'admin',
  true
)
ON CONFLICT (username) DO UPDATE SET
  nome = EXCLUDED.nome,
  perfil = 'admin',
  ativo = true,
  senha_hash = CASE
    WHEN usuarios.senha_hash IS NULL OR usuarios.senha_hash = '' THEN EXCLUDED.senha_hash
    ELSE usuarios.senha_hash
  END,
  atualizado_em = NOW();
