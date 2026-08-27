import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-external-send-readiness-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const htmlPath = path.join(tmpDir, 'warm-external-send-readiness.html')
const mobileScreenshotPath = path.join(outputDir, 'warm-external-send-readiness-mobile.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-external-send-readiness-desktop.png')
const mp4Path = path.join(outputDir, 'warm-external-send-readiness-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm external send readiness QA</title>
    <style>
      body { margin: 0; background: #030712; color: #f9fafb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1040px; margin: 0 auto; padding: 16px 12px 42px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 22px; line-height: 1.18; margin-bottom: 12px; }
      button { min-height: 40px; border: 1px solid rgba(239, 68, 68, .45); border-radius: 8px; background: rgba(239, 68, 68, .12); color: #fecaca; font-weight: 700; padding: 8px 12px; font-size: 13px; }
      .toolbar, .panel, details { border: 1px solid #1f2937; background: rgba(15, 23, 42, .92); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .muted { color: #9ca3af; font-size: 12px; line-height: 1.55; margin-top: 4px; }
      .panel { display: none; border-color: rgba(239, 68, 68, .36); background: rgba(69, 10, 10, .2); }
      .panel.show { display: block; }
      .headline { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
      .badge { width: fit-content; border-radius: 999px; border: 1px solid rgba(251, 191, 36, .35); padding: 3px 8px; color: #fde68a; background: rgba(120, 53, 15, .28); font-size: 11px; font-weight: 700; }
      .badge.good { color: #bbf7d0; border-color: rgba(16, 185, 129, .35); background: rgba(16, 185, 129, .12); }
      .badge.blocked { color: #fecaca; border-color: rgba(239, 68, 68, .4); background: rgba(127, 29, 29, .3); }
      .grid { display: grid; gap: 8px; margin-top: 12px; }
      .card { border: 1px solid rgba(55, 65, 81, .9); border-radius: 8px; background: rgba(2, 6, 23, .46); padding: 10px; }
      .card h3 { font-size: 11px; text-transform: uppercase; color: #cbd5e1; letter-spacing: 0; margin-bottom: 5px; }
      .card p { font-size: 12px; line-height: 1.55; color: #e5e7eb; }
      .key { word-break: break-all; color: #94a3b8 !important; font-size: 10px !important; margin-top: 6px; }
      .flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .flag { border: 1px solid rgba(16, 185, 129, .3); background: rgba(16, 185, 129, .12); color: #d1fae5; border-radius: 6px; padding: 5px 7px; font-size: 11px; }
      .gate { border-color: rgba(148, 163, 184, .28); color: #cbd5e1; background: rgba(15, 23, 42, .55); }
      .notice { display: none; margin-top: 10px; border: 1px solid rgba(239, 68, 68, .4); border-radius: 8px; background: rgba(127, 29, 29, .28); padding: 10px; color: #fecaca; font-size: 12px; line-height: 1.55; }
      .notice.show { display: block; }
      summary { cursor: pointer; font-size: 14px; font-weight: 700; }
      @media (min-width: 700px) {
        main { padding: 28px 20px 56px; }
        h1 { font-size: 28px; }
        .grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        .wide { grid-column: span 2; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Warm outreach external-send readiness</h1>
      <div class="toolbar">
        <strong>Canonical contact workroom</strong>
        <p class="muted">The operator can see local readiness, tracked Gmail draft evidence, sender identity, per-recipient approval, suppression, idempotency, and the external-send disabled state without sending email.</p>
        <button id="review">Review send authority</button>
      </div>

      <section id="panel" class="panel" aria-label="Warm external send readiness">
        <div class="headline">
          <div>
            <h2>Email first candidate</h2>
            <p class="muted">Local draft readiness and Gmail draft tracking are evidence only. They do not authorize Gmail send.</p>
          </div>
          <span class="badge blocked">External send disabled</span>
        </div>

        <div class="grid">
          <div class="card">
            <h3>Local draft readiness</h3>
            <span class="badge good">Handoff ready</span>
            <p>Relationship packet and draft basis are ready for internal review.</p>
          </div>
          <div class="card">
            <h3>Sender identity</h3>
            <span class="badge">Verified for draft only</span>
            <p>Required: vambah@amadutown.com / Connected: vambah@amadutown.com.</p>
          </div>
          <div class="card">
            <h3>Recipient approval</h3>
            <span class="badge blocked">Required</span>
            <p>No per-recipient external-send approval is recorded.</p>
          </div>
          <div class="card">
            <h3>Draft evidence</h3>
            <span class="badge">Tracked Gmail draft</span>
            <p>Draft: r3600377219184694601 / Thread: 1a043d900ee02b0f.</p>
          </div>
          <div class="card">
            <h3>Suppression and consent</h3>
            <span class="badge good">Clear</span>
            <p>No DNC, unsubscribe, or removed-state blocker is recorded.</p>
          </div>
        </div>

        <div class="card">
          <div class="headline">
            <div>
              <h3>External send authority</h3>
              <p>Portfolio cannot send this Gmail message from this state. Gmail drafts, canaries, and provider smoke evidence are not send permission.</p>
            </div>
            <span class="badge blocked">Blocked pending authority</span>
          </div>
          <p class="key">warm-outreach:email-send-queue:v1:operator-path</p>
          <button id="send">Check send authority</button>
          <p id="notice" class="notice">Ask the Integration Captain for explicit per-recipient external-send authority after sender identity, suppression, draft evidence, and final copy are reviewed. No Gmail send endpoint was called.</p>
        </div>

        <div class="flags">
          <span class="flag">Provider calls: off</span>
          <span class="flag">Draft creation: off</span>
          <span class="flag">External send: off</span>
          <span class="flag">Scheduling: off</span>
          <span class="flag">Slack: off</span>
          <span class="flag gate">Gmail draft is evidence only</span>
          <span class="flag gate">Per-recipient send approval missing</span>
        </div>

        <details id="details">
          <summary>Batch surface check</summary>
          <p class="muted">Batch Gmail send is disabled. Open each recipient relationship packet, verify sender identity, confirm suppression and final copy, then request explicit per-recipient authority.</p>
        </details>
      </section>
    </main>
    <script>
      document.querySelector('#review').addEventListener('click', () => {
        document.querySelector('#panel').classList.add('show');
        document.querySelector('#details').open = true;
      });
      document.querySelector('#send').addEventListener('click', () => {
        document.querySelector('#notice').classList.add('show');
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
await page.locator('#review').click()
await page.locator('#send').click()
await page.waitForTimeout(1000)
await page.screenshot({ path: mobileScreenshotPath, fullPage: true })
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

const desktopBrowser = await chromium.launch()
const desktopContext = await desktopBrowser.newContext({
  viewport: { width: 1280, height: 900 },
})
const desktopPage = await desktopContext.newPage()
await desktopPage.goto(pathToFileURL(htmlPath).href)
await desktopPage.locator('#review').click()
await desktopPage.locator('#send').click()
await desktopPage.waitForTimeout(500)
await desktopPage.screenshot({ path: desktopScreenshotPath, fullPage: true })
await desktopContext.close()
await desktopBrowser.close()

console.log(JSON.stringify({
  fixture: htmlPath,
  mobileScreenshotPath,
  desktopScreenshotPath,
  rawVideoPath,
  videoPath: rawVideoPath ? mp4Path : null,
}, null, 2))
