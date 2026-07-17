-- Migration 025: Fix schema movimentacoes — adicionar coluna status
-- Corrige bug identificado na auditoria: relatorios.js referencia m.status
-- que não existia na migration 001
-- Data: 2026-07-17

-- ─── Adicionar coluna status em movimentacoes ─────────────────────────────────
ALTER TABLE movimentacoes
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'EXECUTADO'
    CHECK (status IN ('EXECUTADO', 'PENDENTE', 'CANCELADO'));

-- Retroativamente marcar todas as movimentações existentes como EXECUTADO
UPDATE movimentacoes SET status = 'EXECUTADO' WHERE status IS NULL OR status = '';

-- Índice para queries por status (usado em relatórios e aprovações)
CREATE INDEX IF NOT EXISTS idx_movimentacoes_status ON movimentacoes(status, criado_em DESC);

-- ─── Adicionar campos extras em kanban_parametros ─────────────────────────────
-- Para que o admin possa editar parâmetros kanban diretamente
ALTER TABLE kanban_parametros
  ADD COLUMN IF NOT EXISTS editado_manualmente BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS editado_por UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ;

-- ─── Índice para buscas por categoria ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geo_mfa_tentativas_ip ON geo_mfa_tentativas(ip, criado_em DESC);
