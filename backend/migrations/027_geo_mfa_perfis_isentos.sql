-- Migration 027: Perfis Isentos do Geo MFA
-- Permite que o admin configure quais perfis/cargos ficam isentos da verificação geográfica.
-- Data: 2026-07-17
-- Autor: Antigravity (Staff Engineer Audit)

ALTER TABLE geo_mfa_config
  ADD COLUMN IF NOT EXISTS perfis_isentos JSONB NOT NULL DEFAULT '["admin"]'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN geo_mfa_config.perfis_isentos IS
  'Array JSON com os perfis isentos do Geo MFA. Ex: ["admin","supervisor_turno"]. '
  'Usuários com estes perfis passam direto pelo login sem verificação geográfica.';
