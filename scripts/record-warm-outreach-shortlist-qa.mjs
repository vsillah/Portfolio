import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const rawVideoDir = path.join(root, 'test-results', 'warm-outreach-shortlist-qa')
const mp4Path = path.join(outputDir, 'warm-outreach-shortlist-qa.mp4')
const mobileScreenshotPath = path.join(outputDir, 'warm-outreach-shortlist-mobile-390.png')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3064').replace(/\/$/, '')
const qaUrl = `${baseUrl}/admin/outreach?tab=leads&filter=warm&id=42&contactId=42&qa=warm-slack-send-approval`

await mkdir(outputDir, { recursive: true })
await mkdir(rawVideoDir, { recursive: true })

const user = {
  id: 'qa-admin-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-admin@example.test',
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

async function seedSession(page) {
  await page.addInitScript((storedSession) => {
    window.localStorage.setItem('sb-example-auth-token', JSON.stringify(storedSession))
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession))
  }, session)
}

async function installRoutes(page) {
  await page.route('**/api/user/profile**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          id: user.id,
          email: user.email,
          role: 'admin',
          created_at: user.created_at,
          updated_at: user.created_at,
        },
      }),
    })
  })
  await page.route(/https:\/\/[^/]+\.supabase\.co\/auth\/v1\/user.*/i, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
  })
  await page.route('**/api/admin/value-evidence/workflow-status**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ runs: [] }) })
  })
  await page.route('**/api/admin/chat-escalations**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ escalations: [], total: 0 }) })
  })
  await page.route('**/api/admin/meetings**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meetings: [], total: 0 }) })
  })
  await page.route('**/api/admin/sales/contact-meetings**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meetings: [] }) })
  })
  await page.route('**/api/meeting-action-tasks**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [] }) })
  })
}

function collectUnexpectedRequests(page) {
  const requests = []
  page.on('request', (request) => {
    const url = request.url()
    if (/telnyx\.com|slack\.com|gmail\.com|googleapis\.com|n8n/i.test(url)) {
      requests.push(url)
    }
  })
  return requests
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
      @media (max-width: 800px) { body { padding-right: 0 !important; } #qa-side-text { display: none; } }
    `,
  })
  await page.evaluate(() => {
    const panel = document.createElement('aside')
    panel.id = 'qa-side-text'
    panel.innerHTML = `
      <h2>warm-outreach-shortlist QA</h2>
      <h3>Scenario</h3>
      <p>Operator opens /admin/outreach?filter=warm and reviews the daily warm-contact shortlist.</p>
      <h3>Expected</h3>
      <ul>
        <li>Compact priority rows show relationship basis, last touch, channels, blockers, and one CTA.</li>
        <li>CTA opens the existing Portfolio workroom.</li>
        <li>Approval request is local/inert in this fixture.</li>
      </ul>
      <h3>Changed Areas</h3>
      <p>Warm outreach route, shortlist prioritization, blocker mapping, CTA selection.</p>
      <h3>External Boundary</h3>
      <p>No Gmail send, Slack dispatch, Telnyx call, SMS, n8n call, schedule, publish, or production mutation.</p>
    `
    document.body.appendChild(panel)
  })
}

async function createContext(browser, viewport, recordVideo = false) {
  const context = await browser.newContext({
    viewport,
    ...(recordVideo ? { recordVideo: { dir: rawVideoDir, size: viewport } } : {}),
  })
  const page = await context.newPage()
  await seedSession(page)
  await installRoutes(page)
  return { context, page, unexpectedRequests: collectUnexpectedRequests(page) }
}

const browser = await chromium.launch()
const desktop = await createContext(browser, { width: 1280, height: 720 }, true)
await desktop.page.goto(qaUrl, { waitUntil: 'networkidle' })
await addSideText(desktop.page)
await desktop.page.getByLabel('Daily warm outreach shortlist').waitFor({ timeout: 15_000 })
await desktop.page.waitForTimeout(900)
await desktop.page.getByRole('button', { name: 'Request approval for Amina QA Recipient' }).click()
const desktopWorkroom = desktop.page.locator('section[aria-label="Outreach workroom for Amina QA Recipient"]')
await desktopWorkroom.waitFor({ timeout: 15_000 })
await desktop.page.waitForTimeout(900)
await desktopWorkroom.getByRole('button', { name: 'Request send approval' }).click()
await desktop.page.getByText(/QA local Slack approval request recorded/).waitFor({ timeout: 10_000 })
await desktop.page.waitForTimeout(1200)
const video = desktop.page.video()
await desktop.context.close()

const mobile = await createContext(browser, { width: 390, height: 844 })
await mobile.page.goto(qaUrl, { waitUntil: 'networkidle' })
await mobile.page.getByLabel('Daily warm outreach shortlist').waitFor({ timeout: 15_000 })
await mobile.page.getByRole('button', { name: 'Request approval for Amina QA Recipient' }).waitFor({ timeout: 10_000 })
await mobile.page.screenshot({ path: mobileScreenshotPath, fullPage: true })
await mobile.context.close()
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

const unexpectedRequests = [...desktop.unexpectedRequests, ...mobile.unexpectedRequests]
if (unexpectedRequests.length > 0) {
  throw new Error(`Unexpected external/provider request(s): ${unexpectedRequests.join(', ')}`)
}

console.log(JSON.stringify({
  qaUrl,
  videoPath: mp4Path,
  rawVideoPath,
  mobileScreenshotPath,
  unexpectedRequests,
}, null, 2))
