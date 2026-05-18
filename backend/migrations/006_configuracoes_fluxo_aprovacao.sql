-- Configuracoes do fluxo de aprovacao de pedidos

CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  chave VARCHAR(120) PRIMARY KEY,
  valor TEXT NOT NULL,
  descricao TEXT,
  categoria VARCHAR(60) NOT NULL DEFAULT 'geral',
  atualizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('pedidos.limite_supervisor', '5000', 'Valor a partir do qual o pedido pula aprovacao do supervisor e vai para gerente de operacoes', 'pedidos'),
  ('pedidos.limite_gerente', '50000', 'Valor a partir do qual o pedido aprovado pelo gerente escala para diretoria/plant manager', 'pedidos')
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE pedidos_compra
  ADD COLUMN IF NOT EXISTS maquina_id UUID REFERENCES maquinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovador_n1_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_maquina ON pedidos_compra(maquina_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_aprovador_n1 ON pedidos_compra(aprovador_n1_id, status);
