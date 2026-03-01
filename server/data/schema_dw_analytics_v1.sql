-- Analytics warehouse schema (separate from OLTP)
-- Suggested to deploy on isolated DB/schema in production.

BEGIN;

CREATE TABLE IF NOT EXISTS dw_customer_daily (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  tenant_id BIGINT NOT NULL,
  customers_total INT NOT NULL DEFAULT 0,
  customers_active INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stat_date, tenant_id)
);

CREATE TABLE IF NOT EXISTS dw_activity_daily (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  tenant_id BIGINT NOT NULL,
  activity_completions INT NOT NULL DEFAULT 0,
  sign_in_count INT NOT NULL DEFAULT 0,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stat_date, tenant_id)
);

CREATE TABLE IF NOT EXISTS dw_content_daily (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  tenant_id BIGINT NOT NULL,
  course_completions INT NOT NULL DEFAULT 0,
  learn_duration_seconds BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stat_date, tenant_id)
);

CREATE TABLE IF NOT EXISTS dw_order_daily (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  tenant_id BIGINT NOT NULL,
  orders_created INT NOT NULL DEFAULT 0,
  orders_paid INT NOT NULL DEFAULT 0,
  orders_refunded INT NOT NULL DEFAULT 0,
  points_consumed INT NOT NULL DEFAULT 0,
  points_refunded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stat_date, tenant_id)
);

CREATE TABLE IF NOT EXISTS dw_etl_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_name VARCHAR(80) NOT NULL,
  stat_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  source_watermark TIMESTAMPTZ,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dw_customer_tenant_date ON dw_customer_daily(tenant_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_dw_activity_tenant_date ON dw_activity_daily(tenant_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_dw_content_tenant_date ON dw_content_daily(tenant_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_dw_order_tenant_date ON dw_order_daily(tenant_id, stat_date DESC);

COMMIT;
