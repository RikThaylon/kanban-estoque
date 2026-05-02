-- KANBAN ESTOQUE — SEED DATA (Migration 002)
-- 9 perfis hierarquicos. Login = username (sem email). Senhas pre-hasheadas com bcrypt cost 12.
-- Senhas:
--   admin       => Admin@123
--   plant       => Plant@123
--   geneng      => Geneng@123
--   processos   => Epc@123
--   producao    => Epd@123
--   gerente.op  => Gop@123
--   supervisor  => Sup@123
--   comprador   => Cmp@123
--   facilitador => Fac@123

INSERT INTO usuarios (id, nome, username, senha_hash, perfil) VALUES
('a0000000-0000-0000-0000-000000000001', 'Administrador',           'admin',       '$2b$12$ZmvIhpxkNHGrxqVXEMwL7.R7D7c0OoqzKmp5jjdQUYcURT6zZCPfi', 'admin'),
('a0000000-0000-0000-0000-000000000002', 'Plant Manager',           'plant',       '$2b$12$ZAfW2Q9GcT9WMWy//YukJuwL46u6VX36t/DZi79ECKRE1cJ8ozFeG', 'plant_manager'),
('a0000000-0000-0000-0000-000000000003', 'Gerente de Engenharia',   'geneng',      '$2b$12$cfe28vkG3uC8XXpqoBtjaOmIFbkxmjJvHw/grNul0xhgNN3Cz6wgi', 'gerente_engenharia'),
('a0000000-0000-0000-0000-000000000004', 'Eng. de Processos',       'processos',   '$2b$12$648Pl1D/ibxosfel9tBAAO9krMLGQbAXvo4jeuhUxOfkiwBEClNJ6', 'eng_processos'),
('a0000000-0000-0000-0000-000000000005', 'Eng. de Produção',        'producao',    '$2b$12$dlBUBLfrY28jsrccV/rdFuDQoTUBnspbKzoYuz43wMAu1tb9selKi', 'eng_producao'),
('a0000000-0000-0000-0000-000000000006', 'Gerente de Operações',    'gerente.op',  '$2b$12$v8GYEZb6pMpz3Ju22ucaaOVRo9CtZ49p0sAKB6ReR8vgADvEiO9Cm', 'gerente_operacoes'),
('a0000000-0000-0000-0000-000000000007', 'Supervisor de Turno',     'supervisor',  '$2b$12$isfVUt1IuP7fAulLUcFTXOZY585jaA8cht1tu11aSztoE4lRO0H4e', 'supervisor_turno'),
('a0000000-0000-0000-0000-000000000008', 'Comprador',               'comprador',   '$2b$12$KU1lFg/j2vnQ0mg1vjLC3uL9CUqNnr8N8G.lQ9oETwtFg76R2Z57e', 'comprador'),
('a0000000-0000-0000-0000-000000000009', 'Facilitador Kanban',      'facilitador', '$2b$12$kqS7yKRdjJdq4GpFVB1jAuUKW3LpOi.lykSeyilQuigfSXgH4U8HS', 'facilitador');

-- Categorias
INSERT INTO categorias (id, nome, descricao, cor_hex) VALUES
('c0000000-0000-0000-0000-000000000001', 'Hidráulico', 'Componentes hidráulicos industriais', '3B82F6'),
('c0000000-0000-0000-0000-000000000002', 'Mecânico', 'Peças mecânicas e componentes', '8B5CF6'),
('c0000000-0000-0000-0000-000000000003', 'Elétrico', 'Componentes elétricos e eletrônicos', 'F59E0B'),
('c0000000-0000-0000-0000-000000000004', 'Consumível', 'Materiais de consumo', '10B981'),
('c0000000-0000-0000-0000-000000000005', 'Estrutural', 'Materiais estruturais', '6B7280');

-- Fornecedores
INSERT INTO fornecedores (id, nome, cnpj, contato_nome, contato_email, contato_telefone, cidade, estado, modal_padrao, prazo_pagamento_dias, avaliacao) VALUES
('f0000000-0000-0000-0000-000000000001', 'HidraParts Ltda', '11.222.333/0001-44', 'Carlos Silva', 'carlos@hidraparts.com', '(11) 99999-1111', 'São Paulo', 'SP', 'rodoviario', 30, 4.50),
('f0000000-0000-0000-0000-000000000002', 'MecTech Industrial', '55.666.777/0001-88', 'Fernanda Lima', 'fernanda@mectech.com', '(21) 98888-2222', 'Rio de Janeiro', 'RJ', 'rodoviario', 45, 4.00),
('f0000000-0000-0000-0000-000000000003', 'EletroSupply SA', '99.000.111/0001-22', 'Roberto Santos', 'roberto@eletrosupply.com', '(31) 97777-3333', 'Belo Horizonte', 'MG', 'aereo', 28, 4.20);

-- Produtos (8 produtos, VH-200 calibrado para ES=7, PR=37, EOQ=136)
INSERT INTO produtos (id, codigo, nome, descricao, unidade, categoria_id, custo_unitario, custo_pedido, taxa_carregamento, nivel_servico, estoque_atual, localizacao, classificacao_abc, criado_por) VALUES
('b0000000-0000-0000-0000-000000000001', 'VH-200', 'Válvula Hidráulica VH-200', 'Válvula de controle direcional 3/4"', 'UN', 'c0000000-0000-0000-0000-000000000001', 45.0000, 150.00, 0.2000, 95, 30.0000, 'A-01-03', 'A', 'a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000002', 'RL-150', 'Rolamento Linear RL-150', 'Rolamento linear 15mm eixo', 'UN', 'c0000000-0000-0000-0000-000000000002', 22.5000, 80.00, 0.2000, 95, 85.0000, 'B-02-01', 'A', 'a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000003', 'CB-500', 'Cabo Elétrico CB-500', 'Cabo flex 2.5mm² 750V', 'MT', 'c0000000-0000-0000-0000-000000000003', 3.5000, 50.00, 0.1500, 95, 500.0000, 'C-01-05', 'B', 'a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000004', 'FT-300', 'Filtro Industrial FT-300', 'Filtro de óleo hidráulico 10 micra', 'UN', 'c0000000-0000-0000-0000-000000000001', 78.0000, 120.00, 0.2000, 98, 12.0000, 'A-02-01', 'A', 'a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000005', 'PF-100', 'Parafuso Flangeado PF-100', 'Parafuso M10x50 classe 8.8', 'UN', 'c0000000-0000-0000-0000-000000000005', 1.2000, 30.00, 0.1500, 90, 1200.0000, 'D-01-01', 'C', 'a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000006', 'MG-250', 'Mangueira Hidráulica MG-250', 'Mangueira 1/2" 3000PSI', 'MT', 'c0000000-0000-0000-0000-000000000001', 35.0000, 90.00, 0.2000, 95, 45.0000, 'A-03-02', 'B', 'a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000007', 'SL-400', 'Selante Industrial SL-400', 'Selante anaeróbico 50ml', 'UN', 'c0000000-0000-0000-0000-000000000004', 28.0000, 60.00, 0.2000, 95, 20.0000, 'E-01-03', 'C', 'a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000008', 'DJ-600', 'Disjuntor DJ-600', 'Disjuntor tripolar 63A', 'UN', 'c0000000-0000-0000-0000-000000000003', 95.0000, 100.00, 0.2000, 99, 8.0000, 'C-02-03', 'A', 'a0000000-0000-0000-0000-000000000001');

-- Produto-Fornecedor
INSERT INTO produto_fornecedor (produto_id, fornecedor_id, prioridade, preco_acordado, lead_time_nominal_dias) VALUES
('b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 43.00, 7),
('b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 1, 21.00, 5),
('b0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 1, 3.20, 3),
('b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 1, 75.00, 10),
('b0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', 1, 1.00, 4),
('b0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', 1, 33.00, 6),
('b0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000002', 1, 26.00, 5),
('b0000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000003', 1, 90.00, 8);

-- Kanban parametros pre-calculados
INSERT INTO kanban_parametros (produto_id, demanda_diaria_media, sigma_demanda_diaria, lead_time_previsto_dias, lead_time_seguro_dias, sigma_lead_time, fator_z, estoque_seguranca, ponto_reposicao, eoq, estoque_maximo, faixa_atual, semanas_historico_usadas, pedidos_historico_usados) VALUES
('b0000000-0000-0000-0000-000000000001', 3.5000, 1.2000, 7.00, 9.00, 1.20, 1.6449, 7.0000, 37.0000, 136.0000, 143.0000, 'AMARELO', 12, 8),
('b0000000-0000-0000-0000-000000000002', 5.0000, 1.5000, 5.00, 7.00, 1.00, 1.6449, 7.0000, 32.0000, 152.0000, 159.0000, 'VERDE', 12, 8),
('b0000000-0000-0000-0000-000000000003', 15.0000, 4.0000, 3.00, 5.00, 0.80, 1.6449, 15.0000, 60.0000, 520.0000, 535.0000, 'VERDE', 12, 8),
('b0000000-0000-0000-0000-000000000004', 1.8000, 0.6000, 10.00, 13.00, 1.50, 1.8808, 5.0000, 23.0000, 59.0000, 64.0000, 'AMARELO', 12, 8),
('b0000000-0000-0000-0000-000000000005', 25.0000, 8.0000, 4.00, 6.00, 1.00, 1.2816, 26.0000, 126.0000, 1826.0000, 1852.0000, 'VERDE', 12, 8),
('b0000000-0000-0000-0000-000000000006', 4.0000, 1.3000, 6.00, 8.00, 1.10, 1.6449, 7.0000, 31.0000, 114.0000, 121.0000, 'VERDE', 12, 8),
('b0000000-0000-0000-0000-000000000007', 2.0000, 0.8000, 5.00, 7.00, 0.90, 1.6449, 4.0000, 14.0000, 73.0000, 77.0000, 'VERDE', 12, 8),
('b0000000-0000-0000-0000-000000000008', 0.8000, 0.3000, 8.00, 11.00, 1.30, 2.3263, 3.0000, 9.0000, 29.0000, 32.0000, 'VERMELHO', 12, 8);

-- Movimentacoes dos ultimos 90 dias para VH-200
DO $$
DECLARE
  v_date TIMESTAMPTZ;
  v_qty DECIMAL;
  v_stock DECIMAL := 120;
  v_tipos TEXT[] := ARRAY['SAIDA','SAIDA','SAIDA','ENTRADA','SAIDA','SAIDA','SAIDA'];
  v_qtds DECIMAL[] := ARRAY[5, 3, 8, 50, 4, 6, 7, 2, 10, 45, 3, 5, 8, 6, 4, 50, 7, 3, 5, 9];
  i INTEGER;
BEGIN
  FOR i IN 1..20 LOOP
    v_date := NOW() - ((90 - i * 4) || ' days')::INTERVAL;
    v_qty := v_qtds[i];
    IF i IN (4, 10, 16) THEN
      INSERT INTO movimentacoes (produto_id, tipo, quantidade, estoque_antes, estoque_depois, referencia, criado_por, criado_em)
      VALUES ('b0000000-0000-0000-0000-000000000001', 'ENTRADA', v_qty, v_stock, v_stock + v_qty, 'PC-SEED-' || i, 'a0000000-0000-0000-0000-000000000001', v_date);
      v_stock := v_stock + v_qty;
    ELSE
      IF v_stock - v_qty >= 0 THEN
        INSERT INTO movimentacoes (produto_id, tipo, quantidade, estoque_antes, estoque_depois, referencia, criado_por, criado_em)
        VALUES ('b0000000-0000-0000-0000-000000000001', 'SAIDA', v_qty, v_stock, v_stock - v_qty, 'OP-SEED-' || i, 'a0000000-0000-0000-0000-000000000009', v_date);
        v_stock := v_stock - v_qty;
      END IF;
    END IF;
  END LOOP;
  UPDATE produtos SET estoque_atual = v_stock WHERE id = 'b0000000-0000-0000-0000-000000000001';
END $$;

-- Pedidos historicos para VH-200 com lead times variados
INSERT INTO pedidos_compra (numero, produto_id, fornecedor_id, quantidade_pedida, quantidade_recebida, preco_unitario, custo_total, status, data_emissao, data_prevista, data_recebimento, criado_por) VALUES
('PC-202501-0001', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 50, 50, 43.00, 2150.00, 'RECEBIDO', NOW()-'85 days'::INTERVAL, (NOW()-'78 days'::INTERVAL)::DATE, NOW()-'78 days'::INTERVAL, 'a0000000-0000-0000-0000-000000000008'),
('PC-202501-0002', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 50, 50, 43.00, 2150.00, 'RECEBIDO', NOW()-'70 days'::INTERVAL, (NOW()-'63 days'::INTERVAL)::DATE, NOW()-'62 days'::INTERVAL, 'a0000000-0000-0000-0000-000000000008'),
('PC-202502-0001', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 45, 45, 44.00, 1980.00, 'RECEBIDO', NOW()-'56 days'::INTERVAL, (NOW()-'49 days'::INTERVAL)::DATE, NOW()-'48 days'::INTERVAL, 'a0000000-0000-0000-0000-000000000008'),
('PC-202502-0002', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 50, 50, 43.00, 2150.00, 'RECEBIDO', NOW()-'42 days'::INTERVAL, (NOW()-'35 days'::INTERVAL)::DATE, NOW()-'36 days'::INTERVAL, 'a0000000-0000-0000-0000-000000000008'),
('PC-202503-0001', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 50, 50, 43.50, 2175.00, 'RECEBIDO', NOW()-'30 days'::INTERVAL, (NOW()-'23 days'::INTERVAL)::DATE, NOW()-'22 days'::INTERVAL, 'a0000000-0000-0000-0000-000000000008'),
('PC-202503-0002', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 55, 55, 43.00, 2365.00, 'RECEBIDO', NOW()-'21 days'::INTERVAL, (NOW()-'14 days'::INTERVAL)::DATE, NOW()-'13 days'::INTERVAL, 'a0000000-0000-0000-0000-000000000008'),
('PC-202504-0001', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 50, 50, 44.00, 2200.00, 'RECEBIDO', NOW()-'14 days'::INTERVAL, (NOW()-'7 days'::INTERVAL)::DATE, NOW()-'6 days'::INTERVAL, 'a0000000-0000-0000-0000-000000000008'),
('PC-202504-0002', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 50, 0, 43.00, 2150.00, 'EM_TRANSITO', NOW()-'5 days'::INTERVAL, (NOW()+'2 days'::INTERVAL)::DATE, NULL, 'a0000000-0000-0000-0000-000000000008');

-- Alertas
INSERT INTO alertas (produto_id, tipo, titulo, mensagem, severidade) VALUES
('b0000000-0000-0000-0000-000000000008', 'FAIXA_VERMELHA', 'Disjuntor DJ-600 em nível crítico', 'Estoque abaixo do Estoque de Segurança. Providenciar reposição imediata.', 'CRITICO'),
('b0000000-0000-0000-0000-000000000001', 'FAIXA_AMARELA', 'Válvula VH-200 atingiu ponto de reposição', 'Estoque abaixo do Ponto de Reposição. Avaliar emissão de pedido.', 'AVISO'),
('b0000000-0000-0000-0000-000000000004', 'FAIXA_AMARELA', 'Filtro FT-300 atingiu ponto de reposição', 'Estoque abaixo do Ponto de Reposição.', 'AVISO');
