-- Pedidos de compra nao devem ficar parados como rascunho no fluxo operacional.
-- Rascunhos existentes sao reencaminhados para a primeira fila acionavel.

UPDATE pedidos_compra
SET
  status = CASE
    WHEN criado_por IS NOT NULL
      AND aprovador_n1_id IS NOT NULL
      AND criado_por = aprovador_n1_id
    THEN 'AGUARDANDO_GERENTE'
    ELSE 'AGUARDANDO_APROVACAO'
  END,
  escalado_em = CASE
    WHEN criado_por IS NOT NULL
      AND aprovador_n1_id IS NOT NULL
      AND criado_por = aprovador_n1_id
    THEN COALESCE(escalado_em, NOW())
    ELSE escalado_em
  END,
  atualizado_em = NOW()
WHERE status = 'RASCUNHO';
