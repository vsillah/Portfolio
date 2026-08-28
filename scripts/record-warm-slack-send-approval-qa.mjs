import { chromium } from '@playwright/test'
import { execFile, execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const rawVideoDir = path.join(root, 'test-results', 'warm-slack-send-approval-qa')
const videoFramesDir = path.join(rawVideoDir, 'frames')
const mobileScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-mobile.png')
const mobile360ScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-mobile-360.png')
const mobile430ScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-mobile-430.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-desktop.png')
const contactMobileScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-contact-mobile-390.png')
const contactDesktopScreenshotPath = path.join(outputDir, 'warm-slack-send-approval-contact-desktop.png')
const mp4Path = path.join(outputDir, 'warm-slack-send-approval-mobile.mp4')

const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3064').replace(/\/$/, '')
const qaPath = (process.env.QA_PATH || '/admin/outreach?tab=leads&id=42&contactId=42&qa=warm-slack-send-approval')
  .replaceAll('&amp;', '&')
const qaUrl = new URL(qaPath, baseUrl).toString()
const contactQaUrl = new URL('/admin/contacts/42?qa=warm-slack-send-approval', baseUrl).toString()
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE
const workroomSelector = 'section[aria-label="Outreach workroom for Amina QA Recipient"]'

await mkdir(outputDir, { recursive: true })
await mkdir(rawVideoDir, { recursive: true })
await mkdir(videoFramesDir, { recursive: true })

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
  await page.addInitScript(({ storageKeys, storedSession }) => {
    for (const storageKey of storageKeys) {
      window.localStorage.setItem(storageKey, JSON.stringify(storedSession))
    }
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession))
  }, { storageKeys: supabaseAuthStorageKeys(), storedSession: session })
}

function isVercelPreviewBaseUrl(value) {
  try {
    const url = new URL(value)
    return url.hostname.endsWith('.vercel.app') && url.hostname !== 'vercel.app'
  } catch {
    return false
  }
}

function projectLinkCandidates(cwd = process.cwd()) {
  const candidates = []
  let current = path.resolve(cwd)
  while (true) {
    candidates.push(current)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  const basename = path.basename(path.resolve(cwd))
  if (basename) {
    candidates.push(path.join(os.homedir(), 'Projects', basename))
  }

  const parts = path.resolve(cwd).split(path.sep)
  const worktreesIndex = parts.findIndex((part) => part.endsWith('.worktrees'))
  if (worktreesIndex > 0) {
    const canonicalName = parts[worktreesIndex].replace(/\.worktrees$/, '')
    candidates.push(path.join(path.sep, ...parts.slice(1, worktreesIndex), canonicalName))
  }

  return [...new Set(candidates)]
}

function readProjectLink(cwd = process.cwd()) {
  for (const candidate of projectLinkCandidates(cwd)) {
    const file = path.join(candidate, '.vercel', 'project.json')
    if (!existsSync(file)) continue
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      if (parsed?.orgId && parsed?.projectId) {
        return { orgId: parsed.orgId, projectId: parsed.projectId }
      }
    } catch {
      return null
    }
  }
  return null
}

function vercelApi(endpoint) {
  const output = execFileSync('vercel', ['api', endpoint, '--raw'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return JSON.parse(output)
}

function resolveVercelProjectForBaseUrl(value) {
  const link = readProjectLink()
  if (!link || !isVercelPreviewBaseUrl(value)) return undefined

  try {
    const hostname = new URL(value).hostname
    const deployment = vercelApi(`/v13/deployments/${encodeURIComponent(hostname)}?teamId=${link.orgId}`)
    return {
      orgId: link.orgId,
      projectId: deployment?.projectId || link.projectId,
      target: deployment?.target === 'production' ? 'production' : 'preview',
    }
  } catch {
    return {
      ...link,
      target: 'preview',
    }
  }
}

function getVercelAutomationBypassSecretForBaseUrl(value) {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    return process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  }

  const resolved = resolveVercelProjectForBaseUrl(value)
  if (!resolved) return undefined

  try {
    const project = vercelApi(`/v9/projects/${resolved.projectId}?teamId=${resolved.orgId}`)
    return Object.entries(project?.protectionBypass || {}).find(([, config]) => config?.isEnvVar)?.[0]
  } catch {
    return undefined
  }
}

function getVercelProjectEnvValueForBaseUrl(key, value) {
  const resolved = resolveVercelProjectForBaseUrl(value)
  if (!resolved) return undefined

  try {
    const envList = vercelApi(`/v10/projects/${resolved.projectId}/env?teamId=${resolved.orgId}`)
    const env = (envList?.envs || []).find((candidate) => {
      if (candidate?.key !== key) return false
      if (Array.isArray(candidate.target)) return candidate.target.includes(resolved.target)
      return candidate.target === resolved.target
    })
    if (!env?.id) return undefined
    const detail = vercelApi(`/v1/projects/${resolved.projectId}/env/${env.id}?teamId=${resolved.orgId}`)
    return typeof detail?.value === 'string' && detail.value ? detail.value : undefined
  } catch {
    return undefined
  }
}

function supabaseAuthStorageKeys() {
  const urls = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    getVercelProjectEnvValueForBaseUrl('NEXT_PUBLIC_SUPABASE_URL', baseUrl),
    'https://example.supabase.co',
  ].filter(Boolean)

  return [...new Set(urls.map((value) => {
    try {
      return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
    } catch {
      return null
    }
  }).filter(Boolean))]
}

function vercelBypassHeaders(value) {
  const secret = getVercelAutomationBypassSecretForBaseUrl(value)
  return secret
    ? {
        'x-vercel-protection-bypass': secret,
        'x-vercel-set-bypass-cookie': 'true',
      }
    : undefined
}

function isVercelLoginUrl(value) {
  try {
    const url = new URL(value)
    return url.hostname === 'vercel.com' || url.hostname.endsWith('.vercel.com')
  } catch {
    return false
  }
}

async function assertPortfolioRouteReached(page, response, targetUrl = qaUrl) {
  const finalUrl = page.url()
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
  const expectedHost = new URL(baseUrl).hostname
  const finalHost = new URL(finalUrl).hostname

  if (isVercelLoginUrl(finalUrl) || /vercel\s+(log\s*in|login|deployment protection|password)/i.test(bodyText)) {
    throw new Error(
      `Warm Slack send approval QA reached Vercel login/protection instead of Portfolio: ${finalUrl}. ` +
      'Set VERCEL_AUTOMATION_BYPASS_SECRET or run from a Vercel-linked checkout that can resolve the preview protection bypass.',
    )
  }

  if (finalHost !== expectedHost) {
    throw new Error(`Warm Slack send approval QA left expected Portfolio host ${expectedHost} and landed on ${finalHost}.`)
  }

  const status = response?.status()
  if (status && status >= 400) {
    throw new Error(`Warm Slack send approval QA route returned HTTP ${status}: ${targetUrl}`)
  }
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

  await page.route('**/api/admin/meetings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ meetings: [], total: 0 }),
    })
  })

  await page.route('**/api/admin/value-evidence/workflow-status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ runs: [] }),
    })
  })
}

function collectUnexpectedRequests(page) {
  const requests = []
  page.on('request', (request) => {
    const url = request.url()
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const hostname = parsed.hostname
    if (
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-send)\b/i.test(pathname) ||
      /slack\.com|gmail\.com|googleapis\.com|n8n/i.test(hostname)
    ) {
      requests.push(url)
    }
  })
  return () => requests
}

const bypassHeaders = vercelBypassHeaders(baseUrl)
const seededStorageKeys = supabaseAuthStorageKeys()
console.log(`Warm Slack send approval QA URL: ${qaUrl}`)
console.log(`Warm Slack send approval contact QA URL: ${contactQaUrl}`)
console.log(`Vercel protection bypass configured: ${bypassHeaders ? 'yes' : 'no'}`)
console.log(`Synthetic Supabase auth storage keys seeded: ${seededStorageKeys.length}`)

async function openQaContext(browser, viewport, recordVideo = false) {
  const context = await browser.newContext({
    viewport,
    ...(recordVideo ? { recordVideo: { dir: rawVideoDir, size: viewport } } : {}),
    ...(authStatePath && existsSync(authStatePath) ? { storageState: authStatePath } : {}),
    ...(bypassHeaders ? { extraHTTPHeaders: bypassHeaders } : {}),
  })
  const page = await context.newPage()
  if (!authStatePath) await seedSession(page)
  await installRoutes(page)
  const unexpectedRequests = collectUnexpectedRequests(page)
  return { context, page, unexpectedRequests }
}

const browser = await chromium.launch()

async function createMp4FromFrames(frames, outputPath) {
  const concatListPath = path.join(rawVideoDir, 'warm-slack-send-approval-mobile-frames.txt')
  const escapeForConcat = (value) => value.replace(/'/g, "'\\''")
  const lines = frames.flatMap((frame) => [
    `file '${escapeForConcat(frame.path)}'`,
    `duration ${frame.durationSeconds}`,
  ])
  lines.push(`file '${escapeForConcat(frames[frames.length - 1].path)}'`)
  await writeFile(concatListPath, `${lines.join('\n')}\n`, 'utf8')

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
    outputPath,
  ])
}

const mobile = await openQaContext(browser, { width: 390, height: 844 })
const mobileResponse = await mobile.page.goto(qaUrl)
await assertPortfolioRouteReached(mobile.page, mobileResponse)
const mobileWorkroom = mobile.page.locator(workroomSelector)
await mobileWorkroom.waitFor({ timeout: 15_000 })
const videoFrames = []
async function captureVideoFrame(name, durationSeconds) {
  const framePath = path.join(videoFramesDir, name)
  await mobile.page.screenshot({ path: framePath })
  videoFrames.push({ path: framePath, durationSeconds })
}

await captureVideoFrame('01-initial-workroom.png', 2.5)
await mobileWorkroom.getByText('Activation readiness: Live import disabled').scrollIntoViewIfNeeded()
await mobile.page.waitForTimeout(300)
await captureVideoFrame('02-real-recipient-rollout.png', 2.5)
await mobileWorkroom.getByText('Provider execution readiness').scrollIntoViewIfNeeded()
await mobile.page.waitForTimeout(300)
await captureVideoFrame('03-provider-readiness-summary.png', 3)
await mobileWorkroom.locator('details').filter({ hasText: 'Execution gate details' }).locator('summary').click()
await mobile.page.waitForTimeout(300)
await captureVideoFrame('04-disabled-execution-gate-details.png', 3)
await mobileWorkroom.getByRole('button', { name: 'Request send approval' }).click()
await mobileWorkroom.getByText(/QA local Slack approval request recorded/).waitFor({ timeout: 10_000 })
await mobile.page.waitForTimeout(800)
await captureVideoFrame('05-inert-approval-request-receipt.png', 3)
await mobile.page.screenshot({ path: mobileScreenshotPath, fullPage: true })
await mobile.context.close()
await createMp4FromFrames(videoFrames, mp4Path)

async function captureMobileScreenshot(viewport, screenshotPath) {
  const target = await openQaContext(browser, viewport)
  const response = await target.page.goto(qaUrl)
  await assertPortfolioRouteReached(target.page, response)
  const workroom = target.page.locator(workroomSelector)
  await workroom.waitFor({ timeout: 15_000 })
  await workroom.getByText('Provider execution readiness').scrollIntoViewIfNeeded()
  await workroom.getByText('Activation gate: ENABLE_WARM_GMAIL_SEND_EXECUTION is disabled.').waitFor({ timeout: 10_000 })
  await target.page.waitForTimeout(300)
  await target.page.screenshot({ path: screenshotPath, fullPage: true })
  await target.context.close()
  return target.unexpectedRequests()
}

const mobile360UnexpectedRequests = await captureMobileScreenshot({ width: 360, height: 800 }, mobile360ScreenshotPath)
const mobile430UnexpectedRequests = await captureMobileScreenshot({ width: 430, height: 932 }, mobile430ScreenshotPath)

async function captureContactScreenshot(viewport, screenshotPath) {
  const target = await openQaContext(browser, viewport)
  const response = await target.page.goto(contactQaUrl)
  await assertPortfolioRouteReached(target.page, response, contactQaUrl)
  await target.page.getByRole('heading', { name: /Amina QA Recipient/i }).waitFor({ timeout: 15_000 })
  await target.page.getByText('Provider execution readiness').scrollIntoViewIfNeeded()
  await target.page.getByText('Activation gate: ENABLE_WARM_GMAIL_SEND_EXECUTION is disabled.').waitFor({ timeout: 10_000 })
  await target.page.getByRole('button', { name: 'Request send approval' }).click()
  await target.page.getByText(/QA local Slack approval request recorded/).waitFor({ timeout: 10_000 })
  await target.page.waitForTimeout(300)
  await target.page.screenshot({ path: screenshotPath, fullPage: true })
  await target.context.close()
  return target.unexpectedRequests()
}

const contactMobileUnexpectedRequests = await captureContactScreenshot(
  { width: 390, height: 844 },
  contactMobileScreenshotPath,
)
const contactDesktopUnexpectedRequests = await captureContactScreenshot(
  { width: 1280, height: 900 },
  contactDesktopScreenshotPath,
)

const desktop = await openQaContext(browser, { width: 1280, height: 900 })
const desktopResponse = await desktop.page.goto(qaUrl)
await assertPortfolioRouteReached(desktop.page, desktopResponse)
const desktopWorkroom = desktop.page.locator(workroomSelector)
await desktopWorkroom.waitFor({ timeout: 15_000 })
await desktopWorkroom.getByText('Activation readiness: Live import disabled').scrollIntoViewIfNeeded()
await desktopWorkroom.getByRole('button', { name: 'Request send approval' }).click()
await desktopWorkroom.getByText(/QA local Slack approval request recorded/).waitFor({ timeout: 10_000 })
await desktop.page.waitForTimeout(500)
await desktop.page.screenshot({ path: desktopScreenshotPath, fullPage: true })
await desktop.context.close()
await browser.close()

const unexpectedRequests = [
  ...mobile.unexpectedRequests(),
  ...mobile360UnexpectedRequests,
  ...mobile430UnexpectedRequests,
  ...contactMobileUnexpectedRequests,
  ...contactDesktopUnexpectedRequests,
  ...desktop.unexpectedRequests(),
]
if (unexpectedRequests.length > 0) {
  throw new Error(`Unexpected external/provider request(s): ${unexpectedRequests.join(', ')}`)
}

console.log(JSON.stringify({
  qaUrl,
  mobileScreenshotPath,
  mobile360ScreenshotPath,
  mobile430ScreenshotPath,
  desktopScreenshotPath,
  contactMobileScreenshotPath,
  contactDesktopScreenshotPath,
  videoFrames: videoFrames.map((frame) => frame.path),
  videoPath: mp4Path,
  unexpectedRequests,
}, null, 2))
