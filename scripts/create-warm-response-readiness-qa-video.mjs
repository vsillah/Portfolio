import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, copyFile, writeFile } from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const sourceFrameDir = path.join(root, 'test-results', 'warm-slack-send-approval-qa', 'frames')
const qaDir = path.join(root, 'test-results', 'warm-response-readiness-qa')
const compositeFrameDir = path.join(qaDir, 'frames')
const responseReadinessCropPath = path.join(compositeFrameDir, '00-source-response-capture-crop.png')

const renamedScreenshots = [
  [
    path.join(outputDir, 'warm-slack-send-approval-mobile-360.png'),
    path.join(outputDir, 'warm-response-readiness-mobile-360.png'),
  ],
  [
    path.join(outputDir, 'warm-slack-send-approval-mobile.png'),
    path.join(outputDir, 'warm-response-readiness-mobile-390.png'),
  ],
  [
    path.join(outputDir, 'warm-slack-send-approval-mobile-430.png'),
    path.join(outputDir, 'warm-response-readiness-mobile-430.png'),
  ],
  [
    path.join(outputDir, 'warm-slack-send-approval-desktop.png'),
    path.join(outputDir, 'warm-response-readiness-desktop.png'),
  ],
  [
    path.join(outputDir, 'warm-slack-send-approval-contact-mobile-390.png'),
    path.join(outputDir, 'warm-response-readiness-contact-mobile-390.png'),
  ],
  [
    path.join(outputDir, 'warm-slack-send-approval-contact-desktop.png'),
    path.join(outputDir, 'warm-response-readiness-contact-desktop.png'),
  ],
]

const frames = [
  {
    source: responseReadinessCropPath,
    output: path.join(compositeFrameDir, '01-response-capture-readiness.png'),
    durationSeconds: 3,
    title: 'Response Capture Readiness',
    body:
      'Existing contact workroom. Provider-assisted response metadata is visible, but polling, imports, Slack dispatch, Gmail drafts, and sends are off.',
    gate: 'Decision gate: human review before any reply, task, or suppression action.',
  },
  {
    source: path.join(sourceFrameDir, '02-real-recipient-rollout.png'),
    output: path.join(compositeFrameDir, '02-classification-and-actions.png'),
    durationSeconds: 3,
    title: 'Classification And Actions',
    body:
      'Supported classes include interested, question, referral, objection, not now, unsubscribe or do-not-contact, negative or sensitive, and ambiguous.',
    gate: 'Decision gate: approve, reject, revise, or capture only as Portfolio records.',
  },
  {
    source: path.join(sourceFrameDir, '03-provider-readiness-summary.png'),
    output: path.join(compositeFrameDir, '03-provider-metadata-only.png'),
    durationSeconds: 3,
    title: 'Provider Metadata Only',
    body:
      'Gmail and LinkedIn can show metadata readiness. Facebook and phone remain manual. No provider capability is activated here.',
    gate: 'Expected result: provider rows stay blocked, manual, or readiness-only.',
  },
  {
    source: path.join(sourceFrameDir, '04-disabled-execution-gate-details.png'),
    output: path.join(compositeFrameDir, '04-external-actions-blocked.png'),
    durationSeconds: 3,
    title: 'External Actions Blocked',
    body:
      'The workroom keeps Slack, Gmail send, Gmail draft creation, scheduling, provider polling, n8n, and external monitoring disabled.',
    gate: 'Expected result: no live external request is made.',
  },
  {
    source: path.join(sourceFrameDir, '05-inert-approval-request-receipt.png'),
    output: path.join(compositeFrameDir, '05-human-qa-boundary.png'),
    durationSeconds: 3,
    title: 'Human QA Boundary',
    body:
      'The visible action records local intent in QA mode. It does not post Slack or send Gmail. Suppression changes remain proposals.',
    gate: 'Decision gate: captain review and Vambah human QA before any future execution lane.',
  },
]

const mp4Path = path.join(outputDir, 'warm-response-readiness-mobile.mp4')
const concatListPath = path.join(qaDir, 'warm-response-readiness-frames.txt')

await mkdir(outputDir, { recursive: true })
await mkdir(qaDir, { recursive: true })
await mkdir(compositeFrameDir, { recursive: true })

for (const [from, to] of renamedScreenshots) {
  await copyFile(from, to)
}

await execFileAsync('ffmpeg', [
  '-y',
  '-i',
  path.join(outputDir, 'warm-response-readiness-mobile-390.png'),
  '-vf',
  'crop=390:844:0:2650',
  '-frames:v',
  '1',
  '-update',
  '1',
  responseReadinessCropPath,
])

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function frameHtml(frame) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: 1280px;
        height: 720px;
        overflow: hidden;
        background: #05070d;
        color: #f8fafc;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main { display: grid; grid-template-columns: 410px 1fr; width: 1280px; height: 720px; }
      aside {
        padding: 40px 32px;
        background: #0b1220;
        border-right: 1px solid rgba(148, 163, 184, .24);
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 18px;
      }
      .eyebrow {
        color: #93c5fd;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      h1 { margin: 0; font-size: 36px; line-height: 1.08; letter-spacing: 0; }
      p { margin: 0; color: #cbd5e1; font-size: 22px; line-height: 1.36; letter-spacing: 0; }
      .gate {
        border: 1px solid rgba(251, 191, 36, .45);
        background: rgba(146, 64, 14, .24);
        border-radius: 8px;
        padding: 14px;
        color: #fde68a;
        font-size: 19px;
        line-height: 1.35;
      }
      .flags { display: flex; flex-wrap: wrap; gap: 8px; }
      .flag {
        border: 1px solid rgba(16, 185, 129, .35);
        background: rgba(6, 78, 59, .42);
        color: #d1fae5;
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 14px;
        font-weight: 750;
      }
      .screen {
        height: 720px;
        padding: 18px 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #020617;
      }
      img {
        max-width: 820px;
        max-height: 684px;
        border: 1px solid rgba(148, 163, 184, .3);
        border-radius: 8px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, .5);
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <main>
      <aside>
        <div class="eyebrow">Warm Response QA</div>
        <h1>${escapeHtml(frame.title)}</h1>
        <p>${escapeHtml(frame.body)}</p>
        <div class="gate">${escapeHtml(frame.gate)}</div>
        <div class="flags">
          <span class="flag">Gmail off</span>
          <span class="flag">Slack off</span>
          <span class="flag">Providers off</span>
          <span class="flag">Local rows only</span>
        </div>
      </aside>
      <div class="screen">
        <img src="${pathToFileURL(frame.source).href}" alt="Portfolio warm outreach operator screen" />
      </div>
    </main>
  </body>
</html>`
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })

for (const frame of frames) {
  const htmlPath = path.join(qaDir, `${path.basename(frame.output, '.png')}.html`)
  await writeFile(htmlPath, frameHtml(frame), 'utf8')
  await page.goto(pathToFileURL(htmlPath).href)
  await page.screenshot({ path: frame.output })
}

await browser.close()

const escapeForConcat = (value) => value.replace(/'/g, "'\\''")
const concatLines = frames.flatMap((frame) => [
  `file '${escapeForConcat(frame.output)}'`,
  `duration ${frame.durationSeconds}`,
])
concatLines.push(`file '${escapeForConcat(frames[frames.length - 1].output)}'`)
await writeFile(concatListPath, `${concatLines.join('\n')}\n`, 'utf8')

await execFileAsync('ffmpeg', [
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatListPath,
  '-vf',
  'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
  '-r',
  '30',
  '-c:v',
  'libx264',
  '-movflags',
  '+faststart',
  mp4Path,
])

console.log(JSON.stringify({
  videoPath: mp4Path,
  screenshots: renamedScreenshots.map(([, to]) => to),
  compositeFrames: frames.map((frame) => frame.output),
}, null, 2))
