import { dataScope, permissionRequired, tenantContext } from '../common/access-control.mjs';
import { appendAuditLog, getState, nextId, persistState } from '../common/state.mjs';
import { fulfillOrderWriteoff } from '../services/commerce.service.mjs';

export function registerBAdminRoutes(app) {
  app.get('/api/b/customers', tenantContext, permissionRequired('customer:read'), dataScope('customer'), (req, res) => {
    const state = getState();
    const customers = (state.users || [])
      .filter((user) => req.dataScope.canAccessCustomer(user))
      .map((user) => ({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        ownerUserId: user.ownerUserId,
        tenantId: user.tenantId,
        orgId: user.orgId,
        teamId: user.teamId,
      }));
    res.json({ list: customers });
  });

  app.post('/api/b/customers/:id/tags', tenantContext, permissionRequired('customer:write'), dataScope('customer'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.bCustomerTags)) state.bCustomerTags = [];
    if (!Array.isArray(state.bCustomerTagRels)) state.bCustomerTagRels = [];

    const customerId = Number(req.params.id);
    const customer = (state.users || []).find((row) => Number(row.id) === customerId);
    if (!customer || !req.dataScope.canAccessCustomer(customer)) {
      return res.status(404).json({ code: 'CUSTOMER_NOT_FOUND', message: '客户不存在或无权限' });
    }

    const tagName = String(req.body?.tag || '').trim();
    if (!tagName) return res.status(400).json({ code: 'TAG_REQUIRED', message: '标签不能为空' });

    let tag = state.bCustomerTags.find((row) => row.tenantId === req.tenantContext.tenantId && row.name === tagName);
    if (!tag) {
      tag = {
        id: nextId(state.bCustomerTags),
        tenantId: req.tenantContext.tenantId,
        name: tagName,
        createdBy: req.actor.actorId,
        createdAt: new Date().toISOString(),
      };
      state.bCustomerTags.push(tag);
    }

    const exists = state.bCustomerTagRels.find((row) => row.customerId === customerId && row.tagId === tag.id);
    if (!exists) {
      state.bCustomerTagRels.push({
        id: nextId(state.bCustomerTagRels),
        tenantId: req.tenantContext.tenantId,
        customerId,
        tagId: tag.id,
        createdBy: req.actor.actorId,
        createdAt: new Date().toISOString(),
      });
    }

    appendAuditLog({
      tenantId: req.tenantContext.tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'customer.tag.add',
      resourceType: 'customer',
      resourceId: String(customerId),
      result: 'success',
    });
    persistState();
    return res.json({ ok: true, tag });
  });

  app.get('/api/b/orders', tenantContext, permissionRequired('customer:read'), dataScope('customer'), (req, res) => {
    const state = getState();
    const list = (state.orders || []).filter((row) => {
      const customer = (state.users || []).find((user) => Number(user.id) === Number(row.customerId));
      return req.dataScope.canAccessCustomer(customer);
    });
    res.json({ list });
  });

  app.post('/api/b/orders/:id/writeoff', tenantContext, permissionRequired('order:writeoff'), (req, res) => {
    try {
      const { token } = req.body || {};
      const result = fulfillOrderWriteoff({
        tenantId: req.tenantContext.tenantId,
        orderId: Number(req.params.id),
        operatorAgentId: req.actor.actorId,
        token: String(token || ''),
        actor: req.actor,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      const code = err?.message || 'WRITE_OFF_FAILED';
      const mapping = {
        ORDER_NOT_FOUND: [404, '订单不存在'],
        ORDER_NOT_PAID: [409, '订单未支付'],
        REDEMPTION_NOT_FOUND: [404, '兑换记录不存在'],
        INVALID_TOKEN: [400, '核销码错误'],
        TOKEN_EXPIRED: [410, '核销已过期'],
      };
      const [status, message] = mapping[code] || [400, '核销失败'];
      return res.status(status).json({ code, message });
    }
  });
}
