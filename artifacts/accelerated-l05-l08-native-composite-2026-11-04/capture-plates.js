const { chromium } = require('/Users/vambahsillah/Projects/Portfolio/node_modules/playwright');
const path = require('path');

const lesson = process.argv[2];
if (!/^L0[5-8]$/.test(lesson || '')) throw new Error('Pass one lesson ID from L05 through L08.');
const port = process.env.REVIEW_PORT || '8770';
const route = `http://127.0.0.1:${port}/docs/accelerated-course-modules/l05-l08-guided-video/review.html?lesson=${lesson}`;
const packet = require(path.join(__dirname, '..', '..', 'docs', 'accelerated-course-modules', 'l05-l08-guided-video', `${lesson.toLowerCase()}-packet.json`));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const [index, scene] of packet.scenes.entries()) {
    let seconds = scene.start_seconds + 1;
    if (scene.presenter) {
      seconds = Math.min(scene.end_seconds - 1, scene.presenter.start_seconds + 1);
    }
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
    await page.locator('.stage').screenshot({
      path: path.join(__dirname, 'composite-assets', `${lesson.toLowerCase()}-scene${index + 1}.png`),
    });
  }
  await browser.close();
})();
