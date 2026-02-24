const { chromium, request } = require('playwright');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:4000';
const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3003';

async function apiCall(api, method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await api.fetch(`${API_BASE}${path}`, {
    method,
    headers,
    data: body,
  });
  let json = null;
  try {
    json = await resp.json();
  } catch {
    json = null;
  }
  return { status: resp.status(), json };
}

(async () => {
  const results = [];
  const artifacts = [];
  const api = await request.newContext();

  const health = await apiCall(api, 'GET', '/api/health');
  results.push({
    id: 'API-HEALTH-001',
    area: '基础可用性',
    request: 'GET /api/health',
    expected: '200 + {ok:true,service:"insurance-api"}',
    status: health.status,
    passed: health.status === 200 && health.json?.ok === true && health.json?.service === 'insurance-api',
    response: health.json,
  });

  const mallAnon = await apiCall(api, 'GET', '/api/mall/items');
  results.push({
    id: 'API-MALL-ANON-001',
    area: '商城匿名浏览',
    request: 'GET /api/mall/items',
    expected: '未登录可返回200且items非空',
    status: mallAnon.status,
    passed: mallAnon.status === 200 && Array.isArray(mallAnon.json?.items) && mallAnon.json.items.length > 0,
    response: { itemCount: Array.isArray(mallAnon.json?.items) ? mallAnon.json.items.length : -1 },
  });

  const redeemAnon = await apiCall(api, 'POST', '/api/mall/redeem', { itemId: 1 });
  results.push({
    id: 'API-GATE-LOGIN-001',
    area: '兑换登录门禁',
    request: 'POST /api/mall/redeem body={itemId:1} (no auth)',
    expected: '401 UNAUTHORIZED',
    status: redeemAnon.status,
    passed: redeemAnon.status === 401 && redeemAnon.json?.code === 'UNAUTHORIZED',
    response: redeemAnon.json,
  });

  const mobile = `138${String(Date.now()).slice(-8)}`;
  const verify = await apiCall(api, 'POST', '/api/auth/verify-basic', {
    name: '张三',
    mobile,
    code: '123456',
  });
  const token = verify.json?.token;
  results.push({
    id: 'API-AUTH-001',
    area: '登录实名',
    request: `POST /api/auth/verify-basic body={name:'张三',mobile:'${mobile}',code:'123456'}`,
    expected: '200 + token',
    status: verify.status,
    passed: verify.status === 200 && Boolean(token),
    response: { hasToken: Boolean(token) },
  });

  const activities = await apiCall(api, 'GET', '/api/activities', undefined, token);
  results.push({
    id: 'API-DATA-ACT-001',
    area: '活动页数据',
    request: 'GET /api/activities (auth)',
    expected: '200 + activities[]',
    status: activities.status,
    passed: activities.status === 200 && Array.isArray(activities.json?.activities) && activities.json.activities.length > 0,
    response: { count: Array.isArray(activities.json?.activities) ? activities.json.activities.length : -1 },
  });

  const me = await apiCall(api, 'GET', '/api/me', undefined, token);
  results.push({
    id: 'API-DATA-ME-001',
    area: '我的页数据',
    request: 'GET /api/me (auth)',
    expected: '200 + user + balance',
    status: me.status,
    passed: me.status === 200 && Boolean(me.json?.user) && Number.isFinite(Number(me.json?.balance)),
    response: { user: me.json?.user?.name || null, balance: me.json?.balance },
  });

  const signIn = await apiCall(api, 'POST', '/api/sign-in', {}, token);
  const completeTask = await apiCall(api, 'POST', '/api/activities/4/complete', {}, token);
  const beforeRedeem = await apiCall(api, 'GET', '/api/points/summary', undefined, token);
  const redeem = await apiCall(api, 'POST', '/api/mall/redeem', { itemId: 3 }, token);
  const tx = await apiCall(api, 'GET', '/api/points/transactions', undefined, token);
  const redemptions = await apiCall(api, 'GET', '/api/redemptions', undefined, token);

  const redemptionRow = Array.isArray(redemptions.json?.list) ? redemptions.json.list[0] : null;
  let writeoff = { status: -1, json: null };
  let writeoffAgain = { status: -1, json: null };

  if (redemptionRow?.id) {
    writeoff = await apiCall(api, 'POST', `/api/redemptions/${redemptionRow.id}/writeoff`, { token: redemptionRow.writeoffToken }, token);
    writeoffAgain = await apiCall(api, 'POST', `/api/redemptions/${redemptionRow.id}/writeoff`, { token: redemptionRow.writeoffToken }, token);
  }

  results.push({
    id: 'API-DATA-POINTS-001',
    area: '积分页数据',
    request: 'GET /api/points/summary + /api/points/transactions (auth)',
    expected: '200 + balance + list[]',
    status: `${beforeRedeem.status}/${tx.status}`,
    passed: beforeRedeem.status === 200 && tx.status === 200 && Array.isArray(tx.json?.list),
    response: { balance: beforeRedeem.json?.balance, txCount: Array.isArray(tx.json?.list) ? tx.json.list.length : -1 },
  });

  const hasConsume = Array.isArray(tx.json?.list) && tx.json.list.some((r) => r?.source === 'redeem' || String(r?.description || '').includes('兑换'));
  results.push({
    id: 'API-REPLAY-001',
    area: '积分变更与兑换记录回放',
    request: 'sign-in -> activity complete -> redeem -> list redemptions -> writeoff -> writeoff again',
    expected: '链路可回放且幂等冲突返回409',
    status: `${signIn.status}/${completeTask.status}/${redeem.status}/${redemptions.status}/${writeoff.status}/${writeoffAgain.status}`,
    passed:
      signIn.status === 200 &&
      completeTask.status === 200 &&
      redeem.status === 200 &&
      redemptions.status === 200 &&
      writeoff.status === 200 &&
      writeoffAgain.status === 409 &&
      hasConsume,
    response: {
      redeemToken: redeem.json?.token ? 'present' : 'missing',
      redemptionCount: Array.isArray(redemptions.json?.list) ? redemptions.json.list.length : -1,
      writeoffAgainCode: writeoffAgain.json?.code || null,
      hasConsume,
    },
  });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    await dialog.dismiss().catch(() => {});
  });

  await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const popupTitle = page.locator('text=每日签到好礼').first();
  if (await popupTitle.isVisible().catch(() => false)) {
    await page.locator('div.fixed.inset-0.z-50 button').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  await page.locator('button:has-text("去积分商城"), button:has-text("查看积分")').first().click();
  await page.waitForTimeout(700);
  const mallHeaderVisible = await page.locator('h1:has-text("积分商城")').first().isVisible().catch(() => false);

  results.push({
    id: 'UI-MALL-ANON-001',
    area: 'UI商城匿名浏览',
    request: '未登录进入积分商城',
    expected: '可浏览商城列表',
    status: mallHeaderVisible ? 200 : 500,
    passed: mallHeaderVisible,
    response: { mallHeaderVisible },
  });

  await page.screenshot({ path: '/tmp/insurance_ui_gate.png', fullPage: true });
  artifacts.push('/tmp/insurance_ui_gate.png');

  await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.locator('nav button').nth(4).click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("去实名")').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const authModalVisible = await page.locator('h2:has-text("基础身份确认")').first().isVisible().catch(() => false);

  results.push({
    id: 'UI-GATE-VERIFY-001',
    area: '实名/登录门禁',
    request: '未登录在我的页点击去实名',
    expected: '弹出基础身份确认',
    status: authModalVisible ? 200 : 500,
    passed: authModalVisible,
    response: { authModalVisible },
  });

  await page.evaluate((t) => {
    localStorage.setItem('insurance_token', t);
  }, token);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const popup2 = page.locator('text=每日签到好礼').first();
  if (await popup2.isVisible().catch(() => false)) {
    await page.locator('div.fixed.inset-0.z-50 button').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  await page.locator('nav button').nth(2).click();
  await page.waitForTimeout(500);
  const activityTitleVisible = await page.locator('h1:has-text("活动中心")').first().isVisible().catch(() => false);
  const activityHasData = (await page.locator('text=进行中').count().catch(() => 0)) > 0 || (await page.locator('text=热门活动').count().catch(() => 0)) > 0;

  results.push({
    id: 'UI-DATA-ACT-001',
    area: '活动页展示',
    request: '登录后进入活动中心',
    expected: '页面标题与活动数据可见',
    status: activityTitleVisible ? 200 : 500,
    passed: activityTitleVisible && activityHasData,
    response: { activityTitleVisible, activityHasData },
  });

  await page.screenshot({ path: '/tmp/insurance_ui_activities.png', fullPage: true });
  artifacts.push('/tmp/insurance_ui_activities.png');

  await page.locator('nav button').nth(4).click();
  await page.waitForTimeout(1200);
  const profilePointsVisible = await page.locator('text=我的积分').first().isVisible().catch(() => false);
  const profileDataVisible = await page.locator('text=已实名').first().isVisible().catch(() => false);

  results.push({
    id: 'UI-DATA-ME-001',
    area: '我的页展示',
    request: '登录后进入我的页',
    expected: '我的积分与实名状态可见',
    status: profilePointsVisible ? 200 : 500,
    passed: profilePointsVisible && profileDataVisible,
    response: { profilePointsVisible, profileDataVisible },
  });

  const popup3 = page.locator('text=每日签到好礼').first();
  if (await popup3.isVisible().catch(() => false)) {
    await page.locator('div.fixed.inset-0.z-50 button').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  await page.locator('button:has-text("查看积分")').first().click().catch(() => {});
  await page.waitForTimeout(700);
  const pointsTitleVisible = await page.locator('h1:has-text("积分明细")').first().isVisible().catch(() => false);
  const pointsDataVisible = (await page.locator('text=当前总积分').count().catch(() => 0)) > 0;

  results.push({
    id: 'UI-DATA-POINTS-001',
    area: '积分页展示',
    request: '我的页点击查看积分',
    expected: '积分明细页面及数据可见',
    status: pointsTitleVisible ? 200 : 500,
    passed: pointsTitleVisible && pointsDataVisible,
    response: { pointsTitleVisible, pointsDataVisible },
  });

  await page.screenshot({ path: '/tmp/insurance_ui_points.png', fullPage: true });
  artifacts.push('/tmp/insurance_ui_points.png');

  await browser.close();
  await api.dispose();

  const failed = results.filter((r) => !r.passed);
  console.log(
    JSON.stringify(
      {
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        results,
        artifacts,
      },
      null,
      2
    )
  );

  if (failed.length > 0) process.exit(1);
})().catch((err) => {
  console.error(JSON.stringify({ fatal: err?.message || String(err) }, null, 2));
  process.exit(1);
});
