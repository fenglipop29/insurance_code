export function registerPAdminOpsRoutes(app, deps) {
  const { tenantContext, permissionRequired, refundOrder, rebuildDailySnapshot, latestSnapshot, listSnapshots, runReconciliation } = deps;

  app.post('/api/p/orders/:id/refund', tenantContext, permissionRequired('order:refund'), (req, res) => {
    try {
      const { reason } = req.body || {};
      const result = refundOrder({
        tenantId: req.tenantContext.tenantId,
        orderId: Number(req.params.id),
        operatorId: req.actor.actorId,
        reason: String(reason || 'ops_refund'),
        actor: req.actor,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      const code = err?.message || 'REFUND_FAILED';
      const mapping = {
        ORDER_NOT_FOUND: [404, '订单不存在'],
        ORDER_NOT_PAID: [409, '订单未支付'],
        ORDER_ALREADY_FULFILLED: [409, '订单已履约，不能退款'],
      };
      const [status, message] = mapping[code] || [400, '退款失败'];
      return res.status(status).json({ code, message });
    }
  });

  app.post('/api/p/stats/rebuild', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const day = req.body?.day || new Date().toISOString().slice(0, 10);
    const snapshot = rebuildDailySnapshot(day);
    res.json({ ok: true, snapshot });
  });

  app.get('/api/p/stats/overview', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const limit = Number(req.query?.limit || 14);
    res.json({
      latest: latestSnapshot(),
      history: listSnapshots(limit),
    });
  });

  app.post('/api/p/reconciliation/run', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const report = runReconciliation(req.body?.day || new Date().toISOString().slice(0, 10));
    res.json({ ok: true, report });
  });
}
