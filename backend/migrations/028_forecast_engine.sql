-- Forecast Engine adaptativo: configuração, histórico auditável e ponte com Kanban.

INSERT INTO configuracoes_sistema (chave, valor, descricao, categoria) VALUES
  ('forecast.adi_threshold', '1.32', 'Limite configurável de ADI para classificação de demanda intermitente', 'forecast'),
  ('forecast.cv2_threshold', '0.49', 'Limite configurável de CV² das demandas não zero', 'forecast'),
  ('forecast.seasonality_min_correlation', '0.45', 'Autocorrelação mínima para propor modelos sazonais', 'forecast'),
  ('forecast.underforecast_cost', '1.5', 'Peso do custo de subprevisão no ranking de modelos', 'forecast'),
  ('forecast.overforecast_cost', '1.0', 'Peso do custo de sobreprevisão no ranking de modelos', 'forecast'),
  ('forecast.absolute_tolerance', '1', 'Tolerância absoluta operacional padrão', 'forecast'),
  ('forecast.relative_warning', '0.15', 'Erro relativo que gera aviso operacional', 'forecast'),
  ('forecast.relative_critical', '0.30', 'Erro relativo considerado crítico', 'forecast')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  engine_version VARCHAR(40) NOT NULL,
  model_type VARCHAR(40) NOT NULL,
  model_version VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CHAMPION'
    CHECK (status IN ('CHAMPION', 'CHALLENGER', 'FAILED', 'INSUFFICIENT_DATA')),
  frequency VARCHAR(20) NOT NULL DEFAULT 'DAILY',
  horizon_periods INTEGER NOT NULL CHECK (horizon_periods > 0),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  demand_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  challengers JSONB NOT NULL DEFAULT '[]'::jsonb,
  forecast_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_quality JSONB NOT NULL DEFAULT '{}'::jsonb,
  drift JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence VARCHAR(30) NOT NULL,
  trained_until DATE,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_produto_created
  ON forecast_runs(produto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_model
  ON forecast_runs(model_type, created_at DESC);

ALTER TABLE kanban_parametros
  ADD COLUMN IF NOT EXISTS forecast_run_id UUID REFERENCES forecast_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forecast_model VARCHAR(40),
  ADD COLUMN IF NOT EXISTS forecast_version VARCHAR(40),
  ADD COLUMN IF NOT EXISTS forecast_confidence VARCHAR(30),
  ADD COLUMN IF NOT EXISTS forecast_metrics JSONB,
  ADD COLUMN IF NOT EXISTS demand_profile JSONB,
  ADD COLUMN IF NOT EXISTS forecast_result JSONB,
  ADD COLUMN IF NOT EXISTS forecast_treinado_ate DATE,
  ADD COLUMN IF NOT EXISTS forecast_avaliado_em TIMESTAMPTZ;

ALTER TABLE pedidos_compra
  ADD COLUMN IF NOT EXISTS lead_time_previsto_no_momento DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS lead_time_erro_absoluto DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS lead_time_erro_relativo DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS lead_time_tolerancia_status VARCHAR(20)
    CHECK (lead_time_tolerancia_status IN ('ACCEPTABLE', 'WARNING', 'CRITICAL'));

COMMENT ON COLUMN simulation_runs.fill_rate_theoretical IS
  'Legacy column name: stores theoretical cycle service level, not unit fill rate.';
COMMENT ON COLUMN simulation_runs.fill_rate_simulated IS
  'Legacy column name: stores simulated cycle service level, not unit fill rate.';
