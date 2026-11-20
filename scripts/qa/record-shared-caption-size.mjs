import { chromium } from 'playwright'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { holdRenderedFrames, waitForCaptionSize, waitForCueFrame } from './caption-size-state.mjs'

const out = 'agentified/workshop/caption-size-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
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
    return { time: longest.startTime + .05, text: longest.text }
  })
  await video.evaluate((element, time) => { element.pause(); element.currentTime = time; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, cue.time)
  await waitForCueFrame(page, cue.time)
  await video.locator('../..').scrollIntoViewIfNeeded()
  await page.waitForFunction((text) => document.querySelector('[aria-label$=" caption"]')?.textContent?.includes(text), cue.text.replaceAll('\n', ' ').slice(0, 12))
  await page.getByRole('button', { name: 'Medium captions' }).click()
  await waitForCaptionSize(page, { course, width: 390, name: 'Medium' })
  await holdRenderedFrames(page)
  for (const size of ['Small', 'Medium', 'Large']) {
    await page.getByRole('button', { name: `${size} captions` }).click()
    states.push({ course, id, step: size, ...await waitForCaptionSize(page, { course, width: 390, name: size }) })
    await holdRenderedFrames(page, 42)
  }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]') && [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'English captions off' && button.getAttribute('aria-pressed') === 'false'))
  states.push({ course, id, step: 'off', stored: await page.evaluate(() => localStorage.getItem('amadutown.caption-size.v1')) })
  await holdRenderedFrames(page, 42)
  await page.getByRole('button', { name: 'English captions off' }).click()
  states.push({ course, id, step: 'restored', ...await waitForCaptionSize(page, { course, width: 390, name: 'Large' }) })
  await holdRenderedFrames(page, 42)
  const source = await page.video().path()
  await context.close()
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', `${out}/${course}-${id}-390-walkthrough.mp4`], { encoding: 'utf8' })
  if (result.status !== 0) throw Error(result.stderr || `ffmpeg exited ${result.status}`)
  await unlink(source)
}
await browser.close()
await writeFile(`${out}/walkthrough-state.json`, JSON.stringify({ generatedAt: new Date().toISOString(), states }, null, 2) + '\n')
