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

-- ── 5. Seed inicial de departamentos e máquinas (mockados) ──
INSERT INTO departamentos (id, codigo, nome, descricao) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'PROD-A', 'Produção - Linha A', 'Linha de montagem hidráulica'),
  ('d0000000-0000-0000-0000-000000000002', 'PROD-B', 'Produção - Linha B', 'Linha de montagem mecânica'),
  ('d0000000-0000-0000-0000-000000000003', 'MANUT',  'Manutenção',         'Equipe de manutenção corretiva e preventiva')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO maquinas (id, codigo, nome, departamento_id, localizacao) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'MQ-001', 'Prensa Hidráulica 200T', 'd0000000-0000-0000-0000-000000000001', 'Galpão A - Setor 1'),
  ('e0000000-0000-0000-0000-000000000002', 'MQ-002', 'Torno CNC',              'd0000000-0000-0000-0000-000000000002', 'Galpão B - Setor 1'),
  ('e0000000-0000-0000-0000-000000000003', 'MQ-003', 'Centro de Usinagem',     'd0000000-0000-0000-0000-000000000002', 'Galpão B - Setor 2'),
  ('e0000000-0000-0000-0000-000000000004', 'MQ-004', 'Compressor Industrial',  'd0000000-0000-0000-0000-000000000003', 'Casa de Máquinas')
ON CONFLICT (codigo) DO NOTHING;

-- Vincula alguns produtos do seed às máquinas (mockado)
INSERT INTO maquina_produto (maquina_id, produto_id, consumo_estimado_diario) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 2.0),  -- prensa usa válvula VH-200
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 1.0),  -- e mangueira MG-250
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 3.0),  -- torno usa rolamento RL-150
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000005', 10.0), -- e parafuso PF-100
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', 8.0),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 5.0),  -- compressor usa cabo CB-500
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000008', 0.5)   -- e disjuntor DJ-600
ON CONFLICT DO NOTHING;
