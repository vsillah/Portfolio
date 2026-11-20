import { chromium } from 'playwright'
import { mkdir, unlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const out = 'agentified/workshop/caption-size-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
for (const [course, id, path] of [
  ['agentified', 'L07', '/agentified/learningplan?lesson=L07'],
  ['accelerated', 'L01', '/accelerated/learningplan'],
  ['accelerated', 'L09', '/accelerated/learningplan'],
]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out, size: { width: 390, height: 844 } } })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:3121${path}`, { waitUntil: 'networkidle' })
  if (course === 'accelerated' && id === 'L09') await page.locator('button[aria-label^="L09:"]').evaluate((button) => button.click())
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  const cue = await video.evaluate((element) => {
    const longest = Array.from(element.textTracks[0].cues).reduce((a, b) => b.text.length > a.text.length ? b : a)
    return longest.startTime + .05
  })
  await video.evaluate((element, time) => { element.pause(); element.currentTime = time; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, cue)
  await video.locator('../..').scrollIntoViewIfNeeded()
  await page.waitForTimeout(750)
  for (const size of ['Small', 'Medium', 'Large']) {
    await page.getByRole('button', { name: `${size} captions` }).click()
    await page.waitForTimeout(1100)
  }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: 'English captions off' }).click()
  await page.waitForTimeout(1100)
  const source = await page.video().path()
  await context.close()
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', `${out}/${course}-${id}-390-walkthrough.mp4`], { encoding: 'utf8' })
  if (result.status !== 0) throw Error(result.stderr || `ffmpeg exited ${result.status}`)
  await unlink(source)
}
await browser.close()
