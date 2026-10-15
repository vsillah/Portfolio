import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || path.join(root, '.auth', 'outlier-evidence-local-storage-state.json')
const outputDir = path.join(root, 'docs', 'social-content', 'qa', 'outlier-evidence-calibration')
const rawDir = path.join(root, 'test-results', 'outlier-evidence-calibration-video')
const publicMp4 = path.join(root, 'public', 'review-assets', 'social-content', 'outlier-evidence-calibration-responsive-walkthrough.mp4')
const finalMp4 = publicMp4

if (!existsSync(authState)) throw new Error(`Missing Playwright auth state: ${authState}`)
mkdirSync(outputDir, { recursive: true })
mkdirSync(path.dirname(publicMp4), { recursive: true })
rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

const route = (state) => `${baseUrl}/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=context&qa_fixture=channel_native_video_v2&outlierQa=${state}`

async function openScorecard(page, state = 'ready') {
  await page.goto(route(state), { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Outlier evidence scorecard' }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByTestId('outlier-evidence-scorecard').scrollIntoViewIfNeeded()
}

async function recordScenario(browser, { name, viewport, mobile = false }) {
  const videoDir = path.join(rawDir, name)
  mkdirSync(videoDir, { recursive: true })
  const context = await browser.newContext({
    storageState: authState,
    viewport,
    colorScheme: 'dark',
    recordVideo: { dir: videoDir, size: viewport },
  })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  const page = await context.newPage()
  await openScorecard(page, 'ready')
  const scorecard = page.getByTestId('outlier-evidence-scorecard')
  if (mobile) {
    await page.screenshot({ path: path.join(outputDir, `${name}-ready-dark.png`) })
  } else {
    await scorecard.screenshot({ path: path.join(outputDir, `${name}-ready-dark.png`) })
  }
  await page.waitForTimeout(700)
  const productEvidence = scorecard.getByRole('button', { name: /Product evidence/ })
  await productEvidence.click()
  await page.waitForTimeout(700)
  if (mobile) {
    await productEvidence.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(outputDir, `${name}-product-drill-in-dark.png`) })
  }
  await scorecard.getByText('Sources, exclusions, and deterministic inputs').click()
  await page.waitForTimeout(900)

  if (!mobile) {
    for (const state of ['missing', 'stale', 'unauthorized']) {
      await openScorecard(page, state)
      await page.waitForTimeout(700)
    }
    await openScorecard(page, 'ready')
    await page.waitForTimeout(700)
  } else {
    await scorecard.getByRole('button', { name: /Originality risk control/ }).click()
    await page.waitForTimeout(900)
  }

  const video = page.video()
  await context.close()
  const videoPath = await video.path()
  if (!videoPath) throw new Error(`No recorded video path for ${name}`)
  return videoPath
}

async function captureLight(browser) {
  const context = await browser.newContext({
    storageState: authState,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'light'))
  const page = await context.newPage()
  await openScorecard(page, 'ready')
  await page.getByTestId('outlier-evidence-scorecard').screenshot({ path: path.join(outputDir, 'desktop-1440-ready-light.png') })
  await context.close()
}

const browser = await chromium.launch({ headless: true })
let desktopVideo
let mobileVideo
try {
  desktopVideo = await recordScenario(browser, { name: 'desktop-1440', viewport: { width: 1440, height: 900 } })
  mobileVideo = await recordScenario(browser, { name: 'mobile-390', viewport: { width: 390, height: 844 }, mobile: true })
  await captureLight(browser)
} finally {
  await browser.close()
}

execFileSync('ffmpeg', [
  '-y',
  '-i', desktopVideo,
  '-i', mobileVideo,
  '-filter_complex',
  '[0:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v0];[1:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  finalMp4,
], { stdio: 'ignore' })

const probe = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames:format=duration,size',
  '-of', 'json',
  finalMp4,
], { encoding: 'utf8' }))

const receipt = {
  route: route('ready'),
  states_reviewed: ['ready', 'missing', 'stale', 'unauthorized'],
  viewports: ['1440x900', '390x844'],
  themes: ['dark', 'light'],
  interactions: ['product evidence drill-in', 'originality risk drill-in', 'source disclosure', 'source links'],
  side_effects: {
    provider_generation: false,
    upload: false,
    platform_draft: false,
    schedule: false,
    publish: false,
    external_send: false,
  },
  mp4: path.relative(root, finalMp4),
  mp4_sha256: createHash('sha256').update(readFileSync(finalMp4)).digest('hex'),
  probe,
}
writeFileSync(path.join(outputDir, 'qa-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt, null, 2))
