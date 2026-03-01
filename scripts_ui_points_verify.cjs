const { chromium, firefox, webkit } = require('playwright');

const WEB_BASE = 'http://127.0.0.1:3003';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickFirst(page, selectors, timeout = 10000) {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout });
      return selector;
    }
  }
  throw new Error(`No visible selector matched: ${selectors.join(' | ')}`);
}

async function dismissTransientOverlays(page) {
  const marketingTitle = page.locator('text=每日签到好礼').first();
  if (await marketingTitle.isVisible().catch(() => false)) {
    const backdrop = page.locator('div.fixed.inset-0.z-50 .absolute.inset-0').first();
    if (await backdrop.isVisible().catch(() => false)) {
      await backdrop.click({ force: true }).catch(() => {});
      await wait(300);
    }
  }
}

async function check(page, navIndex, selectors, label) {
  await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await wait(900);
  await dismissTransientOverlays(page);

  if (navIndex !== null) {
    await page.locator('nav button').nth(navIndex).click({ timeout: 10000 });
    await wait(450);
  }

  await clickFirst(page, selectors);
  await wait(700);
  const open = await page.locator('h1', { hasText: '积分商城' }).first().isVisible().catch(() => false);
  return `${label}:${open}`;
}

(async () => {
  const token = process.argv[2] || '';
  const out = [];
  const launchers = [
    ['chromium', () => chromium.launch({ headless: true })],
    ['firefox', () => firefox.launch({ headless: true })],
    ['webkit', () => webkit.launch({ headless: true })],
  ];
  let browser = null;
  let browserName = '';
  const launchErrors = [];
  for (const [name, fn] of launchers) {
    try {
      browser = await fn();
      browserName = name;
      break;
    } catch (err) {
      launchErrors.push({ browser: name, message: err?.message || String(err) });
    }
  }
  if (!browser) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: 'browser_launch_failed',
          launchErrors,
        },
        null,
        2
      )
    );
    return;
  }

  const context = await browser.newContext();
  await context.addInitScript((t) => {
    localStorage.clear();
    if (t) localStorage.setItem('insurance_token', t);
  }, token);

  const page1 = await context.newPage();
  out.push(await check(page1, null, ['button:has-text("去积分商城")', 'button:has-text("查看积分")'], 'home'));
  await page1.close();

  const page2 = await context.newPage();
  out.push(await check(page2, 2, ['button:has-text("积分商城")'], 'activities'));
  await page2.close();

  const page3 = await context.newPage();
  out.push(await check(page3, 4, ['button:has-text("积分商城")'], 'profile'));
  await page3.close();

  console.log(JSON.stringify({ browser: browserName, out }, null, 2));
  await browser.close();
})();
