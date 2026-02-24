import { authOptional, authRequired } from '../common/middleware.mjs';
import { getBalance, getState } from '../common/state.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { createOrder, payOrderWithPoints } from '../services/commerce.service.mjs';

export function registerMallRoutes(app) {
  app.get('/api/mall/items', authOptional, (_req, res) => {
    const state = getState();
    const items = state.mallItems.filter((item) => item.isActive);
    res.json({ items });
  });

  app.post('/api/mall/redeem', authRequired, tenantContext, (req, res) => {
    if (!req.user.isVerifiedBasic) {
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }

    try {
      const itemId = Number(req.body?.itemId);
      const idempotencyKey = String(req.body?.idempotencyKey || '').trim() || undefined;
      const { order } = createOrder({
        tenantId: req.tenantContext.tenantId,
        customerId: req.user.id,
        productId: itemId,
        quantity: 1,
        idempotencyKey: idempotencyKey ? `mall-create:${idempotencyKey}` : undefined,
        actor: req.actor,
      });
      const { redemption } = payOrderWithPoints({
        tenantId: req.tenantContext.tenantId,
        orderId: Number(order.id),
        customerId: req.user.id,
        idempotencyKey: idempotencyKey ? `mall-pay:${idempotencyKey}` : undefined,
        actor: req.actor,
      });
      const state = getState();
      const item = state.mallItems.find((row) => Number(row.id) === itemId);
      return res.json({
        ok: true,
        redemption: {
          id: redemption.id,
          orderNo: order.orderNo,
          itemName: item?.name || order.productName,
          pointsCost: redemption.pointsCost,
          status: redemption.status,
          expiresAt: redemption.expiresAt,
          writeoffToken: redemption.writeoffToken,
        },
        token: redemption.writeoffToken,
        balance: getBalance(req.user.id),
      });
    } catch (err) {
      const code = err?.message || 'REDEEM_FAILED';
      if (code === 'ITEM_NOT_FOUND') return res.status(404).json({ code, message: '商品不存在' });
      if (code === 'OUT_OF_STOCK') return res.status(409).json({ code, message: '库存不足' });
      if (code === 'INSUFFICIENT_POINTS') return res.status(409).json({ code, message: '积分不足' });
      return res.status(400).json({ code, message: '兑换失败' });
    }
  });
}
