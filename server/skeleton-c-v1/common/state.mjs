import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'db.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const initialState = {
  users: [],
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
    { id: 1, name: '智能低糖电饭煲', pointsCost: 1200, stock: 50, isActive: true },
    { id: 2, name: '家庭体检套餐', pointsCost: 800, stock: 80, isActive: true },
    { id: 3, name: '健康管理咨询券', pointsCost: 300, stock: 999, isActive: true },
  ],
  redemptions: [],
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
    await ensureRuntimeSchema();

    const loaded = await loadRuntimeStateFromPostgres();
    if (loaded) {
      assignState(loaded);
    } else {
      const legacy = loadStateFromFile();
      assignState(legacy);
      await writeRuntimeStateToPostgres();
    }
  } else {
    assignState(loadStateFromFile());
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
    .then(() => writeRuntimeStateToPostgres())
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
  if (Array.isArray(state.pointAccounts)) {
    const account = state.pointAccounts.find((x) => x.userId === userId);
    if (account && Number.isFinite(Number(account.balance))) return Number(account.balance);
  }

  const rows = state.pointTransactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  return Number(rows[0]?.balance || 0);
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
      smsCodes: Array.isArray(parsed.smsCodes) ? parsed.smsCodes : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      pointAccounts: Array.isArray(parsed.pointAccounts) ? parsed.pointAccounts : [],
      pointTransactions: Array.isArray(parsed.pointTransactions) ? parsed.pointTransactions : [],
      mallItems: Array.isArray(parsed.mallItems) ? parsed.mallItems : structuredClone(initialState.mallItems),
      redemptions: Array.isArray(parsed.redemptions) ? parsed.redemptions : [],
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

async function ensureRuntimeSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS runtime_state (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function loadRuntimeStateFromPostgres() {
  const { rows } = await pool.query('SELECT payload FROM runtime_state WHERE id = 1');
  if (!rows[0]) return null;
  return rows[0].payload;
}

async function writeRuntimeStateToPostgres() {
  await pool.query(
    `
      INSERT INTO runtime_state (id, payload, updated_at)
      VALUES (1, $1::jsonb, now())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `,
    [JSON.stringify(state)]
  );
}
