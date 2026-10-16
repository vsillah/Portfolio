import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3107'
const revision = process.env.QA_REVISION || 'working-tree'
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/channel-experiment-social-detail-2026-10-16')
const rawDir = path.join(root, 'test-results', 'channel-experiment-social-detail-video')
const finalMp4 = path.join(outputDir, 'channel-experiment-social-detail-walkthrough.mp4')
const records = [
  { id: 'licenses-yt-a', title: 'Stop Counting AI Licenses: Build a Readiness Scorecard That Shows the Work' },
  { id: 'licenses-yt-b', title: 'Your AI Pilot Worked. Then the Handoff Broke.' },
  { id: 'pm-os-yt-a', title: "The Product Manager's New Operating System: The SAM Loop for AI Work" },
  { id: 'pm-os-yt-b', title: 'I Built the Product Brief With AI. Then I Audited Every Decision.' },
  { id: 'harness-yt-a', title: 'The Agent Harness Is the Product: 7 Systems Your Demo Still Needs' },
  { id: 'harness-yt-b', title: 'Can You Reconstruct What Your AI Agent Did? A Receipt Test' },
]

mkdirSync(outputDir, { recursive: true })
rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

const rawStorageState = JSON.parse(readFileSync(authStatePath, 'utf8'))
const storageState = {
  ...rawStorageState,
  origins: (rawStorageState.origins || []).map(origin => ({ ...origin, origin: baseUrl })),
}

function route(record) {
  const params = new URLSearchParams({
    step: 'copy',
    qa_fixture: 'channel_experiment_social_detail_v1',
    rev: revision,
  })
  return `${baseUrl}/admin/social-content/${record.id}?${params.toString()}`
}

async function createPage(context) {
  const page = await context.newPage()
  const externalRequests = []
  const allowedAuthRequests = []
  const blockedExpectedRequests = []
  await page.route('**/*', async requestRoute => {
    const url = new URL(requestRoute.request().url())
    if (url.origin === baseUrl) return requestRoute.continue()
    if (/\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/auth/v1/')) {
      allowedAuthRequests.push(requestRoute.request().url())
      return requestRoute.continue()
    }
    if (url.hostname === 'va.vercel-scripts.com') {
      blockedExpectedRequests.push(requestRoute.request().url())
      return requestRoute.abort('blockedbyclient')
    }
    externalRequests.push(requestRoute.request().url())
    return requestRoute.abort('blockedbyclient')
  })
  return { page, externalRequests, allowedAuthRequests, blockedExpectedRequests }
}

async function recordViewport(browser, { label, viewport }) {
  const videoDir = path.join(rawDir, label)
  mkdirSync(videoDir, { recursive: true })
  const context = await browser.newContext({
    storageState,
    viewport,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    recordVideo: { dir: videoDir, size: viewport },
  })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  const { page, externalRequests, allowedAuthRequests, blockedExpectedRequests } = await createPage(context)
  const routeReceipts = []

  for (const record of records) {
    const url = route(record)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const surface = page.getByRole('region', { name: `YouTube experiment review: ${record.title}` })
    await surface.waitFor({ state: 'visible', timeout: 30_000 })
    await surface.getByText(record.title, { exact: true }).waitFor({ state: 'visible' })
    for (const heading of ['Opening hook', 'Episode outline', 'Thumbnail brief', 'Evidence lineage', 'Product-proof requirements']) {
      await surface.getByText(heading, { exact: true }).waitFor({ state: 'visible' })
    }
    if (await page.getByText('LinkedIn Preview', { exact: true }).count()) throw new Error(`${label} ${record.id} rendered LinkedIn preview guidance.`)
    if (await page.getByText('LinkedIn optimal: 150-300 words', { exact: true }).count()) throw new Error(`${label} ${record.id} rendered LinkedIn copy guidance.`)
    if (!await surface.getByText('Unscored', { exact: true }).count()) throw new Error(`${label} ${record.id} did not expose the Unscored state.`)
    if (!await page.getByText('Privacy-safe channel-native YouTube experiment fixture. Review only.', { exact: true }).count()) throw new Error(`${label} ${record.id} did not expose the read-only fixture notice.`)

    const routeScreenshot = `${label}-${record.id}-route.png`
    const reviewScreenshot = `${label}-${record.id}-review.png`
    await page.screenshot({ path: path.join(outputDir, routeScreenshot), fullPage: false })

    await page.locator('[data-social-detail-header]').evaluate(element => {
      element.style.position = 'relative'
      element.style.maxHeight = 'none'
    })
    await surface.evaluate(element => {
      const scroller = document.querySelector('#admin-main')
      if (!(scroller instanceof HTMLElement)) throw new Error('Admin scroll container is missing.')
      const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
    })
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(outputDir, reviewScreenshot), fullPage: false })

    await surface.getByText('Score inputs and Unscored evidence', { exact: true }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    await surface.getByText('Evidence boundaries and execution gates', { exact: true }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)

    routeReceipts.push({ id: record.id, url, screenshots: [routeScreenshot, reviewScreenshot] })
  }

  const video = page.video()
  await context.close()
  const rawVideoPath = await video?.path()
  if (!rawVideoPath) throw new Error(`${label} did not produce a walkthrough recording.`)
  const stableVideoPath = path.join(rawDir, `${label}.webm`)
  renameSync(rawVideoPath, stableVideoPath)
  if (externalRequests.length) throw new Error(`${label} made unexpected external requests: ${externalRequests.join(', ')}`)

  return { stableVideoPath, routeReceipts, allowedAuthRequests, blockedExpectedRequests }
}

const browser = await chromium.launch({ headless: true })
let desktop
let mobile
try {
  desktop = await recordViewport(browser, { label: 'desktop-1440', viewport: { width: 1440, height: 900 } })
  mobile = await recordViewport(browser, { label: 'mobile-390', viewport: { width: 390, height: 844 } })
} finally {
  await browser.close()
}

execFileSync('ffmpeg', [
  '-y',
  '-i', desktop.stableVideoPath,
  '-i', mobile.stableVideoPath,
  '-filter_complex',
  '[0:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v0];[1:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  finalMp4,
], { stdio: 'ignore' })

const probe = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames:format=duration,size',
  '-of', 'json',
  finalMp4,
], { encoding: 'utf8' }))

for (const receipt of [...desktop.routeReceipts, ...mobile.routeReceipts]) {
  for (const screenshot of receipt.screenshots) {
    if (!existsSync(path.join(outputDir, screenshot))) throw new Error(`Missing screenshot ${screenshot}.`)
  }
}

const receipt = {
  revision,
  fixture: 'channel_experiment_social_detail_v1',
  record_ids: records.map(record => record.id),
  exact_routes: desktop.routeReceipts.map(item => item.url),
  viewports: ['1440x900', '390x844'],
  routes_reviewed: desktop.routeReceipts.length + mobile.routeReceipts.length,
  screenshots: [...desktop.routeReceipts, ...mobile.routeReceipts].flatMap(item => item.screenshots),
  assertions: [
    'title',
    'description',
    'opening hook',
    'episode outline',
    'thumbnail brief',
    'evidence lineage',
    'product-proof requirements',
    'Unscored state',
    'no LinkedIn preview guidance',
    'read-only notice',
  ],
  side_effects: {
    production_social_content_reads: false,
    production_writes: false,
    provider_calls: false,
    rendering: false,
    upload: false,
    platform_draft: false,
    schedule: false,
    publish: false,
    external_send: false,
  },
  network: {
    unexpected_external_requests: 0,
    allowed_auth_requests: desktop.allowedAuthRequests.length + mobile.allowedAuthRequests.length,
    blocked_expected_analytics_requests: desktop.blockedExpectedRequests.length + mobile.blockedExpectedRequests.length,
  },
  mp4: path.relative(root, finalMp4),
  mp4_sha256: createHash('sha256').update(readFileSync(finalMp4)).digest('hex'),
  probe,
}
writeFileSync(path.join(outputDir, 'qa-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt, null, 2))
