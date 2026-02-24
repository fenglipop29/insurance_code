import { authRequired } from '../common/middleware.mjs';
import { getBalance, getState } from '../common/state.mjs';

export function registerPointsRoutes(app) {
  app.get('/api/points/summary', authRequired, (req, res) => {
    return res.json({ balance: getBalance(req.user.id) });
  });

  app.get('/api/points/transactions', authRequired, (req, res) => {
    const state = getState();
    const list = state.pointTransactions
      .filter((t) => t.userId === req.user.id)
      .sort((a, b) => b.id - a.id);

    return res.json({ list });
  });

  app.get('/api/points/detail', authRequired, (req, res) => {
    const state = getState();
    const normalized = state.pointTransactions
      .filter((t) => t.userId === req.user.id)
      .map((row) => normalizeTransaction(row))
      .sort((a, b) => {
        const at = new Date(a.createdAt).getTime();
        const bt = new Date(b.createdAt).getTime();
        if (bt !== at) return bt - at;
        return Number(b.id || 0) - Number(a.id || 0);
      });

    const groupsMap = new Map();
    normalized.forEach((row) => {
      const key = monthKey(row.createdAt);
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          label: monthLabel(row.createdAt),
          items: [],
        });
      }
      groupsMap.get(key).items.push(row);
    });

    return res.json({
      balance: getBalance(req.user.id),
      groups: [...groupsMap.values()],
    });
  });
}

function normalizeTransaction(row) {
  const createdAt = row.createdAt || row.created_at || new Date().toISOString();
  const source = String(row.source || row.sourceType || '');
  const typeRaw = String(row.type || row.direction || 'earn');
  const direction = typeRaw === 'consume' || typeRaw === 'out' ? 'out' : 'in';
  const amount = Math.abs(Number(row.amount) || 0);

  return {
    id: Number(row.id) || 0,
    title: row.description || fallbackTitle(source, direction),
    amount,
    balance: Number(row.balance),
    direction,
    source,
    createdAt,
  };
}

function fallbackTitle(source, direction) {
  if (source.includes('daily_sign_in') || source.includes('sign')) return '每日签到奖励';
  if (source.includes('redeem')) return '商品兑换消耗';
  if (source.includes('course')) return '观看视频奖励';
  if (source.includes('activity')) return '完善保障资料';
  return direction === 'in' ? '积分收入' : '积分支出';
}

function monthKey(isoTime) {
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return 'older';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(isoTime) {
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return '更早';
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return '本月';
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth()) return '上个月';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
