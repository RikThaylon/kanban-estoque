-- Up Migration
CREATE TABLE bom_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  child_item_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantity_required DECIMAL(12,4) NOT NULL CHECK (quantity_required > 0),
  lead_time_days INTEGER DEFAULT 0 CHECK (lead_time_days >= 0),
  notes TEXT,
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bom_structures_parent_child_unique UNIQUE (parent_item_id, child_item_id),
  CONSTRAINT bom_structures_prevent_self_reference CHECK (parent_item_id != child_item_id)
);

CREATE INDEX idx_bom_structures_parent ON bom_structures(parent_item_id);
CREATE INDEX idx_bom_structures_child ON bom_structures(child_item_id);

COMMENT ON TABLE bom_structures IS 'Bill of Materials (Estrutura de Materiais) - Relacionamento entre produtos para produção';

-- Trigger para atualização de updated_at
-- (Assumindo que a trigger set_updated_at já existe no banco de outras migrações, vamos criá-la caso contrário ou usar direto)
-- Caso não exista, é feita no node ou a migration seria maior. Usaremos a abordagem padrão do projeto.

-- Down Migration
-- DROP TABLE IF EXISTS bom_structures;
