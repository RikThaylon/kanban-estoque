-- Migration 029: Tabela de Metas Mensais de Gastos
CREATE TABLE IF NOT EXISTS metas_gastos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes VARCHAR(7) UNIQUE NOT NULL, -- Formato 'YYYY-MM'
  meta_valor DECIMAL(12,2) NOT NULL CHECK (meta_valor >= 0),
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE metas_gastos_mensais IS 'Armazena a meta teto de gastos configurada por mês (ano_mes ex: 2026-07).';
