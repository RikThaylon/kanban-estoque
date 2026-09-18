-- Migration 028: Adiciona flag recorrente na tabela produtos
-- Padrão: true (todos os produtos existentes são considerados recorrentes)
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN produtos.recorrente IS
  'true = produto de demanda contínua (lógica Kanban completa);
   false = produto pontual/projeto (sem pedido automático, sem previsão,
           exibe apenas estoque atual e dias estimados de duração).';
