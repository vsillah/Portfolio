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
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/primary-campaign-hero-thumbnail-review-2026-10-19')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'primary-campaign-hero-thumbnail-review-walkthrough.mp4')
const route = `/admin/social-content?campaignQa=campaign-package-preparation-review-v1&rev=${encodeURIComponent(revision)}`

const campaigns = [
  {
    label: 'Dark Castle Chess',
    slug: 'dark-castle',
    teasers: ['REMEMBER THE WHY', 'SEE THE CONSEQUENCE'],
  },
  {
    label: 'AI Audit Calculator',
    slug: 'ai-audit',
    teasers: ['WHO OWNS THE CLEANUP?', 'THE BILL HIDES HERE'],
  },
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
  if (dimensions.scroll > dimensions.client + 1) throw new Error(`${label} has horizontal overflow: ${JSON.stringify(dimensions)}`)
}

async function waitForImages(locator) {
  const image = locator.locator('img').first()
  await image.waitFor({ state: 'visible', timeout: 15_000 })
  await image.evaluate(async (element) => {
    if (element.complete) return
    await new Promise((resolve) => {
      element.addEventListener('load', resolve, { once: true })
      element.addEventListener('error', resolve, { once: true })
    })
  })
}

async function authenticatedStorageState(browser) {
  const context = await browser.newContext({ storageState: authState })
  const page = await context.newPage()
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('[data-testid="campaign-package-preparation"], input[type="email"]').first().waitFor({ state: 'visible', timeout: 60_000 })
  if (await page.getByLabel('Email', { exact: true }).isVisible()) {
    if (!process.env.ADMIN_E2E_EMAIL || !process.env.ADMIN_E2E_PASSWORD) throw new Error('Local QA admin credentials are unavailable.')
    await page.getByLabel('Email', { exact: true }).fill(process.env.ADMIN_E2E_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill(process.env.ADMIN_E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/admin/social-content', { timeout: 30_000 })
  }
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.getByTestId('primary-thumbnail-reviews').waitFor({ state: 'visible', timeout: 30_000 })
  const state = await context.storageState({ indexedDB: true })
  await context.close()
  return state
}

async function reopenReview(page) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const panel = page.getByTestId('campaign-package-preparation')
  await panel.waitFor({ state: 'visible', timeout: 30_000 })
  await panel.getByTestId('primary-thumbnail-reviews').waitFor({ state: 'visible', timeout: 30_000 })
  return panel
}

async function validateCampaign(panel, campaign) {
  const comparison = panel.getByLabel(`${campaign.label} thumbnail candidate comparison`)
  if (await comparison.getByRole('article').count() !== 2) throw new Error(`${campaign.label} did not render exactly two candidates.`)
  if (await comparison.getByAltText(/actual-feed-size preview/).count() !== 2) throw new Error(`${campaign.label} did not render two feed previews.`)
  if (await comparison.getByText('Human QA pending · output ineligible', { exact: true }).count() !== 2) throw new Error(`${campaign.label} exposed an eligible output before Human QA.`)
  for (const teaser of campaign.teasers) await comparison.getByAltText(new RegExp(`thumbnail reading ${teaser.replace(/[?]/g, '\\?')}`, 'i')).waitFor()
  const decisions = comparison.getByText('Inspect live-evidence creative decisions')
  if (await decisions.count() !== 2) throw new Error(`${campaign.label} did not render both evidence controls.`)
  return comparison
}

async function recordScenario(browser, storageState, scenario) {
  const context = await browser.newContext({
    storageState,
    viewport: scenario.viewport,
    colorScheme: scenario.colorScheme,
    reducedMotion: 'reduce',
    recordVideo: { dir: path.join(rawVideoDir, scenario.label), size: scenario.viewport },
  })
  await context.route('https://va.vercel-scripts.com/**', (requestRoute) => requestRoute.abort('blockedbyclient'))
  const page = await context.newPage()
  const unexpectedRequests = watchExternalRequests(page)
  const video = page.video()
  let panel = await reopenReview(page)

  await panel.getByRole('heading', { name: 'Primary campaign hero thumbnails' }).waitFor()
  await panel.getByText(/4 provider calls · 4 successful jobs · 0 retries · 0 uncertain results/).waitFor()
  await panel.getByText('2 campaigns · selection pending', { exact: true }).waitFor()
  const primaryReview = panel.getByTestId('primary-thumbnail-reviews')
  await primaryReview.locator('img').first().scrollIntoViewIfNeeded()
  await waitForImages(primaryReview)
  await primaryReview.getByRole('heading', { name: 'Primary campaign hero thumbnails' }).scrollIntoViewIfNeeded()
  await assertNoOverflow(page, `${scenario.label} overview`)
  await page.screenshot({ path: path.join(outputDir, `${scenario.label}-overview.jpg`), type: 'jpeg', quality: 84 })

  for (const campaign of campaigns) {
    const comparison = await validateCampaign(panel, campaign)
    const candidates = comparison.getByRole('article')
    await candidates.nth(0).scrollIntoViewIfNeeded()
    await waitForImages(candidates.nth(0))
    await page.waitForTimeout(450)
    await assertNoOverflow(page, `${scenario.label} ${campaign.label}`)
    await page.screenshot({ path: path.join(outputDir, `${scenario.label}-${campaign.slug}-comparison.jpg`), type: 'jpeg', quality: 84 })
    await candidates.nth(1).scrollIntoViewIfNeeded()
    await waitForImages(candidates.nth(1))
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(outputDir, `${scenario.label}-${campaign.slug}-candidate-b.jpg`), type: 'jpeg', quality: 84 })
    const evidenceControl = comparison.getByText('Inspect live-evidence creative decisions').first()
    await evidenceControl.click()
    await comparison.getByText(/campaign-specific likeness makes the owner of the decision concrete/i).first().waitFor()
    await evidenceControl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(outputDir, `${scenario.label}-${campaign.slug}-evidence.jpg`), type: 'jpeg', quality: 84 })
  }

  const decisionGates = panel.getByRole('heading', { name: 'Decision gate' })
  if (await decisionGates.count() !== 2) throw new Error(`${scenario.label} did not render both pending decision gates.`)
  await decisionGates.first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(outputDir, `${scenario.label}-decision-gates.jpg`), type: 'jpeg', quality: 84 })

  const recoveryActions = []
  if (scenario.exerciseLinks) {
    const links = panel.getByRole('link', { name: /Review the full-size and 320×180 candidates/ })
    if (await links.count() !== 2) throw new Error('Both campaign recovery controls were not present.')
    for (let index = 0; index < 2; index += 1) {
      const href = await links.nth(index).getAttribute('href')
      if (!href?.startsWith('/admin/social-content?workflow=evidence&campaign=')) throw new Error(`Recovery link is not campaign-scoped: ${href}`)
      recoveryActions.push(href)
      await links.nth(index).click()
      await page.waitForURL((url) => url.pathname === '/admin/social-content' && url.searchParams.get('workflow') === 'evidence', { timeout: 30_000 })
      panel = await reopenReview(page)
    }
  }

  await panel.getByText(/Human QA status: review pending\./).scrollIntoViewIfNeeded()
  await panel.getByText(/Upload, platform draft, scheduling, publishing, deployment, merge, credentials, migrations, and external sends remain closed\./).waitFor()
  await page.waitForTimeout(500)
  await assertNoOverflow(page, `${scenario.label} closed gates`)
  await page.screenshot({ path: path.join(outputDir, `${scenario.label}-closed-gates.jpg`), type: 'jpeg', quality: 84 })

  await context.close()
  const rawPath = video ? await video.path() : null
  if (!rawPath) throw new Error(`${scenario.label} did not produce a video.`)
  if (unexpectedRequests.length) throw new Error(`${scenario.label} made unexpected external requests: ${unexpectedRequests.join(', ')}`)
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
  '-filter_complex', `${filters};${concatInputs}concat=n=${recordings.length}:v=1:a=0[outv]`,
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  mp4Path,
])
await rm(rawVideoDir, { recursive: true, force: true })

const screenshots = scenarios.flatMap(({ label }) => [
  `${label}-overview.jpg`,
  `${label}-dark-castle-comparison.jpg`,
  `${label}-dark-castle-candidate-b.jpg`,
  `${label}-dark-castle-evidence.jpg`,
  `${label}-ai-audit-comparison.jpg`,
  `${label}-ai-audit-candidate-b.jpg`,
  `${label}-ai-audit-evidence.jpg`,
  `${label}-decision-gates.jpg`,
  `${label}-closed-gates.jpg`,
])
const result = {
  revision,
  route: `${baseUrl}${route}`,
  contract: 'youtube-thumbnail-hero-evidence/v2 + social-campaign-storyboard-review/v1',
  campaigns: campaigns.map(({ label, teasers }) => ({ label, teasers, candidates: 2, final_use_eligible: false })),
  scenarios: scenarios.map(({ label, viewport, colorScheme }) => ({ label, viewport, colorScheme })),
  screenshots,
  video: path.basename(mp4Path),
  recovery_actions_exercised: recordings.flatMap(({ recoveryActions }) => recoveryActions),
  external_requests: [],
  blocked_development_telemetry: ['https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'],
  protected_actions_exercised: [],
  qa_provider_calls: 0,
  generation_provider_calls: 4,
  successful_generation_jobs: 4,
  retries: 0,
  uncertain_results: 0,
  separate_observed_charge_usd: 0,
  combined_hard_ceiling_usd: 9,
  combined_hard_ceiling_relation: 'strictly_below',
  paid_media_calls: 0,
  production_reads: 0,
  production_writes: 0,
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
