import { chromium } from 'playwright';

const API = process.env.API_BASE || 'http://127.0.0.1:4000';
const P_WEB = process.env.P_WEB_BASE || 'http://127.0.0.1:3015';
const B_WEB = process.env.B_WEB_BASE || 'http://127.0.0.1:3002';
const C_WEB = process.env.C_WEB_BASE || 'http://127.0.0.1:3000';

const cases = [];
const artifacts = [];

function addCase(id, title, passed, detail = {}) {
  cases.push({ id, title, passed, detail });
}

async function api(path, init = {}) {
  const resp = await fetch(`${API}${path}`, init);
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: resp.status, ok: resp.ok, data };
}

function headers(obj) {
  return { 'Content-Type': 'application/json', ...obj };
}

function actorHeaders({ tenantId, orgId, teamId, actorType, actorId }) {
  return {
    'x-tenant-id': String(tenantId),
    'x-org-id': String(orgId),
    'x-team-id': String(teamId),
    'x-actor-type': String(actorType),
    'x-actor-id': String(actorId),
  };
}

function dayKeyCN(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

(async () => {
  const suffix = nowSuffix();

  const pPlatform = await api('/api/p/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ account: 'platform001', password: '123456' }),
  });
  addCase('REG-P-001', 'P端平台管理员登录', pPlatform.ok && pPlatform.data?.ok === true, { status: pPlatform.status });

  const platformActor = { tenantId: 1, orgId: 1, teamId: 1, actorType: 'employee', actorId: 9001 };

  const tenantName = `回归租户_${suffix}`;
  const adminEmail = `reg_admin_${suffix}@demo.local`;
  const adminPwd = '123456';

  const createTenant = await api('/api/p/tenants', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders(platformActor) },
    body: JSON.stringify({
      name: tenantName,
      type: 'company',
      status: 'active',
      adminEmail,
      initialPassword: adminPwd,
    }),
  });

  const tenantId = Number(createTenant.data?.tenant?.id || 0);

  const pCompany = await api('/api/p/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ account: adminEmail, password: adminPwd }),
  });

  const adminSession = pCompany.data?.session || {};
  const tenantActor = {
    tenantId: Number(adminSession.tenantId || tenantId),
    orgId: Number(adminSession.orgId || 1),
    teamId: Number(adminSession.teamId || 1),
    actorType: String(adminSession.actorType || 'employee'),
    actorId: Number(adminSession.actorId || 0),
  };

  const teamsResp = await api('/api/p/teams', { headers: actorHeaders(tenantActor) });
  const teamList = Array.isArray(teamsResp.data?.list) ? teamsResp.data.list : [];
  const tenantTeamId = Number(teamList[0]?.id || tenantActor.teamId || 1);
  const tenantOrgId = Number(teamList[0]?.orgId || tenantActor.orgId || 1);

  const agentEmail = `reg_agent_${suffix}@demo.local`;
  const leadEmail = `reg_lead_${suffix}@demo.local`;
  const agentMobile = `138${String(Date.now()).slice(-8)}`;
  const leadMobile = `139${String(Date.now()).slice(-8)}`;

  const createAgent = await api('/api/p/employees', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({
      name: '回归业务员',
      email: agentEmail,
      mobile: agentMobile,
      role: 'salesperson',
      teamId: tenantTeamId,
      orgId: tenantOrgId,
      initialPassword: '123456',
    }),
  });

  const createLead = await api('/api/p/employees', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({
      name: '回归团队主管',
      email: leadEmail,
      mobile: leadMobile,
      role: 'support',
      teamId: tenantTeamId,
      orgId: tenantOrgId,
      initialPassword: '123456',
    }),
  });

  const agentId = Number(createAgent.data?.employee?.id || 0);
  const leadId = Number(createLead.data?.employee?.id || 0);

  const pAgent = await api('/api/p/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ account: agentEmail, password: '123456' }),
  });
  addCase('REG-P-004', 'P端租户员工登录可用', pCompany.ok && pAgent.ok && tenantId > 0 && agentId > 0, {
    createTenant: createTenant.status,
    company: pCompany.status,
    agent: pAgent.status,
    tenantId,
    agentId,
  });

  const bCompany = await api('/api/b/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ account: adminEmail, password: adminPwd }),
  });
  const bAgent = await api('/api/b/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ account: agentEmail, password: '123456' }),
  });
  addCase('REG-B-001', 'B端员工登录', bCompany.ok && bAgent.ok, { company: bCompany.status, agent: bAgent.status });

  const pTenantsPlatform = await api('/api/p/tenants', { headers: actorHeaders(platformActor) });
  const pTenantsCompany = await api('/api/p/tenants', { headers: actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) });
  const platformCount = Array.isArray(pTenantsPlatform.data?.list) ? pTenantsPlatform.data.list.length : -1;
  const companyCount = Array.isArray(pTenantsCompany.data?.list) ? pTenantsCompany.data.list.length : -1;
  addCase('DP-AUTH-001', '租户隔离：platform/company 租户可见范围', pTenantsPlatform.ok && pTenantsCompany.ok && platformCount > 1 && companyCount === 1, {
    platformCount,
    companyCount,
  });

  addCase('DP-AUTH-003-PRE', '创建团队主管账号', createLead.ok && leadId > 0, { status: createLead.status, leadId });

  const customerMobile1 = `137${String(Date.now()).slice(-8)}`;
  const customerMobile2 = `136${String(Date.now()).slice(-8)}`;

  const cReg1 = await api('/api/auth/verify-basic', {
    method: 'POST',
    headers: { ...headers(), 'x-tenant-id': String(tenantActor.tenantId) },
    body: JSON.stringify({ name: '回归客户甲', mobile: customerMobile1, code: '123456', tenantId: tenantActor.tenantId }),
  });
  const cReg2 = await api('/api/auth/verify-basic', {
    method: 'POST',
    headers: { ...headers(), 'x-tenant-id': String(tenantActor.tenantId) },
    body: JSON.stringify({ name: '回归客户乙', mobile: customerMobile2, code: '123456', tenantId: tenantActor.tenantId }),
  });

  const customerId1 = Number(cReg1.data?.user?.id || 0);

  await api('/api/p/customers/assign-by-mobile', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({ mobile: customerMobile1, agentId }),
  });
  await api('/api/p/customers/assign-by-mobile', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({ mobile: customerMobile2, agentId }),
  });

  const bCustomersAgent = await api('/api/b/customers', {
    headers: actorHeaders({ tenantId: tenantActor.tenantId, orgId: tenantOrgId, teamId: tenantTeamId, actorType: 'agent', actorId: agentId }),
  });
  const bCustomersLead = await api('/api/b/customers', {
    headers: actorHeaders({ tenantId: tenantActor.tenantId, orgId: tenantOrgId, teamId: tenantTeamId, actorType: 'employee', actorId: leadId }),
  });

  const agentList = Array.isArray(bCustomersAgent.data?.list) ? bCustomersAgent.data.list : [];
  const leadList = Array.isArray(bCustomersLead.data?.list) ? bCustomersLead.data.list : [];
  const agentOwnerOk = agentList.length > 0 && agentList.every((x) => Number(x.ownerUserId || x.ownerId || 0) === agentId);
  const leadTeamOk = leadList.length > 0 && leadList.every((x) => Number(x.teamId || 0) === tenantTeamId);

  addCase('DP-AUTH-002', 'agent 仅可见本人客户', bCustomersAgent.ok && agentOwnerOk, { count: agentList.length, agentId });
  addCase('DP-AUTH-003', 'team_lead 仅可见本团队客户', bCustomersLead.ok && leadTeamOk, { count: leadList.length, teamId: tenantTeamId });

  const crossTenantEmail = `reg_cross_admin_${suffix}@demo.local`;
  const createTenant2 = await api('/api/p/tenants', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders(platformActor) },
    body: JSON.stringify({
      name: `回归跨租户_${suffix}`,
      type: 'company',
      status: 'active',
      adminEmail: crossTenantEmail,
      initialPassword: '123456',
    }),
  });
  const tenantId2 = Number(createTenant2.data?.tenant?.id || 0);

  const crossTenantRead = await api('/api/p/employees', {
    headers: actorHeaders({
      tenantId: tenantId2 || tenantActor.tenantId + 999,
      orgId: tenantOrgId,
      teamId: tenantTeamId,
      actorType: 'employee',
      actorId: tenantActor.actorId,
    }),
  });
  addCase('DP-AUTH-004', '越权读取防护（跨租户）', crossTenantRead.status === 403, {
    status: crossTenantRead.status,
    code: crossTenantRead.data?.code,
    tenantId2,
  });

  const trackC = await api('/api/track/events', {
    method: 'POST',
    headers: {
      ...headers(),
      ...actorHeaders({
        tenantId: tenantActor.tenantId,
        orgId: tenantOrgId,
        teamId: tenantTeamId,
        actorType: 'customer',
        actorId: customerId1 || 1,
      }),
    },
    body: JSON.stringify({ event: 'c_share_success', properties: { from: 'regression' } }),
  });

  const trackB = await api('/api/track/events', {
    method: 'POST',
    headers: {
      ...headers(),
      ...actorHeaders({
        tenantId: tenantActor.tenantId,
        orgId: tenantOrgId,
        teamId: tenantTeamId,
        actorType: 'agent',
        actorId: agentId,
      }),
    },
    body: JSON.stringify({ event: 'b_tools_share_success', properties: { from: 'regression' } }),
  });

  const shareDaily = await api(
    `/api/p/metrics/share-daily?day=${dayKeyCN()}&cActorId=${customerId1 || 1}&bActorId=${agentId}`,
    {
      headers: actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }),
    }
  );

  addCase(
    'DP-EVT-006',
    '分享分端统计(c/b)分开返回',
    trackC.ok &&
      trackB.ok &&
      shareDaily.ok &&
      Number(shareDaily.data?.cShareCount) >= 1 &&
      Number(shareDaily.data?.bShareCount) >= 1 &&
      shareDaily.data?.metricKeys?.c === 'c_share_success_cnt' &&
      shareDaily.data?.metricKeys?.b === 'b_share_success_cnt',
    { status: shareDaily.status, c: shareDaily.data?.cShareCount, b: shareDaily.data?.bShareCount }
  );

  const metricsConfig = await api('/api/p/metrics/config', {
    headers: actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }),
  });
  const allRules = Array.isArray(metricsConfig.data?.rules) ? metricsConfig.data.rules : [];
  const hasLoginCum = allRules.some((x) => {
    const n = String(x.name || '');
    return n.includes('累计登录天数') || n.includes('连续登录天数');
  });
  const hasSigninCum = allRules.some((x) => {
    const n = String(x.name || '');
    return n.includes('累计签到天数') || n.includes('连续签到天数');
  });
  addCase('DP-MET-001/002', '累计/连续登录天数与签到天数指标存在', metricsConfig.ok && hasLoginCum && hasSigninCum, {
    rules: allRules.length,
  });

  const tagSuffix = nowSuffix();
  const createTag = await api('/api/p/tags', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({ tagCode: `REG_TAG_${tagSuffix}`, tagName: `回归标签_${tagSuffix}`, tagType: 'enum', status: 'active' }),
  });
  const tagId = Number(createTag.data?.item?.id || 0);

  const constRule = await api('/api/p/tag-rules', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({
      ruleCode: `REG_RULE_CONST_${tagSuffix}`,
      ruleName: '固定值回归规则',
      targetTagIds: [tagId],
      priority: 10,
      status: 'active',
      conditionDsl: { op: 'and', children: [{ metric: 'c_login_days_30d', cmp: '>=', value: 0 }] },
      outputExpr: { mode: 'const', value: '高价值' },
    }),
  });
  const constRuleId = Number(constRule.data?.item?.id || 0);

  const mapRule = await api('/api/p/tag-rules', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({
      ruleCode: `REG_RULE_MAP_${tagSuffix}`,
      ruleName: '映射值回归规则',
      targetTagIds: [tagId],
      priority: 11,
      status: 'active',
      conditionDsl: { op: 'and', children: [{ metric: 'c_login_days_30d', cmp: '>=', value: 0 }] },
      outputExpr: {
        mode: 'map',
        sourceMetric: 'renew_intent_score',
        mappings: [
          { cmp: '>=', value: 80, output: '高意向' },
          { cmp: '>=', value: 50, output: '中意向' },
        ],
        defaultValue: '低意向',
      },
    }),
  });
  const mapRuleId = Number(mapRule.data?.item?.id || 0);

  const runTagJob = await api('/api/p/tag-rule-jobs', {
    method: 'POST',
    headers: { ...headers(), ...actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }) },
    body: JSON.stringify({ jobType: 'delta', triggerType: 'manual', targetRuleIds: [constRuleId, mapRuleId] }),
  });
  const jobId = Number(runTagJob.data?.item?.id || 0);

  const logs = await api(`/api/p/tag-rule-jobs/${jobId}/logs?page=1&pageSize=200`, {
    headers: actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }),
  });
  const logList = Array.isArray(logs.data?.list) ? logs.data.list : [];
  const constHit = logList.find((x) => Number(x.ruleId) === constRuleId && x.result === 'hit');
  const mapHit = logList.find((x) => Number(x.ruleId) === mapRuleId && x.result === 'hit');
  const mapValOk = mapHit ? ['高意向', '中意向', '低意向'].includes(String(mapHit.outputValue || '')) : false;

  addCase('DP-TAG-001', '标签固定值命中输出', Boolean(constHit && String(constHit.outputValue || '').length > 0), {
    outputValue: constHit?.outputValue || null,
  });
  addCase('DP-TAG-002', '标签映射值命中输出', Boolean(mapHit && mapValOk), { outputValue: mapHit?.outputValue || null });

  const deleteTagInUse = await api(`/api/p/tags/${tagId}`, {
    method: 'DELETE',
    headers: actorHeaders({ ...tenantActor, teamId: tenantTeamId, orgId: tenantOrgId }),
  });
  addCase('DP-TAG-005', '标签被规则引用不可删除', deleteTagInUse.status === 409 && deleteTagInUse.data?.code === 'TAG_IN_USE', {
    status: deleteTagInUse.status,
    code: deleteTagInUse.data?.code,
  });

  await api('/api/p/mall/products', {
    method: 'POST',
    headers: {
      ...headers(),
      ...actorHeaders({
        tenantId: tenantActor.tenantId,
        orgId: tenantOrgId,
        teamId: tenantTeamId,
        actorType: 'agent',
        actorId: agentId,
      }),
    },
    body: JSON.stringify({
      title: `回归兑换商品_${suffix}`,
      points: 8,
      stock: 999,
      status: 'active',
      category: '实物礼品 (Gift)',
      description: '回归测试兑换商品',
    }),
  });

  // Reuse already assigned customer token to ensure customer can see agent-created templates.
  const verify = cReg1;
  const token = verify.data?.token;
  const authed = token ? { Authorization: `Bearer ${token}` } : {};

  const sign = await api('/api/sign-in', { method: 'POST', headers: authed });
  const complete = await api('/api/activities/4/complete', { method: 'POST', headers: authed });
  const mall = await api('/api/mall/items', { headers: authed });
  const itemList = Array.isArray(mall.data?.items) ? mall.data.items : [];
  const item = itemList.find((x) => Number(x.pointsCost || 0) > 0) || itemList[0] || null;
  const redeem = item
    ? await api('/api/mall/redeem', {
        method: 'POST',
        headers: { ...headers(), ...authed },
        body: JSON.stringify({ itemId: Number(item.id) }),
      })
    : { status: 500, ok: false, data: null };
  const tx = await api('/api/points/transactions', { headers: authed });

  addCase('REG-C-001', 'C端实名登录', verify.ok && Boolean(token), { status: verify.status });
  addCase('REG-C-004', 'C端签到成功', sign.ok, { status: sign.status, code: sign.data?.code || null });
  addCase('REG-C-005', 'C端商城兑换成功', redeem.ok, {
    status: redeem.status,
    completeStatus: complete.status,
    redeemCode: redeem.data?.code || null,
  });
  addCase('DP-PTS-001/002', '签到发分+兑换扣分流水存在', tx.ok && Array.isArray(tx.data?.list) && tx.data.list.length > 0, {
    txCount: Array.isArray(tx.data?.list) ? tx.data.list.length : -1,
  });

  const browser = await chromium.launch({ headless: true });

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let pDialog = '';
    page.on('dialog', async (d) => {
      pDialog = d.message();
      await d.dismiss();
    });

    await page.goto(P_WEB, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('company001').fill(leadEmail);
    await page.getByPlaceholder('123456').fill('123456');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForTimeout(1200);
    await page.getByText('活动中心').first().click();
    await page.waitForTimeout(800);
    const createBtn = page.getByRole('button', { name: /新建活动/ }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(500);
    }
    const noPerm = pDialog.includes('仅平台管理员');
    await page.screenshot({ path: '/tmp/reg_p_teamlead_create_activity.png', fullPage: true });
    artifacts.push('/tmp/reg_p_teamlead_create_activity.png');
    addCase('BROWSER-P-001', 'P端团队主管可进入新建活动', !noPerm, { dialog: pDialog || null });
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    const page = await context.newPage();
    await page.goto(B_WEB, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/员工账号|账号/i).first().fill(agentEmail);
    await page.getByPlaceholder(/密码/i).first().fill('123456');
    await page.getByRole('button', { name: /登 录|登录/ }).first().click();
    await page.waitForTimeout(1500);
    const hasWorkbench =
      (await page.getByText('工作台').first().isVisible().catch(() => false)) ||
      (await page.getByText('客户库').first().isVisible().catch(() => false)) ||
      (await page.getByText('获客工具').first().isVisible().catch(() => false));
    await page.screenshot({ path: '/tmp/reg_b_agent_profile.png', fullPage: true });
    artifacts.push('/tmp/reg_b_agent_profile.png');
    addCase('BROWSER-B-001', 'B端业务员登录后页面可用', hasWorkbench, {});
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    const page = await context.newPage();
    await page.goto(C_WEB, { waitUntil: 'domcontentloaded' });
    const learningBtn = page.getByText('知识学习').first();
    let learningVisible = false;
    if (await learningBtn.isVisible().catch(() => false)) {
      await learningBtn.click();
      await page.waitForTimeout(700);
      learningVisible = await page.getByText('知识学习').first().isVisible().catch(() => false);
    }
    await page.screenshot({ path: '/tmp/reg_c_learning.png', fullPage: true });
    artifacts.push('/tmp/reg_c_learning.png');
    addCase('BROWSER-C-001', 'C端知识学习页可进入', learningVisible, {});
    await context.close();
  }

  await browser.close();

  const passed = cases.filter((x) => x.passed).length;
  const failed = cases.filter((x) => !x.passed).length;
  const summary = {
    total: cases.length,
    passed,
    failed,
    passRate: `${((passed / Math.max(1, cases.length)) * 100).toFixed(1)}%`,
  };

  console.log(JSON.stringify({ summary, cases, artifacts }, null, 2));
})();
