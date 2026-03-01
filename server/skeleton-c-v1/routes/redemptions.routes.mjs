import { authRequired, validateBody, validateParams } from '../common/middleware.mjs';
import { appendAuditLog, appendDomainEvent, getState, persistState } from '../common/state.mjs';
import { redemptionIdParamsSchema, writeoffBodySchema } from '../schemas/redemptions.schemas.mjs';

export function registerRedemptionsRoutes(app) {
  app.get('/api/redemptions', authRequired, (req, res) => {
    const state = getState();
    const list = state.redemptions
      .filter((row) => row.userId === req.user.id)
      .map((row) => ({
        ...row,
        itemName: state.mallItems.find((item) => item.id === row.itemId)?.name || '',
      }))
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    res.json({ list });
  });

  app.post('/api/redemptions/:id/writeoff', authRequired, validateParams(redemptionIdParamsSchema), validateBody(writeoffBodySchema), (req, res) => {
    const { id } = req.params;
    const state = getState();
    const row = state.redemptions.find((item) => item.id === id && item.userId === req.user.id);

    if (!row) {
      return res.status(404).json({ code: 'REDEMPTION_NOT_FOUND', message: '兑换记录不存在' });
    }
    if (row.status === 'written_off') {
      return res.status(409).json({ code: 'ALREADY_WRITTEN_OFF', message: '已核销' });
    }

    const token = req.body?.token || '';
    if (token && token !== row.writeoffToken) {
      return res.status(400).json({ code: 'INVALID_TOKEN', message: '核销码错误' });
    }

    const tokenToCheck = token || row.writeoffToken;
    const alreadySuccessByToken = state.redemptions.find(
      (item) => item.writeoffToken === tokenToCheck && item.status === 'written_off'
    );
    if (alreadySuccessByToken) {
      return res.status(409).json({ code: 'ALREADY_WRITTEN_OFF', message: '已核销' });
    }

    if (new Date(row.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({ code: 'TOKEN_EXPIRED', message: '核销已过期' });
    }

    row.status = 'written_off';
    row.writtenOffAt = new Date().toISOString();
    const order = state.orders?.find((item) => Number(item.id) === Number(row.orderId));
    if (order) {
      order.status = 'fulfilled';
      order.fulfillmentStatus = 'written_off';
      order.updatedAt = new Date().toISOString();
    }
    appendDomainEvent('redemption.written_off', { redemptionId: row.id, orderId: row.orderId || null, userId: req.user.id }, { tenantId: req.user.tenantId || 1 });
    appendAuditLog({
      tenantId: req.user.tenantId || 1,
      actorType: 'customer',
      actorId: req.user.id,
      action: 'redemption.writeoff',
      resourceType: 'redemption',
      resourceId: String(row.id),
      result: 'success',
    });
    persistState();
    return res.json({ ok: true });
  });
}
