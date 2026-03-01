#!/usr/bin/env node

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return fallback;
  return String(process.argv[idx + 1] || fallback).trim();
}

function parseCsv(input) {
  return String(input || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

async function api(apiBase, path, init = {}) {
  const resp = await fetch(`${apiBase}${path}`, init);
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: resp.ok, status: resp.status, data };
}

function actorHeaders(session = {}, extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-tenant-id': String(session.tenantId || 0),
    'x-org-id': String(session.orgId || 0),
    'x-team-id': String(session.teamId || 0),
    'x-actor-type': String(session.actorType || 'employee'),
    'x-actor-id': String(session.actorId || 0),
    ...(session.token ? { Authorization: `Bearer ${String(session.token)}` } : {}),
    ...(session.csrfToken ? { 'x-csrf-token': String(session.csrfToken) } : {}),
    ...extra,
  };
}

async function ensureCustomerRegistered(apiBase, mobile, tenantId, customerNamePrefix = '自动分配客户') {
  const normalizedName = String(customerNamePrefix || '')
    .replace(/[^\u4e00-\u9fa5·]/g, '')
    .slice(0, 20);
  const customerName = normalizedName.length >= 2 ? normalizedName : '测试客户';

  const sendCode = await api(apiBase, '/api/auth/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  if (!sendCode.ok) {
    throw new Error(`SEND_CODE_FAILED(${mobile}): ${sendCode.status} ${sendCode.data?.code || ''}`);
  }

  const verify = await api(apiBase, '/api/auth/verify-basic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': String(tenantId),
    },
    body: JSON.stringify({
      name: customerName,
      mobile,
      code: '123456',
    }),
  });
  if (!verify.ok) {
    throw new Error(`VERIFY_BASIC_FAILED(${mobile}): ${verify.status} ${verify.data?.code || ''}`);
  }

  return {
    token: String(verify.data?.token || ''),
    userId: Number(verify.data?.user?.id || 0),
  };
}

async function assignByMobileViaApi(apiBase, platformSession, mobile, agentId) {
  const resp = await api(apiBase, '/api/p/customers/assign-by-mobile', {
    method: 'POST',
    headers: actorHeaders(platformSession, { 'x-action-confirm': 'YES' }),
    body: JSON.stringify({ mobile, agentId }),
  });
  if (!resp.ok || !resp.data?.ok) {
    throw new Error(`ASSIGN_BY_MOBILE_FAILED(${mobile}): ${resp.status} ${resp.data?.code || ''}`);
  }
  return resp.data;
}

async function verifyVisibleCounts(apiBase, customerToken) {
  const auth = customerToken ? { Authorization: `Bearer ${customerToken}` } : {};

  const [courses, activities, mall] = await Promise.all([
    api(apiBase, '/api/learning/courses', { headers: auth }),
    api(apiBase, '/api/activities', { headers: auth }),
    api(apiBase, '/api/mall/items', { headers: auth }),
  ]);

  const courseList = Array.isArray(courses.data?.courses) ? courses.data.courses : [];
  const activityList = Array.isArray(activities.data?.activities) ? activities.data.activities : [];
  const productList = Array.isArray(mall.data?.items) ? mall.data.items : [];

  return {
    courses: courseList.length,
    activities: activityList.length,
    products: productList.length,
    samples: {
      courseTitles: courseList.slice(0, 5).map((x) => String(x.title || '')),
      activityTitles: activityList.slice(0, 5).map((x) => String(x.title || '')),
      productNames: productList.slice(0, 5).map((x) => String(x.name || x.title || '')),
    },
  };
}

async function main() {
  const apiBase = argValue('--api-base', 'http://127.0.0.1:4000');
  const agentAccount = argValue('--agent-account', '');
  const agentPassword = argValue('--agent-password', '123456');
  const platformAccount = argValue('--platform-account', 'platform001');
  const platformPassword = argValue('--platform-password', '123456');
  const mobiles = parseCsv(argValue('--customer-mobiles', ''));
  const dedupedMobiles = [...new Set(mobiles)];
  const customerNamePrefix = argValue('--customer-name-prefix', '自动分配客户');

  if (!agentAccount) throw new Error('AGENT_REQUIRED: 请传 --agent-account');
  if (!mobiles.length) throw new Error('CUSTOMER_REQUIRED: 请传 --customer-mobiles');

  const bLogin = await api(apiBase, '/api/b/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: agentAccount, password: agentPassword }),
  });
  if (!bLogin.ok || !bLogin.data?.session) {
    throw new Error(`AGENT_LOGIN_FAILED: ${bLogin.status} ${bLogin.data?.code || ''}`);
  }
  const bSession = bLogin.data.session;

  const pLogin = await api(apiBase, '/api/p/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: platformAccount, password: platformPassword }),
  });
  if (!pLogin.ok || !pLogin.data?.session) {
    throw new Error(`PLATFORM_LOGIN_FAILED: ${pLogin.status} ${pLogin.data?.code || ''}`);
  }
  const pSession = pLogin.data.session;

  const assignedCustomers = [];
  const createdCustomers = [];
  let firstCustomerToken = '';
  let firstCustomerId = 0;

  for (const mobile of dedupedMobiles) {
    const reg = await ensureCustomerRegistered(apiBase, mobile, Number(bSession.tenantId || 1), customerNamePrefix);
    if (reg.userId > 0) createdCustomers.push({ id: reg.userId, mobile });
    if (!firstCustomerToken) {
      firstCustomerToken = reg.token;
      firstCustomerId = reg.userId;
    }

    const assigned = await assignByMobileViaApi(apiBase, pSession, mobile, Number(bSession.actorId || 0));
    assignedCustomers.push({
      customerId: Number(assigned?.customer?.id || 0),
      mobile,
      after: {
        tenantId: Number(assigned?.customer?.tenantId || 0),
        ownerUserId: Number(assigned?.customer?.ownerUserId || 0),
      },
    });
  }

  const actualVisible = await verifyVisibleCounts(apiBase, firstCustomerToken);

  const result = {
    ok: true,
    agent: {
      id: Number(bSession.actorId || 0),
      name: String(bSession.name || ''),
      account: String(agentAccount),
      tenantId: Number(bSession.tenantId || 0),
      teamId: Number(bSession.teamId || 0),
    },
    assignedCustomers,
    createdCustomers,
    seededContent: null,
    verifyByFirstCustomer: {
      customerId: Number(firstCustomerId || 0),
      expected: {
        courses: actualVisible.courses,
        activities: actualVisible.activities,
        products: actualVisible.products,
      },
      actualVisible: {
        courses: actualVisible.courses,
        activities: actualVisible.activities,
        products: actualVisible.products,
      },
      samples: actualVisible.samples,
    },
    inputSummary: {
      inputCount: mobiles.length,
      uniqueCount: dedupedMobiles.length,
      duplicatedMobiles: mobiles.length === dedupedMobiles.length ? [] : mobiles.filter((m, i) => mobiles.indexOf(m) !== i),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: err?.message || String(err),
      },
      null,
      2
    )
  );
  process.exit(1);
});
