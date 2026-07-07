-- Up Migration
CREATE TABLE IF NOT EXISTS sap_sync_logs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  errors JSONB,
  duration_ms INTEGER,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Down Migration
DROP TABLE IF EXISTS sap_sync_logs;
