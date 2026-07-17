-- Migration 026: Geo MFA Safety Constraints
-- Problema: geo_mfa_config permite ativo=true com lat/lon nulos (configuração incompleta)
--           e não tem unicidade, podendo acumular linhas duplicadas.
-- Data: 2026-07-17
-- Autor: Antigravity (Staff Engineer Audit)

-- 1. Remover linhas duplicadas mantendo apenas a mais recente
DELETE FROM geo_mfa_config
WHERE id NOT IN (
  SELECT id
  FROM geo_mfa_config
  ORDER BY atualizado_em DESC
  LIMIT 1
);

-- 2. Adicionar CHECK: só permite ativo=true se lat e lon estiverem definidos
--    Isso força o admin a configurar as coordenadas ANTES de ativar o Geo MFA
ALTER TABLE geo_mfa_config
  DROP CONSTRAINT IF EXISTS chk_geo_mfa_coords_required,
  ADD CONSTRAINT chk_geo_mfa_coords_required
    CHECK (
      ativo = false
      OR (ativo = true AND latitude IS NOT NULL AND longitude IS NOT NULL)
    );

-- 3. Garantir que existe exatamente 1 linha de configuração (singleton pattern)
--    Usando uma coluna guard com valor fixo e restrição de unicidade
ALTER TABLE geo_mfa_config
  ADD COLUMN IF NOT EXISTS singleton_guard BOOLEAN DEFAULT true CHECK (singleton_guard = true);

ALTER TABLE geo_mfa_config
  DROP CONSTRAINT IF EXISTS geo_mfa_config_singleton_unique;

ALTER TABLE geo_mfa_config
  ADD CONSTRAINT geo_mfa_config_singleton_unique UNIQUE (singleton_guard);

-- 4. Garantir que há ao menos 1 linha (caso a tabela esteja vazia após cleanup)
INSERT INTO geo_mfa_config (ativo) VALUES (false)
ON CONFLICT (singleton_guard) DO NOTHING;
