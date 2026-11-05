import { chromium } from 'playwright'
import { mkdirSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const out = path.resolve('docs/qa/accelerated-video-posters')
mkdirSync(out, { recursive: true })
const url = process.env.POSTER_QA_URL || 'http://localhost:3107/service-prototypes/accelerated-cohort?posterReview=working'
const browser = await chromium.launch({ headless: true })
const reps = ['L01', 'L05', 'L11', 'L15']
const settings = [
  ['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844],
]
try {
  for (const [size, width, height] of settings) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' })
      const page = await context.newPage()
      await page.goto(url)
      await page.getByRole('button', { name: 'Learning plan' }).click()
      for (const id of reps) {
        await page.getByRole('button', { name: new RegExp(`^${id}:`) }).click()
        await page.getByRole('button', { name: new RegExp(`Watch ${id} guided video`) }).click()
        await page.locator('video').waitFor({ state: 'visible' })
        const poster = await page.locator('video').getAttribute('poster')
        if (poster !== `/accelerated/posters/${id.toLowerCase()}-poster.webp`) throw new Error(`${size}/${theme}/${id} poster mismatch: ${poster}`)
        await page.locator('video').scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(out, `${size}-${theme}-${id.toLowerCase()}.png`) })
        await page.getByRole('button', { name: /Return to Learning plan/ }).click()
      }
      await context.close()
    }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', recordVideo: { dir: out, size: { width: 1280, height: 800 } } })
  const page = await context.newPage()
  await page.goto(url)
  await page.getByRole('button', { name: 'Learning plan' }).click()
  for (const id of reps) {
    await page.getByRole('button', { name: new RegExp(`^${id}:`) }).click()
    await page.getByRole('button', { name: new RegExp(`Watch ${id} guided video`) }).click()
    await page.locator('video').scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)
    if (id === 'L01') {
      await page.locator('video').evaluate(async (video) => { await video.play() })
      await page.waitForTimeout(1800)
      const time = await page.locator('video').evaluate((video) => video.currentTime)
      if (time <= 0) throw new Error('Playback did not advance')
      await page.locator('video').evaluate((video) => video.pause())
    }
    await page.getByRole('button', { name: /Return to Learning plan/ }).click()
    await page.waitForTimeout(450)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^L16:/ }).click()
  await page.getByRole('button', { name: /Watch L16 guided video/ }).click()
  await page.locator('video').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /Return to Learning plan/ }).click()
  const video = page.video()
  await context.close()
  const webm = await video.path()
  copyFileSync(webm, path.join(out, 'walkthrough-source.webm'))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', path.join(out, 'accelerated-posters-walkthrough.mp4')])
  console.log(`Captured 24 viewport/theme screenshots and walkthrough at ${url}`)
} finally {
  await browser.close()
}
