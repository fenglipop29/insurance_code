const { chromium, request } = require('playwright');

(async () => {
  const base = 'http://127.0.0.1:3000';
  const api = 'http://127.0.0.1:4000';

  const req = await request.newContext();
  await req.post(`${api}/api/auth/send-code`, { data: { mobile: '13692108229' } }).catch(() => null);
  const vr = await req.post(`${api}/api/auth/verify-basic`, { data: { name: '张三', mobile: '13692108229', code: '123456' } });
  const vd = await vr.json();
  const token = vd?.token;
  if (!token) throw new Error('no token');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((t) => localStorage.setItem('insurance_token', t), token);
  const page = await context.newPage();

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1200);

  const overlays = page.locator('div.fixed.inset-0.z-50 .absolute.inset-0');
  if (await overlays.first().isVisible().catch(() => false)) {
    await overlays.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  await page.locator('nav button').nth(2).click({ timeout: 10000 });
  await page.waitForTimeout(700);

  const card = page.locator('section:has-text("热门活动") .cursor-pointer').first();
  await card.click({ timeout: 10000 });
  await page.waitForTimeout(800);

  const btn = page.locator('button:has-text("立即兑换活动"), button:has-text("已兑换")').first();
  const visible = await btn.isVisible().catch(() => false);
  const text = visible ? await btn.innerText() : '';
  const shot = '/Users/wenshuping/Documents/New project/insurance_code/.tmp_c_activity_detail_check.png';
  await page.screenshot({ path: shot, fullPage: true });

  console.log(JSON.stringify({ visible, text, screenshot: shot, url: page.url() }, null, 2));

  await browser.close();
})();
