import { getBalance, getState, nextId } from '../common/state.mjs';

export function ensurePointAccount(userId) {
  const state = getState();
  if (!Array.isArray(state.pointAccounts)) state.pointAccounts = [];

  let account = state.pointAccounts.find((x) => x.userId === userId);
  if (!account) {
    account = {
      userId,
      balance: getBalance(userId),
      updatedAt: new Date().toISOString(),
    };
    state.pointAccounts.push(account);
  }
  return account;
}

export function recordPoints({ userId, direction, amount, sourceType, sourceId, idempotencyKey, description }) {
  const state = getState();
  if (!Array.isArray(state.pointTransactions)) state.pointTransactions = [];

  const exists = state.pointTransactions.find((tx) => tx.idempotencyKey === idempotencyKey);
  if (exists) {
    ensurePointAccount(userId);
    return {
      duplicated: true,
      transaction: exists,
      balance: exists.balance,
    };
  }

  const account = ensurePointAccount(userId);
  const delta = direction === 'in' ? amount : -amount;
  const nextBalance = Number(account.balance || 0) + delta;
  if (nextBalance < 0) {
    throw new Error('POINTS_BALANCE_NEGATIVE');
  }

  account.balance = nextBalance;
  account.updatedAt = new Date().toISOString();

  const transaction = {
    id: nextId(state.pointTransactions),
    userId,
    type: direction === 'in' ? 'earn' : 'consume',
    amount,
    source: sourceType,
    sourceId,
    idempotencyKey,
    balance: nextBalance,
    description,
    createdAt: new Date().toISOString(),
  };
  state.pointTransactions.push(transaction);

  return {
    duplicated: false,
    transaction,
    balance: nextBalance,
  };
}
