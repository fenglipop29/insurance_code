import { authOptional, authRequired, requireActionConfirmation, validateBody } from '../common/middleware.mjs';
import { dateOnly, getBalance, getState, nextId, persistState } from '../common/state.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { canAccessTemplate } from '../common/template-visibility.mjs';
import { createOrder, payOrderWithPoints } from '../services/commerce.service.mjs';
import { recordPoints } from '../services/points.service.mjs';
import { redeemBodySchema } from '../schemas/mall.schemas.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function toAbsoluteUrl(req, url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${req.protocol}://${req.get('host')}${raw}`;
}

function isEffectiveStatus(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return true;
  return ['active', 'online', 'published', 'ongoing', 'on', '进行中', '生效'].includes(s);
}

export function registerMallRoutes(app) {
  app.get('/api/mall/items', authOptional, tenantContext, (req, res) => {
    const state = getState();
    const source = Array.isArray(state.pProducts) && state.pProducts.length ? state.pProducts : state.mallItems || [];
    const sortedSource = [...source].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const items = sortedSource
      .filter((item) => {
        const activeByFlag = typeof item.isActive === 'boolean' ? item.isActive : null;
        const activeByStatus = isEffectiveStatus(item.status);
        const isOn = activeByFlag === null ? activeByStatus : activeByFlag || activeByStatus;
        return isOn && canAccessTemplate(state, req.actor, item);
      })
      .map((item) => {
        const media = Array.isArray(item.media) ? item.media : [];
        const image = toAbsoluteUrl(req, mediaToUrl(media[0]) || String(item.image || ''));
        return {
          ...item,
          name: String(item.name || item.title || ''),
          pointsCost: Number(item.pointsCost || item.points || 0),
          stock: Number(item.stock || 0),
          image: image || `https://picsum.photos/seed/mall${item.id || 0}/640/640`,
          media,
          description: String(item.description || item.desc || ''),
        };
      });
    res.json({ items });
  });

  app.get('/api/mall/activities', authOptional, tenantContext, (req, res) => {
    const state = getState();
    const source = Array.isArray(state.mallActivities) && state.mallActivities.length
      ? state.mallActivities
      : Array.isArray(state.bCustomerActivities) && state.bCustomerActivities.length
        ? state.bCustomerActivities
        : Array.isArray(state.pActivities)
          ? state.pActivities.filter((row) => row?.sourceDomain === 'mall' || row?.displayTitle)
          : [];
    const seen = new Set();
    const uniqueSource = [...source]
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      .filter((row) => {
        const key = `${Number(row.id || 0)}:${String(row.title || row.displayTitle || '')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const list = uniqueSource
      .filter((row) => isEffectiveStatus(row.status) && canAccessTemplate(state, req.actor, row))
      .map((row, idx) => {
        const media = Array.isArray(row.media) ? row.media : [];
        const image = toAbsoluteUrl(req, mediaToUrl(media[0]) || String(row.image || ''));
        return {
          id: Number(row.id || idx + 1),
          title: String(row.displayTitle || row.title || `商城活动${idx + 1}`),
          subtitle: String(row.description || row.desc || '参与活动可赢积分奖励'),
          badge: '商城活动',
          rewardPoints: Number(row.rewardPoints || 0),
          status: String(row.status || 'active'),
          image: image || `https://picsum.photos/seed/mall-activity${row.id || idx + 1}/960/420`,
          media,
        };
      });
    res.json({ list });
  });

  app.post('/api/mall/redeem', authRequired, tenantContext, requireActionConfirmation('积分兑换'), validateBody(redeemBodySchema), (req, res) => {
    if (!req.user.isVerifiedBasic) {
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }

    try {
      const { itemId, idempotencyKey } = req.body;
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

  app.post('/api/mall/activities/:id/join', authRequired, tenantContext, (req, res) => {
    if (!req.user.isVerifiedBasic) {
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }
    const state = getState();
    if (!Array.isArray(state.activityCompletions)) state.activityCompletions = [];
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_ACTIVITY_ID', message: '活动ID无效' });
    }
    const source = Array.isArray(state.mallActivities) && state.mallActivities.length
      ? state.mallActivities
      : Array.isArray(state.bCustomerActivities) && state.bCustomerActivities.length
        ? state.bCustomerActivities
        : Array.isArray(state.pActivities)
          ? state.pActivities.filter((row) => row?.sourceDomain === 'mall' || row?.displayTitle)
          : [];
    const activity = source.find((row) => Number(row.id) === id);
    if (!activity) {
      return res.status(404).json({ code: 'MALL_ACTIVITY_NOT_FOUND', message: '商城活动不存在' });
    }
    if (!canAccessTemplate(state, req.actor, activity)) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '暂无权限，请联系管理员' });
    }
    const existed = state.activityCompletions.find(
      (x) => Number(x.userId) === Number(req.user.id) && Number(x.activityId) === id
    );
    if (existed) {
      return res.json({ ok: true, duplicated: true, reward: Number(existed.pointsAwarded || 0), balance: getBalance(req.user.id) });
    }
    const rewardPoints = Number(activity.rewardPoints || 0);
    const now = new Date().toISOString();
    state.activityCompletions.push({
      id: nextId(state.activityCompletions),
      userId: Number(req.user.id),
      activityId: id,
      completedDate: dateOnly(new Date()),
      pointsAwarded: rewardPoints,
      createdAt: now,
    });
    recordPoints({
      userId: req.user.id,
      direction: 'in',
      amount: rewardPoints,
      sourceType: 'mall_activity',
      sourceId: String(id),
      idempotencyKey: `mall-activity:${req.user.id}:${id}`,
      description: `参与商城活动 ${String(activity.title || activity.displayTitle || id)}`,
    });
    persistState();
    return res.json({
      ok: true,
      duplicated: false,
      reward: rewardPoints,
      balance: getBalance(req.user.id),
      activity: {
        id,
        title: String(activity.title || activity.displayTitle || ''),
      },
    });
  });
}
