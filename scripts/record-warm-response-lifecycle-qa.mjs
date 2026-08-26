import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'warm-response-lifecycle-qa')
const outputDir = path.join(root, 'test-results', 'warm-response-lifecycle-qa')
const htmlPath = path.join(tmpDir, 'contact-workroom.html')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm response lifecycle QA</title>
    <style>
      body { margin: 0; background: #030712; color: #f9fafb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 48px; }
      section { border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; background: rgba(17, 24, 39, 0.72); }
      header { border-bottom: 1px solid #1f2937; padding: 16px 20px; }
      h1, h2, p { margin: 0; }
      h1 { font-size: 24px; margin-bottom: 16px; }
      h2 { font-size: 16px; display: flex; gap: 8px; align-items: center; }
      .muted { color: #9ca3af; font-size: 12px; line-height: 1.55; margin-top: 6px; }
      .body { padding: 16px 20px; display: grid; gap: 16px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      label { display: grid; gap: 5px; }
      .label { color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      select, textarea { border: 1px solid #374151; border-radius: 8px; background: #020617; color: white; font: inherit; font-size: 14px; padding: 10px 12px; }
      textarea { min-height: 120px; resize: vertical; line-height: 1.5; }
      button { border: 0; border-radius: 8px; background: #0284c7; color: white; font-weight: 700; min-height: 40px; padding: 10px 16px; }
      button:disabled { opacity: .45; }
      .row { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
      .notice { border: 1px solid #065f46; background: rgba(6, 78, 59, .32); color: #d1fae5; padding: 12px; border-radius: 8px; font-size: 14px; display: none; line-height: 1.5; }
      .list-head { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 700; padding: 4px 0; }
      .item { border-top: 1px solid rgba(31, 41, 55, .9); padding: 12px 0; }
      .item:first-of-type { border-top: 0; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
      .chip { border: 1px solid #374151; border-radius: 999px; padding: 3px 7px; color: #d1d5db; font-size: 11px; }
      .chip.qa { border-color: #92400e; background: rgba(120, 53, 15, .35); color: #fde68a; }
      .sequence { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 10px; }
      .step-title { color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .step-copy { color: #f9fafb; font-size: 12px; line-height: 1.45; margin-top: 4px; }
      .step-copy.muted-step { color: #d1d5db; }
      .recovery { color: #9ca3af; font-size: 12px; line-height: 1.5; margin-top: 10px; }
      @media (max-width: 640px) {
        main { padding: 16px 10px 32px; }
        .grid { grid-template-columns: 1fr; }
        .sequence { grid-template-columns: 1fr; }
        header, .body { padding-left: 14px; padding-right: 14px; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Contact Workroom: synthetic warm lead</h1>
      <section>
        <header>
          <h2>Warm response lifecycle</h2>
          <p class="muted">Capture a manual or approved warm reply, classify it, create a local reply draft, and expose the human-gated follow-up or suppression path. No provider monitoring, Gmail draft, DM, Slack, or send action runs here.</p>
        </header>
        <div class="body">
          <div class="grid">
            <label>
              <span class="label">Response channel</span>
              <select id="channel">
                <option>Email</option>
                <option selected>LinkedIn</option>
                <option>Facebook / manual</option>
                <option>Phone / manual</option>
              </select>
            </label>
            <label>
              <span class="label">Linked outreach draft</span>
              <select id="queue">
                <option>No queue row selected</option>
                <option selected>linkedin · Warm LinkedIn Outreach · draft</option>
              </select>
            </label>
          </div>
          <label>
            <span class="label">Captured response</span>
            <textarea id="response" placeholder="Paste or summarize the response Vambah received. Keep private source details summarized when possible."></textarea>
          </label>
          <div class="row">
            <p class="muted">Reply drafts and next-touch decisions stay pending human QA. External execution remains blocked.</p>
            <button id="capture" disabled>Capture response</button>
          </div>
          <div id="notice" class="notice">Captured as interest. Review short next-step reply. Pending: human reply approval. Local reply draft created. Follow-up task: task-synthetic-1.</div>
          <div class="list">
            <div class="list-head">
              <span>Recent response sequences</span>
              <button id="refresh" type="button" style="min-height:28px;padding:5px 9px;background:#111827;border:1px solid #374151;">Refresh</button>
            </div>
            <div id="empty" class="item"><p class="muted">No warm responses captured yet.</p></div>
            <div id="created" class="item" style="display:none">
              <div class="chips"><span class="chip">replied</span><span class="chip">interest</span><span class="chip qa">Human QA</span><span class="chip">linkedin · now</span></div>
              <div class="sequence">
                <div><p class="step-title">Captured response</p><p class="step-copy muted-step">Interested in talking next week. Can we schedule a short conversation?</p></div>
                <div><p class="step-title">Classification</p><p class="step-copy">interest</p></div>
                <div><p class="step-title">Recommended next action</p><p class="step-copy">Review short next-step reply</p></div>
                <div><p class="step-title">Local draft</p><p class="step-copy muted-step">Draft reply: interest</p></div>
                <div><p class="step-title">Approval boundary</p><p class="step-copy">Pending: human reply approval</p></div>
              </div>
              <p class="recovery">Recovery path: approve the local draft in the contact workroom, then use the separately approved outbound channel.</p>
            </div>
            <div id="suppressed" class="item" style="display:none">
              <div class="chips"><span class="chip">replied</span><span class="chip">unsubscribe suppression</span><span class="chip qa">Human QA</span><span class="chip">email · now</span></div>
              <div class="sequence">
                <div><p class="step-title">Captured response</p><p class="step-copy muted-step">Please unsubscribe me and do not contact me again.</p></div>
                <div><p class="step-title">Classification</p><p class="step-copy">unsubscribe suppression</p></div>
                <div><p class="step-title">Recommended next action</p><p class="step-copy">Review suppression update</p></div>
                <div><p class="step-title">Local draft</p><p class="step-copy muted-step">Draft reply: unsubscribe suppression</p></div>
                <div><p class="step-title">Approval boundary</p><p class="step-copy">Blocked: suppression review required</p></div>
              </div>
              <p class="recovery">Recovery path: open the relationship packet suppression state, confirm local evidence, then approve suppression or explicitly clear the blocker before any next step.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    <script>
      const textarea = document.querySelector('#response');
      const button = document.querySelector('#capture');
      textarea.addEventListener('input', () => { button.disabled = textarea.value.trim().length === 0; });
      button.addEventListener('click', () => {
        const text = textarea.value.toLowerCase();
        document.querySelector('#notice').style.display = 'block';
        document.querySelector('#empty').style.display = 'none';
        if (text.includes('unsubscribe') || text.includes('do not contact')) {
          document.querySelector('#notice').textContent = 'Captured as unsubscribe suppression. Blocked: suppression review required. No external action or provider monitoring is enabled.';
          document.querySelector('#suppressed').style.display = 'block';
        } else {
          document.querySelector('#notice').textContent = 'Captured as interest. Review short next-step reply. Pending: human reply approval. Local reply draft created. Follow-up task: task-synthetic-1.';
          document.querySelector('#created').style.display = 'block';
        }
      });
    </script>
  </body>
</html>
`)

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: outputDir, size: { width: 390, height: 844 } },
})
const page = await context.newPage()
await page.goto(pathToFileURL(htmlPath).href)
await page.locator('#response').fill('Interested in talking next week. Can we schedule a short conversation?')
await page.locator('#capture').click()
await page.waitForTimeout(450)
await page.locator('#channel').selectOption({ label: 'Email' })
await page.locator('#queue').selectOption({ label: 'No queue row selected' })
await page.locator('#response').fill('Please unsubscribe me and do not contact me again.')
await page.locator('#capture').click()
await page.waitForTimeout(900)
await page.screenshot({ path: path.join(outputDir, 'mobile-captured-response.png'), fullPage: true })
const video = page.video()
await context.close()
await browser.close()
const rawVideoPath = video ? await video.path() : null
const mp4Path = path.join(outputDir, 'warm-response-reply-followup-gates-mobile.mp4')

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
  screenshotPath: path.join(outputDir, 'mobile-captured-response.png'),
  rawVideoPath,
  videoPath: rawVideoPath ? mp4Path : null,
}, null, 2))
