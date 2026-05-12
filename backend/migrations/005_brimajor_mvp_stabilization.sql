-- BRIMAJOR - MVP stabilization
-- Fixes approval statuses, supplier audit metadata, and prepares RACI/action foundations.

-- 1. Allow third approval level used by backend workflow.
ALTER TABLE pedidos_compra
  DROP CONSTRAINT IF EXISTS pedidos_compra_status_check;

ALTER TABLE pedidos_compra
  ADD CONSTRAINT pedidos_compra_status_check CHECK (status IN (
    'RASCUNHO',
    'AGUARDANDO_APROVACAO',
    'AGUARDANDO_GERENTE',
    'AGUARDANDO_DIRETORIA',
    'APROVADO',
    'EMITIDO',
    'EM_TRANSITO',
    'RECEBIDO_PARCIAL',
    'RECEBIDO',
    'CANCELADO',
    'REJEITADO'
  ));

CREATE INDEX IF NOT EXISTS idx_pedidos_status_aprovacao
  ON pedidos_compra(status, criado_em DESC)
  WHERE status IN ('AGUARDANDO_APROVACAO','AGUARDANDO_GERENTE','AGUARDANDO_DIRETORIA');

-- 2. Align fornecedores route with schema.
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- 3. Foundations for future RACI actionable workflow.
CREATE TABLE IF NOT EXISTS ocorrencias_raci (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_problema VARCHAR(80) NOT NULL,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  pedido_id UUID REFERENCES pedidos_compra(id) ON DELETE SET NULL,
  movimentacao_id UUID REFERENCES movimentacoes(id) ON DELETE SET NULL,
  alerta_id UUID REFERENCES alertas(id) ON DELETE SET NULL,
  responsavel_perfil VARCHAR(30),
  aprovador_perfil VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','EM_ANDAMENTO','AGUARDANDO_APROVACAO','CONCLUIDA','CANCELADA')),
  severidade VARCHAR(10) DEFAULT 'AVISO' CHECK (severidade IN ('INFO','AVISO','CRITICO')),
  prazo TIMESTAMPTZ,
  descricao TEXT,
  evidencia TEXT,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  concluido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_raci_status ON ocorrencias_raci(status, severidade, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_raci_produto ON ocorrencias_raci(produto_id, status);
