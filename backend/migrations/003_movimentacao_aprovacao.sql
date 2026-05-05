-- KANBAN ESTOQUE — Migration 003
-- Adiciona fluxo de aprovação para movimentações de estoque
-- ENTRADA/SAIDA → executam direto (status=EXECUTADO)
-- AJUSTE/TRANSFERENCIA/DEVOLUCAO → ficam PENDENTE até supervisor_turno aprovar

-- 1) Desabilita o trigger antigo (vamos controlar atualização de estoque no código)
DROP TRIGGER IF EXISTS trg_atualiza_estoque ON movimentacoes;

-- 2) Adiciona colunas de aprovação
ALTER TABLE movimentacoes
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'EXECUTADO'
    CHECK (status IN ('PENDENTE', 'APROVADO', 'EXECUTADO', 'REJEITADO')),
  ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejeitado_por UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS rejeitado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

-- 3) Index para listagem de pendências
CREATE INDEX IF NOT EXISTS idx_movimentacoes_status_pendentes
  ON movimentacoes(status, criado_em DESC) WHERE status = 'PENDENTE';
