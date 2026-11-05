import { chromium } from 'playwright'
import { mkdirSync, copyFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const out = path.resolve('docs/qa/accelerated-video-posters/fade')
const url = process.env.POSTER_FADE_QA_URL
if (!url) throw new Error('Set POSTER_FADE_QA_URL to the exact localhost Learning Plan route')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  for (const [name, viewport, lessonId] of [
    ['desktop', { width: 1440, height: 900 }, 'L01'],
    ['mobile', { width: 390, height: 844 }, 'L05'],
  ]) {
    const context = await browser.newContext({ viewport, recordVideo: { dir: out, size: viewport } })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Learning plan' }).click()
    if (lessonId !== 'L01') await page.getByRole('button', { name: new RegExp(`^${lessonId}:`) }).click()
    await page.getByRole('button', { name: new RegExp(`Watch ${lessonId} guided video`) }).click()
    const video = page.locator('video')
    await video.scrollIntoViewIfNeeded()
    const poster = await video.getAttribute('poster')
    if (poster !== `/accelerated/posters/${lessonId.toLowerCase()}-poster.webp`) throw new Error(`${name} poster binding changed: ${poster}`)
    await page.waitForTimeout(1100)
    await video.evaluate(async (element) => element.play())
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.1)
    const animation = await video.evaluate((element) => {
      const active = element.getAnimations().find((item) => item.effect?.getComputedTiming().duration === 340)
      return { duration: active?.effect?.getComputedTiming().duration, name: getComputedStyle(element).animationName }
    })
    if (animation.duration !== 340 || !animation.name.includes('posterToVideo')) throw new Error(`${name} fade animation did not start: ${JSON.stringify(animation)}`)
    await page.waitForTimeout(950)
    await video.evaluate((element) => element.pause())
    await page.waitForTimeout(450)
    await video.evaluate(async (element) => element.play())
    await page.waitForTimeout(950)
    const time = await video.evaluate((element) => element.currentTime)
    if (time <= 0.1) throw new Error(`${name} playback did not advance`)
    await video.evaluate((element) => element.pause())
    await page.getByRole('button', { name: /Return to Learning plan/ }).click()
    await page.waitForTimeout(650)
    const recording = page.video()
    await context.close()
    const webm = await recording.path()
    copyFileSync(webm, path.join(out, `${name}-source.webm`))
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', path.join(out, `${name}-poster-fade.mp4`)])
    unlinkSync(webm)
    console.log(`${name}: ${lessonId} poster, 340ms fade, playback, pause/resume, return verified`)
  }
} finally {
  await browser.close()
}
