import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-slack-send-approval-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const htmlPath = path.join(tmpDir, 'warm-slack-send-approval.html')
const mobileScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-mobile.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-desktop.png')
const mp4Path = path.join(outputDir, 'warm-slack-send-approval-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm Slack send approval QA</title>
    <style>
      body { margin: 0; background: #0f1115; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1040px; margin: 0 auto; padding: 16px 12px 42px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 22px; line-height: 1.18; margin-bottom: 12px; }
      h2 { font-size: 16px; line-height: 1.25; }
      button { min-height: 38px; border: 1px solid rgba(148, 163, 184, .34); border-radius: 7px; background: #1f2937; color: #f8fafc; font-weight: 700; padding: 8px 12px; font-size: 13px; }
      button.primary { background: #047857; border-color: rgba(16, 185, 129, .65); }
      button.danger { background: #7f1d1d; border-color: rgba(248, 113, 113, .58); }
      .surface, .receipt { border: 1px solid #293142; background: #171b24; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .muted { color: #aeb7c7; font-size: 12px; line-height: 1.55; margin-top: 4px; }
      .card { border: 1px solid #374151; border-radius: 8px; background: #10151e; padding: 12px; margin-top: 12px; }
      .card h3 { font-size: 11px; text-transform: uppercase; color: #cbd5e1; letter-spacing: 0; margin-bottom: 5px; }
      .card p { font-size: 12px; line-height: 1.55; color: #e5e7eb; }
      .grid { display: grid; gap: 8px; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .badge { width: fit-content; border-radius: 999px; border: 1px solid rgba(251, 191, 36, .38); padding: 3px 8px; color: #fde68a; background: rgba(120, 53, 15, .24); font-size: 11px; font-weight: 700; }
      .badge.good { color: #bbf7d0; border-color: rgba(16, 185, 129, .4); background: rgba(6, 78, 59, .5); }
      .badge.blocked { color: #fecaca; border-color: rgba(248, 113, 113, .46); background: rgba(127, 29, 29, .35); }
      .key { word-break: break-all; color: #94a3b8 !important; font-size: 10px !important; margin-top: 6px; }
      .receipt { display: none; border-color: rgba(16, 185, 129, .42); }
      .receipt.show { display: block; }
      .warning { border: 1px solid rgba(251, 191, 36, .42); background: rgba(120, 53, 15, .22); border-radius: 8px; padding: 10px; color: #fde68a; font-size: 12px; line-height: 1.55; margin-top: 10px; }
      .flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .flag { border: 1px solid rgba(16, 185, 129, .3); background: rgba(16, 185, 129, .12); color: #d1fae5; border-radius: 6px; padding: 5px 7px; font-size: 11px; }
      @media (min-width: 760px) {
        main { padding: 28px 20px 56px; }
        h1 { font-size: 28px; }
        .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Warm Gmail send authorization</h1>
      <section class="surface" aria-label="Slack one-tap review card">
        <h2>Slack card</h2>
        <p class="muted">One recipient, one message version, one explicit decision. Portfolio remains the canonical audit store.</p>
        <div class="warning">Approve Send records external-send authorization intent in Portfolio for this recipient and message version. Gmail send execution remains disabled in this phase.</div>
        <div class="grid">
          <div class="card">
            <h3>Recipient</h3>
            <p>Amina Example, amina@example.com</p>
          </div>
          <div class="card">
            <h3>Relationship basis</h3>
            <p>Prior meeting context and a local outreach history support a warm follow-up.</p>
          </div>
          <div class="card">
            <h3>Draft evidence</h3>
            <p>Tracked Gmail draft r3600377219184694601. Draft evidence is not send permission.</p>
          </div>
          <div class="card">
            <h3>Suppression and consent</h3>
            <p><span class="badge good">Clear</span></p>
            <p>No DNC, unsubscribe, or removed-state blocker is recorded.</p>
          </div>
          <div class="card">
            <h3>Sender identity</h3>
            <p>Required and connected sender: vambah@amadutown.com.</p>
          </div>
          <div class="card">
            <h3>Idempotency</h3>
            <p class="key">warm-outreach:email-send-queue:v1:operator-path</p>
          </div>
        </div>
        <div class="actions">
          <button id="approve" class="primary">Approve Send</button>
          <button id="reject" class="danger">Reject</button>
          <button id="revise">Revise</button>
        </div>
      </section>

      <section id="receipt" class="receipt" aria-label="Portfolio receipt">
        <h2>Portfolio audit receipt</h2>
        <p class="muted">Slack returned a mobile decision. Portfolio recorded the decision key and kept execution blocked.</p>
        <div class="flags">
          <span class="flag">approval_intent_recorded: true</span>
          <span class="flag">external_send_enabled: false</span>
          <span class="flag">provider_execution_enabled: false</span>
          <span class="flag">gmail_send_called: false</span>
          <span class="flag">external_send_performed: false</span>
        </div>
        <p class="key">warm-outreach:slack-gmail-send-decision:v1:operator-path</p>
      </section>
    </main>
    <script>
      document.querySelector('#approve').addEventListener('click', () => {
        document.querySelector('#receipt').classList.add('show');
      });
      document.querySelector('#reject').addEventListener('click', () => {
        document.querySelector('#receipt').classList.add('show');
      });
      document.querySelector('#revise').addEventListener('click', () => {
        document.querySelector('#receipt').classList.add('show');
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
