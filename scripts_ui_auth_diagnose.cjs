const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();

  page.on('console', (m) => console.log('[console]', m.text()));

  await page.goto('http://127.0.0.1:3003', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator('nav button').nth(4).click();
  await page.waitForTimeout(400);
  await page.locator('button.bg-rose-500').first().click();

  const inputs = page.locator('form input');
  await inputs.first().waitFor({ timeout: 10000 });
  await inputs.nth(0).fill('张三');
  await inputs.nth(1).fill('13800000000');
  await page.locator('form button[type=button]').first().click();
  await page.waitForTimeout(800);
  await inputs.nth(2).fill('123456');
  await page.locator('form button[type=submit]').first().click();
  await page.waitForTimeout(1500);

  const err = await page.locator('p.text-red-500').first().textContent().catch(() => '');
  const modalVisible = await page.locator('form').first().isVisible().catch(() => false);
  const authBtnVisible = await page.locator('button.bg-rose-500').first().isVisible().catch(() => false);

  console.log(JSON.stringify({ modalVisible, authBtnVisible, err }, null, 2));
  await browser.close();
})();
