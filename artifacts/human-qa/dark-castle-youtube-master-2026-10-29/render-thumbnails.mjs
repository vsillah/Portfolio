import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';

const root = new URL('.', import.meta.url).pathname;
const mime = { '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(req.url === '/' ? '/thumbnails/index.html' : req.url));
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1376, height: 780 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/thumbnails/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

for (const id of ['a', 'b', 'c']) {
  const node = page.locator(`#${id}`);
  const name = await node.getAttribute('data-name');
  const full = join(root, 'thumbnails', `${name}.png`);
  await node.screenshot({ path: full });
  await sharp(full).resize(320, 180).png().toFile(join(root, 'thumbnails', `${name}-feed-320.png`));
  await sharp(full).resize(160, 90).png().toFile(join(root, 'thumbnails', `${name}-feed-160.png`));
}

await browser.close();
server.close();
