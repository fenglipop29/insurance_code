import { permissionRequired, tenantContext } from '../common/access-control.mjs';
import { appendAuditLog, getState, nextId, persistState } from '../common/state.mjs';
import { listSnapshots, latestSnapshot, rebuildDailySnapshot, runReconciliation } from '../services/analytics.service.mjs';
import { refundOrder } from '../services/commerce.service.mjs';

export function registerPAdminRoutes(app) {
  app.get('/api/p/tenants', tenantContext, permissionRequired('tenant:read'), (req, res) => {
    const state = getState();
    const list = (state.tenants || []).filter((row) => Number(row.id) === Number(req.tenantContext.tenantId) || req.actor.actorId === 9001);
    res.json({ list });
  });

  app.post('/api/p/tenants', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.tenants)) state.tenants = [];
    const name = String(req.body?.name || '').trim();
    const type = String(req.body?.type || 'company');
    if (!name) return res.status(400).json({ code: 'TENANT_NAME_REQUIRED', message: '租户名称不能为空' });

    const row = {
      id: nextId(state.tenants),
      name,
      type: type === 'individual' ? 'individual' : 'company',
      status: 'active',
      createdBy: req.actor.actorId,
      createdAt: new Date().toISOString(),
    };
    state.tenants.push(row);
    appendAuditLog({
      tenantId: req.tenantContext.tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'tenant.create',
      resourceType: 'tenant',
      resourceId: String(row.id),
      result: 'success',
    });
    persistState();
    return res.json({ ok: true, tenant: row });
  });

  app.get('/api/p/permissions/matrix', tenantContext, permissionRequired('tenant:read'), (_req, res) => {
    const state = getState();
    res.json({
      roles: state.roles || [],
      permissions: state.permissions || [],
      rolePermissions: state.rolePermissions || [],
      userRoles: state.userRoles || [],
    });
  });

  app.post('/api/p/approvals', tenantContext, permissionRequired('approval:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.approvals)) state.approvals = [];
    const row = {
      id: nextId(state.approvals),
      tenantId: req.tenantContext.tenantId,
      requestType: String(req.body?.requestType || 'customer_detail_view'),
      requesterUserType: String(req.body?.requesterUserType || 'employee'),
      requesterUserId: Number(req.body?.requesterUserId || req.actor.actorId),
      reason: String(req.body?.reason || ''),
      scope: req.body?.scope || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    state.approvals.push(row);
    persistState();
    res.json({ ok: true, approval: row });
  });

  app.post('/api/p/approvals/:id/approve', tenantContext, permissionRequired('approval:write'), (req, res) => {
    const state = getState();
    const row = (state.approvals || []).find((item) => Number(item.id) === Number(req.params.id));
    if (!row) return res.status(404).json({ code: 'APPROVAL_NOT_FOUND', message: '审批单不存在' });
    row.status = 'approved';
    row.approvedBy = req.actor.actorId;
    row.approvedAt = new Date().toISOString();
    row.expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    appendAuditLog({
      tenantId: req.tenantContext.tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'approval.approve',
      resourceType: 'approval',
      resourceId: String(row.id),
      result: 'success',
    });
    persistState();
    res.json({ ok: true, approval: row });
  });

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
