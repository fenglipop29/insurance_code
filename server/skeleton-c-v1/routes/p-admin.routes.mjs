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

  app.get('/api/p/employees', tenantContext, permissionRequired('tenant:read'), (req, res) => {
    const state = getState();
    const list = (state.agents || []).filter(
      (row) => Number(row.tenantId) === Number(req.tenantContext.tenantId) || req.actor.actorId === 9001
    );
    res.json({ list });
  });

  app.post('/api/p/employees', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.agents)) state.agents = [];
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const role = String(req.body?.role || 'salesperson');
    if (!name) return res.status(400).json({ code: 'EMPLOYEE_NAME_REQUIRED', message: '员工姓名不能为空' });
    if (!email) return res.status(400).json({ code: 'EMPLOYEE_EMAIL_REQUIRED', message: '员工邮箱不能为空' });

    const row = {
      id: nextId(state.agents),
      tenantId: req.tenantContext.tenantId,
      orgId: Number(req.body?.orgId || 1),
      teamId: Number(req.body?.teamId || 1),
      name,
      email,
      role,
      status: 'invited',
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
    };
    state.agents.push(row);
    persistState();
    return res.json({ ok: true, employee: row });
  });

  app.get('/api/p/mall/products', tenantContext, permissionRequired('tenant:read'), (_req, res) => {
    const state = getState();
    const products = Array.isArray(state.pProducts) ? state.pProducts : [];
    const source = products.length ? products : state.mallItems || [];
    const list = source.map((item, idx) => ({
      id: Number(item.id || idx + 1),
      title: String(item.title || item.name || '').trim(),
      points: Number(item.points ?? item.pointsCost ?? 0),
      stock: Number(item.stock ?? 0),
      sortOrder: Number(item.sortOrder ?? idx + 1),
      status: String(item.status || (item.isActive ? 'active' : 'inactive') || 'inactive'),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }));
    res.json({ list });
  });

  app.post('/api/p/mall/products', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pProducts)) state.pProducts = [];
    if (!Array.isArray(state.mallItems)) state.mallItems = [];
    const title = String(req.body?.title || '').trim();
    const points = Number(req.body?.points || 0);
    const stock = Number(req.body?.stock || 0);
    if (!title) return res.status(400).json({ code: 'PRODUCT_TITLE_REQUIRED', message: '商品标题不能为空' });

    const row = {
      id: nextId(state.pProducts),
      tenantId: req.tenantContext.tenantId,
      title,
      points,
      stock,
      sortOrder: Number(req.body?.sortOrder || state.pProducts.length + 1),
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    state.pProducts.push(row);
    state.mallItems.push({
      id: nextId(state.mallItems),
      name: row.title,
      pointsCost: row.points,
      stock: row.stock,
      isActive: true,
    });
    persistState();
    res.json({ ok: true, product: row });
  });

  app.get('/api/p/mall/activities', tenantContext, permissionRequired('tenant:read'), (_req, res) => {
    const state = getState();
    const saved = Array.isArray(state.pActivities) ? state.pActivities : [];
    const source = saved.length ? saved : state.activities || [];
    const list = source.map((item, idx) => ({
      id: Number(item.id || idx + 1),
      title: String(item.title || item.name || '').trim(),
      type: String(item.type || item.category || 'task'),
      rewardPoints: Number(item.rewardPoints ?? item.points ?? 0),
      sortOrder: Number(item.sortOrder ?? idx + 1),
      status: String(item.status || 'active'),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }));
    res.json({ list });
  });

  app.post('/api/p/mall/activities', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pActivities)) state.pActivities = [];
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ code: 'ACTIVITY_TITLE_REQUIRED', message: '活动标题不能为空' });
    const row = {
      id: nextId(state.pActivities),
      tenantId: req.tenantContext.tenantId,
      title,
      type: String(req.body?.type || 'task'),
      rewardPoints: Number(req.body?.rewardPoints || 0),
      sortOrder: Number(req.body?.sortOrder || state.pActivities.length + 1),
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    state.pActivities.push(row);
    persistState();
    res.json({ ok: true, activity: row });
  });
}
