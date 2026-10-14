import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3000'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/channel-native-video-review-2026-10-14/jev-motion-v2')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'jev-motion-review-walkthrough.mp4')
const reviewUrl = `${baseUrl}/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2`

await mkdir(rawVideoDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: authState,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
const recording = page.video()

await page.goto(reviewUrl, { waitUntil: 'domcontentloaded' })
const surface = page.getByLabel('YouTube Shorts channel-native video review')
await surface.waitFor({ state: 'visible' })
if (await page.getByText('LinkedIn Preview', { exact: true }).count()) throw new Error('Jev rendered LinkedIn preview chrome.')

const disabledActions = surface.getByRole('button', { name: /disabled$/ })
if (await disabledActions.count() !== 6) throw new Error('Jev did not expose all six disabled external actions.')
for (const action of await disabledActions.all()) {
  if (await action.isEnabled()) throw new Error('Jev exposed an enabled external action.')
}

const player = surface.getByLabel('YouTube Shorts review video')
await player.waitFor({ state: 'visible' })
await player.evaluate((element) => new Promise((resolve, reject) => {
  if (!(element instanceof HTMLVideoElement)) return reject(new Error('Review media is not a video element.'))
  if (element.readyState >= 1) return resolve(true)
  element.addEventListener('loadedmetadata', () => resolve(true), { once: true })
  element.addEventListener('error', () => reject(new Error('Review video metadata failed to load.')), { once: true })
}))
const media = await player.evaluate((element) => {
  const video = element
  return { width: video.videoWidth, height: video.videoHeight, duration: video.duration }
})
if (media.width !== 1080 || media.height !== 1920 || Math.abs(media.duration - 22) > 0.1) {
  throw new Error(`Unexpected Jev media binding: ${JSON.stringify(media)}`)
}

await player.evaluate((element) => {
  const header = document.querySelector('[data-social-detail-header]')
  const headerHeight = header?.getBoundingClientRect().height ?? 0
  window.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - headerHeight - 16), behavior: 'instant' })
})
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(outputDir, 'jev-desktop-motion-review.png') })

await player.evaluate(async (element) => {
  const video = element
  video.muted = true
  video.currentTime = 0
  await video.play()
})
await page.waitForFunction(() => {
  const video = document.querySelector('video[aria-label="YouTube Shorts review video"]')
  return video instanceof HTMLVideoElement && video.ended
}, undefined, { timeout: 30000 })

await surface.getByText('Source lineage and privacy boundaries', { exact: true }).click()
await surface.getByText('Receipt status', { exact: true }).click()
await surface.getByText(/Privacy boundary:/).first().waitFor({ state: 'visible' })
await surface.getByText('External execution remains disabled', { exact: true }).evaluate((element) => {
  const header = document.querySelector('[data-social-detail-header]')
  const headerHeight = header?.getBoundingClientRect().height ?? 0
  window.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - headerHeight - 16), behavior: 'instant' })
})
await page.waitForTimeout(700)
await page.screenshot({ path: path.join(outputDir, 'jev-desktop-receipts.png') })

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(reviewUrl, { waitUntil: 'domcontentloaded' })
await surface.waitFor({ state: 'visible' })
await player.waitFor({ state: 'visible' })
await player.evaluate((element) => {
  const header = document.querySelector('[data-social-detail-header]')
  const headerHeight = header?.getBoundingClientRect().height ?? 0
  window.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - headerHeight - 12), behavior: 'instant' })
})
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(outputDir, 'jev-mobile-motion-review.png') })

await context.close()
await browser.close()

const rawPath = await recording?.path()
if (!rawPath) throw new Error('Playwright did not produce a Jev walkthrough video.')
const webmPath = path.join(outputDir, 'jev-motion-review-walkthrough.webm')
await rename(rawPath, webmPath)
await execFileAsync('ffmpeg', [
  '-y',
  '-i', webmPath,
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  mp4Path,
])
await unlink(webmPath)

console.log(JSON.stringify({
  outputDir,
  mp4Path,
  reviewUrl,
  media,
  viewports: ['1440x900', '390x844'],
  externalActionsEnabled: 0,
}, null, 2))
