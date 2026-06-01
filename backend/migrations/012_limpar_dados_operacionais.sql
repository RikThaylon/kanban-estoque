-- Limpa dados operacionais/mockados mantendo somente schema e configuracoes do sistema.
-- Esta migration deixa o banco estruturado, porem sem cadastros, historico ou estoque.

DELETE FROM refresh_tokens;
DELETE FROM audit_log;
DELETE FROM ocorrencias_raci;
DELETE FROM alertas;
DELETE FROM pedidos_compra;
DELETE FROM movimentacoes;
DELETE FROM maquina_produto;
DELETE FROM produto_fornecedor;
DELETE FROM kanban_parametros;
DELETE FROM maquinas;
DELETE FROM departamentos;
DELETE FROM produtos;
DELETE FROM fornecedores;
DELETE FROM categorias;
DELETE FROM usuarios;

UPDATE configuracoes_sistema
SET atualizado_por = NULL;
