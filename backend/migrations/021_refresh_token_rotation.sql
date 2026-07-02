-- KANBAN ESTOQUE — Migration 021: Refresh Token Rotation

-- Remove tokens antigos, pois o algoritmo de hashing vai mudar para SHA-256 e precisamos garantir unicidade
TRUNCATE TABLE refresh_tokens;

ALTER TABLE refresh_tokens 
  ADD COLUMN IF NOT EXISTS family_id UUID,
  ADD COLUMN IF NOT EXISTS absolute_ttl TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replaced_by_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Ajusta constraint de unicidade no token_hash
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);

-- Cria índices
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
