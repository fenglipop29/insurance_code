import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || '127.0.0.1';

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'db.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const state = loadState();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'insurance-api' });
});

app.get('/api/bootstrap', (req, res) => {
  const user = resolveUser(req);
  res.json({
    user: user ? formatUser(user) : null,
    balance: user ? getBalance(user.id) : 0,
    tabs: ['home', 'learning', 'activities', 'insurance', 'profile'],
  });
});

app.post('/api/auth/send-code', (req, res) => {
  const mobile = String(req.body?.mobile || '').trim();
  if (!/^1[3-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ code: 'INVALID_MOBILE', message: '请输入正确手机号' });
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const today = dateOnly(new Date());
    const sentToday = state.smsCodes.filter((s) => s.mobile === mobile && s.createdAt.startsWith(today)).length;
    if (sentToday >= 5) {
      return res.status(429).json({ code: 'SMS_LIMIT_REACHED', message: '今日验证码次数已达上限' });
    }
  }

  const code = process.env.DEV_SMS_CODE || '123456';
  state.smsCodes.push({
    id: nextId(state.smsCodes),
    mobile,
    code,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  });
  persist();
  res.json({ ok: true, message: '验证码已发送', dev_code: process.env.NODE_ENV === 'production' ? undefined : code });
});

app.post('/api/auth/verify-basic', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const mobile = String(req.body?.mobile || '').trim();
  const code = String(req.body?.code || '').trim();

  if (!/^[\u4e00-\u9fa5·]{2,20}$/.test(name)) return res.status(400).json({ code: 'INVALID_NAME', message: '姓名格式不正确' });
  if (!/^1[3-9]\d{9}$/.test(mobile)) return res.status(400).json({ code: 'INVALID_MOBILE', message: '手机号格式不正确' });
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ code: 'INVALID_CODE', message: '验证码格式不正确' });

  const isProd = process.env.NODE_ENV === 'production';
  const devBypassCode = process.env.DEV_SMS_CODE || '123456';
  const isDevBypass = !isProd && code === devBypassCode;

  const sms = [...state.smsCodes]
    .reverse()
    .find((s) => s.mobile === mobile && s.code === code && !s.used);
  if (!sms && !isDevBypass) return res.status(400).json({ code: 'CODE_NOT_FOUND', message: '验证码错误或已失效' });
  if (sms && isProd && new Date(sms.expiresAt).getTime() < Date.now()) return res.status(400).json({ code: 'CODE_EXPIRED', message: '验证码已过期' });

  if (sms) sms.used = true;
  let user = state.users.find((u) => u.mobile === mobile);
  if (!user) {
    user = {
      id: nextId(state.users),
      name,
      mobile,
      isVerifiedBasic: true,
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.users.push(user);
    appendPoints(user.id, 'earn', 200, 'onboard', String(user.id), '新用户基础积分');
  } else {
    user.name = name;
    user.isVerifiedBasic = true;
    user.verifiedAt = new Date().toISOString();
  }

  const token = crypto.randomUUID();
  state.sessions.push({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  persist();
  res.json({ token, user: formatUser(user) });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: formatUser(req.user), balance: getBalance(req.user.id) });
});

app.get('/api/activities', requireAuthOptional, (req, res) => {
  const sorted = state.activities.sort((a, b) => a.sortOrder - b.sortOrder);
  const activities = sorted.map((a) => enrichActivity(a, req.user?.id));
  const taskActivities = activities.filter((a) => a.canComplete);
  const completedTasks = taskActivities.filter((a) => a.completed).length;
  res.json({
    activities,
    balance: req.user ? getBalance(req.user.id) : 0,
    taskProgress: {
      total: taskActivities.length,
      completed: completedTasks,
    },
  });
});

app.post('/api/activities/:id/complete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const activity = state.activities.find((a) => a.id === id);
  if (!activity) return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' });
  if (activity.category === 'sign') return res.status(409).json({ code: 'USE_SIGN_IN', message: '签到任务请使用签到接口' });
  if (activity.category === 'competition') {
    return res.status(409).json({ code: 'MANUAL_FLOW_REQUIRED', message: '该活动需通过活动页参与，不支持直接完成' });
  }

  const today = dateOnly(new Date());
  const exists = state.activityCompletions.find(
    (x) => x.userId === req.user.id && x.activityId === id && x.completedDate === today
  );
  if (exists) return res.status(409).json({ code: 'ALREADY_COMPLETED', message: '今日该任务已完成' });

  state.activityCompletions.push({
    id: nextId(state.activityCompletions),
    userId: req.user.id,
    activityId: id,
    completedDate: today,
    pointsAwarded: activity.rewardPoints,
    createdAt: new Date().toISOString(),
  });
  appendPoints(req.user.id, 'earn', activity.rewardPoints, 'activity_task', String(id), `完成活动 ${activity.title}`);
  persist();
  res.json({ ok: true, reward: activity.rewardPoints, balance: getBalance(req.user.id) });
});

app.post('/api/sign-in', requireAuth, (req, res) => {
  if (!req.user.isVerifiedBasic) {
    return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
  }

  const today = dateOnly(new Date());
  const exists = state.signIns.find((s) => s.userId === req.user.id && s.signDate === today);
  if (exists) return res.status(409).json({ code: 'ALREADY_SIGNED', message: '今日已签到' });

  state.signIns.push({
    id: nextId(state.signIns),
    userId: req.user.id,
    signDate: today,
    pointsAwarded: 10,
    createdAt: new Date().toISOString(),
  });
  appendPoints(req.user.id, 'earn', 10, 'daily_sign_in', today, '每日签到奖励');
  persist();
  res.json({ ok: true, reward: 10, balance: getBalance(req.user.id) });
});

app.get('/api/points/summary', requireAuth, (req, res) => {
  res.json({ balance: getBalance(req.user.id) });
});

app.get('/api/points/transactions', requireAuth, (req, res) => {
  const list = state.pointTransactions
    .filter((t) => t.userId === req.user.id)
    .sort((a, b) => b.id - a.id);
  res.json({ list });
});

app.get('/api/mall/items', requireAuthOptional, (_req, res) => {
  res.json({ items: state.mallItems.filter((i) => i.isActive) });
});

app.post('/api/mall/redeem', requireAuth, (req, res) => {
  if (!req.user.isVerifiedBasic) {
    return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
  }
  const itemId = Number(req.body?.itemId);
  const item = state.mallItems.find((i) => i.id === itemId && i.isActive);
  if (!item) return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: '商品不存在' });
  if (item.stock <= 0) return res.status(409).json({ code: 'OUT_OF_STOCK', message: '库存不足' });
  const balance = getBalance(req.user.id);
  if (balance < item.pointsCost) return res.status(409).json({ code: 'INSUFFICIENT_POINTS', message: '积分不足' });

  item.stock -= 1;
  const redemption = {
    id: nextId(state.redemptions),
    userId: req.user.id,
    itemId: item.id,
    pointsCost: item.pointsCost,
    status: 'pending',
    writeoffToken: `EX${Date.now()}${Math.floor(Math.random() * 1000)}`,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    writtenOffAt: null,
  };
  state.redemptions.push(redemption);
  appendPoints(req.user.id, 'consume', item.pointsCost, 'redeem', String(redemption.id), `兑换 ${item.name}`);
  persist();

  res.json({ ok: true, token: redemption.writeoffToken, balance: getBalance(req.user.id) });
});

app.get('/api/redemptions', requireAuth, (req, res) => {
  const list = state.redemptions
    .filter((r) => r.userId === req.user.id)
    .map((r) => ({ ...r, itemName: state.mallItems.find((i) => i.id === r.itemId)?.name || '' }))
    .sort((a, b) => b.id - a.id);
  res.json({ list });
});

app.post('/api/redemptions/:id/writeoff', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const token = String(req.body?.token || '').trim();
  const row = state.redemptions.find((r) => r.id === id && r.userId === req.user.id);
  if (!row) return res.status(404).json({ code: 'REDEMPTION_NOT_FOUND', message: '兑换记录不存在' });
  if (row.status === 'written_off') return res.status(409).json({ code: 'ALREADY_WRITTEN_OFF', message: '已核销' });
  if (token && token !== row.writeoffToken) return res.status(400).json({ code: 'INVALID_TOKEN', message: '核销码错误' });
  if (new Date(row.expiresAt).getTime() < Date.now()) return res.status(410).json({ code: 'TOKEN_EXPIRED', message: '核销已过期' });
  row.status = 'written_off';
  row.writtenOffAt = new Date().toISOString();
  persist();
  res.json({ ok: true });
});

app.get('/api/learning/courses', (_req, res) => {
  const categories = new Set(['全部', ...state.learningCourses.map((c) => c.category)]);
  res.json({
    categories: [...categories],
    courses: state.learningCourses.sort((a, b) => a.id - b.id),
  });
});

app.get('/api/learning/courses/:id', (req, res) => {
  const id = Number(req.params.id);
  const course = state.learningCourses.find((c) => c.id === id);
  if (!course) return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '课程不存在' });
  res.json({ course });
});

app.post('/api/learning/courses/:id/complete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const course = state.learningCourses.find((c) => c.id === id);
  if (!course) return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '课程不存在' });

  const exists = state.courseCompletions.find((x) => x.userId === req.user.id && x.courseId === id);
  if (exists) {
    return res.json({
      ok: true,
      duplicated: true,
      reward: 0,
      balance: getBalance(req.user.id),
      message: '该课程已领取过积分',
    });
  }

  state.courseCompletions.push({
    id: nextId(state.courseCompletions),
    userId: req.user.id,
    courseId: id,
    pointsAwarded: course.points,
    createdAt: new Date().toISOString(),
  });
  appendPoints(req.user.id, 'earn', course.points, 'course_complete', String(id), `完成课程 ${course.title}`);
  persist();
  res.json({ ok: true, duplicated: false, reward: course.points, balance: getBalance(req.user.id) });
});

app.get('/api/learning/games', (_req, res) => {
  res.json({ games: state.learningGames.sort((a, b) => a.id - b.id) });
});

app.get('/api/learning/tools', (_req, res) => {
  res.json({ tools: state.learningTools.sort((a, b) => a.id - b.id) });
});

app.get('/api/insurance/overview', (_req, res) => {
  res.json({
    summary: state.insuranceSummary,
    familyMembers: state.familyMembers,
    reminders: state.insuranceReminders,
  });
});

app.get('/api/insurance/policies', (_req, res) => {
  const policies = state.policies
    .map((p) => ({ ...p, icon: iconByType(p.type) }))
    .sort((a, b) => b.id - a.id);
  res.json({ policies });
});

app.get('/api/insurance/policies/:id', (req, res) => {
  const id = Number(req.params.id);
  const policy = state.policies.find((p) => p.id === id);
  if (!policy) return res.status(404).json({ code: 'POLICY_NOT_FOUND', message: '保单不存在' });
  res.json({ policy: { ...policy, icon: iconByType(policy.type) } });
});

app.post('/api/insurance/policies/scan', (_req, res) => {
  res.json({
    ok: true,
    data: {
      company: '中国平安保险',
      name: '平安福21重疾险',
      applicant: '张三',
      insured: '张三',
      date: '2024-02-20',
      paymentPeriod: '20年交',
      coveragePeriod: '终身',
      amount: '500000',
      firstPremium: '12000',
    },
  });
});

app.post('/api/insurance/policies', requireAuth, (req, res) => {
  const company = String(req.body?.company || '').trim();
  const name = String(req.body?.name || '').trim();
  const applicant = String(req.body?.applicant || '').trim();
  const insured = String(req.body?.insured || '').trim();
  const date = String(req.body?.date || '').trim();
  const paymentPeriod = String(req.body?.paymentPeriod || '').trim();
  const coveragePeriod = String(req.body?.coveragePeriod || '').trim();
  const amount = Number(req.body?.amount);
  const firstPremium = Number(req.body?.firstPremium);
  const type = String(req.body?.type || '').trim() || inferPolicyType(name);

  if (!company || !name || !applicant || !insured || !date || !paymentPeriod || !coveragePeriod) {
    return res.status(400).json({ code: 'INVALID_POLICY_INPUT', message: '请完整填写保单信息' });
  }
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(firstPremium) || firstPremium <= 0) {
    return res.status(400).json({ code: 'INVALID_POLICY_AMOUNT', message: '保额或首期保费不正确' });
  }

  const policy = {
    id: nextId(state.policies),
    company,
    name,
    type,
    amount,
    nextPayment: nextPaymentDate(date),
    status: '保障中',
    applicant,
    insured,
    periodStart: date,
    periodEnd: calcPeriodEnd(date, coveragePeriod),
    annualPremium: firstPremium,
    paymentPeriod,
    coveragePeriod,
    responsibilities: defaultResponsibilities(type, amount),
    paymentHistory: [
      {
        date,
        amount: firstPremium,
        note: '首期缴费',
        status: '支付成功',
      },
    ],
    policyNo: `PL${Date.now()}${Math.floor(Math.random() * 1000)}`,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  state.policies.push(policy);
  refreshInsuranceSummary();
  persist();
  res.status(201).json({ ok: true, policy: { ...policy, icon: iconByType(policy.type) } });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`insurance api listening on http://${HOST}:${PORT}`);
});

function requireAuth(req, res, next) {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  req.user = user;
  next();
}

function requireAuthOptional(req, _res, next) {
  req.user = resolveUser(req);
  next();
}

function resolveUser(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return state.users.find((u) => u.id === session.userId) || null;
}

function getBalance(userId) {
  const txs = state.pointTransactions.filter((t) => t.userId === userId).sort((a, b) => b.id - a.id);
  return txs[0]?.balance || 0;
}

function appendPoints(userId, type, amount, source, sourceId, description) {
  const prev = getBalance(userId);
  const balance = type === 'earn' ? prev + amount : prev - amount;
  state.pointTransactions.push({
    id: nextId(state.pointTransactions),
    userId,
    type,
    amount,
    source,
    sourceId,
    balance,
    description,
    createdAt: new Date().toISOString(),
  });
}

function nextId(list) {
  if (!list.length) return 1;
  return Math.max(...list.map((x) => x.id)) + 1;
}

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    is_verified_basic: user.isVerifiedBasic,
    verified_at: user.verifiedAt,
  };
}

function loadState() {
  const initial = {
    users: [],
    smsCodes: [],
    sessions: [],
    activities: [
      { id: 1, title: '连续签到7天领鸡蛋', category: 'sign', rewardPoints: 10, sortOrder: 1, participants: 18230 },
      { id: 2, title: '保险知识王者赛', category: 'competition', rewardPoints: 50, sortOrder: 2, participants: 10230 },
      { id: 3, title: '完善保障信息', category: 'task', rewardPoints: 100, sortOrder: 3, participants: 5980 },
      { id: 4, title: '推荐好友加入', category: 'invite', rewardPoints: 500, sortOrder: 4, participants: 4200 },
    ],
    activityCompletions: [],
    signIns: [],
    pointTransactions: [],
    mallItems: [
      { id: 1, name: '智能低糖电饭煲', pointsCost: 1200, stock: 50, isActive: true },
      { id: 2, name: '家庭体检套餐', pointsCost: 800, stock: 80, isActive: true },
      { id: 3, name: '健康管理咨询券', pointsCost: 300, stock: 999, isActive: true },
    ],
    redemptions: [],
    learningCourses: [
      {
        id: 1,
        title: '如何使用手机申领医保报销',
        desc: '手把手教您在手机上操作，简单又省时',
        type: 'video',
        typeLabel: '视频课',
        progress: 80,
        timeLeft: '2 分钟',
        image: 'https://picsum.photos/seed/course1/800/400',
        action: '继续学习',
        color: 'bg-black/60',
        btnColor: 'bg-blue-500 text-white',
        points: 50,
        category: '医疗',
        content: '本节课程将详细演示如何通过官方APP或微信小程序，在线提交医疗报销凭证。无需线下排队，只需准备好发票、病历等材料的照片，跟着视频一步步操作即可完成申领。',
      },
      {
        id: 2,
        title: '三分钟看懂您的保单保障',
        desc: '用通俗易懂的漫画带您理清保障范围',
        type: 'comic',
        typeLabel: '趣味漫画',
        progress: 0,
        timeLeft: '约 3 分钟',
        image: 'https://picsum.photos/seed/course2/800/400',
        action: '开始学习',
        color: 'bg-blue-500',
        btnColor: 'bg-blue-50 text-blue-600',
        points: 30,
        category: '理赔',
        content: '买完保险却不知道保什么？这篇漫画用生动的场景和比喻，帮您快速看懂保单中的核心条款：重疾险保哪些病？医疗险怎么报销？意外险包含哪些意外？让您的保单不再是天书。',
      },
      {
        id: 3,
        title: '2024养老金调整政策解读',
        desc: '为您划重点，看看每月能多领多少钱',
        type: 'article',
        typeLabel: '实用图文',
        progress: 45,
        timeLeft: '剩 5 分钟',
        image: 'https://picsum.photos/seed/course3/800/400',
        action: '继续阅读',
        color: 'bg-slate-800',
        btnColor: 'bg-blue-500 text-white',
        points: 20,
        category: '养老',
        content: '2024年国家基本养老金上调政策正式发布。本次调整采取定额调整、挂钩调整与适当倾斜相结合的办法。本文将为您详细解读调整比例、计算方法以及高龄退休人员的特殊倾斜政策。',
      },
    ],
    courseCompletions: [],
    learningGames: [
      {
        id: 1,
        title: '风险大作战',
        desc: '识别生活中的潜在风险，保护你的小家',
        category: '风险认知',
        difficulty: 2,
        bestScore: '2500分',
        color: 'bg-orange-500',
        lightColor: 'bg-orange-50',
        textColor: 'text-orange-600',
      },
      {
        id: 2,
        title: '条款连连看',
        desc: '消除晦涩难懂的保险术语，轻松学知识',
        category: '产品理解',
        difficulty: 3,
        bestScore: '通关第5关',
        color: 'bg-indigo-500',
        lightColor: 'bg-indigo-50',
        textColor: 'text-indigo-600',
      },
    ],
    learningTools: [
      {
        id: 1,
        title: '养老金计算器',
        desc: '输入参数，可视化未来养老资金缺口',
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
      },
      {
        id: 2,
        title: '保障缺口分析',
        desc: '问答式引导，生成家庭风险矩阵报告',
        color: 'text-blue-500',
        bg: 'bg-blue-50',
      },
      {
        id: 3,
        title: '理赔进度查询',
        desc: '关联已托管保单，实时查询理赔状态',
        color: 'text-purple-500',
        bg: 'bg-purple-50',
      },
    ],
    insuranceSummary: {
      totalCoverage: 2500000,
      healthScore: 85,
      activePolicies: 3,
      annualPremium: 18420,
    },
    familyMembers: [
      {
        id: 1,
        name: '本人',
        avatar: 'https://picsum.photos/seed/self/100/100',
        score: 85,
        coveredTypes: ['医疗', '重疾'],
      },
      {
        id: 2,
        name: '妻子',
        avatar: 'https://picsum.photos/seed/wife/100/100',
        score: 72,
        coveredTypes: ['医疗', '重疾'],
      },
      {
        id: 3,
        name: '儿子',
        avatar: 'https://picsum.photos/seed/son/100/100',
        score: 92,
        coveredTypes: ['少儿', '医疗', '教育'],
      },
    ],
    insuranceReminders: [
      {
        id: 1,
        title: '车险续保提醒',
        desc: '您的沪A·*****保单即将到期',
        tag: '剩 5 天',
        actionText: '立即续保',
        kind: 'renewal',
      },
      {
        id: 2,
        title: '儿子生日提醒',
        desc: '别忘了为他准备生日礼物哦',
        tag: '明天',
        actionText: '查看福利',
        kind: 'birthday',
      },
      {
        id: 3,
        title: '体检报告已生成',
        desc: '年度健康体检结果已更新',
        tag: '3天前',
        actionText: '已读',
        kind: 'report',
      },
    ],
    policies: [
      {
        id: 1,
        company: '平安健康保险股份有限公司',
        name: '尊享e生2024',
        type: '医疗',
        amount: 3000000,
        nextPayment: '2025-01-01',
        status: '保障中',
        applicant: '张*三',
        insured: '张*三',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        annualPremium: 365,
        paymentPeriod: '1年交',
        coveragePeriod: '1年',
        responsibilities: [
          { name: '一般医疗保险金', desc: '含住院/门诊手术/住院前后门诊', limit: 3000000 },
          { name: '重疾医疗保险金', desc: '120种特定重大疾病', limit: 6000000 },
        ],
        paymentHistory: [{ date: '2024-01-01', amount: 365, note: '年度首缴', status: '支付成功' }],
        policyNo: '812345678901',
      },
      {
        id: 2,
        company: '中国人寿保险',
        name: '国寿福重疾险',
        type: '重疾',
        amount: 500000,
        nextPayment: '2024-08-15',
        status: '保障中',
        applicant: '张*三',
        insured: '张*三',
        periodStart: '2023-08-15',
        periodEnd: '2043-08-14',
        annualPremium: 12000,
        paymentPeriod: '20年交',
        coveragePeriod: '终身',
        responsibilities: [
          { name: '重大疾病保险金', desc: '120种重大疾病', limit: 500000 },
          { name: '轻症疾病保险金', desc: '40种轻症，最高6次', limit: 150000 },
        ],
        paymentHistory: [{ date: '2024-08-15', amount: 12000, note: '年度缴费', status: '支付成功' }],
        policyNo: '812345678902',
      },
      {
        id: 3,
        company: '太平洋保险',
        name: '太保意外伤害险',
        type: '意外',
        amount: 1000000,
        nextPayment: '2024-11-20',
        status: '保障中',
        applicant: '张*三',
        insured: '张*三',
        periodStart: '2023-11-20',
        periodEnd: '2024-11-19',
        annualPremium: 1200,
        paymentPeriod: '1年交',
        coveragePeriod: '1年',
        responsibilities: [
          { name: '意外身故/伤残', desc: '按伤残等级给付', limit: 1000000 },
          { name: '意外医疗', desc: '门急诊及住院医疗费用', limit: 100000 },
        ],
        paymentHistory: [{ date: '2023-11-20', amount: 1200, note: '年度首缴', status: '支付成功' }],
        policyNo: '812345678903',
      },
    ],
  };

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
    return initial;
  }

  const raw = fs.readFileSync(dbPath, 'utf8');
  const loaded = JSON.parse(raw);
  const normalized = {
    ...initial,
    ...loaded,
    insuranceSummary: {
      ...initial.insuranceSummary,
      ...(loaded.insuranceSummary || {}),
    },
  };
  normalized.activityCompletions = Array.isArray(normalized.activityCompletions) ? normalized.activityCompletions : [];
  refreshInsuranceSummaryFromState(normalized);
  fs.writeFileSync(dbPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

function enrichActivity(activity, userId) {
  const completed = userId ? isActivityCompleted(userId, activity) : false;
  return {
    ...activity,
    participants: Number(activity.participants || 0),
    completed,
    canComplete: activity.category !== 'competition',
  };
}

function isActivityCompleted(userId, activity) {
  const today = dateOnly(new Date());
  if (activity.category === 'sign') {
    return Boolean(state.signIns.find((x) => x.userId === userId && x.signDate === today));
  }
  return Boolean(
    state.activityCompletions.find((x) => x.userId === userId && x.activityId === activity.id && x.completedDate === today)
  );
}

function iconByType(type) {
  if (type === '医疗') return 'stethoscope';
  if (type === '重疾') return 'heart-pulse';
  if (type === '意外') return 'shield';
  return 'shield';
}

function inferPolicyType(name) {
  if (name.includes('医疗')) return '医疗';
  if (name.includes('重疾')) return '重疾';
  if (name.includes('意外')) return '意外';
  return '保障';
}

function calcPeriodEnd(startDate, coveragePeriod) {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  if (coveragePeriod === '终身') return '终身';
  const years = Number(String(coveragePeriod).replace('年', ''));
  if (!Number.isFinite(years) || years <= 0) return startDate;
  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextPaymentDate(startDate) {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultResponsibilities(type, amount) {
  if (type === '重疾') {
    return [
      { name: '重大疾病保险金', desc: '覆盖常见重大疾病', limit: amount },
      { name: '轻症疾病保险金', desc: '轻症多次赔付', limit: Math.floor(amount * 0.3) },
    ];
  }
  if (type === '意外') {
    return [
      { name: '意外身故/伤残', desc: '按合同约定比例给付', limit: amount },
      { name: '意外医疗', desc: '医疗费用报销', limit: Math.floor(amount * 0.1) },
    ];
  }
  return [
    { name: '一般医疗保险金', desc: '住院及门急诊保障', limit: amount },
    { name: '重疾医疗保险金', desc: '重大疾病医疗额外保障', limit: amount * 2 },
  ];
}

function refreshInsuranceSummary() {
  refreshInsuranceSummaryFromState(state);
}

function refreshInsuranceSummaryFromState(targetState) {
  const activePolicies = targetState.policies.filter((p) => p.status === '保障中').length;
  const totalCoverage = targetState.policies.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const annualPremium = targetState.policies.reduce((sum, p) => sum + Number(p.annualPremium || 0), 0);
  targetState.insuranceSummary = {
    ...(targetState.insuranceSummary || {}),
    totalCoverage,
    activePolicies,
    annualPremium,
    healthScore: targetState.insuranceSummary?.healthScore || 85,
  };
}

function persist() {
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
}
