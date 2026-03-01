#!/usr/bin/env node

const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';
const ADMIN_ACTOR_ID = Number(process.env.P_COMPANY_ACTOR_ID || 9002);
const ADMIN_HEADERS = {
  'x-tenant-id': '1',
  'x-org-id': '1',
  'x-team-id': '1',
  'x-actor-type': 'employee',
  'x-actor-id': String(ADMIN_ACTOR_ID),
};

const IMG_A = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200';
const IMG_B = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200';
const VIDEO = 'https://www.w3schools.com/html/mov_bbb.mp4';

async function call(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function assert(cond, message, context) {
  if (!cond) {
    const err = new Error(message);
    err.context = context;
    throw err;
  }
}

(async () => {
  const startedAt = Date.now();
  const ts = Date.now();

  const health = await call('GET', '/api/health');
  assert(health.ok, 'API health check failed', health);

  const email = `chain_verify_${ts}@company.com`;
  const createEmp = await call(
    'POST',
    '/api/p/employees',
    { name: '链路验证员工', email, role: 'salesperson', initialPassword: '123456' },
    ADMIN_HEADERS
  );
  let employee = createEmp.data?.employee;
  if (!employee) {
    const employees = await call('GET', '/api/p/employees', null, ADMIN_HEADERS);
    employee = (employees.data?.list || []).find((x) => x.email === email);
  }
  assert(employee, 'Failed to create/find employee', createEmp);

  const actorHeaders = {
    'x-tenant-id': '1',
    'x-org-id': String(employee.orgId || 1),
    'x-team-id': String(employee.teamId || 1),
    'x-actor-type': 'agent',
    'x-actor-id': String(employee.id),
  };

  const activityTitle = `活动链路_${ts}`;
  const courseTitle = `学习链路_${ts}`;
  const itemName = `商城商品_${ts}`;
  const mallActivityTitle = `商城活动_${ts}`;

  const createActivity = await call(
    'POST',
    '/api/b/activity-configs',
    {
      title: activityTitle,
      category: 'task',
      desc: '活动详情_链路一致性',
      rewardPoints: 66,
      status: 'online',
      media: [{ name: 'a.jpg', type: 'image/jpeg', preview: IMG_A }],
    },
    actorHeaders
  );
  assert(createActivity.ok, 'Create activity failed', createActivity);

  const createCourse = await call(
    'POST',
    '/api/b/content/items',
    {
      title: courseTitle,
      category: '通用培训',
      body: '学习详情_链路一致性',
      contentType: 'video',
      rewardPoints: 88,
      status: 'published',
      media: [
        { name: 'cover.jpg', type: 'image/jpeg', preview: IMG_B },
        { name: 'demo.mp4', type: 'video/mp4', preview: VIDEO, url: VIDEO },
      ],
    },
    actorHeaders
  );
  assert(createCourse.ok, 'Create course failed', createCourse);

  const createItem = await call(
    'POST',
    '/api/b/mall/products',
    {
      name: itemName,
      desc: '商城详情_链路一致性',
      points: 99,
      stock: 9,
      status: 'active',
      media: [{ name: 'item.jpg', type: 'image/jpeg', preview: IMG_A }],
    },
    actorHeaders
  );
  assert(createItem.ok, 'Create mall item failed', createItem);

  const createMallActivity = await call(
    'POST',
    '/api/b/mall/activities',
    {
      title: mallActivityTitle,
      desc: '商城活动详情_链路一致性',
      rewardPoints: 77,
      status: 'active',
      media: [{ name: 'ma.jpg', type: 'image/jpeg', preview: IMG_B }],
    },
    actorHeaders
  );
  assert(createMallActivity.ok, 'Create mall activity failed', createMallActivity);

  const mobile = `13${String(ts).slice(-9)}`;
  const verify = await call('POST', '/api/auth/verify-basic', { name: '张三', mobile, code: '123456' });
  assert(verify.ok, 'Create C customer failed', verify);
  const token = verify.data?.token;
  const customer = verify.data?.user;
  assert(token && customer?.id, 'Missing customer token/id', verify);

  const assign = await call(
    'POST',
    '/api/p/customers/system-assign',
    { agentId: employee.id, customerIds: [customer.id] },
    ADMIN_HEADERS
  );
  assert(assign.ok, 'Assign customer failed', assign);

  const cHeaders = { Authorization: `Bearer ${token}`, 'x-tenant-id': '1' };
  const [acts, courses, items, mallActs] = await Promise.all([
    call('GET', '/api/activities', null, cHeaders),
    call('GET', '/api/learning/courses', null, cHeaders),
    call('GET', '/api/mall/items', null, cHeaders),
    call('GET', '/api/mall/activities', null, cHeaders),
  ]);

  assert(acts.ok && courses.ok && items.ok && mallActs.ok, 'C list API failed', {
    acts,
    courses,
    items,
    mallActs,
  });

  const act = (acts.data.activities || []).find((x) => x.title === activityTitle);
  const course = (courses.data.courses || []).find((x) => x.title === courseTitle);
  const item = (items.data.items || []).find((x) => (x.name || x.title) === itemName);
  const mAct = (mallActs.data.list || []).find((x) => x.title === mallActivityTitle);

  assert(act, 'C activity not visible', acts.data);
  assert(course, 'C course not visible', courses.data);
  assert(item, 'C mall item not visible', items.data);
  assert(mAct, 'C mall activity not visible', mallActs.data);

  const courseDetail = await call('GET', `/api/learning/courses/${course.id}`, null, cHeaders);
  assert(courseDetail.ok && courseDetail.data?.course, 'C course detail failed', courseDetail);

  const checks = {
    activity: {
      title: act.title === activityTitle,
      image: Boolean(act.image),
      description: String(act.description || '') === '活动详情_链路一致性',
      reward: Number(act.rewardPoints) === 66,
    },
    learning: {
      title: course.title === courseTitle,
      image: Boolean(course.image),
      videoUrl: Boolean(course.videoUrl),
      content: String(course.content || '') === '学习详情_链路一致性',
      detailSameTitle: String(courseDetail.data.course.title || '') === courseTitle,
      detailSameContent: String(courseDetail.data.course.content || '') === '学习详情_链路一致性',
      detailHasVideo: Boolean(courseDetail.data.course.videoUrl),
    },
    mallItem: {
      name: (item.name || item.title) === itemName,
      image: Boolean(item.image),
      description: String(item.description || '') === '商城详情_链路一致性',
      points: Number(item.pointsCost) === 99,
    },
    mallActivity: {
      title: mAct.title === mallActivityTitle,
      image: Boolean(mAct.image),
      subtitle: String(mAct.subtitle || '') === '商城活动详情_链路一致性',
      reward: Number(mAct.rewardPoints) === 77,
    },
  };

  const failed = Object.entries(checks)
    .flatMap(([k, v]) => Object.entries(v).filter(([, ok]) => !ok).map(([f]) => `${k}.${f}`));

  assert(!failed.length, 'Validation failed', { failed, checks });

  console.log(
    JSON.stringify(
      {
        ok: true,
        durationMs: Date.now() - startedAt,
        employee: { id: employee.id, email: employee.email },
        customer: { id: customer.id, mobile },
        checks,
      },
      null,
      2
    )
  );
})().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: err.message,
        context: err.context || null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
