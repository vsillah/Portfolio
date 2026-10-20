import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3218'
const revision = process.env.QA_REVISION || 'working'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/jev-youtube-thumbnail-hero-review-2026-10-19')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'jev-youtube-thumbnail-hero-review-walkthrough.mp4')
const route = `/admin/social-content?campaignQa=campaign-package-preparation-review-v1&rev=${encodeURIComponent(revision)}`
const recoveryLabels = [
  'Complete description evidence',
  'Repair hero evidence',
  'Evaluate the exact thumbnail',
  'Review the exact script and CTA',
  'Rebind the current version',
]

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
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  if (dimensions.scroll > dimensions.client + 1) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(dimensions)}`)
  }
}

async function authenticatedStorageState(browser) {
  const context = await browser.newContext({ storageState: authState })
  const page = await context.newPage()
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('[data-testid="campaign-package-preparation"], input[type="email"]').first().waitFor({ state: 'visible', timeout: 60_000 })
  if (await page.getByLabel('Email', { exact: true }).isVisible()) {
    if (!process.env.ADMIN_E2E_EMAIL || !process.env.ADMIN_E2E_PASSWORD) {
      throw new Error('Local QA admin credentials are unavailable.')
    }
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

async function reopenReview(page) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const panel = page.getByTestId('campaign-package-preparation')
  await panel.waitFor({ state: 'visible', timeout: 30_000 })
  await panel.getByRole('heading', { name: 'Upcoming YouTube campaign review' }).waitFor()
  return panel
}

async function exerciseRecoveryLinks(page, panel) {
  const exercised = []
  for (const label of recoveryLabels) {
    const links = panel.getByRole('link', { name: label, exact: true })
    const count = await links.count()
    for (let index = 0; index < count; index += 1) {
      const href = await links.nth(index).getAttribute('href')
      if (!href?.startsWith('/admin/social-content?workflow=evidence&campaign=')) {
        throw new Error(`${label} did not resolve to a scoped evidence recovery route.`)
      }
      await links.nth(index).click()
      await page.waitForURL((url) => url.pathname === '/admin/social-content' && url.searchParams.get('workflow') === 'evidence', { timeout: 30_000 })
      exercised.push(`${label}: ${href}`)
      panel = await reopenReview(page)
    }
  }
  return { panel, exercised }
}

async function recordScenario(browser, storageState, { label, viewport, colorScheme, exerciseLinks }) {
  const context = await browser.newContext({
    storageState,
    viewport,
    colorScheme,
    reducedMotion: 'reduce',
    recordVideo: { dir: path.join(rawVideoDir, label), size: viewport },
  })
  await context.route('https://va.vercel-scripts.com/**', (requestRoute) => requestRoute.abort('blockedbyclient'))
  const page = await context.newPage()
  const unexpectedRequests = watchExternalRequests(page)
  const video = page.video()
  let panel = await reopenReview(page)

  await panel.getByText('External gates closed', { exact: true }).first().waitFor()
  if (await panel.getByRole('heading', { name: 'Hero-led thumbnail candidates and complete storyboard' }).count() !== 2) {
    throw new Error(`${label} did not render both review-only storyboard packets.`)
  }
  if (await panel.getByText(/YouTube long-form scene board · 6 scenes · 4:00/).count() !== 2) {
    throw new Error(`${label} did not render both six-scene long-form boards.`)
  }
  if (await panel.getByText(/YouTube Shorts scene board · 3 scenes · 0:45/).count() !== 2) {
    throw new Error(`${label} did not render both three-scene Shorts boards.`)
  }
  await assertNoOverflow(page, `${label} overview`)
  await page.screenshot({ path: path.join(outputDir, `${label}-overview.jpg`), type: 'jpeg', quality: 82 })

  const providerHeadings = panel.getByRole('heading', { name: 'Hero-led thumbnail candidates and complete storyboard' })
  await providerHeadings.nth(0).scrollIntoViewIfNeeded()
  await page.waitForTimeout(450)
  await assertNoOverflow(page, `${label} Jev asset`)
  await page.screenshot({ path: path.join(outputDir, `${label}-jev-asset.jpg`), type: 'jpeg', quality: 82 })

  const comparison = panel.getByLabel('Jev thumbnail candidate comparison')
  if (await comparison.getByRole('article').count() !== 2) throw new Error(`${label} did not render two Jev hero candidates.`)
  if (await comparison.getByAltText(/actual-feed-size preview/).count() !== 2) throw new Error(`${label} did not render both 320x180 feed previews.`)
  const evidenceDetails = comparison.getByText('Inspect live-evidence creative decisions').first()
  await evidenceDetails.click()
  await comparison.getByText(/campaign-specific Vambah likeness makes the human decision owner concrete/).first().waitFor()
  if (await comparison.getByText('New campaign-specific generation · review only', { exact: true }).count() !== 2) {
    throw new Error(`${label} did not label both generated review candidates outside the exported pixels.`)
  }
  await comparison.getByText('Selected · sole final output', { exact: true }).waitFor()
  await comparison.getByText('Rejected · ineligible for output', { exact: true }).waitFor()
  await comparison.getByText('Pointing-hand treatment reads as if the hand was severed.', { exact: true }).waitFor()
  await comparison.getByText(/The pointed finger, skeptical gaze, cyan product glow/).waitFor()
  await comparison.getByText(/Both hands visibly grip the product edge/).waitFor()
  await comparison.scrollIntoViewIfNeeded()
  await page.waitForTimeout(450)
  await assertNoOverflow(page, `${label} Jev comparison`)
  await page.screenshot({ path: path.join(outputDir, `${label}-jev-candidate-comparison.jpg`), type: 'jpeg', quality: 82 })
  await comparison.getByRole('article').nth(1).scrollIntoViewIfNeeded()
  await page.waitForTimeout(450)
  await assertNoOverflow(page, `${label} Jev candidate B`)
  await page.screenshot({ path: path.join(outputDir, `${label}-jev-candidate-b.jpg`), type: 'jpeg', quality: 82 })

  const jevGates = panel.getByLabel('Jev evidence gates')
  if (await jevGates.getByRole('article').count() !== 11) throw new Error(`${label} Jev gate matrix is incomplete.`)
  await jevGates.scrollIntoViewIfNeeded()
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(outputDir, `${label}-jev-gates.jpg`), type: 'jpeg', quality: 82 })

  const longBoards = panel.getByText(/YouTube long-form scene board · 6 scenes · 4:00/)
  await longBoards.nth(0).click()
  await longBoards.nth(0).click()
  const cta = panel.getByText(/Spoken conclusion and CTA:/).first()
  await cta.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outputDir, `${label}-jev-conclusion.jpg`), type: 'jpeg', quality: 82 })

  await providerHeadings.nth(1).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await assertNoOverflow(page, `${label} Dark Castle asset`)
  await page.screenshot({ path: path.join(outputDir, `${label}-dark-castle-asset.jpg`), type: 'jpeg', quality: 82 })

  const darkCastleGates = panel.getByLabel('Dark Castle Chess evidence gates')
  if (await darkCastleGates.getByRole('article').count() !== 11) throw new Error(`${label} Dark Castle gate matrix is incomplete.`)
  await darkCastleGates.scrollIntoViewIfNeeded()
  await page.waitForTimeout(450)

  let recoveryActions = []
  if (exerciseLinks) {
    const recoveryResult = await exerciseRecoveryLinks(page, panel)
    panel = recoveryResult.panel
    recoveryActions = recoveryResult.exercised
  }

  await panel.getByText(/Human QA status: review pending\./).scrollIntoViewIfNeeded()
  await page.waitForTimeout(650)
  await assertNoOverflow(page, `${label} closed gates`)
  await page.screenshot({ path: path.join(outputDir, `${label}-closed-gates.jpg`), type: 'jpeg', quality: 82 })

  await context.close()
  const rawPath = video ? await video.path() : null
  if (!rawPath) throw new Error(`${label} did not produce a video.`)
  if (unexpectedRequests.length) {
    throw new Error(`${label} made unexpected external requests: ${unexpectedRequests.join(', ')}`)
  }
  return { rawPath, recoveryActions }
}

const browser = await chromium.launch({ headless: true })
const storageState = await authenticatedStorageState(browser)
const scenarios = [
  { label: 'desktop-1440-dark', viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', exerciseLinks: true },
  { label: 'tablet-768-light', viewport: { width: 768, height: 1024 }, colorScheme: 'light', exerciseLinks: false },
  { label: 'mobile-390-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark', exerciseLinks: false },
]
const recordings = []
for (const scenario of scenarios) recordings.push(await recordScenario(browser, storageState, scenario))
await browser.close()

const ffmpegInputs = recordings.flatMap(({ rawPath }) => ['-i', rawPath])
const filters = recordings.map((_, index) => `[${index}:v]scale=1440:1000:force_original_aspect_ratio=decrease,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${index}]`).join(';')
const concatInputs = recordings.map((_, index) => `[v${index}]`).join('')
await execFileAsync('ffmpeg', [
  '-y',
  ...ffmpegInputs,
  '-filter_complex',
  `${filters};${concatInputs}concat=n=${recordings.length}:v=1:a=0[outv]`,
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  mp4Path,
])
await rm(rawVideoDir, { recursive: true, force: true })

const screenshots = scenarios.flatMap(({ label }) => [
  `${label}-overview.jpg`,
  `${label}-jev-asset.jpg`,
  `${label}-jev-candidate-comparison.jpg`,
  `${label}-jev-candidate-b.jpg`,
  `${label}-jev-gates.jpg`,
  `${label}-jev-conclusion.jpg`,
  `${label}-dark-castle-asset.jpg`,
  `${label}-closed-gates.jpg`,
])
const result = {
  revision,
  route: `${baseUrl}${route}`,
  contract: 'youtube-thumbnail-hero-evidence/v2 + social-campaign-storyboard-review/v1',
  scenarios: scenarios.map(({ label, viewport, colorScheme }) => ({ label, viewport, colorScheme })),
  screenshots,
  video: path.basename(mp4Path),
  recovery_actions_exercised: recordings.flatMap(({ recoveryActions }) => recoveryActions),
  external_requests: [],
  blocked_development_telemetry: ['https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'],
  protected_actions_exercised: [],
  qa_provider_calls: 0,
  generation_provider_calls: 2,
  successful_generation_jobs: 2,
  separate_observed_charge_usd: 0,
  paid_media_calls: 0,
  production_reads: 0,
  production_writes: 0,
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
