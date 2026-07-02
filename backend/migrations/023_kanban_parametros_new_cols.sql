-- KANBAN ESTOQUE — Migration 023: Kanban Parametros New Columns
-- Adiciona as colunas necessárias para o recálculo do Monte Carlo e Tiers

ALTER TABLE kanban_parametros 
  ADD COLUMN IF NOT EXISTS sigma_durante_lt DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS tier_demanda VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cv_confidence VARCHAR(20);
