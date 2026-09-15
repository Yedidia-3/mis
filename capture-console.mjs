import { chromium } from 'playwright';
const [, , url] = process.argv;
if (!url) throw new Error('Usage: node capture-console.mjs <url>');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('[console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[pageerror]', err.toString()));
  page.on('requestfailed', r => console.log('[reqfailed]', r.url(), r.failure()?.errorText));
  page.on('response', r => {
    if (r.url().includes('/assets/index-') || r.url().endsWith('/')) {
      console.log('[response]', r.status(), r.headers()['content-type'] || '', r.url());
    }
  });
  await page.goto(process.argv[2], { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  await browser.close();
})();
