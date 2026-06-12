-- Permissao configuravel para a tela de grafo de relacionamentos.

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  (
    'permissoes.paginas.grafo',
    'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
    'Cargos com acesso a pagina Grafo de relacionamentos',
    'permissoes'
  )
ON CONFLICT (chave) DO NOTHING;
