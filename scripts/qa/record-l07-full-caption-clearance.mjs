import { chromium } from 'playwright'
import { mkdir, rename } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { waitForCueFrame } from './caption-size-state.mjs'

const out = 'agentified/workshop/l07-caption-clearance-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, recordVideo: { dir: out, size: { width, height: 844 } } })
    await page.goto('http://127.0.0.1:3137/agentified/learningplan?lesson=L07&rev=602d43d21-7bb6267c9f-b11360d1dc-3ca22b8816', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
    const video = page.locator('video')
    const player = page.locator('[class*="playerShell"]')
    await player.evaluate((node) => window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - 75))
    await page.waitForTimeout(500)
    const show = async (time, duration = 1200) => {
      await video.evaluate((v, t) => { v.currentTime = t; v.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
      await waitForCueFrame(page, time)
      await video.evaluate((v) => v.pause())
      await page.waitForTimeout(duration)
    }
    await show(8.2)
    await show(45)
    await show(79.082)
    await page.getByRole('button', { name: 'English captions on' }).click()
    await page.waitForTimeout(850)
    await page.getByRole('button', { name: 'English captions off' }).click()
    await show(109)
    await show(140.3)
    await show(156.779)
    await show(175)
    await show(188.514, 750)
    await show(188.515, 750)
    await show(196.863)
    await show(233.515, 750)
    await show(242.5)
    await show(248.2)
    await page.close()
    const webm = await page.video().path()
    const source = `${out}/L07-${width}-context.webm`
    await rename(webm, source)
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-movflags', '+faststart', `${out}/L07-${width}-context.mp4`])
  }
} finally { await browser.close() }
