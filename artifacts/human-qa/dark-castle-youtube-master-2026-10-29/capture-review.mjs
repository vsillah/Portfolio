import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdir, rename } from 'node:fs/promises'
import { resolve } from 'node:path'

const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision ?? '')) throw new Error('Pass the reviewed Git commit SHA.')

const root = process.cwd()
const output = resolve(root, 'artifacts/human-qa/dark-castle-youtube-master-2026-10-29')
const publicOutput = resolve(root, 'public/review-assets/social-content/dark-castle-youtube-master-2026-10-29')
const sourceDir = resolve(output, 'review-source')
const url = `http://127.0.0.1:3230/admin/social-content/dark-castle-youtube-master-review?rev=${revision}`

await mkdir(sourceDir, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const [name, width, height, record] of [
  ['desktop', 1440, 1000, true],
  ['mobile', 390, 844, false],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: 'dark',
    ...(record ? { recordVideo: { dir: sourceDir, size: { width, height } } } : {}),
  })
  await context.route('**/*', (route) => {
    const target = new URL(route.request().url())
    if (target.hostname === '127.0.0.1' || target.protocol === 'data:' || target.protocol === 'blob:') return route.continue()
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const review = page.getByTestId('dark-castle-youtube-master-review')
  await review.waitFor({ state: 'visible' })
  await page.getByText('3:05 final').waitFor({ state: 'visible' })
  const video = page.locator('video')
  await video.waitFor({ state: 'visible' })
  const videoReady = await video.evaluate((element) => element.readyState >= 1 && Number.isFinite(element.duration))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (!videoReady || overflow > 1) throw new Error(`${name}: video or responsive gate failed ${JSON.stringify({ videoReady, overflow })}`)

  await page.screenshot({ path: resolve(output, `${name}-review.png`), fullPage: true })
  if (record) {
    await video.evaluate((element) => { element.muted = true; element.currentTime = 78; return element.play() })
    await page.waitForTimeout(2500)
    await video.evaluate((element) => element.pause())
    await video.evaluate((element) => { element.currentTime = 163; return element.play() })
    await page.waitForTimeout(2200)
    await video.evaluate((element) => element.pause())
    await page.getByText('Choose one thumbnail direction').scrollIntoViewIfNeeded()
    await page.waitForTimeout(2200)
    await page.getByText('Trace and execution boundaries').scrollIntoViewIfNeeded()
    await page.waitForTimeout(2200)
  }

  const recording = page.video()
  await context.close()
  if (recording) {
    const webm = resolve(sourceDir, 'desktop-review.webm')
    await rename(await recording.path(), webm)
    const mp4 = resolve(output, 'review-walkthrough.mp4')
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
    execFileSync('cp', [mp4, resolve(publicOutput, 'review-walkthrough.mp4')])
  }
}

await browser.close()
console.log(url)
