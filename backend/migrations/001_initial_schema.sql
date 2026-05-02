-- KANBAN ESTOQUE — SCHEMA COMPLETO (Migration 001)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL,
  username VARCHAR(60) UNIQUE NOT NULL,
  email VARCHAR(255),
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(30) NOT NULL CHECK (perfil IN (
    'admin',
    'plant_manager',
    'gerente_engenharia',
    'eng_processos',
    'eng_producao',
    'gerente_operacoes',
    'supervisor_turno',
    'comprador',
    'facilitador'
  )),
  ativo BOOLEAN DEFAULT true,
  ultimo_login TIMESTAMPTZ,
  tentativas_login INTEGER DEFAULT 0,
  bloqueado_ate TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  revogado BOOLEAN DEFAULT false,
  ip_origem INET,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  acao VARCHAR(80) NOT NULL,
  tabela VARCHAR(60),
  registro_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  ip INET,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  contato_nome VARCHAR(120),
  contato_email VARCHAR(255),
  contato_telefone VARCHAR(20),
  cidade VARCHAR(100),
  estado CHAR(2),
  modal_padrao VARCHAR(20) CHECK (modal_padrao IN ('rodoviario','aereo','maritimo','ferroviario','expresso')),
  prazo_pagamento_dias INTEGER DEFAULT 30,
  avaliacao DECIMAL(3,2) CHECK (avaliacao BETWEEN 0 AND 5),
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  cor_hex CHAR(6) DEFAULT 'CBD5E1'
);

CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  unidade VARCHAR(20) NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  custo_unitario DECIMAL(12,4) NOT NULL CHECK (custo_unitario >= 0),
  custo_pedido DECIMAL(10,2) NOT NULL DEFAULT 100 CHECK (custo_pedido >= 0),
  taxa_carregamento DECIMAL(5,4) DEFAULT 0.2000 CHECK (taxa_carregamento BETWEEN 0 AND 1),
  nivel_servico INTEGER DEFAULT 95 CHECK (nivel_servico IN (90, 95, 98, 99)),
  estoque_atual DECIMAL(12,4) DEFAULT 0,
  localizacao VARCHAR(50),
  classificacao_abc CHAR(1) CHECK (classificacao_abc IN ('A','B','C')),
  ativo BOOLEAN DEFAULT true,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE produto_fornecedor (
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE CASCADE,
  prioridade INTEGER DEFAULT 1,
  preco_acordado DECIMAL(12,4),
  lead_time_nominal_dias INTEGER,
  ativo BOOLEAN DEFAULT true,
  PRIMARY KEY (produto_id, fornecedor_id)
);

CREATE TABLE kanban_parametros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID UNIQUE REFERENCES produtos(id) ON DELETE CASCADE,
  demanda_diaria_media DECIMAL(12,4),
  sigma_demanda_diaria DECIMAL(12,4),
  lead_time_previsto_dias DECIMAL(8,2),
  lead_time_seguro_dias DECIMAL(8,2),
  sigma_lead_time DECIMAL(8,2),
  fator_z DECIMAL(6,4),
  estoque_seguranca DECIMAL(12,4),
  ponto_reposicao DECIMAL(12,4),
  eoq DECIMAL(12,4),
  estoque_maximo DECIMAL(12,4),
  faixa_atual VARCHAR(10) CHECK (faixa_atual IN ('VERDE','AMARELO','VERMELHO','SEM_DADOS')),
  semanas_historico_usadas INTEGER,
  pedidos_historico_usados INTEGER,
  calculado_em TIMESTAMPTZ DEFAULT NOW(),
  proximo_calculo TIMESTAMPTZ
);

CREATE TABLE movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO','TRANSFERENCIA','DEVOLUCAO')),
  quantidade DECIMAL(12,4) NOT NULL CHECK (quantidade > 0),
  estoque_antes DECIMAL(12,4) NOT NULL,
  estoque_depois DECIMAL(12,4) NOT NULL,
  referencia VARCHAR(100),
  numero_documento VARCHAR(80),
  observacao TEXT,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pedidos_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(30) UNIQUE NOT NULL,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id),
  quantidade_pedida DECIMAL(12,4) NOT NULL CHECK (quantidade_pedida > 0),
  quantidade_recebida DECIMAL(12,4) DEFAULT 0,
  preco_unitario DECIMAL(12,4),
  custo_total DECIMAL(14,2),
  status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','AGUARDANDO_APROVACAO','APROVADO','EMITIDO','EM_TRANSITO','RECEBIDO_PARCIAL','RECEBIDO','CANCELADO')),
  faixa_no_momento VARCHAR(10),
  estoque_no_momento DECIMAL(12,4),
  pr_no_momento DECIMAL(12,4),
  data_emissao TIMESTAMPTZ,
  data_prevista DATE,
  data_recebimento TIMESTAMPTZ,
  lead_time_real_dias INTEGER GENERATED ALWAYS AS (
    CASE WHEN data_recebimento IS NOT NULL AND data_emissao IS NOT NULL
    THEN EXTRACT(DAY FROM data_recebimento - data_emissao)::INTEGER
    ELSE NULL END
  ) STORED,
  aprovado_por UUID REFERENCES usuarios(id),
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produtos(id),
  tipo VARCHAR(40) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT,
  severidade VARCHAR(10) CHECK (severidade IN ('INFO','AVISO','CRITICO')),
  lido BOOLEAN DEFAULT false,
  lido_por UUID REFERENCES usuarios(id),
  lido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_movimentacoes_produto_data ON movimentacoes(produto_id, criado_em DESC);
CREATE INDEX idx_movimentacoes_tipo ON movimentacoes(tipo, criado_em DESC);
CREATE INDEX idx_pedidos_produto ON pedidos_compra(produto_id, status);
CREATE INDEX idx_pedidos_status ON pedidos_compra(status, data_emissao DESC);
CREATE INDEX idx_kanban_faixa ON kanban_parametros(faixa_atual);
CREATE INDEX idx_audit_usuario ON audit_log(usuario_id, criado_em DESC);
CREATE INDEX idx_alertas_nao_lidos ON alertas(lido, criado_em DESC) WHERE lido = false;

-- Trigger
CREATE OR REPLACE FUNCTION atualiza_estoque_apos_movimentacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE produtos SET estoque_atual = NEW.estoque_depois, atualizado_em = NOW() WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualiza_estoque
  AFTER INSERT ON movimentacoes
  FOR EACH ROW EXECUTE FUNCTION atualiza_estoque_apos_movimentacao();
