import { getState, nextId, persistState } from '../common/state.mjs';

function dateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return d.toISOString().slice(0, 10);
}

export function rebuildDailySnapshot(day = new Date()) {
  const state = getState();
  if (!Array.isArray(state.statsWarehouse)) state.statsWarehouse = [];

  const key = dateKey(day);
  const customers = (state.users || []).length;
  const activeCustomers = new Set((state.signIns || []).filter((row) => String(row.signDate || '').startsWith(key)).map((row) => row.userId)).size;
  const createdOrders = (state.orders || []).filter((row) => String(row.createdAt || '').startsWith(key));
  const paidOrders = createdOrders.filter((row) => row.paymentStatus === 'paid');
  const refundedOrders = (state.orderRefunds || []).filter((row) => String(row.createdAt || '').startsWith(key)).length;

  const pointsIn = (state.pointTransactions || [])
    .filter((row) => String(row.createdAt || '').startsWith(key))
    .filter((row) => row.type === 'earn' || row.direction === 'in')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
  const pointsOut = (state.pointTransactions || [])
    .filter((row) => String(row.createdAt || '').startsWith(key))
    .filter((row) => row.type === 'consume' || row.direction === 'out')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);

  const snapshot = {
    id: nextId(state.statsWarehouse),
    day: key,
    metrics: {
      customers,
      activeCustomers,
      createdOrders: createdOrders.length,
      paidOrders: paidOrders.length,
      refundedOrders,
      pointsIn,
      pointsOut,
    },
    createdAt: new Date().toISOString(),
  };

  const existedIndex = state.statsWarehouse.findIndex((row) => row.day === key);
  if (existedIndex >= 0) state.statsWarehouse[existedIndex] = snapshot;
  else state.statsWarehouse.push(snapshot);

  persistState();
  return snapshot;
}

export function latestSnapshot() {
  const state = getState();
  const list = Array.isArray(state.statsWarehouse) ? state.statsWarehouse : [];
  if (!list.length) return null;
  return [...list].sort((a, b) => String(b.day).localeCompare(String(a.day)))[0];
}

export function listSnapshots(limit = 14) {
  const state = getState();
  const list = Array.isArray(state.statsWarehouse) ? state.statsWarehouse : [];
  return [...list].sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, Math.max(1, Number(limit) || 14));
}

export function runReconciliation(day = new Date()) {
  const state = getState();
  if (!Array.isArray(state.reconciliationReports)) state.reconciliationReports = [];

  const key = dateKey(day);
  const balanceMap = new Map();
  (state.pointTransactions || []).forEach((row) => {
    const userId = Number(row.userId);
    const amount = Math.abs(Number(row.amount) || 0);
    const dir = row.type === 'consume' || row.direction === 'out' ? -1 : 1;
    balanceMap.set(userId, (balanceMap.get(userId) || 0) + amount * dir);
  });
  const mismatches = [];
  (state.pointAccounts || []).forEach((acc) => {
    const expected = balanceMap.get(Number(acc.userId)) || 0;
    const actual = Number(acc.balance) || 0;
    if (expected !== actual) {
      mismatches.push({ userId: Number(acc.userId), expected, actual });
    }
  });

  const report = {
    id: nextId(state.reconciliationReports),
    day: key,
    status: mismatches.length ? 'mismatch' : 'ok',
    mismatches,
    checkedAt: new Date().toISOString(),
  };
  state.reconciliationReports.push(report);
  persistState();
  return report;
}
