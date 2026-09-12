import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-gmail-provider-smoke-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const htmlPath = path.join(tmpDir, 'warm-gmail-provider-activation.html')
const mobileScreenshotPath = path.join(outputDir, 'warm-gmail-provider-activation-mobile.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-gmail-provider-activation-desktop.png')
const mp4Path = path.join(outputDir, 'warm-gmail-provider-activation-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm Gmail provider activation QA</title>
    <style>
      body { margin: 0; background: #030712; color: #f9fafb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 980px; margin: 0 auto; padding: 18px 12px 44px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 22px; line-height: 1.2; margin-bottom: 12px; }
      button { min-height: 40px; border: 1px solid #0ea5e9; border-radius: 8px; background: rgba(14, 165, 233, .14); color: #e0f2fe; font-weight: 700; padding: 8px 12px; font-size: 14px; }
      .toolbar, .panel, details { border: 1px solid #1f2937; background: rgba(15, 23, 42, .92); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .muted { color: #9ca3af; font-size: 12px; line-height: 1.55; margin-top: 4px; }
      .panel { display: none; border-color: rgba(14, 165, 233, .36); background: rgba(8, 47, 73, .28); }
      .panel.show { display: block; }
      .headline { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
      .badge { width: fit-content; border-radius: 999px; border: 1px solid rgba(251, 191, 36, .35); padding: 3px 8px; color: #fde68a; background: rgba(120, 53, 15, .28); font-size: 11px; font-weight: 700; }
      .badge.good { color: #bbf7d0; border-color: rgba(16, 185, 129, .35); background: rgba(16, 185, 129, .12); }
      .badge.blocked { color: #fecaca; border-color: rgba(239, 68, 68, .35); background: rgba(127, 29, 29, .28); }
      .grid { display: grid; gap: 8px; margin-top: 12px; }
      .card { border: 1px solid rgba(55, 65, 81, .9); border-radius: 8px; background: rgba(2, 6, 23, .46); padding: 10px; }
      .card h3 { font-size: 11px; text-transform: uppercase; color: #cbd5e1; letter-spacing: 0; margin-bottom: 5px; }
      .card p { font-size: 12px; line-height: 1.55; color: #e5e7eb; }
      .key { word-break: break-all; color: #94a3b8 !important; font-size: 10px !important; margin-top: 6px; }
      .flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .flag { border: 1px solid rgba(16, 185, 129, .3); background: rgba(16, 185, 129, .12); color: #d1fae5; border-radius: 6px; padding: 5px 7px; font-size: 11px; }
      .gate { border-color: rgba(148, 163, 184, .28); color: #cbd5e1; background: rgba(15, 23, 42, .55); }
      summary { cursor: pointer; font-size: 14px; font-weight: 700; }
      @media (min-width: 640px) {
        main { padding: 28px 20px 56px; }
        h1 { font-size: 28px; }
        .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Warm outreach Gmail provider activation readiness</h1>
      <div class="toolbar">
        <strong>Relationship packet loaded</strong>
        <p class="muted">Operator reviews local handoff evidence, sender readiness, no-send canary readiness, Gmail draft tracking, and send blocking as separate gates.</p>
        <button id="review">Review Gmail readiness</button>
      </div>

      <section id="panel" class="panel" aria-label="Warm Gmail provider readiness">
        <div class="headline">
          <div>
            <h2>Email first candidate</h2>
            <p class="muted">Provider/send activation blocked. Future approval must cover this contact, channel, and message version.</p>
          </div>
          <span class="badge">Provider/send off</span>
        </div>

        <div class="card">
          <div class="headline">
            <div>
              <h3>Gmail provider activation readiness</h3>
              <p>Draft readiness, connected sender readiness, no-send canary readiness, Gmail draft tracking, and send authority stay separate.</p>
            </div>
            <span class="badge blocked">External send blocked</span>
          </div>
          <div class="grid">
            <div class="card">
              <h3>Local draft readiness</h3>
              <span class="badge good">Local draft handoff ready</span>
              <p class="key">warm-outreach:gmail-draft-handoff:v1:operator-path</p>
            </div>
            <div class="card">
              <h3>Connected sender readiness</h3>
              <span class="badge good">Connected sender verified</span>
              <p>Required: vambah@amadutown.com / Connected: vambah@amadutown.com</p>
            </div>
            <div class="card">
              <h3>Live draft canary readiness</h3>
              <span class="badge good">No-send canary passed</span>
              <p>No-send canary: provider calls off / creates draft: no.</p>
            </div>
            <div class="card">
              <h3>Gmail draft tracking</h3>
              <span class="badge">Gmail draft exists and is tracked</span>
              <p>Draft: r3600377219184694601 / Thread: 1a043d900ee02b0f / Message: 1a043d900ee02b0f</p>
              <p>Reuse the saved Gmail draft record. It is tracking evidence only; external send still needs separate approval.</p>
            </div>
          </div>
          <div class="flags">
            <span class="flag gate">review local draft handoff packet</span>
            <span class="flag gate">verify connected sender identity</span>
            <span class="flag gate">captain authorize specific live draft canary</span>
            <span class="flag gate">explicit per-recipient Gmail draft authorization</span>
            <span class="flag gate">separate external send authority</span>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h3>Internal draft handoff</h3>
            <span class="badge good">Ready</span>
            <p>contact_submission:42:Ada Operator / follow up</p>
            <p>Suppression: clear. Gmail draft creation off. External send blocked.</p>
            <p class="key">warm-outreach:gmail-draft-handoff:v1:operator-path</p>
          </div>
          <div class="card">
            <h3>Gmail provider smoke</h3>
            <span class="badge">waiting read only smoke authority</span>
            <p>Gmail provider configured, smoke authority required. Provider calls off.</p>
            <p>OAuth: configured / Profile: available.</p>
            <p class="key">warm-outreach:gmail-capability-smoke:v1:operator-path</p>
          </div>
        </div>

        <div class="card">
          <h3>Gmail draft creation availability</h3>
          <span class="badge">provider smoke required</span>
          <p>Gmail provider smoke required before draft creation. Draft creation off. External send blocked.</p>
          <p class="key">warm-outreach:gmail-draft-creation-gate:v1:operator-path</p>
        </div>

        <div class="flags">
          <span class="flag">Provider calls: off</span>
          <span class="flag">Read-only smoke: off</span>
          <span class="flag">Draft creation: off</span>
          <span class="flag">External send: off</span>
          <span class="flag">Scheduling: off</span>
          <span class="flag">Slack: off</span>
        </div>

        <details id="details">
          <summary>Monitoring evidence and send gate details</summary>
          <p class="muted">Stable keys prevent duplicate contact/channel/message-version execution. Gmail draft creation authority and external send authority remain separate future gates.</p>
        </details>
      </section>
    </main>
    <script>
      document.querySelector('#review').addEventListener('click', () => {
        document.querySelector('#panel').classList.add('show');
        document.querySelector('#details').open = true;
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
