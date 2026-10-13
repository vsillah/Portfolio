import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.env.QA_OUTPUT_ROOT || process.cwd()
const outputDir = path.join(root, 'docs', 'mobile-social-decision-reconciliation-qa')
const rawVideoDir = path.join(root, 'test-results', 'mobile-social-decision-reconciliation-qa')
const desktopScreenshotPath = path.join(outputDir, 'desktop-recorded.png')
const mobileScreenshotPath = path.join(outputDir, 'mobile-blocked.png')
const mp4Path = path.join(outputDir, 'social-decision-version-reconciliation.mp4')
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3011'
const trustedOidcToken = process.env.VERCEL_OIDC_TOKEN
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE
const contentId = '11111111-2222-4333-8444-555555555555'
const qaPath = `/admin/social-content/${contentId}?step=copy&review=mobile#social-mobile-decision-receipt`
const version = '2026-10-13T02:31:06.000Z'

await mkdir(outputDir, { recursive: true })
await mkdir(rawVideoDir, { recursive: true })

const user = {
  id: '77777777-8888-4999-aaaa-bbbbbbbbbbbb',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'mobile-decision-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: version,
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const now = Math.floor(Date.now() / 1000)
const expiresAt = now + 3600
const accessToken = [
  base64Url({ alg: 'none', typ: 'JWT' }),
  base64Url({ aud: 'authenticated', exp: expiresAt, iat: now, sub: user.id, email: user.email, role: 'authenticated' }),
  'qa-signature',
].join('.')
const session = {
  access_token: accessToken,
  refresh_token: 'qa-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: expiresAt,
  user,
}
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co').hostname.split('.')[0]
const storageKey = `sb-${projectRef}-auth-token`

function evidenceReceipt(key, status = 'approved') {
  return { receipt_id: `${key}-receipt-qa`, status, content_updated_at: version }
}

function socialItem(mode = 'recorded') {
  const blocked = mode === 'blocked'
  const receipts = {
    source: evidenceReceipt('source'),
    voice: evidenceReceipt('voice'),
    framework: evidenceReceipt('framework'),
    privacy: evidenceReceipt('privacy'),
    visual: evidenceReceipt('visual'),
    challenger: evidenceReceipt('challenger'),
  }
  if (blocked) receipts.challenger = evidenceReceipt('challenger', 'pending')

  const currentVersion = '2026-10-13T02:32:06.000Z'
  const recorded = mode === 'recorded'
  const claimsRecorded = recorded || blocked

  return {
    id: contentId,
    meeting_record_id: null,
    platform: 'linkedin',
    status: claimsRecorded ? 'approved' : 'draft',
    post_text: 'A decision is trustworthy when the evidence travels with it.',
    cta_text: 'Review the receipt before advancing the gate.',
    cta_url: null,
    hashtags: ['AgentOps', 'DecisionReceipts'],
    image_url: null,
    image_prompt: null,
    framework_visual_type: 'architecture',
    voiceover_url: null,
    voiceover_text: null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'privacy_safe_qa_fixture',
      publish_gate: 'draft_only',
      pass_to_human: true,
      ...(claimsRecorded ? {
        current_gate: 'asset_packet',
        latest_internal_decision_receipt_id: 'decision-receipt-qa',
        latest_internal_decision: 'approve',
      } : {}),
      mobile_decision_review: {
        version: 'social-content-decision-review/v1',
        approval_id: 'approval-mobile-qa',
        run_id: 'run-mobile-qa',
        work_item_id: 'work-mobile-qa',
        content_id: contentId,
        content_updated_at: version,
        current_gate: 'copy_review',
        next_gate: 'asset_packet',
        receipts,
        candidate_projection: {
          headline: 'Read-only candidate projection',
          next_internal_gate: 'asset_packet',
        },
      },
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: claimsRecorded ? user.id : null,
    target_platforms: ['linkedin'],
    video_generation_method: 'none',
    youtube_title: null,
    youtube_description: null,
    content_format: 'single_image',
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: version,
    updated_at: currentVersion,
    recorded_internal_decision_receipt: recorded ? {
      receipt_id: 'decision-receipt-qa',
      decision: 'approve',
      reviewed_content_updated_at: version,
      next_gate: 'asset_packet',
      verified: true,
    } : null,
    publishes: [],
  }
}

async function seedSession(page) {
  await page.addInitScript(({ key, storedSession }) => {
    window.localStorage.setItem(key, JSON.stringify(storedSession))
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession))
  }, { key: storageKey, storedSession: session })
}

async function loadMappedStorageState() {
  if (!authStatePath || !existsSync(authStatePath)) return null
  const stored = JSON.parse(await readFile(authStatePath, 'utf8'))
  const sourceOrigin = stored.origins?.find((origin) => origin.localStorage?.some((entry) => entry.name.startsWith('sb-')))
  return {
    cookies: stored.cookies || [],
    origins: sourceOrigin
      ? [{ origin: new URL(baseUrl).origin, localStorage: sourceOrigin.localStorage }]
      : [],
  }
}

async function discoverPreviewSupabaseConfig(page) {
  return page.evaluate(async () => {
    const sources = Array.from(document.querySelectorAll('script[src]')).map((script) => script.src)
    const bodies = await Promise.all(sources.map((source) => fetch(source).then((response) => response.text()).catch(() => '')))
    const combined = bodies.join('\n')
    const urlMatch = combined.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
    const jwtMatches = combined.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []
    const anonKey = jwtMatches.find((candidate) => {
      try {
        const payload = JSON.parse(atob(candidate.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        return payload.role === 'anon' && (!urlMatch || !payload.ref || payload.ref === urlMatch[1])
      } catch {
        return false
      }
    })
    return urlMatch && anonKey ? { url: urlMatch[0], projectRef: urlMatch[1], anonKey } : null
  })
}

async function seedAuthenticatedPreviewSession(page) {
  if (['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) return false
  const email = process.env.ADMIN_E2E_EMAIL
  const password = process.env.ADMIN_E2E_PASSWORD
  if (!email || !password) return false
  const config = await discoverPreviewSupabaseConfig(page)
  if (!config) throw new Error('Unable to discover the deployed preview Supabase client configuration.')
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(`Preview admin session request failed with status ${response.status}.`)
  const authenticatedSession = await response.json()
  await page.evaluate(({ key, storedSession }) => {
    window.localStorage.setItem(key, JSON.stringify(storedSession))
  }, { key: `sb-${config.projectRef}-auth-token`, storedSession: authenticatedSession })
  return true
}

async function installRoutes(page, state) {
  if (trustedOidcToken) {
    await page.route(`${new URL(baseUrl).origin}/**`, (route) => route.continue({
      headers: {
        ...route.request().headers(),
        'x-vercel-trusted-oidc-idp-token': trustedOidcToken,
      },
    }))
  }
  await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }))
  await page.route('**/api/user/profile**', (route) => route.fulfill({
    json: { profile: { id: user.id, email: user.email, role: 'admin', created_at: version, updated_at: version } },
  }))
  await page.route(`**/api/admin/social-content/${contentId}/decision`, (route) => route.fulfill({
    status: 409,
    json: {
      error: 'QA fixture does not permit decision writes.',
      code: 'QA_FIXTURE_READ_ONLY',
    },
  }))
  await page.route(`**/api/admin/social-content/${contentId}/engagement/comments**`, (route) => route.fulfill({ json: { comments: [] } }))
  await page.route(`**/api/admin/social-content/${contentId}`, (route) => route.fulfill({ json: { item: socialItem(state.mode) } }))
  await page.route('**/api/admin/social-content/topic-backlog**', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/admin/social-content/calibration-library**', (route) => route.fulfill({ json: { references: [] } }))
  await page.route('**/api/admin/social-content/config**', (route) => route.fulfill({ json: { configs: [] } }))
  await page.route('**/api/admin/social-content?**', (route) => route.fulfill({ json: { items: [socialItem(state.mode)] } }))
}

function watchExternalRequests(page) {
  const blocked = []
  page.on('request', (request) => {
    const url = request.url()
    if (/supabase\.co\/auth\/v1\//i.test(url)) return
    if (/gmail|linkedin\.com|facebook\.com|slack|n8n|supabase\.co\/(?!auth\/v1\/)/i.test(url)) blocked.push(url)
  })
  return blocked
}

async function captureViewportScreenshot(page, target, screenshotPath, block = 'start') {
  const header = page.locator('[data-social-detail-header]')
  if (await header.count()) await header.evaluate((element) => { element.style.visibility = 'hidden' })
  await target.evaluate((element, targetBlock) => element.scrollIntoView({ block: targetBlock }), block)
  await page.waitForTimeout(100)
  await page.screenshot({ path: screenshotPath })
  if (await header.count()) await header.evaluate((element) => { element.style.visibility = '' })
}

async function recordViewport(browser, { viewport, screenshotPath, label, mode, storageState }) {
  const state = { mode }
  const rawDir = path.join(rawVideoDir, label)
  await mkdir(rawDir, { recursive: true })
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: rawDir, size: viewport },
  })
  const page = await context.newPage()
  const authDiagnostics = []
  page.on('request', (request) => {
    if (/\/auth\/v1\//.test(request.url())) authDiagnostics.push(`request ${new URL(request.url()).pathname}`)
  })
  page.on('response', (response) => {
    if (/\/auth\/v1\//.test(response.url())) authDiagnostics.push(`response ${response.status()} ${new URL(response.url()).pathname}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') authDiagnostics.push(`console ${message.type()}: ${message.text().slice(0, 160)}`)
  })
  await installRoutes(page, state)
  const externalRequests = watchExternalRequests(page)

  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'domcontentloaded' })
  const authenticated = await seedAuthenticatedPreviewSession(page)
  if (!authenticated && storageState?.origins?.[0]?.localStorage) {
    await page.evaluate((entries) => {
      for (const entry of entries) window.localStorage.setItem(entry.name, entry.value)
    }, storageState.origins[0].localStorage)
  } else if (!authenticated) {
    await seedSession(page)
  }

  await page.goto(`${baseUrl}${qaPath}`, { waitUntil: 'domcontentloaded' })
  const panel = page.getByLabel('Protected mobile Social Content decision')
  try {
    await panel.waitFor({ timeout: 12_000 })
  } catch (error) {
    const diagnosticPath = path.join(outputDir, `${label}-load-diagnostic.png`)
    await page.screenshot({ path: diagnosticPath, fullPage: true })
    const title = await page.title()
    const visibleText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)
    const localStorageKeys = await page.evaluate(() => Object.keys(window.localStorage))
    const bundledProjectRefs = await page.evaluate(async () => {
      const refs = new Set()
      const sources = Array.from(document.querySelectorAll('script[src]')).map((script) => script.src)
      for (const source of sources) {
        const body = await fetch(source).then((response) => response.text()).catch(() => '')
        for (const match of body.matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/g)) refs.add(match[1])
      }
      return Array.from(refs)
    })
    throw new Error(`Protected panel did not load at ${page.url()} (${title}); storage keys: ${localStorageKeys.join(', ')}; expected: ${storageKey}; bundle refs: ${bundledProjectRefs.join(', ')}; auth: ${authDiagnostics.join(' | ')}; page: ${visibleText}`, { cause: error })
  }
  await panel.scrollIntoViewIfNeeded()
  await page.evaluate((offset) => window.scrollBy(0, offset), viewport.width <= 480 ? -520 : -240)
  const expectedState = mode === 'recorded' ? 'Recorded decision verified' : 'Decision blocked closed'
  const stateIndicator = panel.getByText(expectedState)
  await stateIndicator.waitFor()
  await page.waitForTimeout(1600)
  await captureViewportScreenshot(page, mode === 'blocked' ? stateIndicator : panel, screenshotPath, mode === 'blocked' ? 'center' : 'start')
  if (mode === 'recorded') {
    await panel.getByRole('link', { name: 'Open asset packet gate' }).click()
    const assetPacketGate = page.locator('#social-asset-packet-gate')
    await assetPacketGate.waitFor()
    await assetPacketGate.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1400)
  }
  await page.waitForTimeout(900)

  const video = page.video()
  await context.close()
  const rawVideoPath = video ? await video.path() : null
  if (!rawVideoPath) throw new Error(`No ${label} video was recorded.`)
  if (externalRequests.length) throw new Error(`Unexpected external request(s): ${externalRequests.join(', ')}`)
  return rawVideoPath
}

const browser = await chromium.launch()
const storageState = await loadMappedStorageState()
const desktopRaw = await recordViewport(browser, {
  viewport: { width: 1280, height: 900 },
  screenshotPath: desktopScreenshotPath,
  label: 'desktop',
  mode: 'recorded',
  storageState,
})
const mobileRaw = await recordViewport(browser, {
  viewport: { width: 390, height: 844 },
  screenshotPath: mobileScreenshotPath,
  label: 'mobile',
  mode: 'blocked',
  storageState,
})
await browser.close()

await execFileAsync('ffmpeg', [
  '-y',
  '-i', desktopRaw,
  '-i', mobileRaw,
  '-filter_complex',
  '[0:v]scale=1280:900:force_original_aspect_ratio=decrease,pad=1280:900:(ow-iw)/2:(oh-ih)/2:black,setsar=1[desktop];[1:v]scale=1280:900:force_original_aspect_ratio=decrease,pad=1280:900:(ow-iw)/2:(oh-ih)/2:black,setsar=1[mobile];[desktop][mobile]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  mp4Path,
])

console.log(JSON.stringify({
  baseUrl,
  qaPath,
  desktopScreenshotPath,
  mobileScreenshotPath,
  videoPath: mp4Path,
  externalRequests: [],
}, null, 2))
