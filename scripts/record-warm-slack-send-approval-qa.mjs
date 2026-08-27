import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const rawVideoDir = path.join(root, 'test-results', 'warm-slack-send-approval-qa')
const mobileScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-mobile.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-desktop.png')
const mp4Path = path.join(outputDir, 'warm-slack-send-approval-mobile.mp4')

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3064'
const qaPath = '/admin/outreach?tab=leads&id=42&contactId=42&qa=warm-slack-send-approval'
const qaUrl = `${baseUrl}${qaPath}`
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE
const supabaseProjectRef = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
).hostname.split('.')[0]
const supabaseAuthStorageKey = `sb-${supabaseProjectRef}-auth-token`

await mkdir(outputDir, { recursive: true })
await mkdir(rawVideoDir, { recursive: true })

const user = {
  id: 'qa-admin-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-admin@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-27T00:00:00.000Z',
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const now = Math.floor(Date.now() / 1000)
const expiresAt = now + 3600
const qaAccessToken = [
  base64Url({ alg: 'none', typ: 'JWT' }),
  base64Url({
    aud: 'authenticated',
    exp: expiresAt,
    iat: now,
    sub: user.id,
    email: user.email,
    role: 'authenticated',
  }),
  'qa-signature',
].join('.')

const session = {
  access_token: qaAccessToken,
  refresh_token: 'qa-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: expiresAt,
  user,
}

async function seedSession(page) {
  await page.addInitScript(({ storageKey, storedSession }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession))
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession))
  }, { storageKey: supabaseAuthStorageKey, storedSession: session })
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    })
  })
}

function collectUnexpectedRequests(page) {
  const requests = []
  page.on('request', (request) => {
    const url = request.url()
    if (
      /\/slack-send-approval\b/i.test(url) ||
      /slack\.com|gmail|googleapis\.com|n8n|provider/i.test(url)
    ) {
      requests.push(url)
    }
  })
  return () => requests
}

async function openQaContext(browser, viewport, recordVideo = false) {
  const context = await browser.newContext({
    viewport,
    ...(recordVideo ? { recordVideo: { dir: rawVideoDir, size: viewport } } : {}),
    ...(authStatePath && existsSync(authStatePath) ? { storageState: authStatePath } : {}),
  })
  const page = await context.newPage()
  if (!authStatePath) await seedSession(page)
  await installRoutes(page)
  const unexpectedRequests = collectUnexpectedRequests(page)
  return { context, page, unexpectedRequests }
}

const browser = await chromium.launch()

const mobile = await openQaContext(browser, { width: 390, height: 844 }, true)
await mobile.page.goto(qaUrl)
const mobileWorkroom = mobile.page.getByRole('region', { name: 'Outreach workroom for Amina QA Recipient' })
await mobileWorkroom.waitFor({ timeout: 15_000 })
await mobileWorkroom.getByText('Ready for one-step send approval request').scrollIntoViewIfNeeded()
await mobileWorkroom.getByRole('button', { name: 'Build Slack approval card' }).click()
await mobileWorkroom.getByText(/QA local Slack approval request recorded/).waitFor({ timeout: 10_000 })
await mobile.page.waitForTimeout(800)
await mobile.page.screenshot({ path: mobileScreenshotPath, fullPage: true })
const video = mobile.page.video()
await mobile.context.close()
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

const desktop = await openQaContext(browser, { width: 1280, height: 900 })
await desktop.page.goto(qaUrl)
const desktopWorkroom = desktop.page.getByRole('region', { name: 'Outreach workroom for Amina QA Recipient' })
await desktopWorkroom.waitFor({ timeout: 15_000 })
await desktopWorkroom.getByText('Ready for one-step send approval request').scrollIntoViewIfNeeded()
await desktopWorkroom.getByRole('button', { name: 'Build Slack approval card' }).click()
await desktopWorkroom.getByText(/QA local Slack approval request recorded/).waitFor({ timeout: 10_000 })
await desktop.page.waitForTimeout(500)
await desktop.page.screenshot({ path: desktopScreenshotPath, fullPage: true })
await desktop.context.close()
await browser.close()

const unexpectedRequests = [...mobile.unexpectedRequests(), ...desktop.unexpectedRequests()]
if (unexpectedRequests.length > 0) {
  throw new Error(`Unexpected external/provider request(s): ${unexpectedRequests.join(', ')}`)
}

console.log(JSON.stringify({
  qaUrl,
  mobileScreenshotPath,
  desktopScreenshotPath,
  rawVideoPath,
  videoPath: rawVideoPath ? mp4Path : null,
  unexpectedRequests,
}, null, 2))
