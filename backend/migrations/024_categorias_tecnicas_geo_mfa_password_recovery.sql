-- Migration 024: Categorias Técnicas + Geo MFA + Password Recovery Corporativo
-- Data: 2026-07-17
-- Autor: Antigravity (Staff Engineer Audit)

-- ─── 1. Categorias Técnicas Padrão ───────────────────────────────────────────
-- Garante que as categorias solicitadas existam com cores distintas
INSERT INTO categorias (id, nome, descricao, cor_hex) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Elétrica',        'Materiais e componentes elétricos', 'F59E0B'),
  ('00000000-0000-0000-0001-000000000002', 'Mecânica',        'Peças e componentes mecânicos',    '3B82F6'),
  ('00000000-0000-0000-0001-000000000003', 'Hidráulica',      'Componentes hidráulicos',          '06B6D4'),
  ('00000000-0000-0000-0001-000000000004', 'Pneumática',      'Componentes pneumáticos',          '8B5CF6'),
  ('00000000-0000-0000-0001-000000000005', 'Instrumentação',  'Instrumentos e sensores',          'EC4899'),
  ('00000000-0000-0000-0001-000000000006', 'Automação',       'Componentes de automação',         '14B8A6'),
  ('00000000-0000-0000-0001-000000000007', 'Ferramentaria',   'Ferramentas e acessórios',         'F97316'),
  ('00000000-0000-0000-0001-000000000008', 'Consumíveis',     'Materiais de consumo geral',       '84CC16'),
  ('00000000-0000-0000-0001-000000000009', 'Segurança',       'EPIs e equipamentos de segurança', 'EF4444'),
  ('00000000-0000-0000-0001-000000000010', 'Produção',        'Insumos de produção',              '10B981'),
  ('00000000-0000-0000-0001-000000000011', 'Almoxarifado',    'Itens gerais de almoxarifado',    '6366F1'),
  ('00000000-0000-0000-0001-000000000012', 'Outros',          'Demais itens sem categoria específica', 'CBD5E1')
ON CONFLICT (id) DO NOTHING;

-- Migrar produtos sem categoria para "Outros"
UPDATE produtos SET categoria_id = '00000000-0000-0000-0001-000000000012'
WHERE categoria_id IS NULL;

-- ─── 2. Campos adicionais em fornecedores ────────────────────────────────────
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES usuarios(id);

-- ─── 3. Campos adicionais em produtos (admin editar tudo) ────────────────────
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS sku VARCHAR(80),
  ADD COLUMN IF NOT EXISTS estoque_minimo DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS estoque_maximo DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS ponto_reposicao_manual DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS lead_time_padrao_dias INTEGER,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ─── 4. Geo MFA Config ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo_mfa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo BOOLEAN DEFAULT false,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  raio_metros INTEGER DEFAULT 1000 CHECK (raio_metros > 0),
  descricao VARCHAR(200),
  configurado_por UUID REFERENCES usuarios(id),
  configurado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração padrão (desabilitada)
INSERT INTO geo_mfa_config (ativo) VALUES (false)
ON CONFLICT DO NOTHING;

-- ─── 5. Geo MFA Tentativas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo_mfa_tentativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  username VARCHAR(60),
  ip INET,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  distancia_metros INTEGER,
  raio_configurado INTEGER,
  status VARCHAR(20) CHECK (status IN ('PERMITIDO', 'BLOQUEADO', 'SEM_LOCALIZACAO', 'MFA_DESABILITADO')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_mfa_tentativas_usuario ON geo_mfa_tentativas(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_geo_mfa_tentativas_status ON geo_mfa_tentativas(status, criado_em DESC);

-- ─── 6. Password Recovery Corporativo ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO', 'USADO', 'EXPIRADO')),
  token_hash VARCHAR(255),           -- SHA-256 do token temporário (preenchido ao aprovar)
  expira_em TIMESTAMPTZ,             -- 2h após aprovação
  motivo_rejeicao TEXT,
  aprovado_por UUID REFERENCES usuarios(id),
  aprovado_em TIMESTAMPTZ,
  usado_em TIMESTAMPTZ,
  ip_solicitante INET,
  ip_redefinicao INET,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prr_usuario ON password_reset_requests(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_prr_status ON password_reset_requests(status, criado_em DESC);

-- ─── 7. Histórico de Senhas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_usuario ON password_history(usuario_id, criado_em DESC);

-- ─── 8. Auditoria de Segurança Adicional ─────────────────────────────────────
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS detalhes JSONB,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;
