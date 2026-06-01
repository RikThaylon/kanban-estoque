-- KANBAN ESTOQUE — Migration 004
-- Departamentos, Máquinas (N:N com produtos), e ajustes em pedidos_compra

-- ── 1. Departamentos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(30) UNIQUE NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  -- Supervisor de turno responsável pelo departamento
  supervisor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_supervisor ON departamentos(supervisor_id);

-- ── 2. Máquinas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maquinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(30) UNIQUE NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  departamento_id UUID REFERENCES departamentos(id) ON DELETE SET NULL,
  localizacao VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maq_dept ON maquinas(departamento_id);

-- ── 3. Vínculo N:N máquina ↔ produto ────────────────────────
-- Mesmo produto pode ser usado em várias máquinas; mesma máquina usa vários produtos
CREATE TABLE IF NOT EXISTS maquina_produto (
  maquina_id UUID NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  consumo_estimado_diario DECIMAL(12,4) DEFAULT 0,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (maquina_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_maqprod_produto ON maquina_produto(produto_id);

-- ── 4. Ajustes em pedidos_compra ────────────────────────────
-- Status REJEITADO + AGUARDANDO_GERENTE separados para escalation por valor
ALTER TABLE pedidos_compra
  DROP CONSTRAINT IF EXISTS pedidos_compra_status_check;

ALTER TABLE pedidos_compra
  ADD CONSTRAINT pedidos_compra_status_check CHECK (status IN (
    'RASCUNHO',
    'AGUARDANDO_APROVACAO',     -- aguardando supervisor de turno
    'AGUARDANDO_GERENTE',       -- escalado para gerente de operações (valor > limite)
    'AGUARDANDO_DIRETORIA',      -- escalado para diretoria
    'APROVADO',
    'EMITIDO',
    'EM_TRANSITO',
    'RECEBIDO_PARCIAL',
    'RECEBIDO',
    'CANCELADO',
    'REJEITADO'
  ));

ALTER TABLE pedidos_compra
  ADD COLUMN IF NOT EXISTS departamento_id UUID REFERENCES departamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejeitado_por UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS rejeitado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT,
  ADD COLUMN IF NOT EXISTS escalado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pedidos_dept ON pedidos_compra(departamento_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_aguardando
  ON pedidos_compra(status) WHERE status IN ('AGUARDANDO_APROVACAO','AGUARDANDO_GERENTE','AGUARDANDO_DIRETORIA');

-- Dados operacionais nao sao populados por migrations.
-- Departamentos, maquinas e vinculos devem ser cadastrados pelo usuario real.
