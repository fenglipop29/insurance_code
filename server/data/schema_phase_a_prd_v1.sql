-- Phase A schema for PRD-aligned B/P + purchase flow
-- Generated: 2026-02-24

BEGIN;

-- 1) Platform and IAM
CREATE TABLE IF NOT EXISTS p_tenants (
  id BIGSERIAL PRIMARY KEY,
  tenant_code VARCHAR(64) NOT NULL UNIQUE,
  tenant_type VARCHAR(20) NOT NULL CHECK (tenant_type IN ('company', 'individual')),
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  package_name VARCHAR(80),
  quota_max_customers INT NOT NULL DEFAULT 0,
  quota_max_templates INT NOT NULL DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS p_roles (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  role_key VARCHAR(64) NOT NULL,
  role_name VARCHAR(80) NOT NULL,
  role_level SMALLINT NOT NULL DEFAULT 1,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, role_key)
);

CREATE TABLE IF NOT EXISTS p_employees (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  name VARCHAR(60) NOT NULL,
  mobile_enc TEXT NOT NULL,
  mobile_masked VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  team_id BIGINT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS iam_permissions (
  id BIGSERIAL PRIMARY KEY,
  permission_key VARCHAR(120) NOT NULL UNIQUE,
  permission_name VARCHAR(120) NOT NULL,
  resource VARCHAR(120) NOT NULL,
  action VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS iam_role_permissions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  role_id BIGINT NOT NULL REFERENCES p_roles(id),
  permission_id BIGINT NOT NULL REFERENCES iam_permissions(id),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS iam_user_roles (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('employee', 'agent', 'customer')),
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL REFERENCES p_roles(id),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, user_type, user_id, role_id)
);

-- 2) Product/Activity operations
CREATE TABLE IF NOT EXISTS p_products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  points_cost INT NOT NULL CHECK (points_cost > 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  shelf_status VARCHAR(20) NOT NULL DEFAULT 'on' CHECK (shelf_status IN ('on', 'off')),
  sort_order INT NOT NULL DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS p_activities (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  title VARCHAR(120) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('sign', 'task', 'invite', 'competition')),
  reward_points INT NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ended')),
  sort_order INT NOT NULL DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3) C-side and B-side core
CREATE TABLE IF NOT EXISTS c_customers (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  owner_agent_id BIGINT,
  name VARCHAR(60) NOT NULL,
  mobile_enc TEXT NOT NULL,
  mobile_masked VARCHAR(20) NOT NULL,
  wechat_open_id VARCHAR(64),
  wechat_union_id VARCHAR(64),
  nick_name VARCHAR(50),
  avatar_url VARCHAR(255),
  member_level SMALLINT NOT NULL DEFAULT 1,
  growth_value INT NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  device_info VARCHAR(255),
  is_verified_basic BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS b_agents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  employee_id BIGINT REFERENCES p_employees(id),
  display_name VARCHAR(60) NOT NULL,
  avatar_url TEXT,
  title VARCHAR(80),
  bio TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS c_point_transactions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  direction VARCHAR(8) NOT NULL CHECK (direction IN ('in', 'out')),
  amount INT NOT NULL CHECK (amount > 0),
  source_type VARCHAR(60) NOT NULL,
  source_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  balance_after INT NOT NULL CHECK (balance_after >= 0),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS c_redeem_records (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  product_id BIGINT NOT NULL REFERENCES p_products(id),
  points_cost INT NOT NULL CHECK (points_cost > 0),
  writeoff_token VARCHAR(80) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'written_off', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ,
  written_off_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS b_customer_activities (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  agent_id BIGINT NOT NULL REFERENCES b_agents(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  activity_type VARCHAR(40) NOT NULL,
  activity_summary VARCHAR(255),
  payload JSONB,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS b_write_off_records (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  redeem_record_id BIGINT NOT NULL REFERENCES c_redeem_records(id),
  operator_agent_id BIGINT NOT NULL REFERENCES b_agents(id),
  writeoff_token VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'rejected')),
  reason VARCHAR(255),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- 4) Governance: approval, audit, idempotency
CREATE TABLE IF NOT EXISTS approval_requests (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  requester_user_type VARCHAR(20) NOT NULL CHECK (requester_user_type IN ('employee', 'agent')),
  requester_user_id BIGINT NOT NULL,
  request_type VARCHAR(40) NOT NULL CHECK (request_type IN ('customer_detail_view', 'customer_export', 'manual_points_adjust')),
  scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approved_by BIGINT,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  approval_request_id BIGINT NOT NULL REFERENCES approval_requests(id),
  step_no INT NOT NULL,
  approver_user_type VARCHAR(20) NOT NULL CHECK (approver_user_type IN ('employee', 'agent')),
  approver_user_id BIGINT NOT NULL,
  decision VARCHAR(20) CHECK (decision IN ('approved', 'rejected')),
  decision_note VARCHAR(255),
  decided_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (approval_request_id, step_no)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES p_tenants(id),
  actor_user_type VARCHAR(20) NOT NULL,
  actor_user_id BIGINT NOT NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(80),
  result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'fail')),
  trace_id VARCHAR(80),
  ip VARCHAR(80),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_records (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  biz_type VARCHAR(40) NOT NULL,
  biz_key VARCHAR(120) NOT NULL,
  request_hash VARCHAR(128),
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE (tenant_id, biz_type, biz_key)
);

-- 5) Missing PRD tables (Phase B/ops extension)
CREATE TABLE IF NOT EXISTS c_family_members (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  name VARCHAR(60) NOT NULL,
  relation VARCHAR(30) NOT NULL,
  gender VARCHAR(10),
  birthday DATE,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS c_policies (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  family_member_id BIGINT REFERENCES c_family_members(id),
  company VARCHAR(120) NOT NULL,
  policy_name VARCHAR(120) NOT NULL,
  policy_no VARCHAR(80),
  policy_type VARCHAR(40),
  amount NUMERIC(14, 2),
  annual_premium NUMERIC(14, 2),
  period_start DATE,
  period_end DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS c_learning_records (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  material_id BIGINT,
  title VARCHAR(160) NOT NULL,
  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('video', 'comic', 'article')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  points_awarded INT NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  completed_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS c_favorites (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'comic', 'article', 'activity')),
  content_id BIGINT NOT NULL,
  title VARCHAR(160),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, customer_id, content_type, content_id)
);

CREATE TABLE IF NOT EXISTS b_customer_tags (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  tag_name VARCHAR(40) NOT NULL,
  tag_source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (tag_source IN ('manual', 'system')),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, tag_name)
);

CREATE TABLE IF NOT EXISTS b_customer_tag_rels (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  customer_id BIGINT NOT NULL REFERENCES c_customers(id),
  tag_id BIGINT NOT NULL REFERENCES b_customer_tags(id),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, customer_id, tag_id)
);

CREATE TABLE IF NOT EXISTS p_learning_materials (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  title VARCHAR(160) NOT NULL,
  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('video', 'comic', 'article')),
  category VARCHAR(60),
  difficulty VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'offline')),
  cover_url TEXT,
  content_url TEXT,
  reward_points INT NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS p_tag_rules (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  rule_name VARCHAR(120) NOT NULL,
  if_expr JSONB NOT NULL DEFAULT '{}'::jsonb,
  then_expr JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope_type VARCHAR(20) NOT NULL DEFAULT 'tenant' CHECK (scope_type IN ('global', 'tenant', 'team')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  priority INT NOT NULL DEFAULT 100,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS reconciliation_jobs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  biz_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  triggered_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, biz_date)
);

CREATE TABLE IF NOT EXISTS reconciliation_results (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES p_tenants(id),
  reconciliation_job_id BIGINT NOT NULL REFERENCES reconciliation_jobs(id),
  result_type VARCHAR(40) NOT NULL,
  mismatch_count INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_p_roles_tenant ON p_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_p_employees_tenant_status ON p_employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_p_products_tenant_status_sort ON p_products(tenant_id, shelf_status, sort_order);
CREATE INDEX IF NOT EXISTS idx_p_activities_tenant_status_sort ON p_activities(tenant_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_c_customers_tenant_owner ON c_customers(tenant_id, owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_c_points_customer_created ON c_point_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_c_redeem_customer_created ON c_redeem_records(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_c_redeem_status_expire ON c_redeem_records(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_b_customer_activities_agent_happened ON b_customer_activities(agent_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_b_writeoff_redeem ON b_write_off_records(redeem_record_id);
CREATE INDEX IF NOT EXISTS idx_approval_tenant_status ON approval_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_steps_request_step ON approval_steps(approval_request_id, step_no);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expire ON idempotency_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_family_member_customer ON c_family_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_policy_customer_status ON c_policies(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_record_customer_created ON c_learning_records(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_customer_created ON c_favorites(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b_customer_tag_rels_customer ON b_customer_tag_rels(customer_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_tenant_status_sort ON p_learning_materials(tenant_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_tag_rules_tenant_status_priority ON p_tag_rules(tenant_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_recon_results_job ON reconciliation_results(reconciliation_job_id);

COMMIT;
