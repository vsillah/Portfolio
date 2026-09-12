import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { config as loadEnv } from 'dotenv'

const execFileAsync = promisify(execFile)
const root = process.cwd()
loadEnv({ path: path.join(root, '.env.local'), quiet: true })

const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const qaDir = path.join(root, 'test-results', 'warm-response-digest-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3064').replace(/\/$/, '')
const qaPath = '/admin/outreach?tab=leads&filter=warm&id=42&contactId=42&qa=warm-slack-send-approval'
const qaUrl = new URL(qaPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-response-digest-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-response-digest-qa.json')

const screenshots = {
  mobile360: path.join(outputDir, 'warm-response-digest-mobile-360.png'),
  mobile390: path.join(outputDir, 'warm-response-digest-mobile-390.png'),
  mobile430: path.join(outputDir, 'warm-response-digest-mobile-430.png'),
  desktop: path.join(outputDir, 'warm-response-digest-desktop-1440.png'),
  workroom: path.join(outputDir, 'warm-response-digest-workroom-desktop.png'),
}

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
await mkdir(compositeDir, { recursive: true })

const user = {
  id: 'warm-response-digest-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-response-digest-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-02T00:00:00.000Z',
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
  return [
    ...new Set([
      'sb-127-auth-token',
      ...urls
        .map((value) => {
          try {
            return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
          } catch {
            return null
          }
        })
        .filter(Boolean),
    ]),
  ]
}

async function seedSession(page) {
  await page.addInitScript(({ keys, storedSession }) => {
    for (const key of keys) window.localStorage.setItem(key, JSON.stringify(storedSession))
  }, { keys: authStorageKeys(), storedSession: session })
}

async function installSafeRoutes(page, externalRequests) {
  const localOrigin = new URL(baseUrl).origin
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const localProviderPath =
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send|gmail-draft-canary)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/gmail-response-import\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/[^/]+\/(?:sms|text|provider-send|manual-send)\b/i.test(url.pathname)
    const providerHost =
      /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|linkedin\.com|facebook\.com|n8n/i.test(url.hostname)

    if (providerHost || localProviderPath) {
      externalRequests.push({ method: request.method(), url: request.url() })
      await route.abort('blockedbyclient')
      return
    }

    if (url.hostname === 'va.vercel-scripts.com') {
      await route.abort('blockedbyclient')
      return
    }

    if (/\/api\/user\/profile\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: { ...user, role: 'admin', updated_at: user.created_at } }),
      })
      return
    }

    if (/\/auth\/v1\/user\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      })
      return
    }

    if (/\/api\/admin\/meetings\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ meetings: [], total: 0 }),
      })
      return
    }

    if (/\/api\/admin\/value-evidence\/workflow-status\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: [] }),
      })
      return
    }

    if (url.origin === localOrigin) {
      await route.continue()
      return
    }

    externalRequests.push({ method: request.method(), url: request.url() })
    await route.abort('blockedbyclient')
  })
}

async function openQaPage(browser, viewport, recordVideo = false) {
  const externalRequests = []
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ...(recordVideo ? { recordVideo: { dir: sourceDir, size: viewport } } : {}),
  })
  const page = await context.newPage()
  await seedSession(page)
  await installSafeRoutes(page, externalRequests)
  const response = await page.goto(qaUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${qaUrl}`)
  }
  if (!page.url().startsWith(baseUrl)) {
    throw new Error(`QA route left the expected local Portfolio host: ${page.url()}`)
  }
  const overlay = await page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay').count()
  if (overlay > 0) throw new Error('Framework error overlay is visible on the QA route.')
  await page.locator('section[aria-label="Warm response digest"]').waitFor({ timeout: 15_000 })
  return { context, page, externalRequests }
}

async function verifyDigest(page) {
  const currentAction = page.getByRole('button', { name: /Warm digest current action/i })
  await currentAction.waitFor({ timeout: 10_000 })
  const checks = await page.evaluate(() => {
    const text = document.body.innerText
    const digest = document.querySelector('[aria-label="Warm response digest"]')
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    return {
      hasDigest: visible(digest),
      hasCounts:
        /Drafted/i.test(text) &&
        /Approved/i.test(text) &&
        /Sent/i.test(text) &&
        /Replied/i.test(text) &&
        /Blocked/i.test(text) &&
        /Needs Vambah/i.test(text),
      hasNoEgressCopy: /external requests 0/i.test(text),
      hasBoundaryCopy: /Provider monitoring, Gmail\/SMS sends, Slack dispatch, social actions, and n8n dispatch remain off/i.test(text),
      hasResponseState: /Reply detected|Follow-up draft ready|Blocked|No response/i.test(text),
      viewport: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
    }
  })
  return {
    ...checks,
    horizontalOverflow: checks.viewport.scrollWidth > checks.viewport.clientWidth,
  }
}

async function viewportEvidence(browser, name, viewport, screenshotPath) {
  const qa = await openQaPage(browser, viewport)
  const digest = qa.page.locator('section[aria-label="Warm response digest"]')
  await digest.scrollIntoViewIfNeeded()
  const checks = await verifyDigest(qa.page)
  await qa.page.screenshot({ path: screenshotPath, fullPage: true })
  await qa.context.close()
  return {
    name,
    viewport,
    screenshotPath,
    checks,
    externalRequests: qa.externalRequests,
  }
}

async function addSideText(page) {
  await page.addStyleTag({
    content: `
      body { padding-right: 360px !important; }
      #qa-side-text {
        position: fixed;
        inset: 0 0 0 auto;
        z-index: 2147483647;
        width: 336px;
        box-sizing: border-box;
        padding: 22px 20px;
        background: #07111f;
        color: #e5eef9;
        border-left: 1px solid rgba(148, 163, 184, .35);
        font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #qa-side-text h2 { margin: 0 0 12px; font-size: 18px; line-height: 1.2; }
      #qa-side-text h3 { margin: 16px 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #f7d56b; }
      #qa-side-text p { margin: 0; color: #cbd5e1; }
      #qa-side-text ul { margin: 6px 0 0; padding-left: 18px; color: #cbd5e1; }
      #qa-side-text li { margin: 5px 0; }
    `,
  })
  await page.evaluate(() => {
    const panel = document.createElement('aside')
    panel.id = 'qa-side-text'
    panel.innerHTML = `
      <h2>warm-response-digest QA</h2>
      <h3>Scenario</h3>
      <p>Operator opens the warm leads route and checks the office-mode response digest.</p>
      <h3>Expected</h3>
      <ul>
        <li>Drafted, approved, sent, replied, blocked, and needs-Vambah counts are compact.</li>
        <li>The current CTA opens the existing contact workroom instead of a parallel dashboard.</li>
        <li>Reply classification, follow-up readiness, and suppression proposal state remain visible.</li>
      </ul>
      <h3>Decision Gate</h3>
      <p>Captain QA and Vambah human QA decide whether the UI behavior is ready. Live provider monitoring or sending remains a separate approval.</p>
      <h3>External Boundary</h3>
      <p>No Gmail draft, Gmail send, SMS, Slack dispatch, social provider call, n8n dispatch, or production row mutation.</p>
    `
    document.body.appendChild(panel)
  })
}

const browser = await chromium.launch()
const viewportResults = []
for (const [name, viewport, screenshotPath] of [
  ['mobile360', { width: 360, height: 800 }, screenshots.mobile360],
  ['mobile390', { width: 390, height: 844 }, screenshots.mobile390],
  ['mobile430', { width: 430, height: 932 }, screenshots.mobile430],
  ['desktop', { width: 1440, height: 1000 }, screenshots.desktop],
]) {
  viewportResults.push(await viewportEvidence(browser, name, viewport, screenshotPath))
}

const videoQa = await openQaPage(browser, { width: 1280, height: 720 }, true)
await addSideText(videoQa.page)
await videoQa.page.locator('section[aria-label="Warm response digest"]').scrollIntoViewIfNeeded()
await videoQa.page.waitForTimeout(700)
const digestFramePath = path.join(sourceDir, '01-digest.png')
await videoQa.page.screenshot({ path: digestFramePath, fullPage: false })
await videoQa.page.getByRole('button', { name: /Warm digest current action/i }).click()
await videoQa.page.locator('#warm-response-lifecycle').waitFor({ timeout: 15_000 })
await videoQa.page.locator('#warm-response-lifecycle').scrollIntoViewIfNeeded()
await videoQa.page.waitForTimeout(900)
await videoQa.page.screenshot({ path: screenshots.workroom, fullPage: true })
const workroomFramePath = path.join(sourceDir, '02-workroom.png')
await videoQa.page.screenshot({ path: workroomFramePath, fullPage: false })
const video = videoQa.page.video()
await videoQa.context.close()
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

const externalRequests = [
  ...viewportResults.flatMap((result) => result.externalRequests),
  ...videoQa.externalRequests,
]

const receipt = {
  route: qaUrl,
  scenario: 'Warm outreach operator reviews office-mode response digest, then opens the current contact workroom.',
  expectedBehavior: [
    'Digest reports drafted, approved, sent, replied, blocked, and needs-Vambah counts.',
    'Current CTA opens the existing contact workroom.',
    'Selected workroom shows response state, follow-up readiness, suppression proposal state, and disabled external-action boundaries.',
  ],
  decisionGate: 'Captain QA and Vambah human QA only; provider monitoring, provider drafting, dispatch, and send authority remain separate explicit gates.',
  externalActionBoundary: 'No Gmail draft, Gmail send, SMS, Slack dispatch, LinkedIn/Facebook call, n8n dispatch, or production mutation was authorized or executed.',
  screenshots,
  videoPath: mp4Path,
  rawVideoPath,
  viewportResults,
  externalRequests,
}

await writeFile(receiptPath, JSON.stringify(receipt, null, 2))

if (externalRequests.length > 0) {
  throw new Error(`Unexpected external/provider request(s): ${JSON.stringify(externalRequests, null, 2)}`)
}

if (viewportResults.some((result) => result.checks.horizontalOverflow)) {
  throw new Error(`Horizontal overflow detected: ${JSON.stringify(viewportResults, null, 2)}`)
}

console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2))
