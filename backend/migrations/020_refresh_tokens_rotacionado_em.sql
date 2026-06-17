-- KANBAN ESTOQUE — Migration 020: Grace Period para Refresh Tokens
-- Adiciona a coluna rotacionado_em para permitir o padrão de "Token Reuse Detection with Grace Period"

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotacionado_em TIMESTAMPTZ;

-- Índices adicionais para otimizar a busca de tokens ativos ou recentemente rotacionados
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
