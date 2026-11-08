#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const require = createRequire(import.meta.url);
const playwrightPath = require.resolve('playwright', { paths: [root] });
const { chromium } = require(playwrightPath);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const batch = JSON.parse(readFileSync(path.join(here, 'batch-manifest.json')));
const { batch_sha256: batchHash, ...payload } = batch;
if (sha(JSON.stringify(payload)) !== batchHash) throw new Error('Batch identity drift');
for (const lesson of batch.lessons) {
  const candidate = JSON.parse(readFileSync(path.join(here, `${lesson.lesson_id.toLowerCase()}-request-candidate.json`)));
  const { candidate_sha256: candidateHash, ...candidatePayload } = candidate;
  if (sha(JSON.stringify(candidatePayload)) !== candidateHash || candidateHash !== lesson.candidate_sha256) throw new Error(`${lesson.lesson_id} candidate identity drift`);
}
const mime = { '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  try {
    const target = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://local').pathname)}`);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error('outside root');
    res.writeHead(200, { 'content-type': mime[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/agentified/workshop/l09-l12-continuous-preflight/review.html`;
const browser = await chromium.launch({ headless: true });
const outputs = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', recordVideo: { dir: here, size: viewport } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const id of ['L09', 'L10', 'L11', 'L12']) {
      for (const state of ['opening', 'plate', 'exercise', 'closing']) {
        await page.goto(`${base}?lesson=${id}&state=${state}&revision=${batchHash.slice(0,16)}`);
        await page.waitForFunction(([lesson, view]) => document.querySelector('#scene')?.textContent === `${lesson}-${view === 'opening' ? '01' : view === 'plate' ? document.querySelector('#scene')?.textContent?.slice(4, 6) : view === 'exercise' ? '07' : '08'} / ${view.toUpperCase()}`, [id, state]).catch(async () => { if (state !== 'plate') throw new Error(`${id} ${state} did not load`); await page.waitForFunction(() => document.querySelector('#scene')?.textContent?.endsWith('/ PLATE')); });
        if (state === 'plate') await page.locator('.visual img').evaluate((img) => img.decode());
        const metric = await page.evaluate(() => {
          const stage = document.querySelector('.stage'), copy = document.querySelector('.copy'), visual = document.querySelector('.visual'), image = visual.querySelector('img');
          const a = copy.getBoundingClientRect(), b = visual.getBoundingClientRect(), c = image?.getBoundingClientRect();
          return { pageOverflow: document.documentElement.scrollWidth > innerWidth + 2, stageOverflow: stage.scrollWidth > stage.clientWidth + 2 || stage.scrollHeight > stage.clientHeight + 2, overlap: a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2, imageInvalid: Boolean(image && (!image.naturalWidth || c.right > b.right + 2 || c.bottom > b.bottom + 2)), failed: document.querySelector('#caption').textContent.startsWith('Review load failed:') };
        });
        if (Object.values(metric).some(Boolean)) errors.push(`${name} ${id} ${state}: ${JSON.stringify(metric)}`);
        if (state === 'plate' || state === 'exercise') await page.screenshot({ path: path.join(here, `${name}-${id}-${state}.png`), fullPage: true });
        if (state === 'exercise') {
          const initial = await page.locator('#countdown').textContent();
          await page.waitForTimeout(1150);
          const next = await page.locator('#countdown').textContent();
          if (initial !== '45' || next !== '44') errors.push(`${name} ${id} countdown did not move 45→44: ${initial}→${next}`);
        } else await page.waitForTimeout(550);
      }
    }
    const video = page.video();
    await context.close();
    const webm = await video.path();
    if (errors.length) { rmSync(webm); throw new Error(errors.join('\n')); }
    const output = path.join(here, `${name}-walkthrough.mp4`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-an', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
    execFileSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-']);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', output]));
    if (probe.streams[0].codec_name !== 'h264' || probe.streams[0].width !== viewport.width || probe.streams[0].height !== viewport.height || Number(probe.format.duration) < 10) throw new Error(`${name} video probe failed`);
    outputs.push({ viewport: name, path: path.basename(output), sha256: sha(readFileSync(output)), duration_seconds: Number(probe.format.duration), codec: 'h264', width: viewport.width, height: viewport.height, states_checked: 16, countdowns_verified: 4 });
    rmSync(webm);
  }
} finally { await browser.close(); server.close(); }
const receipt = { schema_version: 1, source_commit: batch.source_commit, batch_sha256: batchHash, review_html_sha256: sha(readFileSync(path.join(here, 'review.html'))), walkthroughs: outputs, provider_calls: 0, generated_audio: 0, spend_usd: 0, privacy: 'synthetic approved packet text and local plates only' };
writeFileSync(path.join(here, 'review-capture-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(outputs.map((item) => `${item.viewport} ${item.duration_seconds}s ${item.sha256}`).join('\n'));
