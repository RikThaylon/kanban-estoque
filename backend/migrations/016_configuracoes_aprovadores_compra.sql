-- Cargos que podem liberar internamente uma solicitacao antes da OC externa.
-- O admin e sempre implicito pela regra de negocio e nao precisa ser salvo aqui.

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('pedidos.aprovadores_nivel_1', 'supervisor_turno,gerente_operacoes,plant_manager', 'Cargos que podem aprovar internamente pedidos N1 antes do comprador registrar a OC externa', 'pedidos'),
  ('pedidos.aprovadores_nivel_2', 'gerente_operacoes,plant_manager', 'Cargos que podem aprovar internamente pedidos N2 antes do comprador registrar a OC externa', 'pedidos'),
  ('pedidos.aprovadores_nivel_3', 'plant_manager', 'Cargos que podem aprovar internamente pedidos N3 antes do comprador registrar a OC externa', 'pedidos')
ON CONFLICT (chave) DO NOTHING;
