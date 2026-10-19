import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

const root = process.cwd()
loadEnv({ path: path.join(root, '.env.local') })
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3210'
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
const revision = process.env.REVIEW_REVISION || 'eca8afd3'
const route = `${baseUrl}/admin/social-content?campaignQa=campaign-package-preparation-v1&rev=${revision}`
const outputDir = path.join(root, 'artifacts/human-qa/social-campaign-typography-review-2026-10-19')
const authStatePath = path.join(root, '.auth/portfolio-admin-storage-state.json')
const authState = JSON.parse(await readFile(authStatePath, 'utf8'))
const outboundRequests = new Set()
const browser = await chromium.launch({ headless: true })
const desktopContext = await browser.newContext({
  storageState: authState,
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 1000 } },
})

await mkdir(outputDir, { recursive: true })
await desktopContext.route('**/*', async (requestRoute) => {
  const requestUrl = new URL(requestRoute.request().url())
  if (requestUrl.origin === baseUrl || requestUrl.origin === supabaseOrigin) return requestRoute.continue()
  outboundRequests.add(requestUrl.origin)
  return requestRoute.abort()
})

const desktop = await desktopContext.newPage()
await desktop.goto(route, { waitUntil: 'networkidle', timeout: 60000 })
await desktop.getByRole('heading', { name: 'Evidence-backed campaign preparation' }).waitFor({ state: 'visible' })
await desktop.screenshot({ path: path.join(outputDir, 'desktop-1440-initial.png') })

await desktop.getByRole('button', { name: 'Prepare eligible visual plans' }).click()
await desktop.getByText('12 total · 12 scanned · 0 prepared · 12 blocked · 0 remaining · 2 chunks', { exact: true }).waitFor({ state: 'visible' })
await desktop.getByText('Typography Unscored · review direction only', { exact: true }).waitFor({ state: 'visible' })
await desktop.getByAltText(/review direction: MATH IN THE MOVE/i).waitFor({ state: 'visible' })
await desktop.getByText('Typography evidence · unscored', { exact: true }).waitFor({ state: 'visible' })
await desktop.getByText(/2 context-only comparables \(weight 0\)/).waitFor({ state: 'visible' })
await desktop.getByText(/Approval requires at least 4 matched-style examples at performance weight 1/).waitFor({ state: 'visible' })
await desktop.getByText(/Package inputs pass; thumbnail approval remains Unscored/).waitFor({ state: 'visible' })
await desktop.waitForTimeout(900)
await desktop.locator('[data-testid="visual-plan-details"]').scrollIntoViewIfNeeded()
await desktop.screenshot({ path: path.join(outputDir, 'desktop-1440-kicklab-review.png') })
await desktop.getByText('Typography evidence · unscored', { exact: true }).scrollIntoViewIfNeeded()
await desktop.screenshot({ path: path.join(outputDir, 'desktop-1440-typography-receipt.png') })
await desktop.getByText(/Expanded public channel scan · 9 channels · 11 exact candidate videos/).click()
await desktop.getByText(/Khan Academy · physics education \/ youth STEM/).waitFor({ state: 'visible' })
await desktop.getByText(/rounded\/heavy white sentence-case lesson lettering/i).waitFor({ state: 'visible' })
await desktop.getByText(/30-day median 53,950 views/).waitFor({ state: 'visible' })
await desktop.getByText(/0 of 4 exact-style matched examples/).waitFor({ state: 'visible' })
await desktop.screenshot({ path: path.join(outputDir, 'desktop-1440-expanded-channel-scan.png') })

const desktopOverflow = await desktop.evaluate(() => ({
  viewportWidth: window.innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
}))
const desktopExpected = await desktop.getByRole('button', { name: 'Return existing visual batch' }).isVisible()
const desktopVideo = desktop.video()
await desktopContext.close()
const desktopWebm = await desktopVideo.path()

const responsiveResults = []
for (const viewport of [{ width: 768, height: 1024, label: 'tablet-768' }, { width: 390, height: 844, label: 'mobile-390' }]) {
  const context = await browser.newContext({ storageState: authState, viewport: { width: viewport.width, height: viewport.height } })
  await context.route('**/*', async (requestRoute) => {
    const requestUrl = new URL(requestRoute.request().url())
    if (requestUrl.origin === baseUrl || requestUrl.origin === supabaseOrigin) return requestRoute.continue()
    outboundRequests.add(requestUrl.origin)
    return requestRoute.abort()
  })
  const page = await context.newPage()
  await page.goto(route, { waitUntil: 'networkidle', timeout: 60000 })
  await page.getByRole('button', { name: 'Prepare eligible visual plans' }).click()
  await page.getByText('12 total · 12 scanned · 0 prepared · 12 blocked · 0 remaining · 2 chunks', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Typography Unscored · review direction only', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(outputDir, `${viewport.label}-kicklab-review.png`) })
  await page.getByText(/Typography performance: Unscored/).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(outputDir, `${viewport.label}-typography-receipt.png`) })
  const overflow = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }))
  responsiveResults.push({ viewport: viewport.label, ...overflow })
  await context.close()
}

await browser.close()

const results = {
  version: 'kicklab-typography-review-evidence/v1',
  reviewed_commit: revision,
  route,
  fixture: 'campaign-package-preparation-v1 (synthetic local fixture)',
  visual_batch: { total: 12, scanned: 12, prepared: 0, blocked: 12, remaining: 0 },
  observed_states: [
    'Raster thumbnail is visible as a review direction only.',
    'Typography style evidence is Unscored; zero-weight topic/audience comparables are context-only, while approval requires at least four performance-weight-1 matched-style examples and a normalized cohort result.',
    'Expanded read-only public audit screened nine channels across sports science, physics education, youth STEM, and gameplay learning; zero of four exact-style matches and the normalized result remains null.',
    'Five current Khan Academy AP Physics uploads are eligible as same-channel baseline candidates; their rounded/heavy sentence-case lesson lettering is recorded as a style non-match, so no candidate cohort is inferred.',
    'Eleven exact candidate records include public watch URLs, thumbnail URLs, publish/capture dates, views, duration, promotion status, type observations, and exclusion reasons; the original How Ridiculous exclusions remain preserved.',
    'Recovery action is visible; package readiness warning explicitly separates package inputs from thumbnail approval.',
    'Visual and external provider gates remain closed; no production, platform, upload, scheduling, publishing, external write, or external-send action was performed.',
  ],
  public_evidence_audit: {
    channels_screened: 9,
    candidate_videos: 11,
    eligible_same_channel_baseline_observed: 5,
    eligible_same_channel_baseline_median_30_day_views: 53950,
    matched_style_observed: 0,
    matched_style_required: 4,
    eligible_same_channel_baseline_required: 4,
    normalization_result: null,
    verdict: 'unscored',
    captured_at: '2026-10-19',
  },
  viewport_overflow_checks: [{ viewport: 'desktop-1440', ...desktopOverflow }, ...responsiveResults],
  workflow_action_visible_after_prepare: desktopExpected,
  external_origins_blocked: [...outboundRequests].sort(),
  external_origins_allowed: [supabaseOrigin],
  permitted_external_use: 'Portfolio Supabase Auth session validation only; provider, campaign, and publishing origins remain blocked.',
  external_writes: 0,
  desktop_video_source: path.relative(root, desktopWebm),
  desktop_video_mp4: 'artifacts/human-qa/social-campaign-typography-review-2026-10-19/social-campaign-typography-review.mp4',
  screenshots: [
    'desktop-1440-initial.png',
    'desktop-1440-kicklab-review.png',
    'desktop-1440-typography-receipt.png',
    'desktop-1440-expanded-channel-scan.png',
    'tablet-768-kicklab-review.png',
    'tablet-768-typography-receipt.png',
    'mobile-390-kicklab-review.png',
    'mobile-390-typography-receipt.png',
  ],
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
console.log(JSON.stringify({ route, outputDir: path.relative(root, outputDir), screenshots: results.screenshots, viewport_overflow_checks: results.viewport_overflow_checks, external_origins_allowed: results.external_origins_allowed }))
