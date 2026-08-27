import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-gmail-draft-creation-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const htmlPath = path.join(tmpDir, 'warm-gmail-draft-creation.html')
const screenshotPath = path.join(outputDir, 'warm-gmail-draft-creation-mobile.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-gmail-draft-creation-desktop.png')
const mp4Path = path.join(outputDir, 'warm-gmail-draft-creation-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm Gmail draft creation QA</title>
    <style>
      body { margin: 0; background: #030712; color: #f9fafb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 760px; margin: 0 auto; padding: 18px 12px 44px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 22px; line-height: 1.2; margin-bottom: 12px; }
      button { min-height: 40px; border: 1px solid #0ea5e9; border-radius: 8px; background: rgba(14, 165, 233, .14); color: #e0f2fe; font-weight: 700; padding: 8px 12px; font-size: 14px; }
      button[disabled] { border-color: #334155; background: rgba(51, 65, 85, .24); color: #94a3b8; }
      .toolbar, .panel, .result { border: 1px solid #1f2937; background: rgba(15, 23, 42, .92); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .muted { color: #9ca3af; font-size: 12px; line-height: 1.55; margin-top: 4px; }
      .panel { border-color: rgba(14, 165, 233, .36); background: rgba(8, 47, 73, .28); }
      .headline { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
      .badge { width: fit-content; border-radius: 999px; border: 1px solid rgba(251, 191, 36, .35); padding: 3px 8px; color: #fde68a; background: rgba(120, 53, 15, .28); font-size: 11px; font-weight: 700; }
      .badge.good { color: #bbf7d0; border-color: rgba(16, 185, 129, .35); background: rgba(16, 185, 129, .12); }
      .grid { display: grid; gap: 8px; margin-top: 12px; }
      .card { border: 1px solid rgba(55, 65, 81, .9); border-radius: 8px; background: rgba(2, 6, 23, .46); padding: 10px; }
      .card h3 { font-size: 11px; text-transform: uppercase; color: #cbd5e1; letter-spacing: 0; margin-bottom: 5px; }
      .card p { font-size: 12px; line-height: 1.55; color: #e5e7eb; }
      .key { word-break: break-all; color: #94a3b8 !important; font-size: 10px !important; margin-top: 6px; }
      .flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .flag { border: 1px solid rgba(16, 185, 129, .3); background: rgba(16, 185, 129, .12); color: #d1fae5; border-radius: 6px; padding: 5px 7px; font-size: 11px; }
      .result { display: none; border-color: rgba(16, 185, 129, .38); background: rgba(6, 78, 59, .22); color: #d1fae5; }
      .result.show { display: block; }
      .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
      @media (min-width: 640px) {
        main { padding: 28px 20px 56px; }
        h1 { font-size: 28px; }
        .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .actions { flex-direction: row; align-items: center; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Warm outreach Gmail draft creation canary</h1>
      <div class="toolbar">
        <strong>Relationship packet loaded</strong>
        <p class="muted">Operator reviews internal handoff evidence before provider smoke, Gmail draft creation, tracking persistence, or external send authority.</p>
      </div>

      <section class="panel" aria-label="Warm Gmail draft creation availability">
        <div class="headline">
          <div>
            <h2>Email first candidate</h2>
            <p class="muted">Selected contact and message version are known. Gmail draft creation remains off until a future explicit gate.</p>
          </div>
          <span class="badge">Provider/send off</span>
        </div>

        <div class="grid">
          <div class="card">
            <h3>Provider readiness smoke</h3>
            <span class="badge good">passed read-only</span>
            <p>Gmail provider readiness can be checked without creating drafts or sending email.</p>
            <p class="key">warm-outreach:gmail-capability-smoke:v1:contact-13716</p>
          </div>
          <div class="card">
            <h3>Draft creation authorization</h3>
            <span class="badge">draft creation off</span>
            <p>Future Gmail draft creation requires selected contact, selected message, authenticated account, and idempotency evidence.</p>
            <p class="key">warm-outreach:gmail-draft-creation-gate:v1:contact-13716</p>
          </div>
        </div>

        <div class="card">
          <h3>No-send canary</h3>
          <p>Run a no-send canary to confirm the contact, message-version keys, and gates are wired. It does not call Gmail.</p>
          <div class="actions">
            <button id="canary" type="button">Run no-send canary</button>
            <button type="button" disabled>External send blocked</button>
          </div>
        </div>

        <div id="result" class="result" role="status">
          <p><strong>No-send Gmail draft creation canary passed.</strong></p>
          <p class="muted">No Gmail draft was created, no tracking was written, and no email was sent.</p>
          <div class="flags">
            <span class="flag">Provider calls: off</span>
            <span class="flag">Draft creation: off</span>
            <span class="flag">Gmail draft: not created</span>
            <span class="flag">Tracking: not written</span>
            <span class="flag">External send: blocked</span>
          </div>
        </div>
      </section>
    </main>
    <script>
      document.querySelector('#canary').addEventListener('click', () => {
        const button = document.querySelector('#canary');
        button.textContent = 'Checking...';
        setTimeout(() => {
          button.textContent = 'Run no-send canary';
          document.querySelector('#result').classList.add('show');
        }, 450);
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
await page.locator('#canary').click()
await page.getByText('No-send Gmail draft creation canary passed.').waitFor()
await page.waitForTimeout(1000)
await page.screenshot({ path: screenshotPath, fullPage: true })
const video = page.video()
await context.close()

const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await desktopPage.goto(pathToFileURL(htmlPath).href)
await desktopPage.locator('#canary').click()
await desktopPage.getByText('No-send Gmail draft creation canary passed.').waitFor()
await desktopPage.screenshot({ path: desktopScreenshotPath, fullPage: true })
await desktopPage.close()
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
  desktopScreenshotPath,
  rawVideoPath,
  videoPath: rawVideoPath ? mp4Path : null,
}, null, 2))
