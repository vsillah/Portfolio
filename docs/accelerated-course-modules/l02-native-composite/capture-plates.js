const { chromium } = require('playwright');
const path = require('path');

const route = 'http://127.0.0.1:8766/docs/accelerated-course-modules/l02-l04-guided-video/review.html?lesson=L02';
const plates = [
  ['scene1-presenter.png', 0],
  ['scene1-clean.png', 30],
  ['scene2-clean.png', 120],
  ['scene3-presenter.png', 180],
  ['scene3-clean.png', 200],
  ['scene4-clean.png', 300],
  ['scene5-presenter.png', 366],
  ['scene5-clean.png', 387],
  ['scene6-clean.png', 500],
  ['scene7-presenter.png', 574],
  ['scene7-clean.png', 594],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const [filename, seconds] of plates) {
    await page.goto(`${route}&t=${seconds}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.querySelectorAll('main > :not(.layout), .side, .tabs, .transport, .notes, details').forEach((node) => node.remove());
      const main = document.querySelector('main');
      const layout = document.querySelector('.layout');
      const stage = document.querySelector('.stage');
      Object.assign(document.body.style, { margin: '0', background: '#09151b', overflow: 'hidden' });
      Object.assign(main.style, { width: '1920px', maxWidth: 'none', padding: '0', margin: '0' });
      Object.assign(layout.style, { display: 'block', width: '1920px', height: '1080px' });
      Object.assign(layout.firstElementChild.style, { width: '1920px', height: '1080px' });
      Object.assign(stage.style, { width: '1920px', height: '1080px', borderRadius: '0', boxShadow: 'none' });
    });
    await page.locator('.stage').screenshot({ path: path.join(__dirname, 'composite-assets', filename) });
  }
  await browser.close();
})();
