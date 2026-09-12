import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const qaDir = path.join(root, 'test-results', 'warm-gmail-operating-loop-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3064').replace(/\/$/, '')
const contactId = 42
const queueId = 'qa-warm-slack-send-approval-queue-42'
const outreachPath = `/admin/outreach?tab=leads&filter=warm&id=${contactId}&contactId=${contactId}&queueId=${queueId}&qa=warm-slack-send-approval#warm-gmail-operating-loop`
const contactPath = `/admin/contacts/${contactId}?qa=warm-slack-send-approval#warm-response-lifecycle`
const outreachUrl = new URL(outreachPath, baseUrl).toString()
const contactUrl = new URL(contactPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-gmail-operating-loop.mp4')
const receiptPath = path.join(outputDir, 'warm-gmail-operating-loop-qa.json')

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
await mkdir(compositeDir, { recursive: true })

const user = {
  id: 'warm-gmail-loop-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-gmail-loop-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-28T00:00:00.000Z',
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const now = Math.floor(Date.now() / 1000)
const session = {
  access_token: [
    base64Url({ alg: 'none', typ: 'JWT' }),
    base64Url({
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      sub: user.id,
      email: user.email,
      role: 'authenticated',
    }),
    'qa-signature',
  ].join('.'),
  refresh_token: 'qa-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now + 3600,
  user,
}

function authStorageKeys() {
  const urls = [process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://example.supabase.co'].filter(Boolean)
  return [...new Set(urls.map((value) => {
    try {
      return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
    } catch {
      return null
    }
  }).filter(Boolean))]
}

async function seedSession(page) {
  await page.addInitScript(({ keys, storedSession }) => {
    for (const key of keys) window.localStorage.setItem(key, JSON.stringify(storedSession))
  }, { keys: authStorageKeys(), storedSession: session })
}

async function installSafeRoutes(page) {
  await page.route('**/api/user/profile**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ profile: { ...user, role: 'admin', updated_at: user.created_at } }),
  }))
  await page.route(/https:\/\/[^/]+\.supabase\.co\/auth\/v1\/user.*/i, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(user),
  }))
  await page.route('**/api/admin/meetings**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ meetings: [], total: 0 }),
  }))
  await page.route('**/api/admin/value-evidence/workflow-status**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ runs: [] }),
  }))
}

function collectUnexpectedRequests(page) {
  const requests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send)\b/i.test(url.pathname) ||
      /slack\.com|gmail\.com|googleapis\.com|n8n/i.test(url.hostname)
    ) {
      requests.push(request.url())
    }
  })
  return requests
}

async function openQaPage(browser, viewport, targetUrl) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await seedSession(page)
  await installSafeRoutes(page)
  const unexpectedRequests = collectUnexpectedRequests(page)
  const response = await page.goto(targetUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${targetUrl}`)
  }
  if (!page.url().startsWith(baseUrl)) {
    throw new Error(`QA route left the expected local Portfolio host: ${page.url()}`)
  }
  return { context, page, unexpectedRequests }
}

async function viewportEvidence(browser, name, viewport) {
  const qa = await openQaPage(browser, viewport, outreachUrl)
  const loop = qa.page.locator('#warm-gmail-operating-loop').first()
  await loop.waitFor({ timeout: 15_000 })
  await loop.scrollIntoViewIfNeeded()
  const overflow = await qa.page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  const screenshotPath = path.join(outputDir, `warm-gmail-operating-loop-${name}.png`)
  await qa.page.screenshot({ path: screenshotPath, fullPage: true })
  await qa.context.close()
  return {
    name,
    viewport,
    screenshotPath,
    overflow,
    horizontalOverflow: overflow.scrollWidth > overflow.clientWidth,
    unexpectedRequests: qa.unexpectedRequests,
  }
}

const browser = await chromium.launch()
const mobile = await openQaPage(browser, { width: 390, height: 844 }, outreachUrl)
const mobileLoop = mobile.page.locator('#warm-gmail-operating-loop').first()
await mobileLoop.waitFor({ timeout: 15_000 })
await mobileLoop.scrollIntoViewIfNeeded()
const initialLoopPath = path.join(sourceDir, '01-draft-created.png')
await mobileLoop.screenshot({ path: initialLoopPath })

await mobileLoop.getByRole('button', { name: 'Request send approval' }).click()
await mobileLoop.getByText(/QA local Slack approval request recorded/).waitFor({ timeout: 10_000 })
const requestedLoopPath = path.join(sourceDir, '02-approval-requested.png')
await mobileLoop.screenshot({ path: requestedLoopPath })
await mobile.context.close()

const contact = await openQaPage(browser, { width: 390, height: 844 }, contactUrl)
const responseLifecycle = contact.page.locator('#warm-response-lifecycle')
await responseLifecycle.waitFor({ timeout: 15_000 })
await responseLifecycle.scrollIntoViewIfNeeded()
const responseLifecyclePath = path.join(sourceDir, '03-response-lifecycle.png')
await responseLifecycle.screenshot({ path: responseLifecyclePath })
await contact.context.close()

const viewportResults = []
for (const [name, viewport] of [
  ['mobile-360', { width: 360, height: 800 }],
  ['mobile-390', { width: 390, height: 844 }],
  ['mobile-430', { width: 430, height: 932 }],
  ['tablet-768', { width: 768, height: 1024 }],
  ['desktop-1440', { width: 1440, height: 1000 }],
]) {
  viewportResults.push(await viewportEvidence(browser, name, viewport))
}

await browser.close()

const frames = [
  {
    source: initialLoopPath,
    title: 'One governed queue row',
    scenario: 'A tracked Gmail draft is ready for one send-approval review.',
    changed: 'Six stages share one authority model, while the workroom exposes only the current state and one valid next action.',
    expected: 'Draft exists. Approval has not been requested. Gmail send and response polling remain off.',
    gate: 'Next action: request send approval for this exact recipient and message version.',
  },
  {
    source: requestedLoopPath,
    title: 'One review moment',
    scenario: 'The operator records the approval request using inert, synthetic QA evidence.',
    changed: 'The same card advances to Approval requested and replaces the request button with the next decision step.',
    expected: 'No Slack post and no Gmail send. Portfolio records intent only.',
    gate: 'Next action: approve, reject, or request revision before any separate execution gate.',
  },
  {
    source: responseLifecyclePath,
    title: 'Same item after send',
    scenario: 'The contact workroom keeps response handling attached to the existing outreach item.',
    changed: 'Response capture and import readiness remain downstream of sent evidence, not part of draft or send authority.',
    expected: 'Manual capture and dry-run evidence remain available. Live Gmail polling stays disabled.',
    gate: 'Separate gate: future provider reads require explicit current approval.',
  },
]

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function frameHtml(frame) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 1280px; height: 720px; overflow: hidden; background: #020617; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { display: grid; grid-template-columns: 430px 1fr; width: 1280px; height: 720px; }
    aside { display: flex; flex-direction: column; justify-content: center; gap: 17px; padding: 34px; background: #0b1220; border-right: 1px solid rgba(148, 163, 184, .25); }
    .eyebrow, .label { color: #93c5fd; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 35px; line-height: 1.08; }
    p { margin: 4px 0 0; color: #dbeafe; font-size: 18px; line-height: 1.34; }
    .gate { border: 1px solid rgba(251, 191, 36, .45); background: rgba(146, 64, 14, .24); border-radius: 9px; padding: 13px; color: #fde68a; font-size: 18px; line-height: 1.34; }
    .flags { display: flex; flex-wrap: wrap; gap: 7px; }
    .flag { border: 1px solid rgba(16, 185, 129, .35); background: rgba(6, 78, 59, .42); color: #d1fae5; border-radius: 999px; padding: 6px 9px; font-size: 13px; font-weight: 750; }
    .screen { display: flex; align-items: center; justify-content: center; height: 720px; padding: 18px 24px; background: #020617; }
    img { max-width: 790px; max-height: 680px; object-fit: contain; border: 1px solid rgba(148, 163, 184, .32); border-radius: 8px; box-shadow: 0 24px 80px rgba(0, 0, 0, .55); }
  </style>
</head>
<body>
  <main>
    <aside>
      <div class="eyebrow">Warm Gmail Loop QA</div>
      <h1>${escapeHtml(frame.title)}</h1>
      <div><div class="label">Scenario</div><p>${escapeHtml(frame.scenario)}</p></div>
      <div><div class="label">Changed behavior</div><p>${escapeHtml(frame.changed)}</p></div>
      <div><div class="label">Expected result</div><p>${escapeHtml(frame.expected)}</p></div>
      <div class="gate">${escapeHtml(frame.gate)}</div>
      <div class="flags"><span class="flag">Fixture data</span><span class="flag">Gmail off</span><span class="flag">Slack off</span><span class="flag">Polling off</span></div>
    </aside>
    <div class="screen"><img src="${pathToFileURL(frame.source).href}" alt="Portfolio warm Gmail operating loop" /></div>
  </main>
</body>
</html>`
}

const concatPath = path.join(qaDir, 'frames.txt')
const concatLines = []
for (const [index, frame] of frames.entries()) {
  const htmlPath = path.join(compositeDir, `${index + 1}.html`)
  const imagePath = path.join(compositeDir, `${index + 1}.png`)
  await writeFile(htmlPath, frameHtml(frame), 'utf8')
  const renderBrowser = await chromium.launch()
  const page = await renderBrowser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(pathToFileURL(htmlPath).href)
  await page.screenshot({ path: imagePath })
  await renderBrowser.close()
  concatLines.push(`file '${imagePath.replaceAll("'", "'\\''")}'`, 'duration 4')
}
concatLines.push(`file '${path.join(compositeDir, `${frames.length}.png`).replaceAll("'", "'\\''")}'`)
await writeFile(concatPath, `${concatLines.join('\n')}\n`, 'utf8')

await execFileAsync('ffmpeg', [
  '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
  '-r', '30', '-c:v', 'libx264', '-movflags', '+faststart', mp4Path,
])

const unexpectedRequests = [
  ...mobile.unexpectedRequests,
  ...contact.unexpectedRequests,
  ...viewportResults.flatMap((result) => result.unexpectedRequests),
]
const receipt = {
  version: 'warm-gmail-operating-loop-qa/v1',
  generatedAt: new Date().toISOString(),
  routes: { outreachUrl, contactUrl },
  fixture: 'warm-slack-send-approval',
  syntheticContactId: contactId,
  syntheticQueueId: queueId,
  viewports: viewportResults,
  unexpectedRequests,
  executionBoundary: {
    gmailDraftCreated: false,
    gmailSendCalled: false,
    slackDispatched: false,
    n8nCalled: false,
    responsePollingEnabled: false,
    providerReads: false,
  },
  videoPath: mp4Path,
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')

if (viewportResults.some((result) => result.horizontalOverflow)) {
  throw new Error('Warm Gmail operating loop has horizontal overflow at one or more QA widths.')
}
if (unexpectedRequests.length > 0) {
  throw new Error(`Warm Gmail operating loop QA observed unexpected external requests: ${unexpectedRequests.join(', ')}`)
}

console.log(JSON.stringify(receipt, null, 2))
