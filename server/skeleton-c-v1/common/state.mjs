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
  tenants: [
    { id: 1, name: '平台租户', status: 'active', type: 'company', createdAt: new Date().toISOString() },
    { id: 2, name: '隔离租户A', status: 'active', type: 'company', createdAt: new Date().toISOString() },
    { id: 3, name: '隔离租户B', status: 'active', type: 'company', createdAt: new Date().toISOString() },
    { id: 4, name: '隔离租户C', status: 'active', type: 'company', createdAt: new Date().toISOString() },
  ],
  orgUnits: [
    { id: 1, tenantId: 1, name: '平台机构', createdAt: new Date().toISOString() },
    { id: 2, tenantId: 2, name: '租户A机构', createdAt: new Date().toISOString() },
    { id: 3, tenantId: 3, name: '租户B机构', createdAt: new Date().toISOString() },
    { id: 4, tenantId: 4, name: '租户C机构', createdAt: new Date().toISOString() },
  ],
  teams: [
    { id: 1, tenantId: 1, orgId: 1, name: '平台团队', createdAt: new Date().toISOString() },
    { id: 2, tenantId: 2, orgId: 2, name: '租户A团队', createdAt: new Date().toISOString() },
    { id: 3, tenantId: 3, orgId: 3, name: '租户B团队', createdAt: new Date().toISOString() },
    { id: 4, tenantId: 4, orgId: 4, name: '租户C团队', createdAt: new Date().toISOString() },
  ],
  agents: [
    {
      id: 8201,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '租户A管理员',
      status: 'active',
      role: 'manager',
      account: 'tenanta_admin',
      email: 'tenanta_admin@demo.local',
      mobile: '13810000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8202,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '租户A业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenanta_agent1',
      email: 'tenanta_agent1@demo.local',
      mobile: '13810000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8301,
      tenantId: 3,
      orgId: 3,
      teamId: 3,
      name: '租户B管理员',
      status: 'active',
      role: 'manager',
      account: 'tenantb_admin',
      email: 'tenantb_admin@demo.local',
      mobile: '13820000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8302,
      tenantId: 3,
      orgId: 3,
      teamId: 3,
      name: '租户B业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenantb_agent1',
      email: 'tenantb_agent1@demo.local',
      mobile: '13820000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8401,
      tenantId: 4,
      orgId: 4,
      teamId: 4,
      name: '租户C管理员',
      status: 'active',
      role: 'manager',
      account: 'tenantc_admin',
      email: 'tenantc_admin@demo.local',
      mobile: '13830000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8402,
      tenantId: 4,
      orgId: 4,
      teamId: 4,
      name: '租户C业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenantc_agent1',
      email: 'tenantc_agent1@demo.local',
      mobile: '13830000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
  ],
  roles: [],
  permissions: [],
  rolePermissions: [],
  userRoles: [],
  approvals: [],
  auditLogs: [],
  trackEvents: [],
  metricDailyUv: [],
  metricDailyCounters: [],
  metricHourlyCounters: [],
  idempotencyRecords: [],
  domainEvents: [],
  outboxEvents: [],
  smsCodes: [],
  sessions: [],
  actorCsrfTokens: [],
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
  mallActivities: [],
  eventDefinitions: [],
  pTags: [],
  pTagRules: [],
  pTagRuleJobs: [],
  pTagRuleJobLogs: [],
  metricRules: [],
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
  if (
    ensureArray(state.metricDailyUv).length === 0 &&
    ensureArray(state.metricDailyCounters).length === 0 &&
    ensureArray(state.metricHourlyCounters).length === 0
  ) {
    rebuildMetricAggregatesFromEvents();
    if (usePostgres) await writeStateToPostgresTables();
  }

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
    nick_name: user.nickName || '',
    avatar_url: user.avatarUrl || '',
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
  const row = {
    id: nextId(state.auditLogs),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  state.auditLogs.push(row);
  applyAuditMetricAggregates(row);
}

export function appendTrackEvent(entry) {
  if (!Array.isArray(state.trackEvents)) state.trackEvents = [];
  const row = {
    id: nextId(state.trackEvents),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  state.trackEvents.push(row);
  applyTrackMetricAggregates(row);
}

function dayKeyByDate(input) {
  const d = new Date(input || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hourKeyByDate(input) {
  const d = new Date(input || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}`;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function upsertMetricDailyUv({ tenantId, statDate, metricKey, actorId, createdAt }) {
  if (!Array.isArray(state.metricDailyUv)) state.metricDailyUv = [];
  const t = asNumber(tenantId, 1);
  const a = asNumber(actorId, 0);
  if (!statDate || !metricKey || !a) return;
  const exists = state.metricDailyUv.some(
    (row) =>
      asNumber(row.tenantId, 1) === t &&
      String(row.statDate || '') === String(statDate) &&
      String(row.metricKey || '') === String(metricKey) &&
      asNumber(row.actorId, 0) === a
  );
  if (exists) return;
  state.metricDailyUv.push({
    id: nextId(state.metricDailyUv),
    tenantId: t,
    statDate: String(statDate),
    metricKey: String(metricKey),
    actorId: a,
    createdAt: createdAt || new Date().toISOString(),
  });
}

function upsertMetricCounter({ type, tenantId, dateKey, metricKey, actorId = 0, delta = 1 }) {
  if (type === 'daily' && !Array.isArray(state.metricDailyCounters)) state.metricDailyCounters = [];
  if (type === 'hourly' && !Array.isArray(state.metricHourlyCounters)) state.metricHourlyCounters = [];
  const list = type === 'daily' ? state.metricDailyCounters : state.metricHourlyCounters;
  const t = asNumber(tenantId, 1);
  const a = asNumber(actorId, 0);
  const idx = list.findIndex(
    (row) =>
      asNumber(row.tenantId, 1) === t &&
      String(type === 'daily' ? row.statDate : row.hourKey) === String(dateKey) &&
      String(row.metricKey || '') === String(metricKey) &&
      asNumber(row.actorId, 0) === a
  );
  if (idx >= 0) {
    list[idx].cnt = asNumber(list[idx].cnt, 0) + asNumber(delta, 0);
    list[idx].updatedAt = new Date().toISOString();
    return;
  }
  list.push({
    id: nextId(list),
    tenantId: t,
    ...(type === 'daily' ? { statDate: String(dateKey) } : { hourKey: String(dateKey) }),
    metricKey: String(metricKey),
    actorId: a,
    cnt: asNumber(delta, 0),
    updatedAt: new Date().toISOString(),
  });
}

function isCustomerTrack(row) {
  const actorType = String(row?.actorType || '').toLowerCase();
  const source = String(row?.source || '').toLowerCase();
  return actorType === 'customer' || source === 'c-web';
}

function isBTrack(row) {
  const source = String(row?.source || '').toLowerCase();
  const event = String(row?.event || '').toLowerCase();
  return source === 'b-web' || event.startsWith('b_');
}

function applyTrackMetricAggregates(row) {
  const tenantId = asNumber(row?.tenantId, 1);
  const actorId = asNumber(row?.actorId, 0);
  const event = String(row?.event || '').toLowerCase();
  const createdAt = row?.createdAt || new Date().toISOString();
  const statDate = dayKeyByDate(createdAt);
  const hourKey = hourKeyByDate(createdAt);
  if (!statDate || !hourKey) return;

  if (isCustomerTrack(row) && actorId > 0) {
    upsertMetricDailyUv({ tenantId, statDate, metricKey: 'c_dau', actorId, createdAt });
  }
  if (isBTrack(row) && actorId > 0) {
    upsertMetricDailyUv({ tenantId, statDate, metricKey: 'b_dau', actorId, createdAt });
  }

  const props = row?.properties || {};
  const relatedCustomerId = asNumber(props.customerId ?? props.customer_id ?? 0, 0);
  if (isBTrack(row) && relatedCustomerId > 0) {
    upsertMetricDailyUv({ tenantId, statDate, metricKey: 'b_interaction_customer', actorId: relatedCustomerId, createdAt });
  }

  if (actorId > 0 && event === 'c_share_success') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'c_share_success_cnt', actorId, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'c_share_success_cnt', actorId, delta: 1 });
  }
  if (actorId > 0 && event === 'b_tools_share_success') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'b_share_success_cnt', actorId, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'b_share_success_cnt', actorId, delta: 1 });
  }

  if (isBTrack(row) && event.includes('remind')) {
    if (event.includes('click')) {
      upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'b_remind_click', actorId, delta: 1 });
      upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'b_remind_click', actorId, delta: 1 });
    }
    if (event.includes('push') || event.includes('send') || event.includes('show')) {
      upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'b_remind_push', actorId, delta: 1 });
      upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'b_remind_push', actorId, delta: 1 });
    }
  }
}

function applyAuditMetricAggregates(row) {
  const tenantId = asNumber(row?.tenantId, 1);
  const createdAt = row?.createdAt || new Date().toISOString();
  const statDate = dayKeyByDate(createdAt);
  const hourKey = hourKeyByDate(createdAt);
  if (!statDate || !hourKey) return;
  upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'api_total', actorId: 0, delta: 1 });
  upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'api_total', actorId: 0, delta: 1 });
  const result = String(row?.result || '').toLowerCase();
  if (result === 'success') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'api_success', actorId: 0, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'api_success', actorId: 0, delta: 1 });
  } else if (result === 'fail') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'api_fail', actorId: 0, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'api_fail', actorId: 0, delta: 1 });
  }
}

function rebuildMetricAggregatesFromEvents() {
  state.metricDailyUv = [];
  state.metricDailyCounters = [];
  state.metricHourlyCounters = [];
  ensureArray(state.trackEvents).forEach((row) => applyTrackMetricAggregates(row));
  ensureArray(state.auditLogs).forEach((row) => applyAuditMetricAggregates(row));
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
    csrfToken: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export function createActorSession(actor) {
  const token = crypto.randomUUID();
  const actorType = String(actor?.actorType || '').trim().toLowerCase();
  const actorId = Number(actor?.actorId || 0);
  const tenantId = Number(actor?.tenantId || 0) || null;
  const orgId = Number(actor?.orgId || 0) || null;
  const teamId = Number(actor?.teamId || 0) || null;

  state.sessions.push({
    token,
    userId: actorType === 'customer' ? actorId : null,
    actorType,
    actorId,
    tenantId,
    orgId,
    teamId,
    csrfToken: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export function resolveSessionFromBearer(authorization) {
  const auth = String(authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  if (!session.csrfToken) {
    session.csrfToken = crypto.randomUUID();
  }
  return session;
}

export function resolveUserFromBearer(authorization) {
  const session = resolveSessionFromBearer(authorization);
  if (!session) return null;
  const actorType = String(session.actorType || '').toLowerCase();
  const actorId = Number(session.actorId || 0);
  if (actorType === 'employee' || actorType === 'agent') {
    const agent = (state.agents || []).find((x) => Number(x.id) === actorId);
    if (agent) {
      return {
        id: Number(agent.id),
        actorType,
        tenantId: Number(agent.tenantId || session.tenantId || 0) || null,
        orgId: Number(agent.orgId || session.orgId || 0) || null,
        teamId: Number(agent.teamId || session.teamId || 0) || null,
        ownerUserId: 0,
        name: String(agent.name || ''),
        mobile: String(agent.mobile || ''),
        email: String(agent.email || ''),
      };
    }
    if (actorType === 'employee' && actorId === 9001) {
      return {
        id: 9001,
        actorType: 'employee',
        tenantId: Number(session.tenantId || 1),
        orgId: Number(session.orgId || 1),
        teamId: Number(session.teamId || 1),
        ownerUserId: 0,
        name: '平台管理员',
        mobile: '',
        email: '',
      };
    }
    return null;
  }

  return state.users.find((u) => u.id === Number(session.userId || actorId)) || null;
}

export function upsertActorCsrfToken({ tenantId, actorType, actorId }) {
  if (!Array.isArray(state.actorCsrfTokens)) state.actorCsrfTokens = [];
  const token = crypto.randomUUID();
  const t = Number(tenantId || 1);
  const aType = String(actorType || '');
  const aId = Number(actorId || 0);
  const idx = state.actorCsrfTokens.findIndex(
    (x) => Number(x.tenantId || 1) === t && String(x.actorType || '') === aType && Number(x.actorId || 0) === aId
  );
  const row = {
    tenantId: t,
    actorType: aType,
    actorId: aId,
    token,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) state.actorCsrfTokens[idx] = row;
  else state.actorCsrfTokens.push(row);
  return token;
}

export function resolveActorCsrfToken({ tenantId, actorType, actorId }) {
  const row = (state.actorCsrfTokens || []).find(
    (x) =>
      Number(x.tenantId || 1) === Number(tenantId || 1) &&
      String(x.actorType || '') === String(actorType || '') &&
      Number(x.actorId || 0) === Number(actorId || 0)
  );
  return row ? String(row.token || '') : '';
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
      metricDailyUv: Array.isArray(parsed.metricDailyUv) ? parsed.metricDailyUv : [],
      metricDailyCounters: Array.isArray(parsed.metricDailyCounters) ? parsed.metricDailyCounters : [],
      metricHourlyCounters: Array.isArray(parsed.metricHourlyCounters) ? parsed.metricHourlyCounters : [],
      idempotencyRecords: Array.isArray(parsed.idempotencyRecords) ? parsed.idempotencyRecords : [],
      domainEvents: Array.isArray(parsed.domainEvents) ? parsed.domainEvents : [],
      outboxEvents: Array.isArray(parsed.outboxEvents) ? parsed.outboxEvents : [],
      smsCodes: Array.isArray(parsed.smsCodes) ? parsed.smsCodes : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      actorCsrfTokens: Array.isArray(parsed.actorCsrfTokens) ? parsed.actorCsrfTokens : [],
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
      mallActivities: Array.isArray(parsed.mallActivities) ? parsed.mallActivities : [],
      eventDefinitions: Array.isArray(parsed.eventDefinitions) ? parsed.eventDefinitions : [],
      pTags: Array.isArray(parsed.pTags) ? parsed.pTags : [],
      pTagRules: Array.isArray(parsed.pTagRules) ? parsed.pTagRules : [],
      pTagRuleJobs: Array.isArray(parsed.pTagRuleJobs) ? parsed.pTagRuleJobs : [],
      pTagRuleJobLogs: Array.isArray(parsed.pTagRuleJobLogs) ? parsed.pTagRuleJobLogs : [],
      metricRules: Array.isArray(parsed.metricRules) ? parsed.metricRules : [],
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
  ['tenant:read', 'customer:read', 'customer:write', 'order:writeoff', 'stats:read', 'approval:write', 'scope:tenant:all'].forEach(
    (key) => bind('company_admin', key)
  );
  ['customer:read', 'customer:write', 'order:writeoff', 'scope:team:all'].forEach((key) => bind('team_lead', key));
  ['customer:read', 'customer:write', 'order:writeoff'].forEach((key) => bind('agent', key));

  if (!state.userRoles.length) {
    state.userRoles.push(
      { id: 1, tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
      { id: 2, tenantId: 2, userType: 'employee', userId: 8201, roleId: 2 },
      { id: 3, tenantId: 2, userType: 'agent', userId: 8202, roleId: 4 },
      { id: 4, tenantId: 3, userType: 'employee', userId: 8301, roleId: 2 },
      { id: 5, tenantId: 3, userType: 'agent', userId: 8302, roleId: 4 },
      { id: 6, tenantId: 4, userType: 'employee', userId: 8401, roleId: 2 },
      { id: 7, tenantId: 4, userType: 'agent', userId: 8402, roleId: 4 }
    );
  }

  // Backfill role bindings for tenant admins / agents loaded from DB.
  const roleIdByKey = new Map((state.roles || []).map((r) => [String(r.key), Number(r.id)]));
  for (const agent of ensureArray(state.agents)) {
    const tenantId = Number(agent.tenantId || 1);
    const userId = Number(agent.id || 0);
    if (userId <= 0) continue;
    const role = String(agent.role || '').toLowerCase();
    const roleKey = role === 'manager' ? 'company_admin' : role === 'support' ? 'team_lead' : 'agent';
    const roleId = Number(roleIdByKey.get(roleKey) || 0);
    if (roleId <= 0) continue;
    const userType = roleKey === 'agent' ? 'agent' : 'employee';
    const exists = (state.userRoles || []).some(
      (x) =>
        Number(x.tenantId) === tenantId &&
        String(x.userType) === userType &&
        Number(x.userId) === userId &&
        Number(x.roleId) === roleId
    );
    if (!exists) {
      state.userRoles.push({
        id: nextId(state.userRoles),
        tenantId,
        userType,
        userId,
        roleId,
      });
    }
  }
}

function backfillUserScopes() {
  if (!Array.isArray(state.users)) return;
  state.users = state.users.map((user) => ({
    tenantId: Number(user.tenantId || 1),
    orgId: Number(user.orgId || 1),
    teamId: Number(user.teamId || 1),
    // Keep 0 as "unassigned"; never fallback to customer self id.
    ownerUserId: Number(user.ownerUserId ?? 0),
    ...user,
  }));
}

function syncOperationCatalog() {
  if (!Array.isArray(state.pProducts) || state.pProducts.length === 0) {
    state.pProducts = (state.mallItems || []).map((item) => ({
      id: Number(item.id),
      tenantId: Number(item.tenantId || 1),
      name: item.name,
      pointsCost: Number(item.pointsCost) || 0,
      stock: Number(item.stock) || 0,
      shelfStatus: item.isActive ? 'on' : 'off',
      createdBy: Number(item.createdBy || 0) || null,
      creatorRole: item.creatorRole || '',
      templateScope: item.templateScope || 'tenant',
      createdAt: new Date().toISOString(),
    }));
  }

  if (!Array.isArray(state.pActivities) || state.pActivities.length === 0) {
    state.pActivities = (state.activities || []).map((item) => ({
      id: Number(item.id),
      tenantId: Number(item.tenantId || 1),
      title: item.title,
      category: item.category,
      rewardPoints: Number(item.rewardPoints) || 0,
      status: 'published',
      createdBy: Number(item.createdBy || 0) || null,
      creatorRole: item.creatorRole || '',
      templateScope: item.templateScope || 'tenant',
      createdAt: new Date().toISOString(),
    }));
  }

  if (!Array.isArray(state.mallActivities)) state.mallActivities = [];
  if (state.mallActivities.length === 0 && Array.isArray(state.bCustomerActivities) && state.bCustomerActivities.length > 0) {
    state.mallActivities = state.bCustomerActivities.map((item) => ({
      ...item,
      sourceDomain: 'mall',
    }));
  }
  if (state.mallActivities.length === 0 && Array.isArray(state.pActivities) && state.pActivities.length > 0) {
    // 历史版本将“积分商城活动”写在 pActivities，这里做一次兼容回填。
    state.mallActivities = state.pActivities
      .filter((item) => item?.sourceDomain === 'mall' || item?.displayTitle)
      .map((item) => ({
        ...item,
        sourceDomain: 'mall',
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
  if (usePostgres) return false;
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
    CREATE TABLE IF NOT EXISTS p_audit_logs (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      actor_type TEXT,
      actor_id BIGINT,
      action TEXT NOT NULL,
      result TEXT,
      resource_type TEXT,
      resource_id TEXT,
      meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_uv_daily (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      stat_date DATE NOT NULL,
      metric_key TEXT NOT NULL,
      actor_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_counter_daily (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      stat_date DATE NOT NULL,
      metric_key TEXT NOT NULL,
      actor_id BIGINT NOT NULL DEFAULT 0,
      cnt BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_counter_hourly (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      hour_key TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      actor_id BIGINT NOT NULL DEFAULT 0,
      cnt BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_event_definitions (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      event_id INT NOT NULL,
      event_name TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'custom',
      description TEXT,
      collect_method TEXT NOT NULL DEFAULT 'frontend',
      status TEXT NOT NULL DEFAULT 'enabled',
      schema_json JSONB,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_rules (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      metric_name TEXT NOT NULL,
      metric_end TEXT NOT NULL,
      formula TEXT NOT NULL,
      stat_period TEXT NOT NULL,
      data_source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'enabled',
      threshold TEXT,
      remark TEXT,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS age INT;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS annual_income NUMERIC(14,2);
  `);

  await pool.query(`
    ALTER TABLE p_tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS account VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS mobile VARCHAR(32);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS password VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS initial_password VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS role VARCHAR(32);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS org_id BIGINT;
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS team_id BIGINT;
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
    ALTER TABLE p_products ADD COLUMN IF NOT EXISTS media_json JSONB;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS media_json JSONB;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS display_title TEXT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS source_domain TEXT;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS wechat_open_id VARCHAR(64);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS wechat_union_id VARCHAR(64);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS nick_name VARCHAR(50);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS member_level SMALLINT NOT NULL DEFAULT 1;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS growth_value INT NOT NULL DEFAULT 0;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS device_info VARCHAR(255);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS org_id BIGINT;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS team_id BIGINT;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS cover_url TEXT;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS reward_points INT NOT NULL DEFAULT 0;
  `);

  // Backfill customer org/team from owner agent to avoid visibility regression after restart.
  await pool.query(`
    UPDATE c_customers AS c
    SET
      org_id = COALESCE(c.org_id, a.org_id, 1),
      team_id = COALESCE(c.team_id, a.team_id, 1)
    FROM b_agents AS a
    WHERE c.owner_agent_id = a.id
      AND (c.org_id IS NULL OR c.team_id IS NULL);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_c_sign_ins_tenant_customer_sign_date ON c_sign_ins (tenant_id, customer_id, sign_date);
    CREATE INDEX IF NOT EXISTS idx_c_sign_ins_tenant_sign_date ON c_sign_ins (tenant_id, sign_date);
    CREATE INDEX IF NOT EXISTS idx_p_sessions_customer_created ON p_sessions (customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_p_sessions_created ON p_sessions (created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_metric_uv_daily ON p_metric_uv_daily (tenant_id, stat_date, metric_key, actor_id);
    CREATE INDEX IF NOT EXISTS idx_metric_uv_daily_lookup ON p_metric_uv_daily (tenant_id, metric_key, stat_date);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_metric_counter_daily ON p_metric_counter_daily (tenant_id, stat_date, metric_key, actor_id);
    CREATE INDEX IF NOT EXISTS idx_metric_counter_daily_lookup ON p_metric_counter_daily (tenant_id, metric_key, stat_date);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_metric_counter_hourly ON p_metric_counter_hourly (tenant_id, hour_key, metric_key, actor_id);
    CREATE INDEX IF NOT EXISTS idx_metric_counter_hourly_lookup ON p_metric_counter_hourly (tenant_id, metric_key, hour_key);
    CREATE INDEX IF NOT EXISTS idx_p_track_events_metric_lookup ON p_track_events (tenant_id, created_at, actor_type, actor_id);
    CREATE INDEX IF NOT EXISTS idx_p_audit_logs_metric_lookup ON p_audit_logs (tenant_id, created_at, result);
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
  const tenantRows = (await pool.query('SELECT * FROM p_tenants WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const agentRows = (await pool.query('SELECT * FROM b_agents WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
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
  const auditRows = (await pool.query('SELECT * FROM p_audit_logs ORDER BY id ASC')).rows;
  const metricUvRows = (await pool.query('SELECT * FROM p_metric_uv_daily ORDER BY id ASC')).rows;
  const metricCounterDailyRows = (await pool.query('SELECT * FROM p_metric_counter_daily ORDER BY id ASC')).rows;
  const metricCounterHourlyRows = (await pool.query('SELECT * FROM p_metric_counter_hourly ORDER BY id ASC')).rows;
  const eventDefinitionRows = (await pool.query('SELECT * FROM p_event_definitions ORDER BY event_id ASC, id ASC')).rows;
  const metricRuleRows = (await pool.query('SELECT * FROM p_metric_rules ORDER BY metric_end ASC, id ASC')).rows;

  const hasAnyData =
    tenantRows.length ||
    agentRows.length ||
    usersRows.length ||
    txRows.length ||
    mallRows.length ||
    redemptionsRows.length ||
    learningRows.length ||
    policyRows.length ||
    eventDefinitionRows.length ||
    metricRuleRows.length;
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
  const ensureMediaArray = (raw) => (Array.isArray(raw) ? raw : []);
  const pProducts = mallRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    title: row.name || '',
    name: row.name || '',
    points: Number(row.points_cost || 0),
    pointsCost: Number(row.points_cost || 0),
    stock: Number(row.stock || 0),
    sortOrder: Number(row.sort_order || 0),
    status: row.shelf_status === 'on' ? 'active' : 'inactive',
    description: row.description || '',
    media: ensureMediaArray(row.media_json),
    createdBy: Number(row.created_by || 0) || null,
    creatorRole: '',
    templateScope: 'tenant',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  }));

  const allActivities = activitiesRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    title: row.title || '',
    displayTitle: row.display_title || row.title || '',
    type: row.category || 'task',
    category: row.category || 'task',
    rewardPoints: Number(row.reward_points || 0),
    sortOrder: Number(row.sort_order || 0),
    status: String(row.status || 'published'),
    description: row.description || '',
    desc: row.description || '',
    media: ensureMediaArray(row.media_json),
    sourceDomain: String(row.source_domain || 'activity'),
    createdBy: Number(row.created_by || 0) || null,
    creatorRole: '',
    templateScope: 'tenant',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }));
  const pActivities = allActivities.filter((row) => row.sourceDomain !== 'mall');
  const mallActivities = allActivities.filter((row) => row.sourceDomain === 'mall');
  const tenants = tenantRows.map((row) => ({
    id: Number(row.id),
    name: String(row.name || `租户${row.id}`),
    tenantCode: String(row.tenant_code || `tenant_${row.id}`),
    code: String(row.tenant_code || `tenant_${row.id}`),
    type: String(row.tenant_type || 'company'),
    status: String(row.status || 'active'),
    adminEmail: String(row.admin_email || ''),
    createdBy: Number(row.created_by || 9001),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }));
  const agents = agentRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    orgId: Number(row.org_id || row.tenant_id || 1),
    teamId: Number(row.team_id || row.tenant_id || 1),
    employeeId: row.employee_id ? Number(row.employee_id) : null,
    name: String(row.display_name || `Agent-${row.id}`),
    email: String(row.email || ''),
    account: String(row.account || row.email || ''),
    mobile: String(row.mobile || ''),
    password: String(row.password || row.initial_password || '123456'),
    initialPassword: String(row.initial_password || row.password || '123456'),
    role: String(row.role || (String(row.display_name || '').includes('管理员') ? 'manager' : 'agent')),
    status: String(row.status || 'active'),
    avatarUrl: String(row.avatar_url || ''),
    title: String(row.title || ''),
    bio: String(row.bio || ''),
    createdBy: Number(row.created_by || row.id || 0) || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : null,
  }));
  const agentScopeById = new Map(
    agents.map((row) => [
      Number(row.id),
      {
        tenantId: Number(row.tenantId || 1),
        orgId: Number(row.orgId || 1),
        teamId: Number(row.teamId || 1),
      },
    ])
  );
  return {
    ...structuredClone(initialState),
    tenants: tenants.length ? tenants : structuredClone(initialState.tenants),
    agents: agents.length ? agents : structuredClone(initialState.agents),
    users: usersRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || agentScopeById.get(Number(row.owner_agent_id || 0))?.tenantId || 1),
      orgId: Number(row.org_id || agentScopeById.get(Number(row.owner_agent_id || 0))?.orgId || 1),
      teamId: Number(row.team_id || agentScopeById.get(Number(row.owner_agent_id || 0))?.teamId || 1),
      ownerUserId: Number(row.owner_agent_id || 0),
      name: row.name,
      mobile: row.mobile_enc || row.mobile_masked || '',
      openId: String(row.wechat_open_id || ''),
      unionId: String(row.wechat_union_id || ''),
      nickName: String(row.nick_name || ''),
      avatarUrl: String(row.avatar_url || ''),
      memberLevel: Number(row.member_level || 1),
      growthValue: Number(row.growth_value || 0),
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : null,
      deviceInfo: String(row.device_info || ''),
      isVerifiedBasic: Boolean(row.is_verified_basic),
      gender: String(row.gender || ''),
      age: Number(row.age || 0) || null,
      annualIncome: Number(row.annual_income || 0) || null,
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    pointAccounts: accountsMapped,
    pointTransactions: txMapped,
    activities:
      pActivities.length > 0
        ? pActivities.map((row) => ({
            id: Number(row.id),
            tenantId: Number(row.tenantId || 1),
            title: row.title,
            category: row.category,
            rewardPoints: Number(row.rewardPoints || 0),
            sortOrder: Number(row.sortOrder || 0),
            status: String(row.status || 'published'),
            media: Array.isArray(row.media) ? row.media : [],
            content: String(row.description || ''),
            createdBy: Number(row.createdBy || 0) || null,
            creatorRole: '',
            templateScope: 'tenant',
            participants: 0,
          }))
        : structuredClone(initialState.activities),
    mallItems: pProducts.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenantId || 1),
      name: row.name || row.title || '',
      pointsCost: Number(row.pointsCost || row.points || 0),
      stock: Number(row.stock || 0),
      isActive: String(row.status || '').toLowerCase() === 'active',
      media: Array.isArray(row.media) ? row.media : [],
      description: String(row.description || ''),
      createdBy: Number(row.createdBy || 0) || null,
      creatorRole: '',
      templateScope: 'tenant',
    })),
    pProducts,
    pActivities,
    mallActivities,
    bCustomerActivities: mallActivities,
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
    learningCourses: learningRows.map((row) => {
      const contentUrl = String(row.content_url || '').trim();
      const coverUrl = String(row.cover_url || '').trim();
      const extractMediaUrl = (raw) => {
        const text = String(raw || '').trim();
        if (!text) return '';
        if (/^\/uploads\//i.test(text)) return text;
        if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)(\?.*)?$/i.test(text)) return text;
        if (/\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)$/i.test(text)) return text;
        if (text.startsWith('[') || text.startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            const first = Array.isArray(parsed) ? parsed[0] : parsed;
            if (typeof first === 'string') return first;
            if (first && typeof first === 'object') {
              return String(first.preview || first.url || first.path || first.name || '');
            }
          } catch {
            return '';
          }
        }
        return '';
      };
      const coverMediaUrl = extractMediaUrl(coverUrl);
      const contentMediaUrl = extractMediaUrl(contentUrl);
      const resolvedImage = coverMediaUrl || contentMediaUrl || '';
      const resolvedContent = contentMediaUrl ? '' : contentUrl;
      return {
        id: Number(row.id),
        tenantId: Number(row.tenant_id || 1),
        title: row.title,
        desc: '',
        type: row.material_type || 'article',
        contentType: row.material_type || 'article',
        typeLabel: '',
        progress: 0,
        timeLeft: '',
        image: resolvedImage,
        action: '',
        color: '',
        btnColor: '',
        points: Number(row.reward_points || 0),
        category: row.category || '',
        content: resolvedContent,
        coverUrl: coverMediaUrl,
        rewardPoints: Number(row.reward_points || 0),
        status: row.status || 'published',
        createdBy: Number(row.created_by || 0) || null,
        creatorRole: '',
        templateScope: 'tenant',
      };
    }),
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
    auditLogs: auditRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      actorType: String(row.actor_type || ''),
      actorId: Number(row.actor_id || 0),
      action: String(row.action || ''),
      result: String(row.result || ''),
      resourceType: String(row.resource_type || ''),
      resourceId: String(row.resource_id || ''),
      meta: row.meta || {},
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    metricDailyUv: metricUvRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      statDate: row.stat_date ? new Date(row.stat_date).toISOString().slice(0, 10) : dateOnly(),
      metricKey: String(row.metric_key || ''),
      actorId: Number(row.actor_id || 0),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    metricDailyCounters: metricCounterDailyRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      statDate: row.stat_date ? new Date(row.stat_date).toISOString().slice(0, 10) : dateOnly(),
      metricKey: String(row.metric_key || ''),
      actorId: Number(row.actor_id || 0),
      cnt: Number(row.cnt || 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    metricHourlyCounters: metricCounterHourlyRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      hourKey: String(row.hour_key || ''),
      metricKey: String(row.metric_key || ''),
      actorId: Number(row.actor_id || 0),
      cnt: Number(row.cnt || 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    eventDefinitions: eventDefinitionRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      eventId: Number(row.event_id || 0),
      eventName: String(row.event_name || ''),
      eventType: String(row.event_type || 'custom'),
      description: String(row.description || ''),
      collectMethod: String(row.collect_method || 'frontend'),
      status: String(row.status || 'enabled'),
      schema: row.schema_json || {},
      createdBy: Number(row.created_by || 0) || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    metricRules: metricRuleRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      name: String(row.metric_name || ''),
      end: String(row.metric_end || 'c'),
      formula: String(row.formula || ''),
      period: String(row.stat_period || '每日'),
      source: String(row.data_source || ''),
      status: String(row.status || 'enabled'),
      threshold: row.threshold ? String(row.threshold) : '',
      remark: row.remark ? String(row.remark) : '',
      createdBy: Number(row.created_by || 0) || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
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
      if (raw && typeof raw === 'object' && !(raw instanceof Date)) return JSON.stringify(raw);
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
      INSERT INTO p_tenants (id, tenant_code, tenant_type, name, status, package_name, quota_max_customers, quota_max_templates, admin_email, created_at, updated_at, is_deleted)
      VALUES (1, 'default', 'company', '默认租户', 'active', 'default', 0, 0, NULL, NOW(), NOW(), FALSE)
      ON CONFLICT (id) DO NOTHING
    `);

    const clearOrder = [
      'p_metric_rules',
      'p_event_definitions',
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

    const tenantRows = ensureArray(state.tenants).length
      ? ensureArray(state.tenants)
      : [{ id: 1, name: '默认租户', status: 'active', type: 'company', createdAt: new Date().toISOString() }];

    for (const [idx, row] of tenantRows.entries()) {
      const id = Number(row.id || idx + 1);
      const tenantCode = String(row.tenantCode || row.code || `tenant_${id}`);
      const tenantType = String(row.type || row.tenantType || 'company');
      const name = String(row.name || `租户${id}`);
      const status = String(row.status || 'active') === 'disabled' ? 'disabled' : 'active';
      const packageName = String(row.packageName || 'default');
      const quotaMaxCustomers = Number(row.quotaMaxCustomers || 0);
      const quotaMaxTemplates = Number(row.quotaMaxTemplates || 0);
      const adminEmail = String(row.adminEmail || '');
      const createdBy = Number(row.createdBy || 9001);
      const createdAt = row.createdAt || new Date().toISOString();
      await client.query(
        `
          INSERT INTO p_tenants (
            id, tenant_code, tenant_type, name, status, package_name, quota_max_customers, quota_max_templates, admin_email, created_by, created_at, updated_at, is_deleted
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),FALSE)
          ON CONFLICT (id) DO UPDATE SET
            tenant_code = EXCLUDED.tenant_code,
            tenant_type = EXCLUDED.tenant_type,
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            package_name = EXCLUDED.package_name,
            quota_max_customers = EXCLUDED.quota_max_customers,
            quota_max_templates = EXCLUDED.quota_max_templates,
            admin_email = EXCLUDED.admin_email,
            created_by = EXCLUDED.created_by,
            updated_at = NOW(),
            is_deleted = FALSE
        `,
        [id, tenantCode, tenantType, name, status, packageName, quotaMaxCustomers, quotaMaxTemplates, adminEmail || null, createdBy, createdAt]
      );
    }

    const agentTenantById = new Map(
      ensureArray(state.agents)
        .map((row) => [toFiniteNumber(row.id, null), toFiniteNumber(row.tenantId, null)])
        .filter(([id, tenantId]) => Number.isFinite(Number(id)) && Number(id) > 0 && Number.isFinite(Number(tenantId)) && Number(tenantId) > 0)
    );
    const agentScopeById = new Map(
      ensureArray(state.agents)
        .map((row) => [
          toFiniteNumber(row.id, null),
          {
            orgId: toFiniteNumber(row.orgId, 1),
            teamId: toFiniteNumber(row.teamId, 1),
          },
        ])
        .filter(([id]) => Number.isFinite(Number(id)) && Number(id) > 0)
    );

    await truncateAndInsert(
      client,
      'c_customers',
      [
        'id',
        'tenant_id',
        'org_id',
        'team_id',
        'owner_agent_id',
        'name',
        'mobile_enc',
        'mobile_masked',
        'wechat_open_id',
        'wechat_union_id',
        'nick_name',
        'avatar_url',
        'member_level',
        'growth_value',
        'last_active_at',
        'device_info',
        'is_verified_basic',
        'gender',
        'age',
        'annual_income',
        'verified_at',
        'created_by',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      ensureArray(state.users)
        .map((row) => {
          const ownerAgentId = toFiniteNumber(row.ownerUserId, 0);
          const inferredTenantId = ownerAgentId > 0 ? toFiniteNumber(agentTenantById.get(ownerAgentId), null) : null;
          const inferredScope = ownerAgentId > 0 ? agentScopeById.get(ownerAgentId) : null;
          const rawTenantId = toFiniteNumber(row.tenantId, inferredTenantId);
          const tenantId = Number.isFinite(Number(rawTenantId)) && Number(rawTenantId) > 0 ? Number(rawTenantId) : null;
          if (!tenantId) return null;
          return {
            id: Number(row.id),
            tenant_id: tenantId,
            org_id: Number(toFiniteNumber(row.orgId, inferredScope?.orgId ?? 1)),
            team_id: Number(toFiniteNumber(row.teamId, inferredScope?.teamId ?? 1)),
            owner_agent_id: ownerAgentId > 0 ? ownerAgentId : null,
            name: row.name || '',
            mobile_enc: row.mobile || '',
            mobile_masked: row.mobile || '',
            wechat_open_id: row.openId || null,
            wechat_union_id: row.unionId || null,
            nick_name: row.nickName || null,
            avatar_url: row.avatarUrl || null,
            member_level: Number(row.memberLevel || 1),
            growth_value: Number(row.growthValue || 0),
            last_active_at: row.lastActiveAt || null,
            device_info: row.deviceInfo || null,
            is_verified_basic: Boolean(row.isVerifiedBasic),
            gender: row.gender || null,
            age: Number(row.age || 0) || null,
            annual_income: Number(row.annualIncome || 0) || null,
            verified_at: row.verifiedAt || null,
            created_by: Number(row.createdBy || row.ownerUserId || 0) || null,
            created_at: row.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false,
          };
        })
        .filter(Boolean)
    );

    await truncateAndInsert(
      client,
      'b_agents',
      [
        'id',
        'tenant_id',
        'org_id',
        'team_id',
        'employee_id',
        'display_name',
        'account',
        'email',
        'mobile',
        'password',
        'initial_password',
        'role',
        'avatar_url',
        'title',
        'bio',
        'status',
        'last_active_at',
        'created_by',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      ensureArray(state.agents).map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        org_id: Number(row.orgId || row.tenantId || 1),
        team_id: Number(row.teamId || row.tenantId || 1),
        employee_id: row.employeeId ? Number(row.employeeId) : null,
        display_name: row.name || `Agent-${row.id}`,
        account: row.account || row.email || null,
        email: row.email || null,
        mobile: row.mobile || null,
        password: row.password || row.initialPassword || null,
        initial_password: row.initialPassword || row.password || null,
        role: row.role || 'agent',
        avatar_url: row.avatarUrl || null,
        title: row.title || null,
        bio: row.bio || null,
        status: ['active', 'inactive', 'blocked'].includes(String(row.status || '').toLowerCase()) ? String(row.status).toLowerCase() : 'active',
        last_active_at: row.lastActiveAt || null,
        created_by: Number(row.createdBy || row.id || 0) || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    const productRows = (ensureArray(state.pProducts).length ? ensureArray(state.pProducts) : ensureArray(state.mallItems)).map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenantId || 1),
      name: String(row.name || row.title || ''),
      description: String(row.description || row.desc || ''),
      pointsCost: Number(row.pointsCost || row.points || 0),
      stock: Number(row.stock || 0),
      shelfStatus:
        String(row.status || '').toLowerCase() === 'active' ||
        String(row.status || '').toLowerCase() === 'online' ||
        row.isActive === true
          ? 'on'
          : 'off',
      sortOrder: Number(row.sortOrder || 0),
      createdBy: Number(row.createdBy || 0) || null,
      media: Array.isArray(row.media) ? row.media : [],
    }));

    await truncateAndInsert(
      client,
      'p_products',
      ['id', 'tenant_id', 'name', 'description', 'points_cost', 'stock', 'shelf_status', 'sort_order', 'media_json', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      productRows.map((row) => ({
        id: row.id,
        tenant_id: row.tenantId,
        name: row.name,
        description: row.description,
        points_cost: row.pointsCost,
        stock: row.stock,
        shelf_status: row.shelfStatus,
        sort_order: row.sortOrder,
        media_json: row.media,
        created_by: row.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    const activityRowsRaw = [
      ...ensureArray(state.pActivities).map((row) => ({ ...row, sourceDomain: String(row.sourceDomain || 'activity') })),
      ...ensureArray(state.mallActivities).map((row) => ({ ...row, sourceDomain: 'mall' })),
    ];
    const usedIds = new Set();
    let maxId = activityRowsRaw.reduce((mx, row) => Math.max(mx, Number(row.id) || 0), 0);
    const activityRows = activityRowsRaw.map((row) => {
      let id = Number(row.id) || 0;
      if (!id || usedIds.has(id)) {
        maxId += 1;
        id = maxId;
      }
      usedIds.add(id);
      return { ...row, id };
    });

    await truncateAndInsert(
      client,
      'p_activities',
      ['id', 'tenant_id', 'title', 'display_title', 'description', 'source_domain', 'category', 'reward_points', 'start_at', 'end_at', 'status', 'sort_order', 'media_json', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      activityRows.map((row) => ({
        // p_activities.status 受DB约束：draft/published/ended
        // 这里把前端常用 active/online/ongoing 映射为 published。
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        title: String(row.title || ''),
        display_title: String(row.displayTitle || row.title || ''),
        description: String(row.description || row.desc || row.content || ''),
        source_domain: String(row.sourceDomain || 'activity'),
        category: String(row.category || row.type || 'task'),
        reward_points: Number(row.rewardPoints || 0),
        start_at: null,
        end_at: null,
        status: (() => {
          const s = String(row.status || '').toLowerCase();
          if (['published', 'active', 'online', 'ongoing', 'on', '进行中', '生效'].includes(s)) return 'published';
          if (['ended', 'offline', 'inactive', 'off', '下线', '结束'].includes(s)) return 'ended';
          return 'draft';
        })(),
        sort_order: Number(row.sortOrder || 0),
        media_json: Array.isArray(row.media) ? row.media : [],
        created_by: Number(row.createdBy || 0) || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    await truncateAndInsert(
      client,
      'p_learning_materials',
      ['id', 'tenant_id', 'title', 'material_type', 'category', 'difficulty', 'status', 'cover_url', 'content_url', 'reward_points', 'sort_order', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.learningCourses).map((row, idx) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        title: row.title || '',
        material_type: row.type || row.contentType || 'article',
        category: row.category || null,
        difficulty: null,
        status: 'published',
        cover_url: row.coverUrl || row.image || null,
        content_url: row.content || row.desc || null,
        reward_points: Number(row.rewardPoints || row.points || 0),
        sort_order: idx,
        created_by: Number(row.createdBy || 0) || null,
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
        .filter((row) => row.customer_id !== null && Number(row.amount || 0) > 0)
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

    const validAgentIds = new Set(ensureArray(state.agents).map((x) => toFiniteNumber(x.id, 0)).filter((x) => x > 0));
    const fallbackAgentByTenant = new Map();
    ensureArray(state.agents).forEach((x) => {
      const tid = toFiniteNumber(x.tenantId, 1);
      const aid = toFiniteNumber(x.id, 0);
      if (aid > 0 && !fallbackAgentByTenant.has(tid)) fallbackAgentByTenant.set(tid, aid);
    });

    await truncateAndInsert(
      client,
      'b_write_off_records',
      ['id', 'tenant_id', 'redeem_record_id', 'operator_agent_id', 'writeoff_token', 'status', 'reason', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.bWriteOffRecords)
        .map((row, idx) => {
          const tenantId = toFiniteNumber(row.tenantId, 1);
          const rawOperator = toFiniteNumber(row.operatorAgentId, 0);
          const fallbackOperator = fallbackAgentByTenant.get(tenantId) || [...validAgentIds][0] || null;
          const operatorAgentId = validAgentIds.has(rawOperator) ? rawOperator : fallbackOperator;
          return {
            id: toFiniteNumber(row.id, idx + 1),
            tenant_id: tenantId,
            redeem_record_id: toFiniteNumber(row.redeemRecordId, null),
            operator_agent_id: operatorAgentId,
            writeoff_token: row.writeoffToken || '',
            status: row.status || 'success',
            reason: row.reason || null,
            created_by: operatorAgentId,
            created_at: row.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false,
          };
        })
        .filter((row) => row.redeem_record_id !== null && row.operator_agent_id !== null)
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

    await truncateAndInsert(
      client,
      'p_audit_logs',
      ['id', 'tenant_id', 'actor_type', 'actor_id', 'action', 'result', 'resource_type', 'resource_id', 'meta', 'created_at'],
      ensureArray(state.auditLogs).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        actor_type: row.actorType ? String(row.actorType) : null,
        actor_id: toFiniteNumber(row.actorId, null),
        action: String(row.action || 'unknown'),
        result: row.result ? String(row.result) : null,
        resource_type: row.resourceType ? String(row.resourceType) : null,
        resource_id: row.resourceId ? String(row.resourceId) : null,
        meta: row.meta || null,
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    await truncateAndInsert(
      client,
      'p_metric_uv_daily',
      ['id', 'tenant_id', 'stat_date', 'metric_key', 'actor_id', 'created_at'],
      ensureArray(state.metricDailyUv)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          stat_date: row.statDate || dateOnly(),
          metric_key: String(row.metricKey || ''),
          actor_id: toFiniteNumber(row.actorId, 0),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.metric_key && row.actor_id > 0)
    );

    await truncateAndInsert(
      client,
      'p_metric_counter_daily',
      ['id', 'tenant_id', 'stat_date', 'metric_key', 'actor_id', 'cnt', 'updated_at'],
      ensureArray(state.metricDailyCounters)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          stat_date: row.statDate || dateOnly(),
          metric_key: String(row.metricKey || ''),
          actor_id: toFiniteNumber(row.actorId, 0),
          cnt: toFiniteNumber(row.cnt, 0),
          updated_at: row.updatedAt || new Date().toISOString(),
        }))
        .filter((row) => row.metric_key)
    );

    await truncateAndInsert(
      client,
      'p_metric_counter_hourly',
      ['id', 'tenant_id', 'hour_key', 'metric_key', 'actor_id', 'cnt', 'updated_at'],
      ensureArray(state.metricHourlyCounters)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          hour_key: String(row.hourKey || ''),
          metric_key: String(row.metricKey || ''),
          actor_id: toFiniteNumber(row.actorId, 0),
          cnt: toFiniteNumber(row.cnt, 0),
          updated_at: row.updatedAt || new Date().toISOString(),
        }))
        .filter((row) => row.metric_key && row.hour_key)
    );

    await truncateAndInsert(
      client,
      'p_event_definitions',
      [
        'id',
        'tenant_id',
        'event_id',
        'event_name',
        'event_type',
        'description',
        'collect_method',
        'status',
        'schema_json',
        'created_by',
        'created_at',
        'updated_at',
      ],
      ensureArray(state.eventDefinitions).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        event_id: toFiniteNumber(row.eventId, idx + 1),
        event_name: String(row.eventName || ''),
        event_type: String(row.eventType || 'custom'),
        description: row.description ? String(row.description) : null,
        collect_method: String(row.collectMethod || 'frontend'),
        status: String(row.status || 'enabled'),
        schema_json: row.schema || {},
        created_by: toFiniteNumber(row.createdBy, null),
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.updatedAt || new Date().toISOString(),
      }))
    );

    await truncateAndInsert(
      client,
      'p_metric_rules',
      [
        'id',
        'tenant_id',
        'metric_name',
        'metric_end',
        'formula',
        'stat_period',
        'data_source',
        'status',
        'threshold',
        'remark',
        'created_by',
        'created_at',
        'updated_at',
      ],
      ensureArray(state.metricRules).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        metric_name: String(row.name || ''),
        metric_end: String(row.end || 'c'),
        formula: String(row.formula || ''),
        stat_period: String(row.period || '每日'),
        data_source: String(row.source || ''),
        status: String(row.status || 'enabled'),
        threshold: row.threshold ? String(row.threshold) : null,
        remark: row.remark ? String(row.remark) : null,
        created_by: toFiniteNumber(row.createdBy, null),
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.updatedAt || new Date().toISOString(),
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
