-- Turnos operacionais configuraveis.

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  (
    'turnos.lista',
    '[{"id":"1T","nome":"1T","inicio":"06:00","fim":"14:00"},{"id":"2T","nome":"2T","inicio":"14:01","fim":"22:00"},{"id":"3T","nome":"3T","inicio":"22:01","fim":"05:59"}]',
    'Turnos operacionais usados nas movimentacoes de estoque',
    'turnos'
  )
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE movimentacoes
  DROP CONSTRAINT IF EXISTS movimentacoes_turno_check;

ALTER TABLE movimentacoes
  ADD CONSTRAINT movimentacoes_turno_check
  CHECK (turno IS NULL OR turno ~ '^[A-Za-z0-9_-]{1,20}$');
