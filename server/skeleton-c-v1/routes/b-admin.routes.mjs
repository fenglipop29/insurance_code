import { dataScope, permissionRequired, tenantContext } from '../common/access-control.mjs';
import { appendAuditLog, createActorSession, getState, nextId, persistState, resolveSessionFromBearer, upsertActorCsrfToken } from '../common/state.mjs';
import { canAccessTemplate, hasRole } from '../common/template-visibility.mjs';
import { fulfillOrderWriteoff } from '../services/commerce.service.mjs';

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pickDate(row, keys = ['createdAt']) {
  for (const key of keys) {
    const d = asDate(row?.[key]);
    if (d) return d;
  }
  return null;
}

function formatDateISO(value) {
  const d = asDate(value);
  return d ? d.toISOString() : new Date().toISOString();
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function summarizeBehaviorEvent(state, row, context = {}) {
  const event = String(row?.event || row?.eventName || 'unknown');
  const source = String(row?.source || '').trim();
  const path = String(row?.path || '').trim();
  const properties = row?.properties && typeof row.properties === 'object' ? row.properties : {};
  const eventLabelMap = {
    c_learning_enter: '进入知识学习',
    c_learning_switch_tab: '切换学习栏目',
    c_learning_list_load_success: '课程列表加载成功',
    c_learning_list_load_failed: '课程列表加载失败',
    c_learning_filter_category: '筛选课程分类',
    c_learning_open_detail: '打开课程详情',
    c_learning_view_course: '查看课程',
    c_learning_detail_load_success: '课程详情加载成功',
    c_learning_detail_load_failed: '课程详情加载失败',
    c_learning_complete_success: '课程完成领积分成功',
    c_learning_complete_failed: '课程完成领积分失败',
    c_mall_items_load_success: '商城商品加载成功',
    c_mall_activities_load_success: '商城活动加载成功',
    c_mall_redeem_start: '开始兑换商品',
    c_mall_redeem_success: '兑换商品成功',
    c_mall_redeem_failed: '兑换商品失败',
    c_mall_open_redemption_list: '查看兑换记录',
    c_mall_open_product_detail: '查看商品详情',
    c_mall_open_activity_detail: '查看商城活动详情',
    c_mall_activity_join_start: '参与商城活动',
    c_mall_activity_join_success: '参与商城活动成功',
    c_mall_activity_join_failed: '参与商城活动失败',
    c_activity_open_detail: '打开活动详情',
    c_activity_complete_success: '活动完成成功',
    c_activity_complete_failed: '活动完成失败',
    c_sign_in_success: '签到成功',
    c_sign_in_repeat: '重复签到',
    c_sign_in_failed: '签到失败',
    c_page_view: '页面浏览',
  };
  const label = eventLabelMap[event] || event;
  const tabToPageLabel = {
    home: '首页',
    learning: '知识学习页',
    activities: '活动中心页',
    profile: '个人中心页',
    insurance: '保障管理页',
    advisor: '顾问页',
    mall: '积分商城页',
  };
  const pathLabelMap = {
    '/': '首页',
    '/home': '首页',
    '/learning': '知识学习页',
    '/activities': '活动中心页',
    '/profile': '个人中心页',
    '/insurance': '保障管理页',
    '/mall': '积分商城页',
    '/advisor': '顾问页',
  };
  const tab = String(properties.tab || '').trim().toLowerCase();
  const inferByEventPrefix = () => {
    if (event.startsWith('c_learning')) return '知识学习页';
    if (event.startsWith('c_mall')) return '积分商城页';
    if (event.startsWith('c_activity') || event.startsWith('c_activities')) return '活动中心页';
    if (event.startsWith('c_profile')) return '个人中心页';
    if (event.startsWith('c_insurance')) return '保障管理页';
    return '';
  };
  const pathLabel = (path === '/' && tab && tabToPageLabel[tab])
    ? tabToPageLabel[tab]
    : (path === '/' ? inferByEventPrefix() || pathLabelMap[path] : (pathLabelMap[path] || path));
  const fallbackLabel = (() => {
    if (!event.startsWith('c_') && !event.startsWith('b_') && !event.startsWith('p_')) return event;
    if (event.endsWith('_load_success')) return '加载成功';
    if (event.endsWith('_load_failed')) return '加载失败';
    if (event.endsWith('_success')) return '操作成功';
    if (event.endsWith('_failed')) return '操作失败';
    return event;
  })();
  const courseById = context.courseById || new Map((state.learningCourses || []).map((c) => [Number(c.id), c]));
  const itemById = context.itemById || new Map((state.mallItems || []).map((i) => [Number(i.id), i]));
  const activityById = context.activityById
    || new Map([...(state.activities || []), ...(state.mallActivities || []), ...(state.bCustomerActivities || [])].map((a) => [Number(a.id), a]));
  const orderById = context.orderById || new Map((state.orders || []).map((o) => [Number(o.id), o]));

  const courseId = Number(properties.courseId || properties.course_id || 0);
  const itemId = Number(properties.itemId || properties.item_id || 0);
  const activityId = Number(properties.activityId || properties.activity_id || 0);
  const orderId = Number(properties.orderId || properties.order_id || properties.sourceId || 0);
  const order = orderById.get(orderId);
  const course = courseById.get(courseId);
  const item = itemById.get(itemId || Number(order?.productId || 0));
  const activity = activityById.get(activityId || Number(order?.activityId || 0));

  let businessDetail = '';
  if (event.startsWith('c_learning_')) {
    if (course?.title) businessDetail = `课程:${String(course.title)}`;
    else if (courseId > 0) businessDetail = `课程:课程#${courseId}`;
  } else if (event.startsWith('c_mall_redeem')) {
    if (item?.name) businessDetail = `商品:${String(item.name)}`;
    else if (itemId > 0) businessDetail = `商品:商品#${itemId}`;
    else if (order?.productName) businessDetail = `商品:${String(order.productName)}`;
  } else if (event.startsWith('c_mall_activity_') || event === 'c_mall_open_activity_detail') {
    if (activity?.title || activity?.displayTitle) businessDetail = `活动:${String(activity.displayTitle || activity.title)}`;
    else if (activityId > 0) businessDetail = `活动:活动#${activityId}`;
  } else if (event.startsWith('c_activity_')) {
    if (activity?.title || activity?.displayTitle) businessDetail = `活动:${String(activity.displayTitle || activity.title)}`;
    else if (activityId > 0) businessDetail = `活动:活动#${activityId}`;
  }

  const propertyKeys = Object.keys(properties).slice(0, 3);
  const preview = propertyKeys
    .map((k) => `${k}=${String(properties[k])}`)
    .join(' · ');
  const parts = [source ? `来源:${source}` : '', path ? `页面:${pathLabel}` : '', businessDetail, preview].filter(Boolean);
  return {
    title: label === event ? fallbackLabel : label,
    detail: parts.join(' | ') || '行为事件',
  };
}

function sourceLabel(sourceType, sourceId) {
  const source = String(sourceType || '').toLowerCase();
  if (source === 'sign_in' || source === 'daily_sign_in') return '每日签到';
  if (source === 'activity_task') return '活动任务';
  if (source === 'course_complete' || source === 'learning_course') return '课程完成';
  if (source === 'mall_activity') return '商城活动';
  if (source === 'order_redeem' || source === 'redeem') return `礼券兑换${sourceId ? ` #${sourceId}` : ''}`;
  if (source === 'refund') return '订单退款';
  return String(sourceType || '积分变动');
}

export function registerBAdminRoutes(app) {
  app.post('/api/b/auth/login', (req, res) => {
    const state = getState();
    const accountRaw = String(req.body?.account || '').trim();
    const account = accountRaw.toLowerCase();
    const password = String(req.body?.password || '').trim();
    if (!account || !password) {
      return res.status(400).json({ code: 'LOGIN_PARAMS_REQUIRED', message: '请输入账号和密码' });
    }
    const demoAccounts = [];
    const demoSession = demoAccounts.find(
      (x) => (x.account === account || x.mobile === accountRaw) && x.password === password
    );
    if (demoSession) {
      const token = createActorSession({
        actorType: String(demoSession.actorType || 'employee'),
        actorId: Number(demoSession.actorId || 0),
        tenantId: Number(demoSession.tenantId || 0),
        orgId: Number(demoSession.orgId || 0),
        teamId: Number(demoSession.teamId || 0),
      });
      const sessionRow = resolveSessionFromBearer(`Bearer ${token}`);
      const csrfToken = upsertActorCsrfToken({
        tenantId: Number(demoSession.tenantId || 1),
        actorType: String(demoSession.actorType || 'employee'),
        actorId: Number(demoSession.actorId || 0),
      });
      return res.json({
        ok: true,
        session: {
          account: demoSession.account,
          name: demoSession.name,
          role: demoSession.role,
          actorType: demoSession.actorType,
          actorId: demoSession.actorId,
          tenantId: demoSession.tenantId,
          orgId: demoSession.orgId,
          teamId: demoSession.teamId,
          token,
          csrfToken: sessionRow?.csrfToken || csrfToken,
        },
      });
    }

    const user = (state.agents || []).find((x) => {
      const email = String(x.email || '').toLowerCase();
      const accountField = String(x.account || '').toLowerCase();
      const mobile = String(x.mobile || '').trim();
      const name = String(x.name || '').trim();
      return email === account || accountField === account || (mobile && mobile === accountRaw) || (name && name === accountRaw);
    });
    if (!user) return res.status(401).json({ code: 'LOGIN_FAILED', message: '账号或密码错误' });
    if (String(user.password || user.initialPassword || '') !== password) {
      return res.status(401).json({ code: 'LOGIN_FAILED', message: '账号或密码错误' });
    }
    const userRole = String(user.role || '').toLowerCase();
    const isManager = userRole === 'manager';
    const isTeamLead = userRole === 'support' || userRole === 'team_lead';
    const role = isManager ? 'company_admin' : isTeamLead ? 'team_lead' : 'agent';
    const actorType = isManager || isTeamLead ? 'employee' : 'agent';
    const token = createActorSession({
      actorType,
      actorId: Number(user.id),
      tenantId: Number(user.tenantId || 0),
      orgId: Number(user.orgId || 0),
      teamId: Number(user.teamId || 0),
    });
    const sessionRow = resolveSessionFromBearer(`Bearer ${token}`);
    const csrfToken = upsertActorCsrfToken({
      tenantId: Number(user.tenantId || 1),
      actorType,
      actorId: Number(user.id),
    });
    return res.json({
      ok: true,
      session: {
        account: String(user.email || user.account || ''),
        name: String(user.name || '员工'),
        mobile: String(user.mobile || ''),
        role,
        actorType,
        actorId: Number(user.id),
        tenantId: Number(user.tenantId || 1),
        orgId: Number(user.orgId || 1),
        teamId: Number(user.teamId || 1),
        token,
        csrfToken: sessionRow?.csrfToken || csrfToken,
      },
    });
  });

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

  app.get('/api/b/customers/:id/profile', tenantContext, permissionRequired('customer:read'), dataScope('customer'), (req, res) => {
    const state = getState();
    const customerId = Number(req.params.id || 0);
    const customer = (state.users || []).find((row) => Number(row.id) === customerId);
    if (!customer || !req.dataScope.canAccessCustomer(customer)) {
      return res.status(404).json({ code: 'CUSTOMER_NOT_FOUND', message: '客户不存在或无权限' });
    }

    const activityById = new Map(
      [...(state.activities || []), ...(state.mallActivities || []), ...(state.bCustomerActivities || [])].map((row) => [Number(row.id), row])
    );
    const itemById = new Map((state.mallItems || []).map((row) => [Number(row.id), row]));
    const orderById = new Map((state.orders || []).map((row) => [Number(row.id), row]));
    const courseById = new Map((state.learningCourses || []).map((row) => [Number(row.id), row]));

    const interactions = [];
    (state.courseCompletions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        interactions.push({
          type: 'course_complete',
          title: `已完成：${String(row.courseTitle || `课程#${row.courseId || '-'}`)}`,
          detail: `奖励积分 +${toNum(row.pointsAwarded || 0)}`,
          occurredAt: formatDateISO(row.completedAt || row.createdAt),
        });
      });

    (state.activityCompletions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const activity = activityById.get(Number(row.activityId || 0));
        const isMallActivity = String(activity?.sourceDomain || '').toLowerCase() === 'mall';
        interactions.push({
          type: 'activity_complete',
          title: `${isMallActivity ? '参与商城活动' : '参与活动'}：${String(activity?.title || activity?.displayTitle || `活动#${row.activityId || '-'}`)}`,
          detail: `奖励积分 +${toNum(row.pointsAwarded || activity?.rewardPoints || 0)}`,
          occurredAt: formatDateISO(row.completedAt || row.createdAt),
        });
      });

    const signIns = (state.signIns || []).filter((row) => Number(row.userId) === customerId);
    signIns.forEach((row) => {
      interactions.push({
        type: 'sign_in',
        title: '每日签到',
        detail: `签到奖励 +${toNum(row.pointsAwarded || 10)} 积分`,
        occurredAt: formatDateISO(row.createdAt || (row.signDate ? `${row.signDate}T00:00:00.000Z` : null)),
      });
    });

    (state.redemptions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const order = orderById.get(Number(row.orderId || 0));
        const item = itemById.get(Number(row.itemId || order?.productId || 0));
        const orderType = String(order?.orderType || '').toLowerCase();
        const activity = activityById.get(Number(order?.activityId || 0));
        const redeemName = orderType === 'activity'
          ? String(activity?.title || activity?.displayTitle || order?.productName || `活动#${order?.activityId || '-'}`)
          : String(item?.name || order?.productName || `商品#${row.itemId || '-'}`);
        interactions.push({
          type: 'redeem',
          title: `${orderType === 'activity' ? '兑换活动' : '兑换商品'}：${redeemName}`,
          detail: `订单号 #${String(row.orderId || row.id || '-')}`,
          occurredAt: formatDateISO(row.createdAt),
        });
      });

    // 学习浏览行为同步到“互动轨迹”，满足业务侧对“资料学习”展示诉求。
    (state.trackEvents || [])
      .filter(
        (row) =>
          Number(row.tenantId || 1) === Number(req.tenantContext.tenantId || 0) &&
          String(row.actorType || '').toLowerCase() === 'customer' &&
          Number(row.actorId || 0) === customerId
      )
      .forEach((row) => {
        const event = String(row.event || '').toLowerCase();
        const props = row?.properties && typeof row.properties === 'object' ? row.properties : {};
        const courseId = Number(props.courseId || props.course_id || 0);
        const course = (state.learningCourses || []).find((c) => Number(c.id) === courseId);
        if (event === 'c_learning_enter') {
          interactions.push({
            type: 'course_browse',
            title: '进入知识学习',
            detail: `学习栏目：${String(props.tab || 'class')}`,
            occurredAt: formatDateISO(row.createdAt),
          });
        } else if (event === 'c_learning_open_detail' || event === 'c_learning_view_course') {
          interactions.push({
            type: 'course_view',
            title: `查看课程：${String(course?.title || `课程#${courseId || '-'}`)}`,
            detail: `分类：${String(props.category || course?.category || '-')}`,
            occurredAt: formatDateISO(row.createdAt),
          });
        }
      });

    const interactionTimeline = interactions
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 50);

    const behaviorTimeline = (state.trackEvents || [])
      .filter(
        (row) =>
          Number(row.tenantId || 1) === Number(req.tenantContext.tenantId || 0) &&
          String(row.actorType || '').toLowerCase() === 'customer' &&
          Number(row.actorId || 0) === customerId
      )
      .map((row) => {
        const summary = summarizeBehaviorEvent(state, row, { courseById, itemById, activityById, orderById });
        return {
          event: summary.title,
          detail: summary.detail,
          occurredAt: formatDateISO(row.createdAt),
        };
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 100);

    const pointsTransactions = (state.pointTransactions || [])
      .filter((row) => Number(row.userId) === customerId)
      .map((row) => {
        const amountAbs = Math.abs(toNum(row.amount || 0));
        const isConsume = String(row.type || '').toLowerCase() === 'consume';
        return {
          id: Number(row.id || 0),
          title: sourceLabel(row.source, row.sourceId),
          detail: String(row.description || row.sourceId || ''),
          amount: isConsume ? -amountAbs : amountAbs,
          balance: toNum(row.balance, 0),
          occurredAt: formatDateISO(row.createdAt),
        };
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 100);

    const pointAccount = (state.pointAccounts || []).find((row) => Number(row.userId) === customerId);
    const currentBalance = pointAccount
      ? toNum(pointAccount.balance, 0)
      : pointsTransactions.length
        ? toNum(pointsTransactions[0].balance, 0)
        : 0;

    return res.json({
      customer: {
        id: Number(customer.id),
        name: String(customer.name || ''),
        mobile: String(customer.mobile || ''),
      },
      points: {
        currentBalance,
        transactions: pointsTransactions,
      },
      interactionTimeline,
      behaviorTimeline,
    });
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

  app.get('/api/b/tags/library', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId);
    const list = (state.bCustomerTags || []).filter((row) => Number(row.tenantId) === tenantId);
    const recommended = ['养老规划', '教育金需求', '高净值'];
    const groups = [
      { key: 'intent', name: '意向程度', items: ['强意向', '中等意向', '观望中', '无意向'] },
      { key: 'product', name: '产品意向', items: ['医疗险', '年金险', '家庭财产险', '意外险', '定期寿险'] },
      { key: 'family', name: '家庭情况', items: ['单身贵族', '新婚夫妇', '三口之家', '二胎家庭', '退休生活'] },
    ];
    return res.json({ list, recommended, groups });
  });

  app.post('/api/b/tags/custom', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.bCustomerTags)) state.bCustomerTags = [];
    const tenantId = Number(req.tenantContext.tenantId);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ code: 'TAG_REQUIRED', message: '标签不能为空' });
    if (name.length > 10) return res.status(400).json({ code: 'TAG_TOO_LONG', message: '标签长度不能超过10' });

    let tag = state.bCustomerTags.find((row) => Number(row.tenantId) === tenantId && row.name === name);
    if (!tag) {
      tag = {
        id: nextId(state.bCustomerTags),
        tenantId,
        name,
        createdBy: req.actor.actorId,
        createdAt: new Date().toISOString(),
      };
      state.bCustomerTags.push(tag);
      persistState();
    }
    return res.json({ ok: true, tag });
  });

  app.post('/api/b/content/items', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.learningCourses)) state.learningCourses = [];
    if (!Array.isArray(state.pLearningMaterials)) state.pLearningMaterials = [];
    const tenantId = Number(req.tenantContext.tenantId);
    const actorIdentity = {
      tenantId,
      userType: String(req.actor.actorType || 'agent'),
      userId: Number(req.actor.actorId || 0),
    };
    const creatorRole = hasRole(state, actorIdentity, 'platform_admin')
      ? 'platform_admin'
      : hasRole(state, actorIdentity, 'company_admin')
        ? 'company_admin'
        : 'agent';
    const templateScope = creatorRole === 'platform_admin' ? 'platform' : 'tenant';
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ code: 'TITLE_REQUIRED', message: '标题不能为空' });
    const media = Array.isArray(req.body?.media)
      ? req.body.media.slice(0, 6).map((x) => (typeof x === 'string' ? { name: x, type: 'image/*', preview: x } : x))
      : [];
    const mediaToUrl = (raw) => {
      if (!raw) return '';
      if (typeof raw === 'string') return raw;
      return String(raw.preview || raw.url || raw.path || raw.name || '');
    };
    const coverUrl = String(req.body?.coverUrl || mediaToUrl(media[0]) || '').trim();
    const rewardPoints = Number(req.body?.rewardPoints ?? req.body?.points ?? 0);
    const item = {
      id: nextId(state.learningCourses),
      tenantId,
      title,
      category: String(req.body?.category || '通用培训'),
      points: rewardPoints,
      rewardPoints,
      contentType: String(req.body?.contentType || 'article'),
      status: String(req.body?.status || 'published'),
      level: String(req.body?.level || '中级'),
      content: String(req.body?.body || ''),
      sortOrder: Number(req.body?.sortOrder || 1),
      coverUrl,
      media,
      createdBy: req.actor.actorId,
      creatorRole,
      templateScope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.learningCourses.push(item);
    state.pLearningMaterials.push({
      id: nextId(state.pLearningMaterials),
      tenantId,
      title: item.title,
      body: item.content,
      rewardPoints,
      coverUrl,
      sortOrder: item.sortOrder,
      media,
      createdBy: item.createdBy,
      creatorRole,
      templateScope,
      createdAt: item.createdAt,
    });
    persistState();
    return res.json({ ok: true, item });
  });

  app.post('/api/b/activity-configs', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.activities)) state.activities = [];
    if (!Array.isArray(state.pActivities)) state.pActivities = [];
    const tenantId = Number(req.tenantContext.tenantId);
    const actorIdentity = {
      tenantId,
      userType: String(req.actor.actorType || 'agent'),
      userId: Number(req.actor.actorId || 0),
    };
    const creatorRole = hasRole(state, actorIdentity, 'platform_admin')
      ? 'platform_admin'
      : hasRole(state, actorIdentity, 'company_admin')
        ? 'company_admin'
        : 'agent';
    const templateScope = creatorRole === 'platform_admin' ? 'platform' : 'tenant';
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ code: 'TITLE_REQUIRED', message: '活动名称不能为空' });
    const media = Array.isArray(req.body?.media)
      ? req.body.media.slice(0, 6).map((x) => (typeof x === 'string' ? { name: x, type: 'image/*', preview: x } : x))
      : [];
    const item = {
      id: nextId(state.activities),
      tenantId,
      title,
      category: String(req.body?.category || 'task'),
      content: String(req.body?.desc || ''),
      rewardPoints: Number(req.body?.rewardPoints || 0),
      sortOrder: Number(req.body?.sortOrder || 1),
      participants: 0,
      status: String(req.body?.status || 'online'),
      media,
      createdBy: req.actor.actorId,
      creatorRole,
      templateScope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.activities.push(item);
    state.pActivities.push(item);
    persistState();
    return res.json({ ok: true, item });
  });

  app.post('/api/b/mall/products', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pProducts)) state.pProducts = [];
    if (!Array.isArray(state.mallItems)) state.mallItems = [];
    const tenantId = Number(req.tenantContext.tenantId);
    const actorIdentity = {
      tenantId,
      userType: String(req.actor.actorType || 'agent'),
      userId: Number(req.actor.actorId || 0),
    };
    const creatorRole = hasRole(state, actorIdentity, 'platform_admin')
      ? 'platform_admin'
      : hasRole(state, actorIdentity, 'company_admin')
        ? 'company_admin'
        : 'agent';
    const templateScope = creatorRole === 'platform_admin' ? 'platform' : 'tenant';
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ code: 'NAME_REQUIRED', message: '商品名称不能为空' });
    const media = Array.isArray(req.body?.media)
      ? req.body.media.slice(0, 6).map((x) => (typeof x === 'string' ? { name: x, type: 'image/*', preview: x } : x))
      : [];
    const pointsCost = Number(req.body?.pointsCost ?? req.body?.points ?? 0);
    const status = String(req.body?.status || 'active');
    const product = {
      id: nextId(state.pProducts),
      tenantId,
      title: name,
      name,
      description: String(req.body?.desc || ''),
      desc: String(req.body?.desc || ''),
      points: pointsCost,
      pointsCost,
      stock: Number(req.body?.stock || 0),
      sortOrder: Number(req.body?.sortOrder || 1),
      status,
      media,
      createdBy: req.actor.actorId,
      creatorRole,
      templateScope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.pProducts.push(product);
    state.mallItems.push({
      id: nextId(state.mallItems),
      tenantId,
      name,
      pointsCost,
      stock: Number(req.body?.stock || 0),
      description: String(req.body?.desc || ''),
      isActive: ['active', 'online', 'published', 'on', '进行中', '生效'].includes(status.toLowerCase()),
      media,
      createdBy: req.actor.actorId,
      creatorRole,
      templateScope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    persistState();
    return res.json({ ok: true, product });
  });

  app.post('/api/b/mall/activities', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.mallActivities)) state.mallActivities = [];
    if (!Array.isArray(state.bCustomerActivities)) state.bCustomerActivities = [];
    const tenantId = Number(req.tenantContext.tenantId);
    const actorIdentity = {
      tenantId,
      userType: String(req.actor.actorType || 'agent'),
      userId: Number(req.actor.actorId || 0),
    };
    const creatorRole = hasRole(state, actorIdentity, 'platform_admin')
      ? 'platform_admin'
      : hasRole(state, actorIdentity, 'company_admin')
        ? 'company_admin'
        : 'agent';
    const templateScope = creatorRole === 'platform_admin' ? 'platform' : 'tenant';
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ code: 'TITLE_REQUIRED', message: '活动名称不能为空' });
    const media = Array.isArray(req.body?.media)
      ? req.body.media.slice(0, 6).map((x) => (typeof x === 'string' ? { name: x, type: 'image/*', preview: x } : x))
      : [];
    const activity = {
      id: nextId(state.mallActivities),
      tenantId,
      title,
      displayTitle: String(req.body?.title || ''),
      type: String(req.body?.type || 'task'),
      description: String(req.body?.desc || ''),
      desc: String(req.body?.desc || ''),
      rewardPoints: Number(req.body?.rewardPoints || 0),
      sortOrder: Number(req.body?.sortOrder || 1),
      status: String(req.body?.status || 'active'),
      media,
      createdBy: req.actor.actorId,
      creatorRole,
      templateScope,
      sourceDomain: 'mall',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.mallActivities.push(activity);
    state.bCustomerActivities.push(activity);
    persistState();
    return res.json({ ok: true, activity });
  });

  app.get('/api/b/content/items', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = (state.learningCourses || [])
      .filter((row) => canAccessTemplate(state, req.actor, row))
      .map((row) => ({
        id: Number(row.id || 0),
        title: String(row.title || ''),
        status: String(row.status || 'published'),
        contentType: String(row.contentType || 'article'),
        rewardPoints: Number(row.points || 0),
        sortOrder: Number(row.sortOrder || 0),
        content: String(row.content || ''),
        media: Array.isArray(row.media) ? row.media : [],
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      }));
    return res.json({ list });
  });

  app.get('/api/b/activity-configs', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = (state.activities || [])
      .filter((row) => canAccessTemplate(state, req.actor, row))
      .map((row) => ({
        id: Number(row.id || 0),
        title: String(row.title || ''),
        status: String(row.status || 'online'),
        rewardPoints: Number(row.rewardPoints || 0),
        sortOrder: Number(row.sortOrder || 0),
        content: String(row.content || row.desc || ''),
        media: Array.isArray(row.media) ? row.media : [],
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      }));
    return res.json({ list });
  });

  app.get('/api/b/mall/products', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = (state.pProducts || [])
      .filter((row) => canAccessTemplate(state, req.actor, row))
      .map((row) => ({
        id: Number(row.id || 0),
        title: String(row.title || row.name || ''),
        points: Number(row.points ?? row.pointsCost ?? 0),
        stock: Number(row.stock || 0),
        sortOrder: Number(row.sortOrder || 0),
        status: String(row.status || 'active'),
        description: String(row.description || row.desc || ''),
        media: Array.isArray(row.media) ? row.media : [],
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      }));
    return res.json({ list });
  });

  app.get('/api/b/mall/activities', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const source = (Array.isArray(state.mallActivities) && state.mallActivities.length ? state.mallActivities : state.bCustomerActivities || []);
    const list = source
      .filter((row) => canAccessTemplate(state, req.actor, row))
      .map((row) => ({
        id: Number(row.id || 0),
        title: String(row.title || ''),
        status: String(row.status || 'active'),
        rewardPoints: Number(row.rewardPoints || 0),
        sortOrder: Number(row.sortOrder || 0),
        description: String(row.description || row.desc || ''),
        media: Array.isArray(row.media) ? row.media : [],
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      }));
    return res.json({ list });
  });

  app.get('/api/b/orders', tenantContext, permissionRequired('customer:read'), dataScope('customer'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }
    const productOrders = (state.orders || []).filter((row) => {
      const customer = (state.users || []).find((user) => Number(user.id) === Number(row.customerId));
      return req.dataScope.canAccessCustomer(customer);
    });
    const activityOrders = (state.activityCompletions || [])
      .filter((row) => {
        const customer = (state.users || []).find((user) => Number(user.id) === Number(row.userId));
        return req.dataScope.canAccessCustomer(customer);
      })
      .map((row) => {
        const activity =
          (state.activities || []).find((a) => Number(a.id) === Number(row.activityId))
          || (state.mallActivities || []).find((a) => Number(a.id) === Number(row.activityId))
          || (state.bCustomerActivities || []).find((a) => Number(a.id) === Number(row.activityId));
        const createdAt = row.createdAt || new Date().toISOString();
        return {
          id: Number(`9${row.id}`),
          tenantId,
          customerId: Number(row.userId),
          productId: Number(row.activityId),
          productName: String(activity?.title || `活动#${row.activityId}`),
          quantity: 1,
          pointsAmount: Number(row.pointsAwarded || activity?.rewardPoints || 0),
          status: 'completed',
          paymentStatus: 'paid',
          fulfillmentStatus: 'fulfilled',
          refundStatus: 'none',
          orderNo: `ACT-${String(row.completedDate || '').replace(/-/g, '')}-${row.id}`,
          createdAt,
          updatedAt: createdAt,
          orderType: 'activity',
        };
      });
    const list = [...productOrders, ...activityOrders].sort(
      (a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime()
    );
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
