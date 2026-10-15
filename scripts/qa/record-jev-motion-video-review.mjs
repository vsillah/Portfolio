import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, readFile, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3000'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/social-video-production-controls-2026-10-15-revision')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'jev-social-video-production-walkthrough.mp4')
const reviewUrl = `${baseUrl}/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2`
const blockedUrl = `${reviewUrl}&video_package_state=blocked`

await mkdir(rawVideoDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: authState, viewport: { width: 1440, height: 900 }, recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } }, colorScheme: 'dark', reducedMotion: 'no-preference' })
const page = await context.newPage()
const recording = page.video()
const savedState = JSON.parse(await readFile(authState, 'utf8'))
const savedLocalStorage = savedState.origins?.flatMap((entry) => entry.localStorage ?? []) ?? []
await page.addInitScript((entries) => {
  for (const entry of entries) localStorage.setItem(entry.name, entry.value)
}, savedLocalStorage)

async function assertNoHorizontalOverflow(label) {
  const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (overflow.scrollWidth > overflow.width + 1) throw new Error(`${label} overflow: ${JSON.stringify(overflow)}`)
}

async function load(url, theme) {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const controls = page.getByLabel('Video production controls')
  await controls.waitFor({ state: 'visible' })
  await controls.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  return controls
}

async function activate(locator) {
  await locator.evaluate((element) => element.click())
}

let controls = await load(reviewUrl, 'dark')
if (await page.getByText('LinkedIn Preview', { exact: true }).count()) throw new Error('Jev rendered LinkedIn preview chrome.')
await assertNoHorizontalOverflow('desktop dark')
const enhanced = controls.getByLabel('enhanced original Jev video preview')
await enhanced.evaluate((element) => new Promise((resolve, reject) => {
  if (!(element instanceof HTMLVideoElement)) return reject(new Error('Enhanced review media is not a video element.'))
  if (element.readyState >= 1) return resolve(true)
  element.addEventListener('loadedmetadata', () => resolve(true), { once: true })
  element.addEventListener('error', () => reject(new Error('Enhanced video metadata failed to load.')), { once: true })
}))
const media = await enhanced.evaluate((video) => ({ width: video.videoWidth, height: video.videoHeight, duration: video.duration }))
if (media.width !== 1080 || media.height !== 1920 || Math.abs(media.duration - 67.28) > 0.1) throw new Error(`Unexpected enhanced media: ${JSON.stringify(media)}`)
await page.screenshot({ path: path.join(outputDir, 'jev-desktop-dark-ready.png'), fullPage: true })

await activate(controls.getByRole('button', { name: 'A · No music' }))
const baseline = controls.getByLabel('baseline original Jev video preview')
await baseline.waitFor({ state: 'visible' })
if (!String(await baseline.getAttribute('src')).endsWith('/jev-youtube-no-music-review.mp4')) throw new Error('A/B baseline is not bound to the approved no-music master.')
await activate(controls.getByRole('radio', { name: 'No music' }))
await controls.getByText('Unrendered changes', { exact: true }).waitFor({ state: 'visible' })
if (await controls.getByRole('button', { name: 'Render blocked' }).isEnabled()) throw new Error('Dirty inputs exposed an enabled render action.')
await page.screenshot({ path: path.join(outputDir, 'jev-desktop-dark-dirty.png'), fullPage: true })
await activate(controls.getByRole('button', { name: 'Reset approved' }))
await controls.getByText('Render validated', { exact: true }).waitFor({ state: 'visible' })
await activate(controls.getByRole('radio', { name: 'Naturalized · review only' }))
const naturalized = controls.getByLabel('baseline naturalized Jev video preview')
await naturalized.waitFor({ state: 'visible' })
if (!String(await naturalized.getAttribute('src')).endsWith('/jev-youtube-naturalized-voice-review.mp4')) throw new Error('Naturalized A/B is not bound to the local review reference.')
await activate(controls.getByRole('button', { name: 'Reset approved' }))
await activate(controls.getByRole('button', { name: 'Show cue details' }))
await controls.getByText(/inspect score · split screen · 16.3–26.6s/).waitFor({ state: 'visible' })

await page.setViewportSize({ width: 820, height: 900 })
controls = await load(reviewUrl, 'light')
await assertNoHorizontalOverflow('tablet light')
await page.screenshot({ path: path.join(outputDir, 'jev-tablet-light-ready.png'), fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
controls = await load(reviewUrl, 'dark')
await assertNoHorizontalOverflow('mobile reduced-motion')
await activate(controls.getByRole('radio', { name: 'Reduced motion · fades only' }))
await controls.getByText('Unrendered changes', { exact: true }).waitFor({ state: 'visible' })
await page.screenshot({ path: path.join(outputDir, 'jev-mobile-reduced-motion-dirty.png'), fullPage: true })

controls = await load(blockedUrl, 'dark')
await assertNoHorizontalOverflow('mobile blocked')
const alert = controls.getByRole('alert')
await alert.waitFor({ state: 'visible' })
const blockedMessage = await alert.innerText()
if (!/rights.*receipt is missing, stale, or unapproved/i.test(blockedMessage)) throw new Error(`Blocked fixture did not name the rights gate: ${blockedMessage}`)
if (await controls.getByRole('button', { name: 'Render blocked' }).isEnabled()) throw new Error('Rights-blocked state exposed render.')
if (await controls.getByRole('button', { name: 'Decision pending' }).isEnabled()) throw new Error('Rights-blocked state exposed decision.')
await page.screenshot({ path: path.join(outputDir, 'jev-mobile-dark-blocked.png'), fullPage: true })

await context.close()
await browser.close()
const rawPath = await recording?.path()
if (!rawPath) throw new Error('Playwright did not produce a Jev walkthrough video.')
const webmPath = path.join(outputDir, 'jev-social-video-production-walkthrough.webm')
await rename(rawPath, webmPath)
await execFileAsync('ffmpeg', ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4Path])
await unlink(webmPath)

console.log(JSON.stringify({ outputDir, mp4Path, reviewUrl, media, viewports: ['1440x900 dark', '820x900 light', '390x844 dark reduced-motion', '390x844 dark blocked'], assertions: ['A/B source switch', 'dirty invalidation', 'reset', 'cue disclosure', 'rights blocker', 'render disabled', 'decision disabled', 'no horizontal overflow'], externalActionsEnabled: 0 }, null, 2))
