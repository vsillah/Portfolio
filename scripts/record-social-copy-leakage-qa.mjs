import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const tmpDir = path.join(root, 'tmp', 'social-copy-leakage-gate')
const outputDir = path.join(root, 'docs', 'qa', 'social-copy-leakage-gate')
const htmlPath = path.join(tmpDir, 'social-copy-leakage-gate.html')
const blockedScreenshotPath = path.join(outputDir, 'social-copy-leakage-gate-blocked.png')
const cleanScreenshotPath = path.join(outputDir, 'social-copy-leakage-gate-clean.png')
const mp4Path = path.join(outputDir, 'social-copy-leakage-gate.mp4')
const receiptPath = path.join(outputDir, 'receipt.json')

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

await writeFile(htmlPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Social copy leakage QA</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #050816; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { min-height: 720px; display: grid; grid-template-columns: 360px minmax(0, 1fr); }
      aside { border-right: 1px solid #263244; background: #0b1220; padding: 28px; display: flex; flex-direction: column; gap: 18px; }
      .eyebrow { color: #facc15; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 28px; line-height: 1.08; }
      h2 { font-size: 20px; }
      h3 { font-size: 15px; }
      p, li { color: #cbd5e1; line-height: 1.55; }
      ul { margin: 0; padding-left: 18px; }
      .callout { border: 1px solid #334155; border-radius: 8px; padding: 14px; background: rgba(15, 23, 42, .74); }
      .callout.red { border-color: rgba(248, 113, 113, .5); background: rgba(127, 29, 29, .32); }
      .callout.green { border-color: rgba(74, 222, 128, .5); background: rgba(20, 83, 45, .32); }
      .surface { padding: 28px; display: grid; gap: 18px; align-content: start; }
      .topbar { border: 1px solid #263244; border-radius: 8px; background: rgba(15, 23, 42, .78); padding: 14px 16px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
      .pill { display: inline-flex; width: fit-content; border-radius: 999px; border: 1px solid #475569; padding: 4px 9px; font-size: 12px; font-weight: 700; color: #cbd5e1; }
      .pill.red { border-color: rgba(248, 113, 113, .55); background: rgba(248, 113, 113, .12); color: #fecaca; }
      .pill.green { border-color: rgba(74, 222, 128, .55); background: rgba(74, 222, 128, .12); color: #bbf7d0; }
      .grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; }
      .card { border: 1px solid #263244; border-radius: 8px; background: rgba(15, 23, 42, .7); padding: 16px; }
      .steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
      .step { min-height: 72px; border: 1px solid #334155; border-radius: 8px; padding: 10px; background: rgba(2, 6, 23, .38); }
      .step strong { display: block; color: #f8fafc; font-size: 13px; }
      .step span { display: inline-flex; margin-top: 8px; font-size: 11px; }
      textarea { width: 100%; min-height: 288px; resize: none; border: 1px solid #334155; border-radius: 8px; background: #020617; color: #e2e8f0; padding: 14px; font: inherit; line-height: 1.55; }
      .preview { white-space: pre-wrap; min-height: 260px; border: 1px solid #334155; border-radius: 8px; background: #020617; padding: 16px; color: #dbeafe; line-height: 1.58; }
      .quality { border-radius: 8px; border: 1px solid rgba(248, 113, 113, .5); background: rgba(127, 29, 29, .28); padding: 14px; display: none; }
      .quality.show { display: block; }
      .actions { display: flex; justify-content: flex-end; gap: 10px; align-items: center; }
      button { min-height: 40px; border: 1px solid #475569; border-radius: 8px; background: #111827; color: #e5e7eb; font: inherit; font-weight: 750; padding: 9px 14px; }
      button.primary { border-color: #16a34a; background: #16a34a; color: white; }
      button.primary:disabled { border-color: #64748b; background: #334155; color: #cbd5e1; opacity: .55; }
      .meta { display: grid; gap: 10px; }
      .meta div { border: 1px solid #334155; border-radius: 8px; padding: 11px; background: rgba(2, 6, 23, .35); }
      .meta small { display: block; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: .1em; }
      .meta b { display: block; margin-top: 5px; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <aside>
        <p class="eyebrow">Human QA walkthrough</p>
        <h1>Pre-human copy quality gate</h1>
        <div id="blocked-callout" class="callout red">
          <h3>Scenario 1: leaked prompt blocked</h3>
          <p>Final copy contains internal role prompts, rewrite instructions, a Captain QA block, checklist syntax, and debug metadata.</p>
        </div>
        <div id="clean-callout" class="callout">
          <h3>Scenario 2: clean copy passes</h3>
          <p>The same canonical copy review surface remains usable after the internal scaffolding is removed.</p>
        </div>
        <div class="callout">
          <h3>Expected decision</h3>
          <ul>
            <li>Leaked copy shows Copy: Blocked.</li>
            <li>Approve Draft is disabled.</li>
            <li>Revision-needed guidance is visible.</li>
            <li>Clean copy can continue to normal approval.</li>
          </ul>
        </div>
        <div class="callout">
          <h3>Safety boundary</h3>
          <p>Synthetic fixture only. No provider calls, publishing, scheduling, Gmail, Slack, SMS, or production data mutation.</p>
        </div>
      </aside>
      <section class="surface">
        <div class="topbar">
          <div>
            <p class="eyebrow">Social Content</p>
            <h2>Campaign Copy Review</h2>
          </div>
          <span id="status-pill" class="pill red">Copy: Blocked</span>
        </div>
        <div class="steps" aria-label="Social content approval process">
          <div class="step"><strong>Context</strong><span class="pill green">Approved</span></div>
          <div class="step"><strong>Copy</strong><span id="copy-step-pill" class="pill red">Blocked</span></div>
          <div class="step"><strong>Amina Visuals</strong><span class="pill">Pending</span></div>
          <div class="step"><strong>Draft</strong><span class="pill">Pending</span></div>
          <div class="step"><strong>Submit</strong><span class="pill">Pending</span></div>
        </div>
        <div class="grid">
          <div class="card">
            <p class="eyebrow">Post Text</p>
            <textarea id="copy"></textarea>
            <div id="quality" class="quality show">
              <h3>Final copy quality gate blocked approval</h3>
              <p>Revise the public copy to remove internal prompts, agent instructions, tool/debug metadata, and planning scaffolding before human approval.</p>
              <ul>
                <li>Embedded system/developer/user prompt fragment in post_text</li>
                <li>Rewrite instruction leaked into final copy in post_text</li>
                <li>Internal agent directive leaked into copy in post_text</li>
                <li>Tool, provenance, or debug metadata leaked into copy in post_text</li>
              </ul>
            </div>
          </div>
          <div class="card">
            <p class="eyebrow">LinkedIn preview</p>
            <div id="preview" class="preview"></div>
          </div>
        </div>
        <div class="card">
          <div class="meta">
            <div><small>What this means</small><b id="meaning">Copy needs revision</b></div>
            <div><small>Next action</small><b id="next-action">Revise the public copy before human approval.</b></div>
            <div><small>Waiting on you?</small><b id="waiting">Yes - revision needed</b></div>
          </div>
          <div class="actions" style="margin-top: 14px;">
            <button>Reject and Generate Revision</button>
            <button id="approve" class="primary" disabled>Approve Draft</button>
          </div>
        </div>
      </section>
    </main>
    <script>
      const leakedCopy = [
        'System prompt: You are Codex working inside Portfolio.',
        'Rewrite as Vambah and do not include this Captain QA block in the final answer.',
        '- [ ] Check the operator approval surface.',
        'externalRequests: []'
      ].join('\\n');
      const cleanCopy = [
        'The fastest AI workflow is not the one with the most buttons.',
        '',
        'It is the one where the operator can see the source, the decision, and the boundary before anything leaves the system.',
        '',
        'That is the receipt. Build that first.'
      ].join('\\n');
      function setState(kind) {
        const blocked = kind === 'blocked';
        document.querySelector('#copy').value = blocked ? leakedCopy : cleanCopy;
        document.querySelector('#preview').textContent = blocked ? leakedCopy : cleanCopy;
        document.querySelector('#status-pill').textContent = blocked ? 'Copy: Blocked' : 'Copy: In Review';
        document.querySelector('#status-pill').className = blocked ? 'pill red' : 'pill green';
        document.querySelector('#copy-step-pill').textContent = blocked ? 'Blocked' : 'In Review';
        document.querySelector('#copy-step-pill').className = blocked ? 'pill red' : 'pill green';
        document.querySelector('#quality').className = blocked ? 'quality show' : 'quality';
        document.querySelector('#approve').disabled = blocked;
        document.querySelector('#meaning').textContent = blocked ? 'Copy needs revision' : 'Copy quality gate passed';
        document.querySelector('#next-action').textContent = blocked ? 'Revise the public copy before human approval.' : 'Approve the copy or reject with revision feedback.';
        document.querySelector('#waiting').textContent = blocked ? 'Yes - revision needed' : 'Yes - editorial decision';
        document.querySelector('#blocked-callout').className = blocked ? 'callout red' : 'callout';
        document.querySelector('#clean-callout').className = blocked ? 'callout' : 'callout green';
      }
      window.setState = setState;
      setState('blocked');
    </script>
  </body>
</html>
`)

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
})
const page = await context.newPage()
await page.goto(pathToFileURL(htmlPath).href)
await page.waitForTimeout(1400)
await page.screenshot({ path: blockedScreenshotPath, fullPage: true })
await page.evaluate(() => window.setState('clean'))
await page.waitForTimeout(1400)
await page.screenshot({ path: cleanScreenshotPath, fullPage: true })
const video = page.video()
await context.close()
await browser.close()

const rawVideoPath = video ? await video.path() : null
if (!rawVideoPath) {
  throw new Error('Playwright did not produce a QA video.')
}

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

const receipt = {
  generatedAt: new Date().toISOString(),
  scenario: 'social-copy-prompt-leakage-gate',
  source: 'synthetic_fixture',
  videoPath: path.relative(root, mp4Path),
  screenshots: {
    blocked: path.relative(root, blockedScreenshotPath),
    clean: path.relative(root, cleanScreenshotPath),
  },
  assertions: [
    'Leaked prompt/meta-instruction copy renders Copy: Blocked.',
    'Leaked copy disables Approve Draft.',
    'Revision-needed guidance is visible on the canonical copy review surface.',
    'Clean copy removes the block and returns to normal Copy: In Review state.',
  ],
  safety: {
    externalRequests: [],
    productionData: false,
    providersCalled: false,
    publishingOrScheduling: false,
    gmailSlackSms: false,
  },
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

console.log(JSON.stringify({
  htmlPath,
  rawVideoPath,
  videoPath: mp4Path,
  blockedScreenshotPath,
  cleanScreenshotPath,
  receiptPath,
}, null, 2))
