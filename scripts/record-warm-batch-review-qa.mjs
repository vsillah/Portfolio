import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-batch-review-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const htmlPath = path.join(tmpDir, 'warm-batch-review.html')
const screenshotPath = path.join(outputDir, 'warm-batch-review-mobile.png')
const mp4Path = path.join(outputDir, 'warm-batch-review-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm batch review QA</title>
    <style>
      body { margin: 0; background: #030712; color: #f9fafb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1120px; margin: 0 auto; padding: 18px 12px 44px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 22px; line-height: 1.2; margin-bottom: 12px; }
      .toolbar { display: grid; gap: 10px; border: 1px solid #1f2937; background: rgba(15, 23, 42, .92); border-radius: 12px; padding: 12px; margin-bottom: 12px; position: sticky; top: 0; z-index: 10; }
      .toolbar-actions { display: grid; grid-template-columns: 1fr; gap: 8px; }
      .toolbar strong { font-size: 14px; }
      button { min-height: 40px; border: 1px solid #0ea5e9; border-radius: 8px; background: rgba(14, 165, 233, .14); color: #e0f2fe; font-weight: 700; padding: 8px 12px; font-size: 14px; }
      button.secondary { border-color: #334155; background: rgba(15, 23, 42, .75); color: #cbd5e1; }
      .lead-list { display: grid; gap: 10px; }
      .lead { border: 1px solid #1f2937; border-radius: 12px; background: rgba(17, 24, 39, .72); padding: 12px; display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; }
      .lead h2 { font-size: 15px; line-height: 1.25; }
      .muted { color: #9ca3af; font-size: 12px; line-height: 1.55; margin-top: 4px; }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .chip { border: 1px solid #374151; border-radius: 999px; padding: 3px 7px; color: #d1d5db; font-size: 11px; }
      .chip.warm { border-color: #f59e0b; color: #fde68a; background: rgba(120, 53, 15, .3); }
      .batch { display: none; border: 1px solid rgba(14, 165, 233, .36); border-radius: 12px; background: rgba(8, 47, 73, .28); padding: 12px; margin-bottom: 12px; }
      .batch.show { display: block; }
      .batch-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; }
      .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px; }
      .metric { border: 1px solid #1f2937; border-radius: 8px; background: rgba(2, 6, 23, .46); padding: 9px; }
      .metric span { color: #9ca3af; font-size: 12px; }
      .metric strong { display: block; font-size: 18px; margin-top: 2px; }
      .preview { border: 1px solid #1f2937; border-radius: 8px; background: rgba(2, 6, 23, .46); padding: 10px; margin-top: 12px; }
      .preview h3 { font-size: 14px; margin-bottom: 6px; }
      .flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .flag { border: 1px solid rgba(16, 185, 129, .3); background: rgba(16, 185, 129, .12); color: #d1fae5; border-radius: 6px; padding: 5px 7px; font-size: 11px; }
      details { border: 1px solid #1f2937; border-radius: 8px; background: rgba(2, 6, 23, .46); padding: 10px; margin-top: 12px; }
      summary { cursor: pointer; font-size: 14px; font-weight: 700; }
      .recipient { border-top: 1px solid #1f2937; padding: 10px 0; display: grid; gap: 5px; }
      .recipient:first-of-type { border-top: 0; }
      .status { display: inline-flex; width: fit-content; border-radius: 999px; border: 1px solid #334155; padding: 2px 7px; font-size: 11px; }
      .ready { color: #bbf7d0; border-color: #10b981; background: rgba(16, 185, 129, .12); }
      .blocked { color: #fecaca; border-color: #ef4444; background: rgba(127, 29, 29, .2); }
      .existing { color: #bfdbfe; border-color: #3b82f6; background: rgba(30, 64, 175, .2); }
      @media (min-width: 760px) {
        main { padding: 28px 20px 56px; }
        h1 { font-size: 28px; }
        .toolbar { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
        .toolbar-actions { display: flex; flex-wrap: wrap; }
        .summary { grid-template-columns: repeat(4, 1fr); }
        .lead-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .recipient { grid-template-columns: minmax(9rem, .75fr) minmax(0, 1fr) minmax(7rem, .45fr); align-items: start; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>/admin/outreach warm batch review</h1>
      <div class="toolbar">
        <div>
          <strong id="selection">0 selected</strong>
          <p class="muted">Existing lead list selection; no new dashboard surface.</p>
        </div>
        <div class="toolbar-actions">
          <button id="review">Warm batch review</button>
          <button class="secondary" id="clear">Clear</button>
        </div>
      </div>

      <section id="batch" class="batch" aria-label="Warm batch review">
        <div class="batch-head">
          <div>
            <h2>Warm batch review</h2>
            <p class="muted">Review selected warm leads as individualized recipients before any draft or send authority.</p>
          </div>
          <span class="status ready">review only</span>
        </div>
        <div class="summary">
          <div class="metric"><span>Ready</span><strong>1</strong></div>
          <div class="metric"><span>Blocked</span><strong>2</strong></div>
          <div class="metric"><span>Existing</span><strong>1</strong></div>
          <div class="metric"><span>Weak basis</span><strong>1</strong></div>
        </div>
        <div class="preview">
          <h3>Sample individualized preview</h3>
          <p class="muted">Hi Ada, I was reviewing the Ops Lab context in Portfolio. The warm basis is prior meeting context. Draft direction: follow up via email. Next step: prepare a human-reviewed internal draft.</p>
        </div>
        <div class="flags">
          <span class="flag">Provider calls: off</span>
          <span class="flag">Draft creation: off</span>
          <span class="flag">External send: off</span>
          <span class="flag">Gmail draft: off</span>
          <span class="flag">n8n: off</span>
          <span class="flag">Slack: off</span>
        </div>
        <details id="full-list">
          <summary>Full recipient list (4)</summary>
          <div class="recipient">
            <div><strong>Ada Operator</strong><p class="muted">Ops Lab</p></div>
            <p class="muted">Portfolio shows prior meeting context. email / follow up / email_follow_up</p>
            <span class="status ready">Ready</span>
          </div>
          <div class="recipient">
            <div><strong>Kwame Existing</strong><p class="muted">Build Co</p></div>
            <p class="muted">Existing individualized draft returned from outreach_queue. email / follow up / email_follow_up</p>
            <span class="status existing">Existing draft</span>
          </div>
          <div class="recipient">
            <div><strong>Amina Suppressed</strong><p class="muted">Community Org</p></div>
            <p class="muted">Blocked: contact is unsubscribed. No draft generation or send authority.</p>
            <span class="status blocked">Blocked</span>
          </div>
          <div class="recipient">
            <div><strong>Kofi Weak Basis</strong><p class="muted">Quiet Co</p></div>
            <p class="muted">Blocked: local relationship evidence is too thin for a batch draft.</p>
            <span class="status blocked">Blocked</span>
          </div>
        </details>
        <p class="muted">Every row remains review-only. Suppressed, removed, unsubscribed, weak-basis, Facebook, and phone-only rows are blocked before draft generation or send authority.</p>
      </section>

      <div class="lead-list">
        <label class="lead"><input type="checkbox" class="lead-check" /><div><h2>Ada Operator</h2><p class="muted">Ops Lab · warm referral · meeting follow-up evidence</p><div class="chips"><span class="chip warm">Warm</span><span class="chip">email</span></div></div></label>
        <label class="lead"><input type="checkbox" class="lead-check" /><div><h2>Kwame Existing</h2><p class="muted">Build Co · prior queue row · existing draft returned</p><div class="chips"><span class="chip warm">Warm</span><span class="chip">existing draft</span></div></div></label>
        <label class="lead"><input type="checkbox" class="lead-check" /><div><h2>Amina Suppressed</h2><p class="muted">Community Org · suppression visible · blocked</p><div class="chips"><span class="chip warm">Warm</span><span class="chip">unsubscribed</span></div></div></label>
        <label class="lead"><input type="checkbox" class="lead-check" /><div><h2>Kofi Weak Basis</h2><p class="muted">Quiet Co · contact row only · blocked before draft</p><div class="chips"><span class="chip warm">Warm</span><span class="chip">weak basis</span></div></div></label>
      </div>
    </main>
    <script>
      const checks = [...document.querySelectorAll('.lead-check')];
      const selection = document.querySelector('#selection');
      const batch = document.querySelector('#batch');
      const fullList = document.querySelector('#full-list');
      function updateSelection() {
        const count = checks.filter((item) => item.checked).length;
        selection.textContent = count + ' selected';
      }
      checks.forEach((item) => item.addEventListener('change', updateSelection));
      document.querySelector('#review').addEventListener('click', () => {
        batch.classList.add('show');
        batch.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      document.querySelector('#clear').addEventListener('click', () => {
        checks.forEach((item) => { item.checked = false; });
        batch.classList.remove('show');
        fullList.open = false;
        updateSelection();
      });
    </script>
  </body>
</html>`)

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: outputDir, size: { width: 390, height: 844 } },
})
const page = await context.newPage()
await page.goto(pathToFileURL(htmlPath).href)
await page.locator('.lead-check').nth(0).check()
await page.locator('.lead-check').nth(1).check()
await page.locator('.lead-check').nth(2).check()
await page.locator('.lead-check').nth(3).check()
await page.waitForTimeout(300)
await page.locator('#review').click()
await page.waitForTimeout(700)
await page.locator('#full-list').evaluate((node) => {
  node.setAttribute('open', 'true')
})
await page.waitForTimeout(900)
await page.screenshot({ path: screenshotPath, fullPage: true })
const video = page.video()
await context.close()
await browser.close()
const rawVideoPath = video ? await video.path() : null

if (rawVideoPath) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    rawVideoPath,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    mp4Path,
  ])
}

console.log(JSON.stringify({
  fixture: htmlPath,
  screenshotPath,
  rawVideoPath,
  videoPath: rawVideoPath ? mp4Path : null,
}, null, 2))
