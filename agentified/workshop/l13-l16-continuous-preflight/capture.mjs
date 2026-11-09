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
const base = `http://127.0.0.1:${server.address().port}/agentified/workshop/l13-l16-continuous-preflight/review.html`;
const browser = await chromium.launch({ headless: true });
const outputs = [];
const interactionResults = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', recordVideo: { dir: here, size: viewport } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let statesChecked = 0;
    for (const id of ['L13', 'L14', 'L15', 'L16']) {
      const candidate = JSON.parse(readFileSync(path.join(here, `${id.toLowerCase()}-request-candidate.json`)));
      const states = ['opening', 'plate1', ...(candidate.visuals.length > 1 ? ['plate2'] : []), 'exercise', 'closing'];
      for (const state of states) {
        const sceneId = state === 'opening' ? `${id}-01` : state === 'exercise' ? `${id}-07` : state === 'closing' ? `${id}-08` : candidate.visuals[state === 'plate2' ? 1 : 0].scene_id;
        await page.goto(`${base}?lesson=${id}&state=${state}&capture=1&revision=${batchHash.slice(0,16)}`);
        await page.waitForFunction((expected) => document.querySelector('#scene')?.textContent === expected, sceneId);
        statesChecked++;
        if (state.startsWith('plate') || state === 'opening') await page.locator('.visual img').evaluate((img) => img.decode());
        const metric = await page.evaluate(() => {
          const stage = document.querySelector('.stage'), copy = document.querySelector('.copy'), visual = document.querySelector('.visual'), image = visual.querySelector('img');
          const a = copy.getBoundingClientRect(), b = visual.getBoundingClientRect(), c = image?.getBoundingClientRect();
          const text = `${copy.innerText} ${visual.innerText} ${document.querySelector('#caption').innerText}`;
          return { pageOverflow: document.documentElement.scrollWidth > innerWidth + 2, stageOverflow: stage.scrollWidth > stage.clientWidth + 2 || stage.scrollHeight > stage.clientHeight + 2, overlap: a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2, imageInvalid: Boolean(image && (!image.naturalWidth || c.right > b.right + 2 || c.bottom > b.bottom + 2)), internalCopy: /SHA-256|SYN-[A-Z0-9-]+|fixture|synthetic|sample data|internal review|provider audio|candidate hash/i.test(text), failed: document.querySelector('#caption').textContent.startsWith('Review load failed:') };
        });
        if (Object.values(metric).some(Boolean)) errors.push(`${name} ${id} ${state}: ${JSON.stringify(metric)}`);
        if (state.startsWith('plate') || state === 'exercise') await page.screenshot({ path: path.join(here, `${name}-${id}-${state}.png`), fullPage: true });
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
    outputs.push({ viewport: name, path: path.basename(output), sha256: sha(readFileSync(output)), duration_seconds: Number(probe.format.duration), codec: 'h264', width: viewport.width, height: viewport.height, states_checked: statesChecked, countdowns_verified: 4, customer_copy_audited: true });
    rmSync(webm);
  }
  for (const [name, viewport] of [['narrow', { width: 320, height: 720 }], ['tablet', { width: 768, height: 900 }], ['desktop', { width: 1280, height: 800 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}?lesson=L13&state=opening&revision=${batchHash.slice(0, 16)}`);
    for (const id of ['L13', 'L14', 'L15', 'L16']) {
      await page.locator('button[data-state="opening"]').click();
      await page.locator('#lesson').selectOption(id);
      await page.waitForFunction((expected) => document.querySelector('#scene')?.textContent === `${expected}-01`, id);
      const candidate = JSON.parse(readFileSync(path.join(here, `${id.toLowerCase()}-request-candidate.json`)));
      for (const state of ['opening', 'plate1', 'plate2', 'exercise', 'closing']) {
        const button = page.locator(`button[data-state="${state}"]`);
        if (state === 'plate2' && candidate.visuals.length === 1) {
          if (!(await button.isDisabled()) || !(await button.getAttribute('title'))?.includes('One approved plate')) errors.push(`${name} ${id} plate2 disable reason missing`);
          continue;
        }
        await button.click();
        const sceneId = state === 'opening' ? `${id}-01` : state === 'exercise' ? `${id}-07` : state === 'closing' ? `${id}-08` : candidate.visuals[state === 'plate2' ? 1 : 0].scene_id;
        await page.waitForFunction((expected) => document.querySelector('#scene')?.textContent === expected, sceneId);
        const metric = await page.evaluate(() => {
          const stage = document.querySelector('.stage');
          return { pageOverflow: document.documentElement.scrollWidth > innerWidth + 2, stageOverflow: stage.scrollWidth > stage.clientWidth + 2 || stage.scrollHeight > stage.clientHeight + 2, controlsClipped: [...document.querySelectorAll('.controls button')].some((button) => button.getBoundingClientRect().right > innerWidth + 2) };
        });
        if (Object.values(metric).some(Boolean)) errors.push(`${name} ${id} ${state} ${JSON.stringify(metric)}`);
      }
    }
    if (errors.length) throw new Error(errors.join('\n'));
    interactionResults.push({ viewport: name, width: viewport.width, actions_checked: 18, disabled_reasons_checked: 2, overflow: false });
    await context.close();
  }
} finally { await browser.close(); server.close(); }
const receipt = { schema_version: 1, source_commit: batch.source_commit, batch_sha256: batchHash, review_html_sha256: sha(readFileSync(path.join(here, 'review.html'))), walkthroughs: outputs, interaction_results: interactionResults, provider_calls: 0, generated_audio: 0, spend_usd: 0, privacy: 'synthetic approved packet text and local plates only' };
writeFileSync(path.join(here, 'review-capture-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(outputs.map((item) => `${item.viewport} ${item.duration_seconds}s ${item.sha256}`).join('\n'));
