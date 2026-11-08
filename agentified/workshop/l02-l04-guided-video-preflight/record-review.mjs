import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const revision = process.argv[2];
const base = process.argv[3] ?? 'http://127.0.0.1:4173';
if (!/^[0-9a-f]{40}$/.test(revision ?? '')) throw new Error('Pass exact code commit SHA');
const url = `${base}/agentified/workshop/l02-l04-guided-video-preflight/review.html`;
const browser = await chromium.launch({ headless: true });
const results = [];
for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', recordVideo: { dir: here, size: viewport } });
  const page = await context.newPage();
  const errors = [];
  for (const lesson of ['L02', 'L03', 'L04']) {
    for (const state of ['opening', 'diagram', 'closing', 'card']) {
      await page.goto(`${url}?lesson=${lesson}&state=${state}&revision=${revision}`);
      await page.waitForFunction(([id, view]) => document.querySelector('#scene')?.textContent === `${id}-${view === 'opening' ? '01' : view === 'diagram' ? (id === 'L03' ? '02' : '04') : '08'} / ${view.toUpperCase()}`, [lesson, state]);
      await page.locator('#cover').evaluate((image) => image.decode());
      if (state === 'diagram') await page.locator('#visual img').evaluate((image) => image.decode());
      const measured = await page.evaluate(() => {
        const stage = document.querySelector('.stage');
        const visual = document.querySelector('.visual');
        const copy = document.querySelector('.copy');
        const image = visual.querySelector('img');
        const vr = visual.getBoundingClientRect(), cr = copy.getBoundingClientRect(), ir = image?.getBoundingClientRect();
        return {
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          stageOverflow: stage.scrollWidth > stage.clientWidth + 2 || stage.scrollHeight > stage.clientHeight + 2,
          copyVisualOverlap: cr.left < vr.right - 2 && cr.right > vr.left + 2 && cr.top < vr.bottom - 2 && cr.bottom > vr.top + 2,
          imageInvalid: Boolean(image && (!image.naturalWidth || ir.right > vr.right + 2 || ir.bottom > vr.bottom + 2)),
          controlClipped: [...document.querySelectorAll('.controls button')].some((button) => button.scrollWidth > button.clientWidth + 2 || button.getBoundingClientRect().right > innerWidth + 2),
          error: document.querySelector('#caption')?.textContent?.startsWith('Review load failed:'),
        };
      });
      if (Object.values(measured).some(Boolean)) errors.push(`${name} ${lesson} ${state}: ${JSON.stringify(measured)}`);
      if (state === 'diagram' || state === 'card') await page.screenshot({ path: path.join(here, `${name}-${lesson}-${state}.png`), fullPage: true });
      if (name === 'mobile') {
        await page.waitForTimeout(350);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }
      await page.waitForTimeout(850);
    }
  }
  const video = page.video();
  await context.close();
  if (errors.length) throw new Error(errors.join('\n'));
  const webm = await video.path();
  const mp4 = path.join(here, `${name}-walkthrough.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-an', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-']);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', mp4]));
  if (probe.streams[0].codec_name !== 'h264' || probe.streams[0].width !== viewport.width || probe.streams[0].height !== viewport.height || Number(probe.format.duration) < 9) throw new Error(`${name} MP4 failed validation`);
  const body = readFileSync(mp4);
  results.push({ viewport: name, route: `${url}?lesson=L02&state=opening&revision=${revision}`, path: path.basename(mp4), sha256: createHash('sha256').update(body).digest('hex'), bytes: body.length, duration_seconds: Number(probe.format.duration), codec: 'h264', width: viewport.width, height: viewport.height, states_checked: 12, privacy: 'synthetic packet and approved local assets only' });
  rmSync(webm);
}
await browser.close();
writeFileSync(path.join(here, 'review-capture-receipt.json'), `${JSON.stringify({ schema_version: 1, code_revision: revision, walkthroughs: results, provider_calls: 0, audio_generated: 0, customer_data_used: false }, null, 2)}\n`);
console.log(results.map((item) => `${item.viewport}: ${item.duration_seconds.toFixed(1)}s, ${item.sha256}`).join('\n'));
