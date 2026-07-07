-- Up Migration
CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')),
  machine_id UUID NOT NULL REFERENCES maquinas(id),
  department_id UUID NOT NULL REFERENCES departamentos(id),
  supervisor_id UUID REFERENCES usuarios(id),
  technician_id UUID REFERENCES usuarios(id),
  notes TEXT,
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES produtos(id),
  quantity DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
  cost DECIMAL(12,4) DEFAULT 0,
  notes TEXT,
  added_by UUID REFERENCES usuarios(id),
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_machine ON service_orders(machine_id);

COMMENT ON TABLE service_orders IS 'Ordens de Serviço para manutenção de máquinas';
COMMENT ON TABLE service_order_materials IS 'Materiais MRO consumidos em uma Ordem de Serviço';

-- Down Migration
-- DROP TABLE IF EXISTS service_order_materials;
-- DROP TABLE IF EXISTS service_orders;
