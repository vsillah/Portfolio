import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3098'
const revision = process.env.QA_REVISION || 'b9fcbac3'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/social-campaign-long-form-batch-2026-10-19')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'social-campaign-long-form-batch-walkthrough.mp4')
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
  // Supabase can finish persisting its refreshed session after the redirect.
  // Prove the exact QA route is authenticated before copying browser state into
  // the recorded contexts, and include IndexedDB for browser-storage variants.
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.getByTestId('campaign-package-preparation').waitFor({ state: 'visible', timeout: 30_000 })
  const state = await context.storageState({ indexedDB: true })
  await context.close()
  return state
}

async function recordScenario(browser, storageState, { label, viewport, colorScheme }) {
  const context = await browser.newContext({
    storageState,
    viewport,
    colorScheme,
    recordVideo: { dir: path.join(rawVideoDir, label), size: viewport },
  })
  await context.route('https://va.vercel-scripts.com/**', (requestRoute) => requestRoute.abort('blockedbyclient'))
  const page = await context.newPage()
  const unexpectedRequests = watchExternalRequests(page)
  const video = page.video()
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const panel = page.getByTestId('campaign-package-preparation')
  await panel.waitFor({ state: 'visible', timeout: 30_000 })
  await panel.getByText('LinkedIn and YouTube deliverables remain sealed', { exact: false }).waitFor()
  await assertNoOverflow(page, `${label} initial`)
  await panel.getByText('Long-form draft scripts remain sealed', { exact: false }).waitFor()
  await page.screenshot({ path: path.join(outputDir, `${label}-batch-sealed.png`), fullPage: true })

  const prepareBatch = panel.getByRole('button', { name: 'Prepare eligible long-form scripts' })
  await prepareBatch.waitFor()
  if (!(await prepareBatch.isEnabled())) throw new Error(`${label} long-form batch preparation was disabled.`)
  await prepareBatch.click()
  await panel.getByText('12 total · 12 scanned · 1 prepared · 11 blocked · 0 deferred · 0 remaining · 2 chunks', { exact: true }).waitFor()
  await panel.getByText('ReversR rebuild · Blocked', { exact: true }).waitFor()
  await assertNoOverflow(page, `${label} prepared batch`)
  await page.screenshot({ path: path.join(outputDir, `${label}-batch-prepared.png`), fullPage: true })

  await panel.getByText('Can a Game Make Physics Feel Obvious? Inside KickLab', { exact: true }).click()
  await panel.locator('p').filter({ hasText: '10 min · 1488 words' }).waitFor()
  await panel.getByText('First 30 seconds', { exact: true }).first().waitFor()
  await panel.getByText('Delivered CTA', { exact: true }).first().waitFor()
  await panel.getByRole('heading', { name: 'Full chaptered script' }).waitFor()
  await panel.getByText(/A punch, a corner, and a free kick look unrelated/).scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await panel.getByText(/Start in Fight\. The player does not choose/).scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await panel.getByText(/Open and run KickLab, then comment with one surprising result/).scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outputDir, `${label}-batch-evaluation.png`), fullPage: true })

  await panel.getByRole('option', { name: /ReversR rebuild/i }).click()
  await panel.getByText('Preparation blocked', { exact: true }).waitFor()
  await panel.getByText('LinkedIn and YouTube deliverables are withheld', { exact: false }).waitFor()
  await assertNoOverflow(page, `${label} blocked`)
  await page.screenshot({ path: path.join(outputDir, `${label}-reversr-blocked.png`), fullPage: true })

  await panel.getByText('Evidence, formulas, and comparison trace', { exact: true }).click()
  await panel.getByText('Saved playlist examples: zero performance weight; taste calibration only; Unscored.', { exact: true }).waitFor()
  await panel.getByText('Thumbnail v6 pre-Human-QA checklist', { exact: true }).click()
  await panel.getByText('Reject split-card or pasted-side-by-side layouts', { exact: true }).waitFor()
  await panel.getByText('Closed in this workflow', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
  await assertNoOverflow(page, `${label} prepared`)

  await context.close()
  const rawPath = video ? await video.path() : null
  if (!rawPath) throw new Error(`${label} did not produce a video.`)
  if (unexpectedRequests.length) throw new Error(`${label} made unexpected external requests: ${unexpectedRequests.join(', ')}`)
  return rawPath
}

const browser = await chromium.launch({ headless: true })
const storageState = await authenticatedStorageState(browser)
const desktopVideo = await recordScenario(browser, storageState, { label: 'desktop-1440', viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' })
const mobileVideo = await recordScenario(browser, storageState, { label: 'mobile-390', viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
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
  screenshots: [
    'desktop-1440-batch-sealed.png',
    'desktop-1440-batch-prepared.png',
    'desktop-1440-batch-evaluation.png',
    'desktop-1440-reversr-blocked.png',
    'mobile-390-batch-sealed.png',
    'mobile-390-batch-prepared.png',
    'mobile-390-batch-evaluation.png',
    'mobile-390-reversr-blocked.png',
  ],
  video: path.basename(mp4Path),
  external_requests: [],
  blocked_development_telemetry: ['https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'],
  protected_actions_exercised: [],
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))

