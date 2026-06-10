-- Default administrativo do custo para manter estoque usado em novos produtos.

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('kanban.taxa_carregamento_padrao', '0.2', 'Taxa anual padrao do custo para manter estoque usada no calculo EOQ de novos produtos', 'kanban')
ON CONFLICT (chave) DO NOTHING;
