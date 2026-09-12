import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-real-gmail-rollout-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const htmlPath = path.join(tmpDir, 'warm-real-gmail-rollout.html')
const mobileScreenshotPath = path.join(outputDir, 'warm-real-gmail-rollout-mobile.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-real-gmail-rollout-desktop.png')
const mp4Path = path.join(outputDir, 'warm-real-gmail-rollout-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm real Gmail rollout QA</title>
    <style>
      body { margin: 0; background: #0b1018; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1040px; margin: 0 auto; padding: 16px 12px 44px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 22px; line-height: 1.18; margin-bottom: 12px; }
      h2 { font-size: 15px; line-height: 1.25; }
      button { min-height: 38px; border: 1px solid rgba(16, 185, 129, .42); border-radius: 7px; background: rgba(16, 185, 129, .14); color: #d1fae5; font-weight: 700; padding: 8px 12px; font-size: 13px; }
      .surface { border: 1px solid #293142; background: #141a24; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .muted { color: #aeb7c7; font-size: 12px; line-height: 1.55; margin-top: 4px; }
      .workroom { display: grid; gap: 10px; }
      .card { border: 1px solid rgba(16, 185, 129, .32); border-radius: 8px; background: rgba(6, 78, 59, .16); padding: 10px; }
      .card h3 { font-size: 11px; text-transform: uppercase; color: #cbd5e1; letter-spacing: 0; margin-bottom: 5px; }
      .card p { font-size: 12px; line-height: 1.55; color: #e5e7eb; }
      .headline { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
      .badge { width: fit-content; border-radius: 999px; border: 1px solid rgba(16, 185, 129, .38); padding: 3px 8px; color: #bbf7d0; background: rgba(6, 78, 59, .5); font-size: 11px; font-weight: 700; }
      .badge.warn { color: #fde68a; border-color: rgba(251, 191, 36, .42); background: rgba(120, 53, 15, .25); }
      .badge.blocked { color: #fecaca; border-color: rgba(239, 68, 68, .44); background: rgba(127, 29, 29, .35); }
      .requirements { display: grid; gap: 6px; margin-top: 10px; }
      .req { border: 1px solid rgba(16, 185, 129, .28); background: rgba(16, 185, 129, .1); border-radius: 6px; padding: 7px; font-size: 11px; color: #d1fae5; }
      .req.warn { border-color: rgba(251, 191, 36, .35); background: rgba(251, 191, 36, .1); color: #fde68a; }
      .boundary { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .flag { border: 1px solid rgba(16, 185, 129, .3); background: rgba(16, 185, 129, .12); color: #d1fae5; border-radius: 6px; padding: 5px 7px; font-size: 11px; }
      .key { overflow-wrap: anywhere; word-break: normal; color: #94a3b8 !important; font-size: 10px !important; margin-top: 6px; }
      .notice { display: none; margin-top: 10px; border: 1px solid rgba(16, 185, 129, .35); background: rgba(6, 78, 59, .22); border-radius: 8px; padding: 10px; color: #d1fae5; font-size: 12px; line-height: 1.55; }
      .notice.show { display: block; }
      @media (min-width: 760px) {
        main { padding: 28px 20px 56px; }
        h1 { font-size: 28px; }
        .workroom { grid-template-columns: minmax(0, 1.1fr) minmax(22rem, .9fr); }
        .requirements { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Selected outreach workroom</h1>
      <section class="surface" aria-label="Relationship packet">
        <div class="workroom">
          <div>
            <h2>Amina Example</h2>
            <p class="muted">Prior meeting context and Portfolio-local relationship evidence support a warm follow-up.</p>
            <div class="boundary">
              <span class="flag">Provider calls: off</span>
              <span class="flag">Draft creation: off</span>
              <span class="flag">External send: off</span>
              <span class="flag">Slack dispatch: off</span>
            </div>
          </div>
          <div class="card" aria-label="Real-recipient Gmail rollout">
            <div class="headline">
              <div>
                <h3>Real-recipient Gmail rollout</h3>
                <p>Ready for one-step send approval request</p>
              </div>
              <span class="badge">Approve send request</span>
            </div>
            <p class="muted">No Portfolio or Slack send authorization decision is recorded yet.</p>
            <div class="requirements">
              <span class="req">Draft: tracked</span>
              <span class="req">Sender: matched</span>
              <span class="req">Suppression: clear</span>
              <span class="req">Provider: configured</span>
              <span class="req warn">Authorization: missing</span>
              <span class="req warn">Submitted evidence: missing</span>
            </div>
            <p class="key">Slack payload: /api/admin/outreach/[id]/slack-send-approval. Dispatch off.</p>
            <p class="key">Dedupe: warm-outreach:slack-gmail-send-card:v1:real-recipient</p>
            <button id="approve">Approve send request</button>
            <p id="notice" class="notice">This records authorization intent only. Gmail send stays off until the captain enables the production flag and calls the exact per-recipient route.</p>
          </div>
        </div>
      </section>

      <section class="surface" aria-label="Blocked and duplicate examples">
        <div class="workroom">
          <div class="card">
            <div class="headline">
              <h3>Blocked row</h3>
              <span class="badge blocked">Resolve blocker</span>
            </div>
            <p>Tracked Gmail draft sender evidence is missing.</p>
          </div>
          <div class="card">
            <div class="headline">
              <h3>Already sent row</h3>
              <span class="badge blocked">Do not resend</span>
            </div>
            <p>Submitted Gmail send evidence already exists. No duplicate send path should run.</p>
          </div>
        </div>
      </section>
    </main>
    <script>
      document.querySelector('#approve').addEventListener('click', () => {
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
await page.locator('#approve').click()
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
await desktopPage.locator('#approve').click()
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
