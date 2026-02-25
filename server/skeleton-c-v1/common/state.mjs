import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'db.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const initialState = {
  users: [],
  tenants: [{ id: 1, name: '默认租户', status: 'active', type: 'company', createdAt: new Date().toISOString() }],
  orgUnits: [{ id: 1, tenantId: 1, name: '默认机构', createdAt: new Date().toISOString() }],
  teams: [{ id: 1, tenantId: 1, orgId: 1, name: '默认团队', createdAt: new Date().toISOString() }],
  agents: [{ id: 8001, tenantId: 1, orgId: 1, teamId: 1, name: '默认业务员', status: 'active', createdAt: new Date().toISOString() }],
  roles: [],
  permissions: [],
  rolePermissions: [],
  userRoles: [],
  approvals: [],
  auditLogs: [],
  trackEvents: [],
  idempotencyRecords: [],
  domainEvents: [],
  outboxEvents: [],
  smsCodes: [],
  sessions: [],
  activities: [
    { id: 1, title: '连续签到7天领鸡蛋', category: 'sign', rewardPoints: 10, sortOrder: 1, participants: 18230 },
    { id: 2, title: '保险知识王者赛', category: 'competition', rewardPoints: 50, sortOrder: 2, participants: 10230 },
    { id: 3, title: '完善保障信息', category: 'task', rewardPoints: 100, sortOrder: 3, participants: 5980 },
    { id: 4, title: '推荐好友加入', category: 'invite', rewardPoints: 500, sortOrder: 4, participants: 4200 },
  ],
  activityCompletions: [],
  signIns: [],
  pointAccounts: [],
  pointTransactions: [],
  mallItems: [
    { id: 1, name: '智能低糖电饭煲', pointsCost: 99, stock: 50, isActive: true },
    { id: 2, name: '家庭体检套餐', pointsCost: 79, stock: 80, isActive: true },
    { id: 3, name: '健康管理咨询券', pointsCost: 59, stock: 999, isActive: true },
  ],
  redemptions: [],
  orders: [],
  orderPayments: [],
  orderFulfillments: [],
  orderRefunds: [],
  bCustomerTags: [],
  bCustomerTagRels: [],
  bCustomerActivities: [],
  bWriteOffRecords: [],
  pLearningMaterials: [],
  pProducts: [],
  pActivities: [],
  statsWarehouse: [],
  reconciliationReports: [],
  learningCourses: [],
  courseCompletions: [],
  learningGames: [],
  learningTools: [],
  insuranceSummary: {},
  familyMembers: [],
  insuranceReminders: [],
  policies: [],
};

const state = structuredClone(initialState);
let initialized = false;
let flushChain = Promise.resolve();

const DATABASE_URL = process.env.DATABASE_URL || '';
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'postgres';
const usePostgres = STORAGE_BACKEND === 'postgres';

const pool = usePostgres
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      max: Number(process.env.PG_POOL_MAX || 10),
    })
  : null;

export function getStorageBackend() {
  return usePostgres ? 'postgres' : 'file';
}

export async function initializeState() {
  if (initialized) return;

  if (usePostgres) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is required when STORAGE_BACKEND=postgres');
    }
    await ensureRelationalSchema();

    const loaded = await loadStateFromPostgresTables();
    if (loaded) assignState(loaded);
    else assignState(loadStateFromFile());

    const normalized = normalizeMallPricingForDemo();
    const seeded = ensureDomainSeedsFromFile();
    if (normalized || seeded || !loaded) {
      await writeStateToPostgresTables();
    }
  } else {
    assignState(loadStateFromFile());
    const normalized = normalizeMallPricingForDemo();
    if (normalized) {
      fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), 'utf-8');
    }
  }
  ensureAccessControlSeeds();
  backfillUserScopes();
  syncOperationCatalog();

  initialized = true;
}

export function getState() {
  return state;
}

export function persistState() {
  if (!initialized) return;

  if (!usePostgres) {
    fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), 'utf-8');
    return;
  }

  flushChain = flushChain
    .then(() => writeStateToPostgresTables())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[state] postgres persist failed:', err?.message || err);
    });
}

export async function closeState() {
  if (pool) {
    await flushChain.catch(() => undefined);
    await pool.end();
  }
}

export function dateOnly(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function nextId(list) {
  if (!Array.isArray(list) || list.length === 0) return 1;
  return Math.max(...list.map((x) => Number(x.id) || 0)) + 1;
}

export function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    is_verified_basic: Boolean(user.isVerifiedBasic),
    verified_at: user.verifiedAt || null,
  };
}

export function getBalance(userId) {
  const rows = state.pointTransactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  const latestTxBalance = Number(rows[0]?.balance);
  if (Number.isFinite(latestTxBalance)) return latestTxBalance;

  if (Array.isArray(state.pointAccounts)) {
    const account = state.pointAccounts.find((x) => x.userId === userId);
    const accountBalance = Number(account?.balance);
    if (Number.isFinite(accountBalance)) return accountBalance;
  }

  return 0;
}

export function appendPoints(userId, type, amount, source, sourceId, description) {
  const prev = getBalance(userId);
  const balance = type === 'earn' ? prev + amount : prev - amount;
  state.pointTransactions.push({
    id: nextId(state.pointTransactions),
    userId,
    type,
    amount,
    source,
    sourceId,
    balance,
    description,
    createdAt: new Date().toISOString(),
  });

  if (!Array.isArray(state.pointAccounts)) state.pointAccounts = [];
  let account = state.pointAccounts.find((x) => x.userId === userId);
  if (!account) {
    account = { userId, balance: 0, updatedAt: new Date().toISOString() };
    state.pointAccounts.push(account);
  }
  account.balance = balance;
  account.updatedAt = new Date().toISOString();
}

export function appendAuditLog(entry) {
  if (!Array.isArray(state.auditLogs)) state.auditLogs = [];
  state.auditLogs.push({
    id: nextId(state.auditLogs),
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

export function appendTrackEvent(entry) {
  if (!Array.isArray(state.trackEvents)) state.trackEvents = [];
  state.trackEvents.push({
    id: nextId(state.trackEvents),
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

export function appendDomainEvent(type, payload, options = {}) {
  if (!Array.isArray(state.domainEvents)) state.domainEvents = [];
  if (!Array.isArray(state.outboxEvents)) state.outboxEvents = [];

  const event = {
    id: nextId(state.domainEvents),
    type,
    payload,
    tenantId: Number(options.tenantId || 1),
    traceId: options.traceId || null,
    createdAt: new Date().toISOString(),
  };
  state.domainEvents.push(event);
  state.outboxEvents.push({ ...event, status: 'pending' });
  return event;
}

export function withIdempotency({ tenantId = 1, bizType, bizKey, execute }) {
  if (!Array.isArray(state.idempotencyRecords)) state.idempotencyRecords = [];
  const existed = state.idempotencyRecords.find(
    (row) => Number(row.tenantId) === Number(tenantId) && row.bizType === bizType && row.bizKey === bizKey
  );
  if (existed) {
    return { hit: true, value: existed.response };
  }

  const value = execute();
  state.idempotencyRecords.push({
    id: nextId(state.idempotencyRecords),
    tenantId: Number(tenantId),
    bizType,
    bizKey,
    response: value,
    createdAt: new Date().toISOString(),
  });
  return { hit: false, value };
}

export function createSession(userId) {
  const token = crypto.randomUUID();
  state.sessions.push({
    token,
    userId,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export function resolveUserFromBearer(authorization) {
  const auth = String(authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;

  return state.users.find((u) => u.id === session.userId) || null;
}

export function generateWriteoffToken() {
  let token = '';
  do {
    token = `EX${Date.now()}${Math.floor(Math.random() * 1000)}`;
  } while (state.redemptions.some((row) => row.writeoffToken === token));
  return token;
}

function assignState(next) {
  const merged = {
    ...structuredClone(initialState),
    ...(next || {}),
  };

  for (const key of Object.keys(initialState)) {
    state[key] = merged[key];
  }
}

function loadStateFromFile() {
  if (!fs.existsSync(dbPath)) return structuredClone(initialState);
  try {
    const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    return {
      ...structuredClone(initialState),
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants : structuredClone(initialState.tenants),
      orgUnits: Array.isArray(parsed.orgUnits) ? parsed.orgUnits : structuredClone(initialState.orgUnits),
      teams: Array.isArray(parsed.teams) ? parsed.teams : structuredClone(initialState.teams),
      agents: Array.isArray(parsed.agents) ? parsed.agents : structuredClone(initialState.agents),
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
      rolePermissions: Array.isArray(parsed.rolePermissions) ? parsed.rolePermissions : [],
      userRoles: Array.isArray(parsed.userRoles) ? parsed.userRoles : [],
      approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      idempotencyRecords: Array.isArray(parsed.idempotencyRecords) ? parsed.idempotencyRecords : [],
      domainEvents: Array.isArray(parsed.domainEvents) ? parsed.domainEvents : [],
      outboxEvents: Array.isArray(parsed.outboxEvents) ? parsed.outboxEvents : [],
      smsCodes: Array.isArray(parsed.smsCodes) ? parsed.smsCodes : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      pointAccounts: Array.isArray(parsed.pointAccounts) ? parsed.pointAccounts : [],
      pointTransactions: Array.isArray(parsed.pointTransactions) ? parsed.pointTransactions : [],
      mallItems: Array.isArray(parsed.mallItems) ? parsed.mallItems : structuredClone(initialState.mallItems),
      redemptions: Array.isArray(parsed.redemptions) ? parsed.redemptions : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      orderPayments: Array.isArray(parsed.orderPayments) ? parsed.orderPayments : [],
      orderFulfillments: Array.isArray(parsed.orderFulfillments) ? parsed.orderFulfillments : [],
      orderRefunds: Array.isArray(parsed.orderRefunds) ? parsed.orderRefunds : [],
      bCustomerTags: Array.isArray(parsed.bCustomerTags) ? parsed.bCustomerTags : [],
      bCustomerTagRels: Array.isArray(parsed.bCustomerTagRels) ? parsed.bCustomerTagRels : [],
      bCustomerActivities: Array.isArray(parsed.bCustomerActivities) ? parsed.bCustomerActivities : [],
      bWriteOffRecords: Array.isArray(parsed.bWriteOffRecords) ? parsed.bWriteOffRecords : [],
      pLearningMaterials: Array.isArray(parsed.pLearningMaterials) ? parsed.pLearningMaterials : [],
      pProducts: Array.isArray(parsed.pProducts) ? parsed.pProducts : [],
      pActivities: Array.isArray(parsed.pActivities) ? parsed.pActivities : [],
      statsWarehouse: Array.isArray(parsed.statsWarehouse) ? parsed.statsWarehouse : [],
      reconciliationReports: Array.isArray(parsed.reconciliationReports) ? parsed.reconciliationReports : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : structuredClone(initialState.activities),
      activityCompletions: Array.isArray(parsed.activityCompletions) ? parsed.activityCompletions : [],
      signIns: Array.isArray(parsed.signIns) ? parsed.signIns : [],
      learningCourses: Array.isArray(parsed.learningCourses) ? parsed.learningCourses : [],
      courseCompletions: Array.isArray(parsed.courseCompletions) ? parsed.courseCompletions : [],
      learningGames: Array.isArray(parsed.learningGames) ? parsed.learningGames : [],
      learningTools: Array.isArray(parsed.learningTools) ? parsed.learningTools : [],
      familyMembers: Array.isArray(parsed.familyMembers) ? parsed.familyMembers : [],
      insuranceReminders: Array.isArray(parsed.insuranceReminders) ? parsed.insuranceReminders : [],
      policies: Array.isArray(parsed.policies) ? parsed.policies : [],
    };
  } catch {
    return structuredClone(initialState);
  }
}

function ensureAccessControlSeeds() {
  if (!Array.isArray(state.roles)) state.roles = [];
  if (!Array.isArray(state.permissions)) state.permissions = [];
  if (!Array.isArray(state.rolePermissions)) state.rolePermissions = [];
  if (!Array.isArray(state.userRoles)) state.userRoles = [];

  if (!state.roles.length) {
    state.roles.push(
      { id: 1, tenantId: 1, key: 'platform_admin', name: '平台管理员' },
      { id: 2, tenantId: 1, key: 'company_admin', name: '公司管理员' },
      { id: 3, tenantId: 1, key: 'team_lead', name: '团队主管' },
      { id: 4, tenantId: 1, key: 'agent', name: '业务员' },
      { id: 5, tenantId: 1, key: 'customer', name: '客户' }
    );
  }

  const permissionSeeds = [
    { key: 'tenant:read', name: '查看租户' },
    { key: 'tenant:write', name: '管理租户' },
    { key: 'customer:read', name: '查看客户' },
    { key: 'customer:write', name: '编辑客户' },
    { key: 'order:writeoff', name: '核销订单' },
    { key: 'order:refund', name: '退款订单' },
    { key: 'stats:read', name: '查看统计' },
    { key: 'approval:write', name: '审批处理' },
    { key: 'scope:tenant:all', name: '租户全量数据范围' },
    { key: 'scope:team:all', name: '团队数据范围' },
  ];
  permissionSeeds.forEach((seed) => {
    const exists = state.permissions.find((row) => row.key === seed.key);
    if (!exists) {
      state.permissions.push({ id: nextId(state.permissions), ...seed });
    }
  });

  const bind = (roleKey, permissionKey) => {
    const role = state.roles.find((r) => r.key === roleKey);
    const permission = state.permissions.find((p) => p.key === permissionKey);
    if (!role || !permission) return;
    const exists = state.rolePermissions.find((row) => row.roleId === role.id && row.permissionId === permission.id);
    if (!exists) {
      state.rolePermissions.push({
        id: nextId(state.rolePermissions),
        tenantId: role.tenantId,
        roleId: role.id,
        permissionId: permission.id,
      });
    }
  };

  ['tenant:read', 'tenant:write', 'customer:read', 'customer:write', 'order:writeoff', 'order:refund', 'stats:read', 'approval:write', 'scope:tenant:all'].forEach(
    (key) => bind('platform_admin', key)
  );
  ['tenant:read', 'customer:read', 'customer:write', 'order:writeoff', 'stats:read', 'approval:write', 'scope:team:all'].forEach(
    (key) => bind('company_admin', key)
  );
  ['customer:read', 'customer:write', 'order:writeoff', 'scope:team:all'].forEach((key) => bind('team_lead', key));
  ['customer:read', 'customer:write', 'order:writeoff'].forEach((key) => bind('agent', key));

  if (!state.userRoles.length) {
    state.userRoles.push(
      { id: 1, tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
      { id: 2, tenantId: 1, userType: 'employee', userId: 9002, roleId: 2 },
      { id: 3, tenantId: 1, userType: 'agent', userId: 8001, roleId: 4 }
    );
  }
}

function backfillUserScopes() {
  if (!Array.isArray(state.users)) return;
  state.users = state.users.map((user) => ({
    tenantId: Number(user.tenantId || 1),
    orgId: Number(user.orgId || 1),
    teamId: Number(user.teamId || 1),
    ownerUserId: Number(user.ownerUserId || user.id || 0),
    ...user,
  }));
}

function syncOperationCatalog() {
  if (!Array.isArray(state.pProducts) || state.pProducts.length === 0) {
    state.pProducts = (state.mallItems || []).map((item) => ({
      id: Number(item.id),
      tenantId: 1,
      name: item.name,
      pointsCost: Number(item.pointsCost) || 0,
      stock: Number(item.stock) || 0,
      shelfStatus: item.isActive ? 'on' : 'off',
      createdAt: new Date().toISOString(),
    }));
  }

  if (!Array.isArray(state.pActivities) || state.pActivities.length === 0) {
    state.pActivities = (state.activities || []).map((item) => ({
      id: Number(item.id),
      tenantId: 1,
      title: item.title,
      category: item.category,
      rewardPoints: Number(item.rewardPoints) || 0,
      status: 'published',
      createdAt: new Date().toISOString(),
    }));
  }
}

function normalizeMallPricingForDemo() {
  if (!Array.isArray(state.mallItems) || state.mallItems.length === 0) return false;

  const targetById = new Map([
    [1, 99],
    [2, 79],
    [3, 59],
  ]);

  let changed = false;
  state.mallItems = state.mallItems.map((item) => {
    const target = targetById.get(Number(item.id));
    if (!target) return item;
    if (Number(item.pointsCost) === target) return item;
    changed = true;
    return { ...item, pointsCost: target };
  });
  return changed;
}

function ensureDomainSeedsFromFile() {
  const fileState = loadStateFromFile();
  let changed = false;

  const fillArray = (key) => {
    if (ensureArray(state[key]).length > 0) return;
    const fromFile = ensureArray(fileState[key]);
    if (fromFile.length === 0) return;
    state[key] = structuredClone(fromFile);
    changed = true;
  };

  fillArray('learningCourses');
  fillArray('learningGames');
  fillArray('learningTools');
  fillArray('familyMembers');
  fillArray('insuranceReminders');
  fillArray('policies');

  if ((!state.insuranceSummary || Object.keys(state.insuranceSummary).length === 0) && fileState.insuranceSummary) {
    state.insuranceSummary = structuredClone(fileState.insuranceSummary);
    changed = true;
  }
  if (ensureArray(state.policies).length > 0) {
    const current = state.insuranceSummary || {};
    const shouldRebuild =
      !current ||
      Object.keys(current).length === 0 ||
      Number(current.activePolicies || 0) === 0 ||
      Number(current.totalCoverage || 0) === 0;
    if (shouldRebuild) {
      state.insuranceSummary = buildInsuranceSummary(state.policies, Number(current.healthScore || 85));
      changed = true;
    }
  }

  if ((!state.insuranceSummary || Object.keys(state.insuranceSummary).length === 0) && ensureArray(state.policies).length > 0) {
    state.insuranceSummary = buildInsuranceSummary(state.policies, 85);
    changed = true;
  }

  return changed;
}

async function ensureRelationalSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS p_sessions (
      token TEXT PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_sms_codes (
      id BIGINT PRIMARY KEY,
      mobile TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_orders (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      product_id BIGINT NOT NULL REFERENCES p_products(id),
      product_name TEXT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      points_amount INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      fulfillment_status TEXT NOT NULL,
      refund_status TEXT NOT NULL,
      order_no TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_order_payments (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      order_id BIGINT NOT NULL REFERENCES p_orders(id),
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      amount INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_order_fulfillments (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      order_id BIGINT NOT NULL REFERENCES p_orders(id),
      mode TEXT NOT NULL,
      operator_agent_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_order_refunds (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      order_id BIGINT NOT NULL REFERENCES p_orders(id),
      refund_type TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS c_activity_completions (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      activity_id BIGINT NOT NULL REFERENCES p_activities(id),
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS c_sign_ins (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      sign_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_idempotency_records (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      biz_type TEXT NOT NULL,
      biz_key TEXT NOT NULL,
      response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS c_policy_responsibilities (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      policy_id BIGINT NOT NULL REFERENCES c_policies(id),
      name TEXT NOT NULL,
      description TEXT,
      limit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS c_policy_payment_history (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      policy_id BIGINT NOT NULL REFERENCES c_policies(id),
      payment_date DATE NOT NULL,
      amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      note TEXT,
      status TEXT,
      sort_order INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS p_track_events (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      actor_type TEXT NOT NULL,
      actor_id BIGINT NOT NULL DEFAULT 0,
      org_id BIGINT NOT NULL DEFAULT 1,
      team_id BIGINT NOT NULL DEFAULT 1,
      event_name TEXT NOT NULL,
      properties JSONB,
      path TEXT,
      source TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function loadStateFromPostgresTables() {
  const usersRows = (await pool.query('SELECT * FROM c_customers WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const txRows = (await pool.query('SELECT * FROM c_point_transactions WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const mallRows = (await pool.query('SELECT * FROM p_products WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const redemptionsRows = (await pool.query('SELECT * FROM c_redeem_records WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const sessionsRows = (await pool.query('SELECT * FROM p_sessions ORDER BY created_at ASC')).rows;
  const smsRows = (await pool.query('SELECT * FROM p_sms_codes ORDER BY id ASC')).rows;
  const orderRows = (await pool.query('SELECT * FROM p_orders ORDER BY id ASC')).rows;
  const orderPaymentRows = (await pool.query('SELECT * FROM p_order_payments ORDER BY id ASC')).rows;
  const orderFulfillmentRows = (await pool.query('SELECT * FROM p_order_fulfillments ORDER BY id ASC')).rows;
  const orderRefundRows = (await pool.query('SELECT * FROM p_order_refunds ORDER BY id ASC')).rows;
  const writeoffRows = (await pool.query('SELECT * FROM b_write_off_records WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const learningRows = (await pool.query('SELECT * FROM p_learning_materials WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const completionRows = (await pool.query('SELECT * FROM c_learning_records WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const policyRows = (await pool.query('SELECT * FROM c_policies WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const responsibilityRows = (await pool.query('SELECT * FROM c_policy_responsibilities ORDER BY sort_order ASC, id ASC')).rows;
  const paymentHistoryRows = (await pool.query('SELECT * FROM c_policy_payment_history ORDER BY sort_order ASC, id ASC')).rows;
  const activitiesRows = (await pool.query('SELECT * FROM p_activities WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const activityCompletionRows = (await pool.query('SELECT * FROM c_activity_completions ORDER BY id ASC')).rows;
  const signInRows = (await pool.query('SELECT * FROM c_sign_ins ORDER BY id ASC')).rows;
  const idemRows = (await pool.query('SELECT * FROM p_idempotency_records ORDER BY id ASC')).rows;
  const trackRows = (await pool.query('SELECT * FROM p_track_events ORDER BY id ASC')).rows;

  const hasAnyData =
    usersRows.length || txRows.length || mallRows.length || redemptionsRows.length || learningRows.length || policyRows.length;
  if (!hasAnyData) return null;

  const txMapped = txRows.map((row) => ({
    id: Number(row.id),
    userId: Number(row.customer_id),
    type: row.direction === 'out' ? 'consume' : 'earn',
    amount: Number(row.amount || 0),
    source: row.source_type || '',
    sourceId: row.source_id || '',
    idempotencyKey: row.idempotency_key || '',
    balance: Number(row.balance_after || 0),
    description: '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }));

  const accountsMapped = [];
  if (!accountsMapped.length && txMapped.length) {
    const latestByUser = new Map();
    for (const tx of txMapped) {
      const prev = latestByUser.get(tx.userId);
      if (!prev || Number(tx.id) > Number(prev.id)) latestByUser.set(tx.userId, tx);
    }
    for (const tx of latestByUser.values()) {
      accountsMapped.push({
        userId: Number(tx.userId),
        balance: Number(tx.balance || 0),
        updatedAt: tx.createdAt || new Date().toISOString(),
      });
    }
  }

  const responsibilitiesByPolicy = new Map();
  for (const row of responsibilityRows) {
    const key = Number(row.policy_id || row.c_policy_id);
    if (!responsibilitiesByPolicy.has(key)) responsibilitiesByPolicy.set(key, []);
    responsibilitiesByPolicy.get(key).push({
      name: row.name,
      desc: row.description || '',
      limit: Number(row.limit_amount || 0),
    });
  }

  const paymentHistoryByPolicy = new Map();
  for (const row of paymentHistoryRows) {
    const key = Number(row.policy_id || row.c_policy_id);
    if (!paymentHistoryByPolicy.has(key)) paymentHistoryByPolicy.set(key, []);
    paymentHistoryByPolicy.get(key).push({
      date: row.payment_date ? new Date(row.payment_date).toISOString().slice(0, 10) : '',
      amount: Number(row.amount || 0),
      note: row.note || '',
      status: row.status || '',
    });
  }

  const mappedPolicies = policyRows.map((row) => ({
    id: Number(row.id),
    company: row.company || '',
    name: row.policy_name || row.name || '',
    type: row.policy_type || row.type || '',
    amount: Number(row.amount || 0),
    nextPayment: row.period_start ? new Date(row.period_start).toISOString().slice(0, 10) : null,
    status: row.status === 'active' ? '保障中' : row.status || '',
    applicant: '',
    insured: '',
    periodStart: row.period_start ? new Date(row.period_start).toISOString().slice(0, 10) : null,
    periodEnd: row.period_end || '',
    annualPremium: Number(row.annual_premium || 0),
    paymentPeriod: '',
    coveragePeriod: '',
    policyNo: row.policy_no || '',
    createdBy: Number(row.customer_id || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    responsibilities: responsibilitiesByPolicy.get(Number(row.id)) || [],
    paymentHistory: paymentHistoryByPolicy.get(Number(row.id)) || [],
  }));

  const redemptions = redemptionsRows.map((row) => ({
    id: Number(row.id),
    orderId: null,
    userId: Number(row.customer_id),
    itemId: Number(row.product_id),
    pointsCost: Number(row.points_cost || 0),
    status: row.status,
    writeoffToken: row.writeoff_token,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    writtenOffAt: row.written_off_at ? new Date(row.written_off_at).toISOString() : null,
  }));

  const insuranceSummary = buildInsuranceSummary(mappedPolicies, state.insuranceSummary?.healthScore || 85);

  return {
    ...structuredClone(initialState),
    users: usersRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      orgId: 1,
      teamId: 1,
      ownerUserId: Number(row.owner_agent_id || row.id),
      name: row.name,
      mobile: row.mobile_enc || row.mobile_masked || '',
      isVerifiedBasic: Boolean(row.is_verified_basic),
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    pointAccounts: accountsMapped,
    pointTransactions: txMapped,
    activities:
      activitiesRows.length > 0
        ? activitiesRows.map((row) => ({
            id: Number(row.id),
            title: row.title,
            category: row.category,
            rewardPoints: Number(row.reward_points || 0),
            sortOrder: Number(row.sort_order || 0),
            participants: 0,
          }))
        : structuredClone(initialState.activities),
    mallItems: mallRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      pointsCost: Number(row.points_cost || 0),
      stock: Number(row.stock || 0),
      isActive: row.shelf_status === 'on',
    })),
    redemptions,
    sessions: sessionsRows.map((row) => ({
      token: row.token,
      userId: Number(row.customer_id),
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    smsCodes: smsRows.map((row) => ({
      id: Number(row.id),
      mobile: row.mobile,
      code: row.code,
      expiresAt: new Date(row.expires_at).toISOString(),
      used: Boolean(row.used),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    orders: orderRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      customerId: Number(row.customer_id),
      productId: Number(row.product_id),
      productName: row.product_name,
      quantity: Number(row.quantity || 1),
      pointsAmount: Number(row.points_amount || 0),
      status: row.status,
      paymentStatus: row.payment_status,
      fulfillmentStatus: row.fulfillment_status,
      refundStatus: row.refund_status,
      orderNo: row.order_no,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    })),
    orderPayments: orderPaymentRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      orderId: Number(row.order_id),
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      amount: Number(row.amount || 0),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    orderFulfillments: orderFulfillmentRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      orderId: Number(row.order_id),
      mode: row.mode,
      operatorAgentId: Number(row.operator_agent_id),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    orderRefunds: orderRefundRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      orderId: Number(row.order_id),
      refundType: row.refund_type,
      status: row.status,
      reason: row.reason || '',
      createdAt: new Date(row.created_at).toISOString(),
    })),
    bWriteOffRecords: writeoffRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      redeemRecordId: Number(row.redeem_record_id),
      operatorAgentId: Number(row.operator_agent_id),
      writeoffToken: row.writeoff_token,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    learningCourses: learningRows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      desc: '',
      type: row.material_type || 'article',
      typeLabel: '',
      progress: 0,
      timeLeft: '',
      image: row.content_url || '',
      action: '',
      color: '',
      btnColor: '',
      points: 0,
      category: row.category || '',
      content: row.content_url || '',
    })),
    courseCompletions: completionRows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.customer_id),
      courseId: Number(row.material_id || 0),
      pointsAwarded: Number(row.points_awarded || 0),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    policies: mappedPolicies,
    insuranceSummary,
    activityCompletions: activityCompletionRows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.customer_id),
      activityId: Number(row.activity_id),
      completedAt: new Date(row.completed_at).toISOString(),
    })),
    signIns: signInRows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.customer_id),
      signDate: new Date(row.sign_date).toISOString().slice(0, 10),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    idempotencyRecords: idemRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      bizType: row.biz_type,
      bizKey: row.biz_key,
      response: row.response || null,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    trackEvents: trackRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      actorType: row.actor_type || 'anonymous',
      actorId: Number(row.actor_id || 0),
      orgId: Number(row.org_id || 1),
      teamId: Number(row.team_id || 1),
      event: row.event_name || '',
      properties: row.properties || {},
      path: row.path || '',
      source: row.source || '',
      userAgent: row.user_agent || '',
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

function buildInsuranceSummary(policies, healthScore = 85) {
  const activePolicies = ensureArray(policies).filter((p) => p.status === '保障中').length;
  const totalCoverage = ensureArray(policies).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const annualPremium = ensureArray(policies).reduce((sum, p) => sum + Number(p.annualPremium || 0), 0);
  return { totalCoverage, activePolicies, annualPremium, healthScore };
}

async function truncateAndInsert(client, tableName, columns, rows) {
  await client.query(`DELETE FROM ${tableName}`);
  if (!rows.length) return;
  for (const row of rows) {
    const values = columns.map((col) => {
      const raw = row[col];
      if (raw === undefined) return null;
      if (typeof raw === 'number' && !Number.isFinite(raw)) return null;
      return raw;
    });
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
  }
}

async function writeStateToPostgresTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const responsibilitiesRows = [];
    const paymentHistoryRows = [];
    for (const policy of ensureArray(state.policies)) {
      for (const [idx, item] of ensureArray(policy.responsibilities).entries()) {
        responsibilitiesRows.push({
          id: nextId(responsibilitiesRows),
          tenant_id: 1,
          policy_id: Number(policy.id),
          name: item.name || '',
          description: item.desc || '',
          limit_amount: Number(item.limit || 0),
          sort_order: idx + 1,
        });
      }
      for (const [idx, item] of ensureArray(policy.paymentHistory).entries()) {
        paymentHistoryRows.push({
          id: nextId(paymentHistoryRows),
          tenant_id: 1,
          policy_id: Number(policy.id),
          payment_date: item.date || dateOnly(),
          amount: Number(item.amount || 0),
          note: item.note || '',
          status: item.status || '',
          sort_order: idx + 1,
        });
      }
    }

    await client.query(`
      INSERT INTO p_tenants (id, tenant_code, tenant_type, name, status, package_name, quota_max_customers, quota_max_templates, created_at, updated_at, is_deleted)
      VALUES (1, 'default', 'company', '默认租户', 'active', 'default', 0, 0, NOW(), NOW(), FALSE)
      ON CONFLICT (id) DO NOTHING
    `);

    const clearOrder = [
      'p_track_events',
      'b_write_off_records',
      'c_redeem_records',
      'p_order_refunds',
      'p_order_fulfillments',
      'p_order_payments',
      'p_orders',
      'c_activity_completions',
      'c_sign_ins',
      'p_sessions',
      'p_sms_codes',
      'p_idempotency_records',
      'c_learning_records',
      'p_learning_materials',
      'c_policy_payment_history',
      'c_policy_responsibilities',
      'c_policies',
      'c_point_transactions',
      'p_activities',
      'p_products',
      'b_agents',
      'c_customers',
    ];
    for (const tableName of clearOrder) {
      await client.query(`DELETE FROM ${tableName}`);
    }

    await truncateAndInsert(
      client,
      'c_customers',
      ['id', 'tenant_id', 'owner_agent_id', 'name', 'mobile_enc', 'mobile_masked', 'is_verified_basic', 'verified_at', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.users).map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        owner_agent_id: Number(row.ownerUserId || row.id || 0) || null,
        name: row.name || '',
        mobile_enc: row.mobile || '',
        mobile_masked: row.mobile || '',
        is_verified_basic: Boolean(row.isVerifiedBasic),
        verified_at: row.verifiedAt || null,
        created_by: Number(row.ownerUserId || row.id || 0) || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    await truncateAndInsert(
      client,
      'b_agents',
      ['id', 'tenant_id', 'employee_id', 'display_name', 'avatar_url', 'title', 'bio', 'status', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.agents).map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        employee_id: row.employeeId ? Number(row.employeeId) : null,
        display_name: row.name || `Agent-${row.id}`,
        avatar_url: row.avatarUrl || null,
        title: row.title || null,
        bio: row.bio || null,
        status: row.status || 'active',
        created_by: Number(row.createdBy || row.id || 0) || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    await truncateAndInsert(
      client,
      'p_products',
      ['id', 'tenant_id', 'name', 'description', 'points_cost', 'stock', 'shelf_status', 'sort_order', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.mallItems).map((row) => ({
        id: Number(row.id),
        tenant_id: 1,
        name: row.name || '',
        description: '',
        points_cost: Number(row.pointsCost || 0),
        stock: Number(row.stock || 0),
        shelf_status: row.isActive ? 'on' : 'off',
        sort_order: 0,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    await truncateAndInsert(
      client,
      'p_activities',
      ['id', 'tenant_id', 'title', 'category', 'reward_points', 'start_at', 'end_at', 'status', 'sort_order', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.activities).map((row) => ({
        id: Number(row.id),
        tenant_id: 1,
        title: row.title || '',
        category: row.category || 'task',
        reward_points: Number(row.rewardPoints || 0),
        start_at: null,
        end_at: null,
        status: 'published',
        sort_order: Number(row.sortOrder || 0),
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    await truncateAndInsert(
      client,
      'p_learning_materials',
      ['id', 'tenant_id', 'title', 'material_type', 'category', 'difficulty', 'status', 'content_url', 'sort_order', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.learningCourses).map((row, idx) => ({
        id: Number(row.id),
        tenant_id: 1,
        title: row.title || '',
        material_type: row.type || 'article',
        category: row.category || null,
        difficulty: null,
        status: 'published',
        content_url: row.image || row.content || null,
        sort_order: idx,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    await truncateAndInsert(
      client,
      'c_policies',
      ['id', 'tenant_id', 'customer_id', 'family_member_id', 'company', 'policy_name', 'policy_no', 'policy_type', 'amount', 'annual_premium', 'period_start', 'period_end', 'status', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.policies).map((row) => ({
        id: Number(row.id),
        tenant_id: 1,
        customer_id: Number(row.createdBy || 0) || 1,
        family_member_id: null,
        company: row.company || '',
        policy_name: row.name || '',
        policy_no: row.policyNo || null,
        policy_type: row.type || null,
        amount: Number(row.amount || 0),
        annual_premium: Number(row.annualPremium || 0),
        period_start: row.periodStart || null,
        period_end: row.periodEnd === '终身' ? null : row.periodEnd || null,
        status: row.status === '保障中' ? 'active' : row.status || 'active',
        created_by: Number(row.createdBy || 0) || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    await truncateAndInsert(
      client,
      'c_point_transactions',
      ['id', 'tenant_id', 'customer_id', 'direction', 'amount', 'source_type', 'source_id', 'idempotency_key', 'balance_after', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.pointTransactions)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: 1,
          customer_id: toFiniteNumber(row.userId, null),
          direction: row.type === 'consume' ? 'out' : 'in',
          amount: Math.abs(toFiniteNumber(row.amount, 0)),
          source_type: row.source || '',
          source_id: row.sourceId || '',
          idempotency_key: row.idempotencyKey || `tx-${idx + 1}`,
          balance_after: toFiniteNumber(row.balance, 0),
          created_by: toFiniteNumber(row.userId, null),
          created_at: row.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        }))
        .filter((row) => row.customer_id !== null)
        .map((row, idx) => ({
          ...row,
          id: toFiniteNumber(row.id, idx + 1),
        }))
    );

    await truncateAndInsert(
      client,
      'p_sms_codes',
      ['id', 'mobile', 'code', 'expires_at', 'used', 'created_at'],
      ensureArray(state.smsCodes).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        mobile: row.mobile,
        code: row.code,
        expires_at: row.expiresAt || new Date().toISOString(),
        used: Boolean(row.used),
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    await truncateAndInsert(
      client,
      'p_sessions',
      ['token', 'customer_id', 'expires_at', 'created_at'],
      ensureArray(state.sessions)
        .map((row) => ({
          token: row.token,
          customer_id: toFiniteNumber(row.userId, null),
          expires_at: row.expiresAt || new Date().toISOString(),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.customer_id !== null)
    );

    await truncateAndInsert(
      client,
      'p_orders',
      ['id', 'tenant_id', 'customer_id', 'product_id', 'product_name', 'quantity', 'points_amount', 'status', 'payment_status', 'fulfillment_status', 'refund_status', 'order_no', 'created_at', 'updated_at'],
      ensureArray(state.orders)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          customer_id: toFiniteNumber(row.customerId, null),
          product_id: toFiniteNumber(row.productId, null),
          product_name: row.productName || '',
          quantity: toFiniteNumber(row.quantity, 1),
          points_amount: toFiniteNumber(row.pointsAmount, 0),
          status: row.status || 'created',
          payment_status: row.paymentStatus || 'pending',
          fulfillment_status: row.fulfillmentStatus || 'pending',
          refund_status: row.refundStatus || 'none',
          order_no: row.orderNo || '',
          created_at: row.createdAt || new Date().toISOString(),
          updated_at: row.updatedAt || new Date().toISOString(),
        }))
        .filter((row) => row.customer_id !== null && row.product_id !== null)
    );

    await truncateAndInsert(
      client,
      'c_redeem_records',
      ['id', 'tenant_id', 'customer_id', 'product_id', 'points_cost', 'writeoff_token', 'status', 'expires_at', 'written_off_at', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.redemptions)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: 1,
          customer_id: toFiniteNumber(row.userId, null),
          product_id: toFiniteNumber(row.itemId, null),
          points_cost: toFiniteNumber(row.pointsCost, 0),
          writeoff_token: row.writeoffToken || `EX-${idx + 1}`,
          status: row.status || 'pending',
          expires_at: row.expiresAt || null,
          written_off_at: row.writtenOffAt || null,
          created_by: toFiniteNumber(row.userId, null),
          created_at: row.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        }))
        .filter((row) => row.customer_id !== null && row.product_id !== null)
    );

    await truncateAndInsert(
      client,
      'c_sign_ins',
      ['id', 'tenant_id', 'customer_id', 'sign_date', 'created_at'],
      ensureArray(state.signIns)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: 1,
          customer_id: toFiniteNumber(row.userId, null),
          sign_date: row.signDate || dateOnly(),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.customer_id !== null)
    );

    await truncateAndInsert(
      client,
      'c_activity_completions',
      ['id', 'tenant_id', 'customer_id', 'activity_id', 'completed_at'],
      ensureArray(state.activityCompletions)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: 1,
          customer_id: toFiniteNumber(row.userId, null),
          activity_id: toFiniteNumber(row.activityId, null),
          completed_at: row.completedAt || row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.customer_id !== null && row.activity_id !== null)
    );

    await truncateAndInsert(
      client,
      'c_learning_records',
      ['id', 'tenant_id', 'customer_id', 'material_id', 'title', 'material_type', 'progress', 'points_awarded', 'completed_at', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.courseCompletions)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: 1,
          customer_id: toFiniteNumber(row.userId, null),
          material_id: toFiniteNumber(row.courseId, null),
          title: ensureArray(state.learningCourses).find((c) => Number(c.id) === Number(row.courseId))?.title || '学习记录',
          material_type: ensureArray(state.learningCourses).find((c) => Number(c.id) === Number(row.courseId))?.type || 'article',
          progress: 100,
          points_awarded: toFiniteNumber(row.pointsAwarded, 0),
          completed_at: row.createdAt || new Date().toISOString(),
          created_by: toFiniteNumber(row.userId, null),
          created_at: row.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        }))
        .filter((row) => row.customer_id !== null)
    );

    await truncateAndInsert(
      client,
      'c_policy_responsibilities',
      ['id', 'tenant_id', 'policy_id', 'name', 'description', 'limit_amount', 'sort_order'],
      responsibilitiesRows
    );

    await truncateAndInsert(
      client,
      'c_policy_payment_history',
      ['id', 'tenant_id', 'policy_id', 'payment_date', 'amount', 'note', 'status', 'sort_order'],
      paymentHistoryRows
    );

    await truncateAndInsert(
      client,
      'p_order_payments',
      ['id', 'tenant_id', 'order_id', 'payment_method', 'payment_status', 'amount', 'created_at'],
      ensureArray(state.orderPayments)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          order_id: toFiniteNumber(row.orderId, null),
          payment_method: row.paymentMethod || 'points',
          payment_status: row.paymentStatus || 'paid',
          amount: toFiniteNumber(row.amount, 0),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.order_id !== null)
    );

    await truncateAndInsert(
      client,
      'p_order_fulfillments',
      ['id', 'tenant_id', 'order_id', 'mode', 'operator_agent_id', 'created_at'],
      ensureArray(state.orderFulfillments)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          order_id: toFiniteNumber(row.orderId, null),
          mode: row.mode || 'writeoff',
          operator_agent_id: toFiniteNumber(row.operatorAgentId, 0),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.order_id !== null)
    );

    await truncateAndInsert(
      client,
      'p_order_refunds',
      ['id', 'tenant_id', 'order_id', 'refund_type', 'status', 'reason', 'created_at'],
      ensureArray(state.orderRefunds)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          order_id: toFiniteNumber(row.orderId, null),
          refund_type: row.refundType || 'manual',
          status: row.status || 'success',
          reason: row.reason || '',
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.order_id !== null)
    );

    await truncateAndInsert(
      client,
      'b_write_off_records',
      ['id', 'tenant_id', 'redeem_record_id', 'operator_agent_id', 'writeoff_token', 'status', 'reason', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.bWriteOffRecords)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          redeem_record_id: toFiniteNumber(row.redeemRecordId, null),
          operator_agent_id: toFiniteNumber(row.operatorAgentId, 0),
          writeoff_token: row.writeoffToken || '',
          status: row.status || 'success',
          reason: row.reason || null,
          created_by: toFiniteNumber(row.operatorAgentId, null),
          created_at: row.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        }))
        .filter((row) => row.redeem_record_id !== null)
    );

    await truncateAndInsert(
      client,
      'p_idempotency_records',
      ['id', 'tenant_id', 'biz_type', 'biz_key', 'response', 'created_at'],
      ensureArray(state.idempotencyRecords).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        biz_type: row.bizType,
        biz_key: row.bizKey,
        response: row.response || null,
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    await truncateAndInsert(
      client,
      'p_track_events',
      ['id', 'tenant_id', 'actor_type', 'actor_id', 'org_id', 'team_id', 'event_name', 'properties', 'path', 'source', 'user_agent', 'created_at'],
      ensureArray(state.trackEvents).map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        actor_type: String(row.actorType || 'anonymous'),
        actor_id: Number(row.actorId || 0),
        org_id: Number(row.orgId || 1),
        team_id: Number(row.teamId || 1),
        event_name: String(row.event || ''),
        properties: row.properties || {},
        path: row.path || null,
        source: row.source || null,
        user_agent: row.userAgent || null,
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
