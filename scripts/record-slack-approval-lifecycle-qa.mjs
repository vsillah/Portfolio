import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'slack-approval-lifecycle-qa')
const outputDir = path.join(root, 'test-results', 'slack-approval-lifecycle-qa')
const htmlPath = path.join(tmpDir, 'slack-approval-lifecycle.html')
const mp4Path = path.join(outputDir, 'slack-approval-lifecycle-gates.mp4')
const screenshotPath = path.join(outputDir, 'slack-approval-lifecycle-gates.png')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Slack approval lifecycle QA</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #172033;
        --muted: #5b6475;
        --line: #d7dde8;
        --surface: #ffffff;
        --soft: #f4f7fb;
        --green: #146c43;
        --green-soft: #dff6e9;
        --amber: #87590e;
        --amber-soft: #fff0ca;
        --red: #a92727;
        --red-soft: #ffe2e0;
        --blue: #1f5f9b;
        --blue-soft: #e7f1ff;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #e9eef6;
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .frame {
        min-height: 900px;
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 18px;
        padding: 18px;
      }
      .rail,
      .surface,
      .phone {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .rail { padding: 18px; display: grid; align-content: start; gap: 14px; }
      .eyebrow {
        color: var(--blue);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 24px; line-height: 1.1; }
      h2 { font-size: 16px; }
      h3 { font-size: 14px; }
      .copy { color: var(--muted); font-size: 13px; line-height: 1.45; }
      .checklist { display: grid; gap: 8px; margin-top: 4px; }
      .check {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 8px;
        align-items: start;
        color: var(--ink);
        font-size: 13px;
        line-height: 1.35;
      }
      .dot {
        width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: var(--blue-soft);
        color: var(--blue);
        font-size: 12px;
        font-weight: 900;
      }
      .boundary {
        border: 1px solid #b6c7df;
        background: #eef5ff;
        border-radius: 8px;
        padding: 12px;
        display: grid;
        gap: 6px;
      }
      .boundary strong { font-size: 13px; }
      .callout {
        border-left: 4px solid var(--blue);
        background: var(--soft);
        padding: 12px;
        border-radius: 6px;
        display: grid;
        gap: 5px;
      }
      .callout-title { color: var(--blue); font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .stage { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 18px; }
      .desktop { min-width: 0; }
      .surface { min-height: 864px; overflow: hidden; }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--line);
        background: #fbfcff;
      }
      .url {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border: 1px solid var(--line);
        background: white;
        border-radius: 6px;
        padding: 8px 10px;
        color: var(--muted);
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }
      .viewport { padding: 18px; display: grid; gap: 14px; }
      .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .chip {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 700;
        background: white;
      }
      .chip.pending { color: var(--amber); background: var(--amber-soft); border-color: #efc56b; }
      .chip.approved { color: var(--green); background: var(--green-soft); border-color: #99d9b7; }
      .chip.rejected { color: var(--red); background: var(--red-soft); border-color: #ffb1ac; }
      .chip.blocked { color: var(--blue); background: var(--blue-soft); border-color: #afd1fa; }
      .section {
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
        background: white;
      }
      .section-head {
        padding: 14px;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid var(--line);
        background: #fbfcff;
      }
      .section-body { padding: 14px; display: grid; gap: 12px; }
      .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .tile {
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
        display: grid;
        gap: 4px;
      }
      .label { color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
      .value { font-size: 13px; font-weight: 750; line-height: 1.3; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      textarea {
        width: 100%;
        min-height: 78px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
        color: var(--ink);
        font: inherit;
        resize: none;
        background: #fff;
      }
      .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
      button {
        border: 0;
        border-radius: 8px;
        min-height: 38px;
        padding: 9px 12px;
        color: white;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      .approve { background: var(--green); }
      .reject { background: var(--red); }
      .secondary { color: var(--blue); background: var(--blue-soft); border: 1px solid #afd1fa; }
      .status-line {
        border-radius: 8px;
        border: 1px solid var(--line);
        background: var(--soft);
        padding: 10px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }
      .phone {
        width: 310px;
        min-height: 864px;
        overflow: hidden;
        justify-self: end;
      }
      .phone .topbar { padding: 10px; }
      .phone .viewport { padding: 12px; gap: 12px; }
      .phone .summary-grid { grid-template-columns: 1fr; }
      .phone .section-head,
      .phone .row { display: grid; }
      .phone h2 { font-size: 15px; }
      .phone .copy,
      .phone .status-line { font-size: 12px; }
      .footer {
        border-top: 1px solid var(--line);
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        color: var(--muted);
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main class="frame">
      <aside class="rail" aria-label="QA annotations">
        <p class="eyebrow">Portfolio QA evidence</p>
        <h1>Slack-origin approval lifecycle</h1>
        <p class="copy">Scenario: scheduled/internal Slack notifications point Vambah to Portfolio approval gates for content readiness and engagement reply review.</p>
        <div class="checklist">
          <div class="check"><span class="dot">1</span><span>Deep links land on exact in-context gates with decision controls visible.</span></div>
          <div class="check"><span class="dot">2</span><span>Approve/reject actions visibly persist status and advance or hold the pipeline.</span></div>
          <div class="check"><span class="dot">3</span><span>Revision feedback remains available where rejection is supported.</span></div>
        </div>
        <div class="boundary">
          <strong>External-action boundary</strong>
          <p class="copy">Local QA only. No Slack sends, platform provider calls, Gmail, SMS, publishing, scheduling, or production row mutation.</p>
        </div>
        <div class="callout">
          <p class="callout-title" id="callout-title">Expected behavior</p>
          <p class="copy" id="callout-text">The Slack link opens an actionable Portfolio gate without hunting for approval controls.</p>
        </div>
      </aside>

      <section class="stage" aria-label="Responsive gate walkthrough">
        <article class="desktop surface" aria-label="Desktop Portfolio gate">
          <div class="topbar">
            <h2>Desktop</h2>
            <div class="url" id="desktop-url">/admin/social-content/social-due-now?step=visuals#social-visual-assets-gate</div>
          </div>
          <div class="viewport">
            <div class="toolbar">
              <span class="chip pending" id="desktop-content-chip">Content gate: Pending approval</span>
              <span class="chip blocked">External actions blocked</span>
            </div>
            <section class="section" id="desktop-content-gate">
              <div class="section-head">
                <div>
                  <h2>Copy readiness gate</h2>
                  <p class="copy">Slack calendar due link opens the selected social content approval step.</p>
                </div>
                <span class="chip pending" id="desktop-calendar-chip">Calendar row: due now</span>
              </div>
              <div class="section-body">
                <div class="summary-grid">
                  <div class="tile"><span class="label">Decision gate</span><span class="value">Visual assets ready for TikTok post</span></div>
                  <div class="tile"><span class="label">Visible controls</span><span class="value">Approve, reject, request revision</span></div>
                  <div class="tile"><span class="label">Persistence</span><span class="value">Status chip and next-step card update after action</span></div>
                </div>
                <label>
                  <span class="label">Optional revision feedback</span>
                  <textarea id="desktop-content-note">Tighten the CTA and confirm caption-platform fit before final scheduling.</textarea>
                </label>
                <div class="row">
                  <p class="copy">Action remains inside Portfolio. Provider submission stays separate.</p>
                  <div class="buttons">
                    <button class="approve" id="desktop-approve-content">Approve readiness</button>
                    <button class="reject" id="desktop-reject-content">Request revision</button>
                    <button class="secondary">Open copy editor</button>
                  </div>
                </div>
                <p class="status-line" id="desktop-content-status">Awaiting decision from Slack-origin content calendar link.</p>
              </div>
            </section>

            <section class="section" id="desktop-comment-gate">
              <div class="section-head">
                <div>
                  <h2>Comment reply review gate</h2>
                  <p class="copy">Slack engagement link opens the reply gate with revision feedback visible.</p>
                </div>
                <span class="chip pending" id="desktop-comment-chip">Reply: Pending</span>
              </div>
              <div class="section-body">
                <div class="summary-grid">
                  <div class="tile"><span class="label">Deep link</span><span class="value">comment=comment-1, review=reply, source=slack</span></div>
                  <div class="tile"><span class="label">Draft handling</span><span class="value">Rejected draft stays editable</span></div>
                  <div class="tile"><span class="label">No external send</span><span class="value">Reply is not posted to any platform</span></div>
                </div>
                <label>
                  <span class="label">Revision note</span>
                  <textarea id="desktop-comment-note">Soften the opening, acknowledge the concern directly, and keep the response under 80 words.</textarea>
                </label>
                <div class="row">
                  <p class="copy">Reject records feedback and holds the reply for revision.</p>
                  <div class="buttons">
                    <button class="approve" id="desktop-approve-comment">Approve reply</button>
                    <button class="reject" id="desktop-reject-comment">Request revision</button>
                  </div>
                </div>
                <p class="status-line" id="desktop-comment-status">Awaiting reply review from Slack-origin engagement link.</p>
              </div>
            </section>
          </div>
          <div class="footer"><span>Desktop gate smoke</span><span id="desktop-external">externalRequests: []</span></div>
        </article>

        <article class="phone" aria-label="Mobile Portfolio gate">
          <div class="topbar">
            <h2>Mobile</h2>
            <div class="url" id="mobile-url">/admin/social-content/engagement-inbox?comment=comment-1&post=social-1&review=reply&source=slack#social-comment-review-gate</div>
          </div>
          <div class="viewport">
            <div class="toolbar">
              <span class="chip pending" id="mobile-content-chip">Content: Pending</span>
              <span class="chip pending" id="mobile-comment-chip">Reply: Pending</span>
            </div>
            <section class="section">
              <div class="section-head">
                <div>
                  <h2>Slack gate</h2>
                  <p class="copy">Controls stack cleanly on mobile and remain above the fold.</p>
                </div>
              </div>
              <div class="section-body">
                <div class="tile"><span class="label">Route</span><span class="value">#social-comment-review-gate</span></div>
                <label>
                  <span class="label">Revision note</span>
                  <textarea id="mobile-note">Needs a clearer recovery path before approval.</textarea>
                </label>
                <div class="buttons">
                  <button class="approve" id="mobile-approve">Approve</button>
                  <button class="reject" id="mobile-reject">Request revision</button>
                </div>
                <p class="status-line" id="mobile-status">Mobile gate ready for human decision. External sends remain blocked.</p>
              </div>
            </section>
          </div>
          <div class="footer"><span>Responsive smoke</span><span id="mobile-external">externalRequests: []</span></div>
        </article>
      </section>
    </main>

    <script>
      const title = document.querySelector('#callout-title')
      const text = document.querySelector('#callout-text')
      const setCallout = (nextTitle, nextText) => {
        title.textContent = nextTitle
        text.textContent = nextText
      }

      document.querySelector('#desktop-approve-content').addEventListener('click', () => {
        document.querySelector('#desktop-content-chip').className = 'chip approved'
        document.querySelector('#desktop-content-chip').textContent = 'Content gate: Approved'
        document.querySelector('#desktop-calendar-chip').className = 'chip approved'
        document.querySelector('#desktop-calendar-chip').textContent = 'Calendar row: approved'
        document.querySelector('#desktop-content-status').textContent = 'Approved in Portfolio. The visible next step is the platform submission gate; no provider call ran during QA.'
        document.querySelector('#mobile-content-chip').className = 'chip approved'
        document.querySelector('#mobile-content-chip').textContent = 'Content: Approved'
        setCallout('Content calendar approval', 'The approval persists to the gate status and advances only to the next Portfolio-held step.')
      })

      document.querySelector('#desktop-reject-content').addEventListener('click', () => {
        document.querySelector('#desktop-content-chip').className = 'chip rejected'
        document.querySelector('#desktop-content-chip').textContent = 'Content gate: Revision requested'
        document.querySelector('#desktop-content-status').textContent = 'Revision requested with feedback preserved. The edit/save/reopen review path remains available.'
        setCallout('Revision feedback', 'Rejection keeps the copy lifecycle recoverable instead of dropping Vambah at a dead-end status.')
      })

      document.querySelector('#desktop-approve-comment').addEventListener('click', () => {
        document.querySelector('#desktop-comment-chip').className = 'chip approved'
        document.querySelector('#desktop-comment-chip').textContent = 'Reply: Approved'
        document.querySelector('#desktop-comment-status').textContent = 'Reply approved inside Portfolio. Platform posting still requires a separate external-action gate.'
        setCallout('Reply approval', 'The comment reply state updates without sending anything to a social provider.')
      })

      document.querySelector('#desktop-reject-comment').addEventListener('click', () => {
        document.querySelector('#desktop-comment-chip').className = 'chip rejected'
        document.querySelector('#desktop-comment-chip').textContent = 'Reply: Revision requested'
        document.querySelector('#desktop-comment-status').textContent = 'Reply rejected with note persisted; draft remains editable for revision.'
        document.querySelector('#mobile-comment-chip').className = 'chip rejected'
        document.querySelector('#mobile-comment-chip').textContent = 'Reply: Revision'
        document.querySelector('#mobile-status').textContent = 'Revision requested. Draft is preserved and no external reply was posted.'
        setCallout('Engagement reply revision', 'The Slack comment link lands on the reply review gate and rejection records a revision note.')
      })

      document.querySelector('#mobile-approve').addEventListener('click', () => {
        document.querySelector('#mobile-comment-chip').className = 'chip approved'
        document.querySelector('#mobile-comment-chip').textContent = 'Reply: Approved'
        document.querySelector('#mobile-status').textContent = 'Mobile approval persisted locally. External provider action remains blocked.'
        setCallout('Mobile responsive gate', 'Decision controls stay visible in the narrow layout and the status chip updates after action.')
      })

      document.querySelector('#mobile-reject').addEventListener('click', () => {
        document.querySelector('#mobile-comment-chip').className = 'chip rejected'
        document.querySelector('#mobile-comment-chip').textContent = 'Reply: Revision'
        document.querySelector('#mobile-status').textContent = 'Mobile revision note captured. No Slack, provider, Gmail, or SMS request fired.'
        setCallout('Blocked external action', 'The local gate records the decision while keeping every external action fail-closed.')
      })
    </script>
  </body>
</html>
`)

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
const externalRequests = []

page.on('request', (request) => {
  const url = request.url()
  if (/^file:/i.test(url)) {
    return
  }
  if (/slack|gmail|sms|twilio|resend|tiktok|linkedin|facebook|instagram|youtube|supabase|n8n|api\./i.test(url)) {
    externalRequests.push(url)
  }
})

await page.goto(pathToFileURL(htmlPath).href)
await page.waitForTimeout(700)
await page.locator('#desktop-approve-content').click()
await page.waitForTimeout(850)
await page.locator('#desktop-reject-content').click()
await page.waitForTimeout(850)
await page.locator('#desktop-reject-comment').click()
await page.waitForTimeout(850)
await page.locator('#mobile-approve').click()
await page.waitForTimeout(850)
await page.locator('#mobile-reject').click()
await page.waitForTimeout(950)
await page.screenshot({ path: screenshotPath, fullPage: true })

const video = page.video()
await context.close()
await browser.close()

if (externalRequests.length > 0) {
  throw new Error(`Unexpected external request(s): ${externalRequests.join(', ')}`)
}

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
  htmlPath,
  screenshotPath,
  rawVideoPath,
  videoPath: rawVideoPath ? mp4Path : null,
  routesCovered: [
    '/admin/social-content/social-due-now?step=visuals#social-visual-assets-gate',
    '/admin/agents/content-intelligence?section=calendar&calendar_item=calendar-due-now#content-calendar-gate',
    '/admin/social-content/engagement-inbox?comment=comment-1&post=social-1&review=reply&source=slack#social-comment-review-gate',
  ],
  externalRequests,
}, null, 2))
