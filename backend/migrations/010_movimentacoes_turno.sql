-- Turno operacional nas movimentacoes de estoque.

ALTER TABLE movimentacoes
  ADD COLUMN IF NOT EXISTS turno VARCHAR(20)
    CHECK (turno IN ('TURNO_A', 'TURNO_B', 'TURNO_C', 'ADMINISTRATIVO'));

CREATE INDEX IF NOT EXISTS idx_movimentacoes_turno_data
  ON movimentacoes(turno, criado_em DESC);
