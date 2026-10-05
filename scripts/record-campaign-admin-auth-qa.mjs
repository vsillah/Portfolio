import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { config as loadEnv } from 'dotenv'

const execFileAsync = promisify(execFile)
const root = process.cwd()
loadEnv({
  path: process.env.PORTFOLIO_ENV_FILE || path.join(root, '.env.local'),
  quiet: true,
})

const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const campaignId = 'campaign-auth-qa'
const outputDir = path.join(root, 'docs', 'campaign-autopilot', 'qa', 'campaign-admin-auth')
const videoDir = path.join(root, 'test-results', 'campaign-admin-auth-video', String(process.pid))
const mp4Path = path.join(outputDir, 'campaign-admin-auth-walkthrough.mp4')
const receiptPath = path.join(outputDir, 'campaign-admin-auth-receipt.json')
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE || ''

await mkdir(outputDir, { recursive: true })
await mkdir(videoDir, { recursive: true })

const user = {
  id: 'campaign-admin-auth-qa-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'campaign-admin-auth-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-10-05T00:00:00.000Z',
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

const campaign = {
  id: campaignId,
  name: 'Agentic Operating System Readiness Challenge',
  slug: 'agentic-operating-system-readiness',
  description: 'A governed readiness challenge for teams preparing agentic workflows.',
  campaign_type: 'free_challenge',
  status: 'draft',
  starts_at: '2026-10-05T13:00:00.000Z',
  ends_at: '2026-10-19T21:00:00.000Z',
  completion_window_days: 14,
  campaign_eligible_bundles: [],
  campaign_criteria_templates: [],
  calendar_item_count: 0,
  next_calendar_item: null,
  social_content_calendar_items: [],
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

async function installSafeRoutes(page, evidence) {
  const localOrigin = new URL(baseUrl).origin

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.hostname === 'va.vercel-scripts.com') {
      await route.abort('blockedbyclient')
      return
    }

    if (url.origin !== localOrigin && !url.pathname.includes('/auth/v1/user')) {
      evidence.externalRequests.push({ method, url: request.url() })
      await route.abort('blockedbyclient')
      return
    }

    if (/\/auth\/v1\/user\b/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
      return
    }

    if (/\/api\/user\/profile\b/.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: { ...user, role: 'admin', updated_at: user.created_at } }),
      })
      return
    }

    if (method !== 'GET' && method !== 'HEAD') {
      evidence.mutationRequests.push({ method, url: request.url() })
      await route.abort('blockedbyclient')
      return
    }

    if (url.pathname === '/api/admin/campaigns') {
      evidence.authHeaders.push(request.headers().authorization || null)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [campaign], count: 1 }),
      })
      return
    }

    if (url.pathname === `/api/admin/campaigns/${campaignId}`) {
      evidence.authHeaders.push(request.headers().authorization || null)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: campaign }) })
      return
    }

    if (url.pathname === `/api/admin/campaigns/${campaignId}/enrollments`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      return
    }

    if (url.pathname === `/api/admin/campaigns/${campaignId}/releases`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ releases: [] }) })
      return
    }

    if (url.pathname === '/api/admin/sales/bundles') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      return
    }

    await route.continue()
  })
}

async function openContext(browser, viewport, recordVideo = false) {
  const evidence = { externalRequests: [], mutationRequests: [], authHeaders: [] }
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ...(authStatePath && existsSync(authStatePath) ? { storageState: authStatePath } : {}),
    ...(recordVideo ? { recordVideo: { dir: videoDir, size: viewport } } : {}),
  })
  const page = await context.newPage()
  if (!authStatePath || !existsSync(authStatePath)) await seedSession(page)
  await installSafeRoutes(page, evidence)
  return { context, page, evidence }
}

async function assertNoOverflow(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))
}

const browser = await chromium.launch({ headless: true })
const receipt = {
  baseUrl,
  route: '/admin/campaigns',
  campaignId,
  generatedAt: new Date().toISOString(),
  desktop: null,
  mobile: null,
}

try {
  const desktop = await openContext(browser, { width: 1440, height: 1000 }, true)
  await desktop.page.goto(`${baseUrl}/admin/campaigns`, { waitUntil: 'networkidle' })
  await desktop.page.getByRole('heading', { name: 'Attraction Campaigns' }).waitFor()
  await desktop.page.getByText(campaign.name).waitFor()
  await desktop.page.waitForTimeout(700)

  await desktop.page.getByRole('button', { name: 'New Campaign' }).click()
  await desktop.page.getByPlaceholder('Win Your Money Back Challenge').fill('Schedule validation example')
  const createButton = desktop.page.getByRole('button', { name: 'Create Campaign' })
  const createDisabledWithoutSchedule = !(await createButton.isEnabled())
  if (!createDisabledWithoutSchedule) throw new Error('Create Campaign must remain disabled without a schedule')
  await desktop.page.waitForTimeout(900)

  await desktop.page.getByRole('button', { name: 'Cancel' }).click()
  await desktop.page.goto(`${baseUrl}/admin/campaigns/${campaignId}`, { waitUntil: 'networkidle' })
  await desktop.page.getByRole('heading', { name: campaign.name }).waitFor()
  await desktop.page.getByRole('button', { name: 'Edit schedule' }).click()
  await desktop.page.getByLabel('Campaign start').waitFor()
  await desktop.page.waitForTimeout(1400)
  await desktop.page.screenshot({ path: path.join(outputDir, 'campaign-admin-auth-desktop-1440.png'), fullPage: true })
  const desktopLayout = await assertNoOverflow(desktop.page)

  receipt.desktop = {
    createDisabledWithoutSchedule,
    layout: desktopLayout,
    authenticatedCampaignRequests: desktop.evidence.authHeaders.length,
    authorizationHeadersPresent: desktop.evidence.authHeaders.every(Boolean),
    externalRequests: desktop.evidence.externalRequests,
    mutationRequests: desktop.evidence.mutationRequests,
  }
  await desktop.context.close()

  const mobile = await openContext(browser, { width: 390, height: 844 })
  await mobile.page.goto(`${baseUrl}/admin/campaigns/${campaignId}`, { waitUntil: 'networkidle' })
  await mobile.page.getByRole('heading', { name: campaign.name }).waitFor()
  await mobile.page.getByRole('button', { name: 'Edit schedule' }).click()
  await mobile.page.getByLabel('Campaign start').waitFor()
  await mobile.page.screenshot({ path: path.join(outputDir, 'campaign-admin-auth-mobile-390.png'), fullPage: true })
  receipt.mobile = {
    layout: await assertNoOverflow(mobile.page),
    authenticatedCampaignRequests: mobile.evidence.authHeaders.length,
    authorizationHeadersPresent: mobile.evidence.authHeaders.every(Boolean),
    externalRequests: mobile.evidence.externalRequests,
    mutationRequests: mobile.evidence.mutationRequests,
  }
  await mobile.context.close()
} finally {
  await browser.close()
}

const sourceVideos = (await readdir(videoDir)).filter((name) => name.endsWith('.webm'))
if (sourceVideos.length !== 1) {
  throw new Error(`Expected one source video, found ${sourceVideos.length}`)
}

await execFileAsync('ffmpeg', [
  '-y',
  '-i', path.join(videoDir, sourceVideos[0]),
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  mp4Path,
])

if (receipt.desktop.layout.horizontalOverflow || receipt.mobile.layout.horizontalOverflow) {
  throw new Error('Campaign QA found horizontal overflow')
}
if (receipt.desktop.mutationRequests.length || receipt.mobile.mutationRequests.length) {
  throw new Error('Campaign QA attempted an internal mutation')
}
if (receipt.desktop.externalRequests.length || receipt.mobile.externalRequests.length) {
  throw new Error('Campaign QA attempted an external request')
}
if (!receipt.desktop.authorizationHeadersPresent || !receipt.mobile.authorizationHeadersPresent) {
  throw new Error('Campaign API request was missing its admin authorization header')
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ mp4Path, receiptPath, receipt }, null, 2))
