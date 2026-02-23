import { authOptional, authRequired } from '../common/middleware.mjs';
import { appendPoints, generateWriteoffToken, getBalance, getState, nextId, persistState } from '../common/state.mjs';

export function registerMallRoutes(app) {
  app.get('/api/mall/items', authOptional, (_req, res) => {
    const state = getState();
    const items = state.mallItems.filter((item) => item.isActive);
    res.json({ items });
  });

  app.post('/api/mall/redeem', authRequired, (req, res) => {
    if (!req.user.isVerifiedBasic) {
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }

    const state = getState();
    const itemId = Number(req.body?.itemId);
    const item = state.mallItems.find((row) => row.id === itemId && row.isActive);
    if (!item) {
      return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: '商品不存在' });
    }
    if (Number(item.stock) <= 0) {
      return res.status(409).json({ code: 'OUT_OF_STOCK', message: '库存不足' });
    }

    const balance = getBalance(req.user.id);
    if (balance < Number(item.pointsCost)) {
      return res.status(409).json({ code: 'INSUFFICIENT_POINTS', message: '积分不足' });
    }

    item.stock -= 1;
    const redemption = {
      id: nextId(state.redemptions),
      userId: req.user.id,
      itemId: item.id,
      pointsCost: item.pointsCost,
      status: 'pending',
      writeoffToken: generateWriteoffToken(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      writtenOffAt: null,
    };

    state.redemptions.push(redemption);
    appendPoints(req.user.id, 'consume', item.pointsCost, 'redeem', String(redemption.id), `兑换 ${item.name}`);
    persistState();

    return res.json({
      ok: true,
      token: redemption.writeoffToken,
      balance: getBalance(req.user.id),
    });
  });
}
