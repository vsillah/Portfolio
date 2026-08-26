import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

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
      .list { border: 1px solid #1f2937; border-radius: 8px; background: rgba(2, 6, 23, .45); overflow: hidden; }
      .list-head, .item { padding: 10px 12px; }
      .list-head { border-bottom: 1px solid #1f2937; font-size: 14px; font-weight: 700; }
      .item { border-top: 1px solid rgba(31, 41, 55, .7); }
      .item:first-of-type { border-top: 0; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
      .chip { border: 1px solid #374151; border-radius: 999px; padding: 3px 7px; color: #d1d5db; font-size: 11px; }
      .chip.qa { border-color: #92400e; background: rgba(120, 53, 15, .35); color: #fde68a; }
      @media (max-width: 640px) {
        main { padding: 16px 10px 32px; }
        .grid { grid-template-columns: 1fr; }
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
          <div id="notice" class="notice">Captured as interested. Local reply draft created. Follow-up task: task-synthetic-1.</div>
          <div class="list">
            <div class="list-head">Recent lifecycle rows</div>
            <div id="empty" class="item"><p class="muted">No warm responses captured yet.</p></div>
            <div id="created" class="item" style="display:none">
              <div class="chips"><span class="chip">replied</span><span class="chip">interested</span><span class="chip qa">Human QA</span><span class="chip">inbound · linkedin</span></div>
              <p>Warm outreach response: interested</p>
              <p class="muted">Interested in talking next week. Can we schedule a short conversation?</p>
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
        document.querySelector('#notice').style.display = 'block';
        document.querySelector('#empty').style.display = 'none';
        document.querySelector('#created').style.display = 'block';
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
await page.waitForTimeout(900)
await page.screenshot({ path: path.join(outputDir, 'mobile-captured-response.png'), fullPage: true })
const video = page.video()
await context.close()
await browser.close()
const videoPath = video ? await video.path() : null

console.log(JSON.stringify({
  htmlPath,
  screenshotPath: path.join(outputDir, 'mobile-captured-response.png'),
  videoPath,
}, null, 2))
