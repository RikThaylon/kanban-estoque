-- Redesenho do fluxo de compra:
-- solicitacao -> aprovacao supervisor -> gerente se exceder teto -> OC externa -> aguardando chegada -> NF/conclusao.

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('pedidos.solicitantes', 'facilitador,comprador', 'Cargos que podem abrir solicitacoes de compra', 'pedidos'),
  ('pedidos.compradores', 'comprador', 'Cargos que podem registrar fornecedor e numero da OC externa apos aprovacao interna', 'pedidos'),
  ('pedidos.recebedores', 'comprador,facilitador', 'Cargos que podem registrar NF e concluir o recebimento do pedido', 'pedidos')
ON CONFLICT (chave) DO NOTHING;

UPDATE configuracoes_sistema
SET valor = 'supervisor_turno'
WHERE chave = 'pedidos.aprovadores_nivel_1'
  AND valor = 'supervisor_turno,gerente_operacoes,plant_manager';

UPDATE configuracoes_sistema
SET valor = 'gerente_operacoes'
WHERE chave = 'pedidos.aprovadores_nivel_2'
  AND valor = 'gerente_operacoes,plant_manager';

ALTER TABLE pedidos_compra
  DROP CONSTRAINT IF EXISTS pedidos_compra_status_check;

UPDATE pedidos_compra SET status = 'AGUARDANDO_CHEGADA' WHERE status = 'EMITIDO';
UPDATE pedidos_compra SET status = 'CONCLUIDO' WHERE status = 'RECEBIDO';

ALTER TABLE pedidos_compra
  ADD CONSTRAINT pedidos_compra_status_check CHECK (status IN (
    'RASCUNHO',
    'AGUARDANDO_APROVACAO',
    'AGUARDANDO_GERENTE',
    'AGUARDANDO_DIRETORIA',
    'APROVADO',
    'AGUARDANDO_CHEGADA',
    'EMITIDO',
    'EM_TRANSITO',
    'RECEBIDO_PARCIAL',
    'CONCLUIDO',
    'RECEBIDO',
    'CANCELADO',
    'REJEITADO'
  ));

CREATE INDEX IF NOT EXISTS idx_pedidos_aguardando_chegada
  ON pedidos_compra(status, data_prevista)
  WHERE status IN ('AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO');
