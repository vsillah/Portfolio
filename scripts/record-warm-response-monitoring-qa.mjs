import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-response-monitoring-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const htmlPath = path.join(tmpDir, 'warm-response-monitoring.html')
const screenshotPath = path.join(outputDir, 'warm-response-monitoring-mobile.png')
const mp4Path = path.join(outputDir, 'warm-response-monitoring-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm response monitoring QA</title>
    <style>
      body { margin: 0; background: #030712; color: #f9fafb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1040px; margin: 0 auto; padding: 16px 10px 36px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 22px; line-height: 1.2; margin-bottom: 12px; }
      section { border: 1px solid #1f2937; border-radius: 12px; background: rgba(17, 24, 39, .72); margin-bottom: 14px; overflow: hidden; }
      header { border-bottom: 1px solid #1f2937; padding: 14px; }
      .body { padding: 14px; display: grid; gap: 12px; }
      h2 { font-size: 16px; line-height: 1.25; }
      h3 { font-size: 13px; line-height: 1.3; color: #dbeafe; }
      .muted { color: #9ca3af; font-size: 12px; line-height: 1.55; margin-top: 5px; }
      .grid { display: grid; gap: 10px; }
      .tile { border: 1px solid #334155; border-radius: 8px; background: rgba(2, 6, 23, .44); padding: 10px; min-width: 0; }
      .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
      .pill { display: inline-flex; width: fit-content; border: 1px solid #334155; border-radius: 999px; padding: 3px 8px; font-size: 11px; color: #d1d5db; }
      .ok { border-color: rgba(16, 185, 129, .45); background: rgba(16, 185, 129, .12); color: #d1fae5; }
      .warn { border-color: rgba(245, 158, 11, .45); background: rgba(120, 53, 15, .28); color: #fde68a; }
      .stop { border-color: rgba(239, 68, 68, .45); background: rgba(127, 29, 29, .25); color: #fecaca; }
      .info { border-color: rgba(14, 165, 233, .42); background: rgba(14, 165, 233, .12); color: #e0f2fe; }
      .flags { display: flex; flex-wrap: wrap; gap: 6px; }
      .flag { border: 1px solid rgba(16, 185, 129, .3); background: rgba(16, 185, 129, .12); color: #d1fae5; border-radius: 6px; padding: 5px 7px; font-size: 11px; }
      .label { color: #6b7280; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
      .small { color: #d1d5db; font-size: 12px; line-height: 1.5; margin-top: 5px; overflow-wrap: anywhere; }
      .channels { display: grid; gap: 8px; }
      .recipients { display: grid; gap: 8px; }
      .recipient { border: 1px solid #334155; border-radius: 8px; padding: 10px; background: rgba(2, 6, 23, .44); }
      button { min-height: 40px; border: 1px solid #0ea5e9; border-radius: 8px; background: rgba(14, 165, 233, .14); color: #e0f2fe; font-weight: 700; padding: 8px 12px; font-size: 14px; width: 100%; }
      @media (min-width: 760px) {
        main { padding: 28px 20px 56px; }
        .grid.two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .channels { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        button { width: auto; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Contact Workroom: Warm Response Monitoring</h1>
      <section aria-label="Relationship packet">
        <header>
          <div class="row">
            <div>
              <h2>Relationship packet</h2>
              <p class="muted">Read-only Portfolio context for warm outreach review.</p>
            </div>
            <span class="pill warn">Needs human review</span>
          </div>
        </header>
        <div class="body">
          <div class="grid two">
            <div class="tile">
              <p class="label">Relationship context</p>
              <p class="small">Prior meeting context and local outreach history support a warm follow-up. Private notes stay summarized.</p>
            </div>
            <div class="tile">
              <p class="label">Suppression and readiness</p>
              <p class="small">No DNC, unsubscribe, or removed-state blocker is recorded.</p>
            </div>
          </div>
          <div class="tile" id="monitoring">
            <div class="row">
              <div>
                <p class="label">Response monitoring</p>
                <h3>Review stale no-response follow-up</h3>
                <p class="muted">A local outreach row is past the expected reply window. Review relationship evidence and channel gates before proposing another touch.</p>
              </div>
              <span class="pill warn">stale no response</span>
            </div>
            <div class="grid two">
              <div>
                <p class="small">Mode: pending</p>
                <p class="small">Latest outbound: 2026-08-17T00:00:00.000Z</p>
                <p class="small">Latest response: none recorded</p>
                <p class="small">Expected reply by: 2026-08-24T00:00:00.000Z</p>
              </div>
              <div>
                <p class="label">Evidence</p>
                <p class="small">outreach_queue: expected reply</p>
                <p class="small">meeting_action_tasks: local follow-up</p>
              </div>
            </div>
            <div class="tile ok" style="margin-top: 10px;">
              <div class="row">
                <div>
                  <p class="label">Gmail response import</p>
                  <h3>Mock Gmail response import ready</h3>
                  <p class="muted">A mocked Gmail reply can be matched to the tracked warm queue row, then reviewed through the existing local response lifecycle.</p>
                </div>
                <span class="pill info">Live import off</span>
              </div>
              <div class="grid two">
                <div>
                  <p class="small">Candidate: ready for mock import / confidence high</p>
                  <p class="small">Queue: queue-1</p>
                  <p class="small">Thread: gmail-thread-42</p>
                  <p class="small">Message: gmail-reply-99</p>
                </div>
                <div>
                  <p class="small">Next: dry-run planner only; import evidence still needs human review.</p>
                  <p class="small">Recovery: unmatched, ambiguous, suppressed, duplicate, or already-replied cases stay manual.</p>
                  <p class="small">Gmail API: not called. Slack/n8n: off.</p>
                </div>
              </div>
            </div>
            <p class="label" style="margin-top: 10px;">Send-readiness gates</p>
            <div class="channels">
              <div class="tile warn"><h3>Gmail / email provider gate required</h3><p class="small">human reply approval, external send authority, provider execution gate</p></div>
              <div class="tile warn"><h3>LinkedIn provider gate required</h3><p class="small">human reply approval, external send authority, provider execution gate</p></div>
              <div class="tile info"><h3>Facebook manual review only</h3><p class="small">manual operator action outside Portfolio</p></div>
              <div class="tile info"><h3>Phone / manual review only</h3><p class="small">manual operator action outside Portfolio</p></div>
            </div>
          </div>
          <div class="flags">
            <span class="flag">Provider calls: off</span>
            <span class="flag">Draft creation: off</span>
            <span class="flag">External send: off</span>
            <span class="flag">Provider monitoring: off</span>
            <span class="flag">External monitoring: off</span>
            <span class="flag info">Local response evidence: visible</span>
          </div>
        </div>
      </section>

      <section aria-label="Warm batch review">
        <header>
          <div class="row">
            <div>
              <h2>Warm batch review</h2>
              <p class="muted">Selected warm leads stay individualized before draft or send authority.</p>
            </div>
            <button id="expand" type="button">Show recipient state</button>
          </div>
        </header>
        <div class="body">
          <div class="flags">
            <span class="flag">Provider calls: off</span>
            <span class="flag">External send: off</span>
            <span class="flag">Gmail draft: off</span>
            <span class="flag">External monitoring: off</span>
            <span class="flag info">Local response evidence: visible</span>
          </div>
          <div class="recipients" id="recipients">
            <div class="recipient">
              <div class="row"><h3>Amina Example</h3><span class="pill ok">Ready</span></div>
              <p class="small">Monitoring: stale no response</p>
              <p class="small">Next: Review stale no-response follow-up</p>
              <p class="small">Recipient key: warm-outreach:recipient:v1:amina42</p>
            </div>
            <div class="recipient">
              <div class="row"><h3>Kofi Suppressed</h3><span class="pill stop">Blocked</span></div>
              <p class="small">Monitoring: blocked</p>
              <p class="small">Next: Resolve blocker before follow-up</p>
              <p class="small">Recipient key: warm-outreach:recipient:v1:kofi77</p>
            </div>
          </div>
          <p class="muted">Every row remains review-only. Suppressed, weak-basis, missing provider capability, and missing human approval fail closed before send readiness.</p>
        </div>
      </section>
    </main>
    <script>
      document.querySelector('#expand').addEventListener('click', () => {
        document.querySelector('#recipients').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
await page.locator('#monitoring').scrollIntoViewIfNeeded()
await page.waitForTimeout(700)
await page.locator('#expand').click()
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
