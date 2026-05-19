-- Cargo visualizador e permissao configuravel de acesso por pagina.

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_perfil_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_perfil_check CHECK (perfil IN (
    'admin',
    'plant_manager',
    'gerente_engenharia',
    'eng_processos',
    'eng_producao',
    'gerente_operacoes',
    'supervisor_turno',
    'comprador',
    'facilitador',
    'visualizador'
  ));

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('permissoes.paginas.dashboard', 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador', 'Cargos com acesso a pagina Dashboard', 'permissoes'),
  ('permissoes.paginas.produtos', 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador', 'Cargos com acesso a pagina Produtos', 'permissoes'),
  ('permissoes.paginas.movimentacoes', 'admin,gerente_operacoes,supervisor_turno,comprador,facilitador', 'Cargos com acesso a pagina Movimentacoes', 'permissoes'),
  ('permissoes.paginas.pedidos', 'admin,gerente_operacoes,supervisor_turno,comprador,facilitador', 'Cargos com acesso a pagina Pedidos', 'permissoes'),
  ('permissoes.paginas.fornecedores', 'admin,comprador', 'Cargos com acesso a pagina Fornecedores', 'permissoes'),
  ('permissoes.paginas.configuracoes', 'admin', 'Cargos com acesso a pagina Configuracoes', 'permissoes'),
  ('permissoes.paginas.maquinas', 'admin,gerente_operacoes,supervisor_turno,eng_producao', 'Cargos com acesso a pagina Maquinas', 'permissoes'),
  ('permissoes.paginas.alertas', 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador', 'Cargos com acesso a pagina Alertas', 'permissoes'),
  ('permissoes.paginas.raci', 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador', 'Cargos com acesso a pagina RACI', 'permissoes'),
  ('permissoes.paginas.relatorios', 'admin,gerente_operacoes,gerente_engenharia,plant_manager,comprador,visualizador', 'Cargos com acesso a pagina Relatorios', 'permissoes'),
  ('permissoes.paginas.usuarios', 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes', 'Cargos com acesso a pagina Usuarios', 'permissoes')
ON CONFLICT (chave) DO NOTHING;
