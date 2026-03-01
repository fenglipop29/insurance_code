import { authOptional, authRequired } from '../common/middleware.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { dateOnly, getBalance, getState, nextId, persistState } from '../common/state.mjs';
import { canAccessTemplate } from '../common/template-visibility.mjs';
import { recordPoints } from '../services/points.service.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function normalizeActivity(activity = {}) {
  const media = Array.isArray(activity.media) ? activity.media : [];
  const cover = mediaToUrl(media[0]) || String(activity.image || activity.cover || '');
  return {
    ...activity,
    image: cover,
    cover,
    media,
    participants: Number(activity.participants || 0),
    rewardPoints: Number(activity.rewardPoints || 0),
    description: String(activity.content || activity.description || activity.desc || ''),
  };
}

export function registerActivitiesRoutes(app) {
  app.get('/api/activities', authOptional, tenantContext, (req, res) => {
    const state = getState();
    const isEffective = (row) => {
      const status = String(row?.status || '').toLowerCase();
      if (!status) return true;
      return ['active', 'online', 'published', 'ongoing', 'on', '进行中', '生效'].includes(status);
    };
    const source = [...(Array.isArray(state.pActivities) ? state.pActivities : []), ...(Array.isArray(state.activities) ? state.activities : [])];
    const seen = new Set();
    const uniqueSource = [...source].filter((row) => {
      const key = `${Number(row?.id || 0)}:${String(row?.title || '')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const list = uniqueSource
      .filter((activity) => isEffective(activity) && canAccessTemplate(state, req.actor, activity))
      .map((activity) => normalizeActivity(activity))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const today = dateOnly(new Date());
    const activities = list.map((activity) => {
      const completed = req.user
        ? activity.category === 'sign'
          ? state.signIns.some((row) => row.userId === req.user.id && row.signDate === today)
          : state.activityCompletions.some(
              (x) => x.userId === req.user.id && x.activityId === activity.id && x.completedDate === today
            )
        : false;

      return {
        ...activity,
        completed,
        canComplete: activity.category !== 'competition',
      };
    });

    const taskActivities = activities.filter((a) => a.canComplete);
    const completedTasks = taskActivities.filter((a) => a.completed).length;

    return res.json({
      activities,
      balance: req.user ? getBalance(req.user.id) : 0,
      taskProgress: {
        total: taskActivities.length,
        completed: completedTasks,
      },
    });
  });

  app.post('/api/activities/:id/complete', authRequired, (req, res) => {
    const state = getState();
    const id = Number(req.params.id);
    const source = [...(Array.isArray(state.pActivities) ? state.pActivities : []), ...(Array.isArray(state.activities) ? state.activities : [])];
    const activity = source.find((a) => Number(a.id) === id);

    if (!activity) {
      return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' });
    }
    if (activity.category === 'sign') {
      return res.status(409).json({ code: 'USE_SIGN_IN', message: '签到任务请使用签到接口' });
    }
    if (activity.category === 'competition') {
      return res.status(409).json({ code: 'MANUAL_FLOW_REQUIRED', message: '该活动需通过活动页参与，不支持直接完成' });
    }
    if (!req.user.isVerifiedBasic) {
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }

    const today = dateOnly(new Date());
    const exists = state.activityCompletions.find(
      (x) => x.userId === req.user.id && x.activityId === id && x.completedDate === today
    );
    if (exists) {
      return res.status(409).json({ code: 'ALREADY_COMPLETED', message: '今日该任务已完成' });
    }

    state.activityCompletions.push({
      id: nextId(state.activityCompletions),
      userId: req.user.id,
      activityId: id,
      completedDate: today,
      pointsAwarded: activity.rewardPoints,
      createdAt: new Date().toISOString(),
    });

    recordPoints({
      userId: req.user.id,
      direction: 'in',
      amount: Number(activity.rewardPoints) || 0,
      sourceType: 'activity_task',
      sourceId: String(id),
      idempotencyKey: `activity:${req.user.id}:${id}:${today}`,
      description: `完成活动 ${activity.title}`,
    });
    persistState();

    return res.json({
      ok: true,
      reward: activity.rewardPoints,
      balance: getBalance(req.user.id),
    });
  });

  app.post('/api/sign-in', authRequired, (req, res) => {
    const state = getState();

    if (!req.user.isVerifiedBasic) {
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }

    const today = dateOnly(new Date());
    const exists = state.signIns.find((s) => s.userId === req.user.id && s.signDate === today);
    if (exists) {
      return res.status(409).json({ code: 'ALREADY_SIGNED', message: '今日已签到' });
    }

    state.signIns.push({
      id: nextId(state.signIns),
      userId: req.user.id,
      signDate: today,
      pointsAwarded: 10,
      createdAt: new Date().toISOString(),
    });

    recordPoints({
      userId: req.user.id,
      direction: 'in',
      amount: 10,
      sourceType: 'daily_sign_in',
      sourceId: today,
      idempotencyKey: `sign-in:${req.user.id}:${today}`,
      description: '每日签到奖励',
    });
    persistState();

    return res.json({
      ok: true,
      reward: 10,
      balance: getBalance(req.user.id),
    });
  });
}
