const { chromium } = require('playwright');
const path = require('path');

const root = __dirname;
const qa = path.join(root, 'qa');
const url = 'http://127.0.0.1:8766/docs/accelerated-course-modules/l02-native-composite/review.html?rev=ded23edb';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(url, { waitUntil: 'networkidle' });
  await desktop.screenshot({ path: path.join(qa, 'review-desktop.png'), fullPage: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: path.join(qa, 'review-mobile.png'), fullPage: true });
  await browser.close();

  const recorded = await chromium.launch({ headless: true });
  const context = await recorded.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: path.join(qa, 'raw-video'), size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  for (const time of ['0', '180', '366', '573.88']) {
    await page.locator(`[data-time="${time}"]`).click();
    await page.waitForTimeout(2800);
  }
  await page.locator('[data-time="573.88"]').click();
  await page.waitForTimeout(15000);
  const video = page.video();
  await context.close();
  await recorded.close();
  console.log(await video.path());
})();
