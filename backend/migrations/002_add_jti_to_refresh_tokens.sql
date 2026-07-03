-- Migration: Add JTI column to refresh_tokens for token rotation tracking
-- Date: 2026-07-02
-- Related commit: 8ff03dca1e3573d3287b8e7cd96a811acb2bf064

ALTER TABLE refresh_tokens
ADD COLUMN jti VARCHAR(255) UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens(jti);

-- Add comment for documentation
COMMENT ON COLUMN refresh_tokens.jti IS 'JWT ID (jti) claim for token rotation and revocation tracking';
