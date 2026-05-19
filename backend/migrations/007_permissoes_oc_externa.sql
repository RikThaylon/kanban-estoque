-- Permissoes operacionais e registro da OC emitida em sistema externo.

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('permissoes.cadastrar_item', 'comprador', 'Cargos autorizados pelo admin a cadastrar itens; admin sempre possui acesso total', 'permissoes'),
  ('permissoes.editar_curva_abc', 'eng_producao', 'Cargos autorizados pelo admin a alterar manualmente a curva ABC; admin sempre possui acesso total', 'permissoes')
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE pedidos_compra
  ALTER COLUMN fornecedor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS numero_oc_externa VARCHAR(80),
  ADD COLUMN IF NOT EXISTS fornecedor_escolhido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fornecedor_escolhido_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pedidos_numero_oc_externa ON pedidos_compra(numero_oc_externa);
