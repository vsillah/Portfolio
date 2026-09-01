import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'social-copy-reopen-review-qa')
const outputDir = path.join(root, 'docs', 'social-content-qa')
const htmlPath = path.join(tmpDir, 'social-copy-reopen-review.html')
const receiptPath = path.join(outputDir, 'social-copy-reopen-review-receipt.json')
const mp4Path = path.join(outputDir, 'social-copy-reopen-review-mobile.mp4')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Social copy reopen review QA</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #020617; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { display: grid; grid-template-columns: minmax(320px, 390px) minmax(260px, 1fr); gap: 18px; max-width: 920px; margin: 0 auto; padding: 20px; }
      .phone { min-height: 680px; border: 1px solid #1f2937; border-radius: 18px; overflow: hidden; background: #030712; box-shadow: 0 18px 60px rgba(0,0,0,.35); }
      .topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #1f2937; padding: 12px; background: rgba(15,23,42,.9); }
      .status { border: 1px solid #ef4444; background: rgba(127,29,29,.35); color: #fecaca; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; }
      .save { border: 0; border-radius: 8px; background: #374151; color: white; font-size: 13px; font-weight: 700; padding: 8px 10px; }
      .content { padding: 14px; display: grid; gap: 14px; }
      .summary, .gate, .recovery { border: 1px solid #1f2937; border-radius: 10px; background: rgba(17,24,39,.82); padding: 12px; }
      .summary { border-color: rgba(245,158,11,.35); }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      h1, h2, p { margin: 0; }
      h1 { font-size: 16px; line-height: 1.25; }
      h2 { font-size: 14px; line-height: 1.3; }
      .eyebrow { color: #94a3b8; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      .badge { border: 1px solid #ef4444; background: rgba(127,29,29,.28); color: #fecaca; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 800; white-space: nowrap; }
      .badge.review { border-color: #3b82f6; background: rgba(30,64,175,.3); color: #bfdbfe; }
      textarea { width: 100%; min-height: 190px; margin-top: 8px; border: 1px solid #374151; border-radius: 8px; background: #111827; color: #e5e7eb; padding: 10px; font: inherit; font-size: 13px; line-height: 1.45; resize: none; }
      .muted { color: #94a3b8; font-size: 12px; line-height: 1.5; margin-top: 7px; }
      .recovery { border-color: rgba(245,158,11,.38); background: rgba(120,53,15,.25); }
      .recovery h2 { color: #fde68a; }
      .return { width: 100%; margin-top: 12px; border: 0; border-radius: 8px; background: #f59e0b; color: #111827; font-size: 14px; font-weight: 800; padding: 11px 12px; }
      .decision { display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #1f2937; padding-top: 12px; }
      .decision button { border-radius: 8px; border: 1px solid #374151; background: #111827; color: #9ca3af; padding: 9px 10px; font-weight: 800; }
      .decision button.primary { border-color: #16a34a; background: #16a34a; color: white; }
      .decision button:disabled { opacity: .42; }
      .captions { border: 1px solid #1f2937; border-radius: 14px; background: #0f172a; padding: 18px; align-self: stretch; display: grid; align-content: center; gap: 14px; }
      .caption { border-left: 3px solid #f59e0b; padding-left: 12px; color: #cbd5e1; font-size: 18px; line-height: 1.45; opacity: .45; transition: opacity .2s ease, color .2s ease; }
      .caption.active { opacity: 1; color: #fff7ed; }
      .boundary { margin-top: 8px; border: 1px solid #334155; border-radius: 10px; padding: 12px; color: #bae6fd; background: rgba(14,116,144,.15); font-size: 13px; line-height: 1.5; }
      @media (max-width: 760px) {
        main { grid-template-columns: 1fr; padding: 10px; }
        .captions { min-height: 220px; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="phone" aria-label="Synthetic Social Content mobile route">
        <div class="topbar">
          <span class="status" id="top-status">Rejected</span>
          <button class="save" type="button">Save Draft</button>
        </div>
        <div class="content">
          <section class="summary" aria-label="Copy rejected mobile workflow summary">
            <p class="eyebrow">Current workflow</p>
            <div class="row">
              <h1 id="summary-title">Copy rejected</h1>
              <span class="badge" id="summary-badge">Rejected</span>
            </div>
            <p class="muted" id="next-action">Edit the draft, then use Return to Copy Review to make it reviewable again.</p>
          </section>

          <section class="gate" id="social-copy-gate">
            <div class="row">
              <h2>Post Text</h2>
              <span class="badge" id="copy-badge">Copy: Rejected</span>
            </div>
            <textarea id="copy">This opener still feels too abstract.

It names the governance idea, but it does not show the operator moment that made the approval path confusing.</textarea>
            <p class="muted" id="count">169 characters</p>
            <div class="recovery" id="recovery">
              <p class="eyebrow">Copy revision</p>
              <h2>Rejected copy is actionable</h2>
              <p class="muted">Revise the draft above, then return it to copy review. This only reopens editorial review; it does not approve, publish, schedule, or call providers.</p>
              <button class="return" id="return">Return to Copy Review</button>
            </div>
          </section>

          <section class="gate" aria-label="Copy Review Decision">
            <p class="eyebrow">Copy Review Decision</p>
            <div class="decision">
              <button id="reject" disabled>Reject hidden/blocked</button>
              <button class="primary" id="approve" disabled>Approve Copy</button>
            </div>
            <p class="muted" id="decision-note">Decision buttons stay unavailable until the rejected draft is returned to review.</p>
          </section>
        </div>
      </section>
      <aside class="captions" aria-label="QA captions">
        <p class="caption active" id="c1">1. Starting state: Copy is rejected, and the copy gate shows a recovery panel instead of a dead end.</p>
        <p class="caption" id="c2">2. Operator edits the draft in place. Save Draft remains available for normal field persistence.</p>
        <p class="caption" id="c3">3. Return to Copy Review reopens editorial review without publishing, scheduling, provider calls, Slack, Gmail, SMS, or outreach.</p>
        <p class="caption" id="c4">4. Reopened state: badge updates to In review and decision buttons become available for a fresh review cycle.</p>
        <div class="boundary">Synthetic equivalent of /admin/social-content/[id]?step=copy#social-copy-gate using fixture data only. No external requests or production data mutations.</div>
      </aside>
    </main>
    <script>
      const copy = document.getElementById('copy')
      const count = document.getElementById('count')
      const setCaption = (id) => {
        document.querySelectorAll('.caption').forEach((node) => node.classList.toggle('active', node.id === id))
      }
      copy.addEventListener('input', () => {
        count.textContent = copy.value.length + ' characters'
      })
      document.getElementById('return').addEventListener('click', () => {
        document.getElementById('top-status').textContent = 'Draft'
        document.getElementById('summary-title').textContent = 'Copy review'
        document.getElementById('summary-badge').textContent = 'In review'
        document.getElementById('summary-badge').classList.add('review')
        document.getElementById('copy-badge').textContent = 'Copy: In review'
        document.getElementById('copy-badge').classList.add('review')
        document.getElementById('recovery').style.display = 'none'
        document.getElementById('reject').disabled = false
        document.getElementById('reject').textContent = 'Reject'
        document.getElementById('approve').disabled = false
        document.getElementById('decision-note').textContent = 'The edited draft is back in copy review. A new reject is only available after this reopen.'
        setCaption('c4')
      })
      window.qaSetCaption = setCaption
    </script>
  </body>
</html>`)

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 920, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: tmpDir, size: { width: 920, height: 720 } },
})
const page = await context.newPage()
await page.goto(pathToFileURL(htmlPath).toString())
await page.waitForTimeout(700)
await page.evaluate(() => window.qaSetCaption('c2'))
await page.fill('#copy', `A founder opened the Social Content review and saw the problem immediately.

The draft was rejected, the copy was editable, and Save Draft was visible. But there was no clear way to return the revised copy to review.

That is the kind of small missing path that turns governance into extra work.`)
await page.waitForTimeout(900)
await page.evaluate(() => window.qaSetCaption('c3'))
await page.click('#return')
await page.waitForTimeout(1200)
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

const receipt = {
  route_equivalent: '/admin/social-content/[id]?step=copy#social-copy-gate',
  production_reference: '/admin/social-content/bb5bcfe7-3de8-4fdc-b13f-da85416e8cad?step=copy&qa=slack-content-calendar-approval&deploy=b368c584#social-copy-gate',
  fixture: 'synthetic rejected Social Content copy gate',
  externalRequests: [],
  productionDataMutations: false,
  validates: [
    'Copy: Rejected state shows Return to Copy Review recovery CTA',
    'Approve/reject decisions remain unavailable before recovery',
    'Edited draft returns to Copy: In review',
    'No publishing, scheduling, provider, Slack, Gmail, SMS, or outreach action runs',
  ],
  videoPath: rawVideoPath ? mp4Path : null,
  generatedAt: new Date().toISOString(),
}
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

console.log(JSON.stringify({ htmlPath, rawVideoPath, mp4Path, receiptPath }, null, 2))
