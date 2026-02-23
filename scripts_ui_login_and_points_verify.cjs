const { chromium, request } = require('playwright');

const WEB_BASE = 'http://127.0.0.1:3003';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dismissTransientOverlays(page) {
  const marketingTitle = page.locator('text=每日签到好礼').first();
  if (await marketingTitle.isVisible().catch(() => false)) {
    await page.locator('div.fixed.inset-0.z-50 .absolute.inset-0').first().click({ force: true }).catch(() => {});
    await wait(200);
  }
}

async function clickFirst(page, selectors, timeout = 10000) {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.click({ timeout });
    return selector;
  }
  throw new Error(`No visible selector matched: ${selectors.join(' | ')}`);
}

async function ensureLoggedIn(page) {
  await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  await dismissTransientOverlays(page);

  await page.locator('nav button').nth(4).click({ timeout: 10000 });
  await wait(350);

  const verifiedTag = page.locator('text=已实名').first();
  if (await verifiedTag.isVisible().catch(() => false)) return 'already-auth';

  const goAuthBtn = page.locator('button:has-text("去实名")').first();
  if (!(await goAuthBtn.isVisible().catch(() => false))) return 'unknown-auth-state';

  await goAuthBtn.click({ timeout: 10000 });
  const modalTitle = page.locator('h2:has-text("基础身份确认")').first();
  await modalTitle.waitFor({ timeout: 10000 });

  const inputs = page.locator('form input');
  await inputs.nth(0).fill('张三');
  await inputs.nth(1).fill('13800000000');
  await clickFirst(page, ['form button:has-text("获取验证码")', 'form button[type=button]']);
  await wait(500);
  await inputs.nth(2).fill('123456');
  await clickFirst(page, ['form button:has-text("提交认证")', 'form button[type=submit]']);

  await modalTitle.waitFor({ state: 'hidden', timeout: 12000 }).catch(() => {});
  await wait(700);

  const nowVerified = await verifiedTag.isVisible().catch(() => false);
  return nowVerified ? 'auth-ok' : 'auth-uncertain';
}

async function setTokenFallback(context) {
  const req = await request.newContext();
  const resp = await req.post('http://127.0.0.1:4000/api/auth/verify-basic', {
    data: { name: '张三', mobile: '13800000000', code: '123456' },
  });
  if (!resp.ok()) return false;
  const data = await resp.json().catch(() => ({}));
  if (!data?.token) return false;

  await context.addInitScript((token) => {
    localStorage.setItem('insurance_token', token);
  }, data.token);
  return true;
}



async function setTokenOnPage(page) {
  const ok = await page.evaluate(async () => {
    try {
      const resp = await fetch('http://127.0.0.1:4000/api/auth/verify-basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '张三', mobile: '13800000000', code: '123456' }),
      });
      const data = await resp.json();
      if (!data?.token) return false;
      localStorage.setItem('insurance_token', data.token);
      return true;
    } catch {
      return false;
    }
  });
  if (!ok) return false;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(450);
  return true;
}

async function waitAuthReady(page) {
  await page.locator('nav button').nth(4).click({ timeout: 10000 });
  await wait(350);
  const verified = page.locator('text=已实名').first();
  if (await verified.isVisible().catch(() => false)) return;

  const needAuth = page.locator('button:has-text("去实名")').first();
  if (await needAuth.isVisible().catch(() => false)) {
    await setTokenOnPage(page);
    await page.locator('nav button').nth(4).click({ timeout: 10000 });
    await wait(350);
  }

  await verified.waitFor({ timeout: 6000 }).catch(() => {});
}

async function checkEntry(context, label, navIndex, selectors) {
  const page = await context.newPage();
  await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(900);
  await dismissTransientOverlays(page);

  if (navIndex !== null) {
    await waitAuthReady(page);
    if (navIndex !== 4) {
      await page.locator('nav button').nth(navIndex).click({ timeout: 10000 });
      await wait(450);
    }
  }

  await clickFirst(page, selectors);
  const mallHeader = page.locator('h1:has-text("积分商城")').last();
  await mallHeader.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  const open = (await page.locator('h1:has-text("积分商城")').count()) > 0 && (await mallHeader.isVisible().catch(() => false));
  await page.close();
  return `${label}:${open}`;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();

  const loginPage = await context.newPage();
  let auth = await ensureLoggedIn(loginPage);
  await loginPage.close();

  if (auth === 'auth-uncertain' || auth === 'unknown-auth-state') {
    const ok = await setTokenFallback(context);
    if (ok) auth = `${auth}->token-fallback`;
  }

  const checks = [];
  checks.push(await checkEntry(context, 'home', null, ['button:has-text("去积分商城")', 'button:has-text("查看积分")']));
  checks.push(await checkEntry(context, 'activities', 2, ['button:has-text("积分商城")']));
  checks.push(await checkEntry(context, 'profile', 4, ['button:has-text("积分商城")']));

  console.log(JSON.stringify({ auth, checks }, null, 2));
  await browser.close();
})();
