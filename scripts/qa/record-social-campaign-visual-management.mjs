import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3210'
const revision = process.env.QA_REVISION || 'fd48ce54'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/social-campaign-visual-management-2026-10-19')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'social-campaign-visual-management-walkthrough.mp4')
const route = `/admin/social-content?campaignQa=campaign-package-preparation-v1&rev=${encodeURIComponent(revision)}`

await mkdir(rawVideoDir, { recursive: true })

function watchExternalRequests(page) {
  const unexpected = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return
    if (/\.supabase\.co$/i.test(url.hostname) && url.pathname.startsWith('/auth/v1/')) return
    if (url.hostname === 'va.vercel-scripts.com' && url.pathname === '/v1/speed-insights/script.debug.js') return
    unexpected.push(request.url())
  })
  return unexpected
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  if (dimensions.scroll > dimensions.client + 1) throw new Error(`${label} has horizontal overflow: ${JSON.stringify(dimensions)}`)
}

async function authenticatedStorageState(browser) {
  const context = await browser.newContext({ storageState: authState })
  const page = await context.newPage()
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await Promise.race([
    page.getByTestId('campaign-package-preparation').waitFor({ state: 'visible', timeout: 30_000 }),
    page.getByLabel('Email', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 }),
  ])
  if (await page.getByLabel('Email', { exact: true }).isVisible()) {
    if (!process.env.ADMIN_E2E_EMAIL || !process.env.ADMIN_E2E_PASSWORD) throw new Error('Local QA admin credentials are unavailable.')
    await page.getByLabel('Email', { exact: true }).fill(process.env.ADMIN_E2E_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill(process.env.ADMIN_E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/admin/social-content', { timeout: 30_000 })
  }
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.getByTestId('campaign-package-preparation').waitFor({ state: 'visible', timeout: 30_000 })
  const state = await context.storageState({ indexedDB: true })
  await context.close()
  return state
}

async function recordScenario(browser, storageState, { label, viewport }) {
  const context = await browser.newContext({ storageState, viewport, colorScheme: 'dark', recordVideo: { dir: path.join(rawVideoDir, label), size: viewport } })
  await context.route('https://va.vercel-scripts.com/**', (requestRoute) => requestRoute.abort('blockedbyclient'))
  const page = await context.newPage()
  const unexpectedRequests = watchExternalRequests(page)
  const video = page.video()
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const panel = page.getByTestId('campaign-package-preparation')
  await panel.waitFor({ state: 'visible', timeout: 30_000 })
  await panel.getByText('Visual plans remain sealed', { exact: false }).waitFor()
  await assertNoOverflow(page, `${label} sealed`)

  const prepare = panel.getByRole('button', { name: 'Prepare eligible visual plans' })
  if (!(await prepare.isEnabled())) throw new Error(`${label} visual batch action was disabled.`)
  await prepare.click()
  await panel.getByText('12 total · 12 scanned · 1 prepared · 11 blocked · 0 remaining · 2 chunks', { exact: true }).waitFor()
  await panel.getByRole('heading', { name: 'KickLab · channel-native visual plan' }).waitFor()
  await panel.getByText('FEEL THE MATH', { exact: true }).waitFor()
  await assertNoOverflow(page, `${label} clean asset view`)
  await page.screenshot({ path: path.join(outputDir, `${label}-clean-assets.png`), fullPage: true })

  await panel.getByText('Show field-level source trace and visual decisions', { exact: true }).click()
  await panel.getByText('Exact source deep links', { exact: true }).waitFor()
  await panel.getByText('Script-to-visual storyboard timing', { exact: true }).waitFor()
  await panel.getByText(/Playlist similarity 82\/100/).waitFor()
  await panel.getByText('Script-to-visual storyboard timing', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await panel.getByText(/Fight, Race, and Kick turn momentum/).first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outputDir, `${label}-trace-and-evaluation.png`), fullPage: true })

  const blocked = panel.getByLabel('Blocked visual candidates')
  await blocked.getByText('ReversR rebuild · Blocked', { exact: true }).scrollIntoViewIfNeeded()
  await blocked.getByText('Numerical visual scoring is withheld until the prerequisite evidence and script contract pass.', { exact: true }).first().waitFor()
  await blocked.getByRole('link', { name: 'Refresh evidence' }).waitFor()
  await assertNoOverflow(page, `${label} blocked recovery`)
  await page.screenshot({ path: path.join(outputDir, `${label}-blocked-recovery.png`), fullPage: true })

  await panel.getByText('Closed in this workflow', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await context.close()
  const rawPath = video ? await video.path() : null
  if (!rawPath) throw new Error(`${label} did not produce a video.`)
  if (unexpectedRequests.length) throw new Error(`${label} made unexpected external requests: ${unexpectedRequests.join(', ')}`)
  return rawPath
}

const browser = await chromium.launch({ headless: true })
const storageState = await authenticatedStorageState(browser)
const desktopVideo = await recordScenario(browser, storageState, { label: 'desktop-1440', viewport: { width: 1440, height: 1000 } })
const mobileVideo = await recordScenario(browser, storageState, { label: 'mobile-390', viewport: { width: 390, height: 844 } })
await browser.close()

await execFileAsync('ffmpeg', [
  '-y',
  '-i', desktopVideo,
  '-i', mobileVideo,
  '-filter_complex',
  '[0:v]scale=1440:1000:force_original_aspect_ratio=decrease,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v0];[1:v]scale=1440:1000:force_original_aspect_ratio=decrease,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  mp4Path,
])

const result = {
  revision,
  route: `${baseUrl}${route}`,
  viewports: [{ width: 1440, height: 1000 }, { width: 390, height: 844 }],
  screenshots: [
    'desktop-1440-clean-assets.png',
    'desktop-1440-trace-and-evaluation.png',
    'desktop-1440-blocked-recovery.png',
    'mobile-390-clean-assets.png',
    'mobile-390-trace-and-evaluation.png',
    'mobile-390-blocked-recovery.png',
  ],
  video: path.basename(mp4Path),
  batch: { total: 12, scanned: 12, prepared: 1, blocked: 11, remaining: 0 },
  external_requests: [],
  blocked_development_telemetry: ['https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'],
  protected_actions_exercised: [],
  external_gates_closed: true,
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
