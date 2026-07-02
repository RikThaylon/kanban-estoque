-- KANBAN ESTOQUE — Migration 022: Monte Carlo Simulation Runs

CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  progress INTEGER DEFAULT 0,
  n_simulations INTEGER DEFAULT 10000,
  fill_rate_theoretical DECIMAL(5,4),
  fill_rate_simulated DECIMAL(5,4),
  cv_confidence VARCHAR(20) CHECK (cv_confidence IN ('calculated','seed','default')),
  result_json JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sim_runs_sku_status ON simulation_runs(sku_id, status);
