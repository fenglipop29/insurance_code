const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.goto('http://127.0.0.1:3004', { waitUntil: 'domcontentloaded' });

  const inputs = page.locator('input');
  if ((await inputs.count()) >= 2) {
    await inputs.nth(0).fill('xiwang@126.com');
    await inputs.nth(1).fill('123456');
    await page.locator('button').first().click();
    await page.waitForTimeout(1500);
  }

  const customerTabs = page.locator('text=客户');
  const count = await customerTabs.count();
  if (count > 0) {
    await customerTabs.nth(count - 1).click();
    await page.waitForTimeout(2500);
  }

  const txt = await page.locator('body').innerText();
  const hasFull = txt.includes('13800000218');
  const hasTail = txt.includes('0218');
  await page.screenshot({ path: '/tmp/b_customer_visible_13800000218.png', fullPage: true });
  console.log(JSON.stringify({ ok: hasFull || hasTail, hasFull, hasTail, hitCount: count, screenshot: '/tmp/b_customer_visible_13800000218.png' }));
  await browser.close();
})();
