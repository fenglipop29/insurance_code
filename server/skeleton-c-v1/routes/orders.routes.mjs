import { authRequired } from '../common/middleware.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { getState } from '../common/state.mjs';
import { cancelOrder, createOrder, payOrderWithPoints, refundOrder } from '../services/commerce.service.mjs';

function errorResponse(res, err) {
  const code = err?.message || 'UNKNOWN_ERROR';
  if (code === 'ITEM_NOT_FOUND') return res.status(404).json({ code, message: '商品不存在' });
  if (code === 'ORDER_NOT_FOUND') return res.status(404).json({ code, message: '订单不存在' });
  if (code === 'ORDER_FORBIDDEN') return res.status(403).json({ code, message: '无权访问该订单' });
  if (code === 'OUT_OF_STOCK') return res.status(409).json({ code, message: '库存不足' });
  if (code === 'INSUFFICIENT_POINTS') return res.status(409).json({ code, message: '积分不足' });
  if (code === 'ORDER_ALREADY_FULFILLED') return res.status(409).json({ code, message: '订单已履约，不能操作' });
  if (code === 'ORDER_NOT_PAID') return res.status(409).json({ code, message: '订单未支付' });
  return res.status(400).json({ code, message: '请求处理失败' });
}

export function registerOrdersRoutes(app) {
  app.get('/api/orders', authRequired, tenantContext, (req, res) => {
    const state = getState();
    const list = (state.orders || [])
      .filter((row) => Number(row.customerId) === Number(req.user.id))
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    res.json({ list });
  });

  app.post('/api/orders', authRequired, tenantContext, (req, res) => {
    try {
      const { productId, quantity, idempotencyKey } = req.body || {};
      const { order } = createOrder({
        tenantId: req.tenantContext.tenantId,
        customerId: req.user.id,
        productId,
        quantity: Number(quantity || 1),
        idempotencyKey,
        actor: req.actor,
      });
      return res.json({ ok: true, order });
    } catch (err) {
      return errorResponse(res, err);
    }
  });

  app.post('/api/orders/:id/pay', authRequired, tenantContext, (req, res) => {
    try {
      const { idempotencyKey } = req.body || {};
      const { order, redemption } = payOrderWithPoints({
        tenantId: req.tenantContext.tenantId,
        orderId: Number(req.params.id),
        customerId: req.user.id,
        idempotencyKey,
        actor: req.actor,
      });
      return res.json({ ok: true, order, redemption });
    } catch (err) {
      return errorResponse(res, err);
    }
  });

  app.post('/api/orders/:id/cancel', authRequired, tenantContext, (req, res) => {
    try {
      const { reason } = req.body || {};
      const { order } = cancelOrder({
        tenantId: req.tenantContext.tenantId,
        orderId: Number(req.params.id),
        customerId: req.user.id,
        reason: String(reason || ''),
        actor: req.actor,
      });
      return res.json({ ok: true, order });
    } catch (err) {
      return errorResponse(res, err);
    }
  });

  app.post('/api/orders/:id/refund', authRequired, tenantContext, (req, res) => {
    try {
      const { reason } = req.body || {};
      const { order } = refundOrder({
        tenantId: req.tenantContext.tenantId,
        orderId: Number(req.params.id),
        operatorId: req.user.id,
        reason: String(reason || 'customer_refund'),
        actor: req.actor,
      });
      return res.json({ ok: true, order });
    } catch (err) {
      return errorResponse(res, err);
    }
  });
}
