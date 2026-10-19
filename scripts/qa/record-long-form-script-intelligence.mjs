import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3210'
const revision = process.env.QA_REVISION || '28920065'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '.auth/long-form-script-intelligence-local.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/long-form-script-intelligence-2026-10-18')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'long-form-script-intelligence-walkthrough.mp4')
const route = (state) => `/admin/content/video-generation?qa_script_intelligence=${encodeURIComponent(state)}&rev=${encodeURIComponent(revision)}`

await rm(rawVideoDir, { recursive: true, force: true })
await mkdir(rawVideoDir, { recursive: true })

function watchRequests(page) {
  const unexpected = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return
    if (/\.supabase\.co$/i.test(url.hostname) && url.pathname.startsWith('/auth/v1/')) return
    if (url.hostname === 'va.vercel-scripts.com') return
    unexpected.push(request.url())
  })
  return unexpected
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  if (dimensions.scrollWidth > dimensions.clientWidth + 1) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(dimensions)}`)
  }
}

async function openReview(page, state) {
  await page.goto(`${baseUrl}${route(state)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const review = page.getByTestId('long-form-script-intelligence-review')
  await review.waitFor({ state: 'visible', timeout: 30_000 })
  await review.scrollIntoViewIfNeeded()
  const expected = state === 'ready'
    ? 'Script intelligence passed'
    : state === 'stale'
      ? 'Evidence remains Unscored'
      : 'Script remains blocked'
  await page.getByText(expected, { exact: true }).waitFor()
  return review
}

async function recordScenario(browser, { label, viewport, mobile }) {
  const context = await browser.newContext({
    storageState: authState,
    viewport,
    colorScheme: 'dark',
    recordVideo: { dir: path.join(rawVideoDir, label), size: viewport },
  })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  const page = await context.newPage()
  await page.route('https://va.vercel-scripts.com/**', (routeRequest) => routeRequest.abort('blockedbyclient'))
  const unexpectedRequests = watchRequests(page)
  const video = page.video()
  let review = await openReview(page, 'ready')

  await assertNoHorizontalOverflow(page, `${label} passing`)
  if (mobile) {
    await page.screenshot({ path: path.join(outputDir, `${label}-passing.png`) })
  } else {
    await review.screenshot({ path: path.join(outputDir, `${label}-passing.png`) })
  }
  await page.waitForTimeout(900)

  await review.getByRole('button', { name: 'Proof placement' }).click()
  await review.getByRole('heading', { name: 'Proof placement' }).waitFor()
  await page.waitForTimeout(900)

  await review.getByText('Topic sources, exclusions, and deterministic fingerprint', { exact: true }).click()
  await review.getByText('Included live sources', { exact: true }).waitFor()
  await page.waitForTimeout(900)

  review = await openReview(page, 'stale')
  await assertNoHorizontalOverflow(page, `${label} stale`)
  if (mobile) {
    await page.screenshot({ path: path.join(outputDir, `${label}-stale.png`) })
  } else {
    await review.screenshot({ path: path.join(outputDir, `${label}-stale.png`) })
  }
  await page.waitForTimeout(1000)

  review = await openReview(page, 'originality_blocked')
  await assertNoHorizontalOverflow(page, `${label} originality blocked`)
  if (mobile) {
    await page.screenshot({ path: path.join(outputDir, `${label}-originality-blocked.png`) })
  }
  await page.waitForTimeout(1000)

  await review.getByText('Framework receipts and public-source boundaries', { exact: true }).click()
  await review.getByText('Originality boundary:', { exact: false }).first().waitFor()
  await review.getByText('Still closed:', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)

  const finalUrl = page.url()
  const videoArtifact = video
  await context.close()
  const rawVideoPath = videoArtifact ? await videoArtifact.path() : null
  if (!rawVideoPath) throw new Error(`${label} did not produce a recording.`)
  if (unexpectedRequests.length) {
    throw new Error(`${label} made unexpected external requests: ${unexpectedRequests.join(', ')}`)
  }
  return { rawVideoPath, finalUrl }
}

const browser = await chromium.launch({ headless: true })
let desktop
let mobile
try {
  desktop = await recordScenario(browser, { label: 'desktop-1440', viewport: { width: 1440, height: 1000 }, mobile: false })
  mobile = await recordScenario(browser, { label: 'mobile-390', viewport: { width: 390, height: 844 }, mobile: true })
} finally {
  await browser.close()
}

await execFileAsync('ffmpeg', [
  '-y',
  '-i', desktop.rawVideoPath,
  '-i', mobile.rawVideoPath,
  '-filter_complex',
  '[0:v]scale=1440:1000:force_original_aspect_ratio=decrease,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v0];[1:v]scale=1440:1000:force_original_aspect_ratio=decrease,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  mp4Path,
])

const { stdout: probe } = await execFileAsync('ffprobe', [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames:format=duration,size',
  '-of', 'json',
  mp4Path,
])

await rm(rawVideoDir, { recursive: true, force: true })

const result = {
  revision,
  route: `${baseUrl}${route('ready')}`,
  states_reviewed: ['passing', 'stale evidence', 'originality blocked'],
  viewports: ['1440x1000', '390x844'],
  interactions: ['dimension drill-in', 'topic evidence trace', 'framework source receipts'],
  screenshots: [
    'desktop-1440-passing.png',
    'desktop-1440-stale.png',
    'mobile-390-passing.png',
    'mobile-390-stale.png',
    'mobile-390-originality-blocked.png',
  ],
  video: path.basename(mp4Path),
  video_probe: JSON.parse(probe),
  external_requests: [],
  blocked_development_telemetry: ['https://va.vercel-scripts.com/**'],
  protected_actions_exercised: [],
}

await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
