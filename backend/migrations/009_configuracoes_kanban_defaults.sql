-- Defaults administrativos do Kanban e hardening da tabela de configuracoes.

ALTER TABLE configuracoes_sistema
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(60) NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS atualizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('kanban.nivel_servico_padrao', '95', 'Nivel de servico padrao usado no cadastro de novos produtos', 'kanban'),
  ('kanban.ciclos_estimativa_inicial', '10', 'Quantidade de ciclos sinteticos usados para iniciar Holt e regressao a partir de CMD/LT estimados', 'kanban')
ON CONFLICT (chave) DO NOTHING;
