import { chromium } from 'playwright'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { holdRenderedFrames, waitForCaptionSize, waitForCueFrame } from './caption-size-state.mjs'

const out = 'agentified/workshop/l08-caption-clearance-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
for (const width of [1280, 390]) {
  const height = width === 390 ? 844 : 720
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:3121/agentified/learningplan?lesson=L08', { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  const media = video.locator('../..')
  await media.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 80, behavior: 'instant' }))
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const seek = async (time) => {
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    await video.evaluate((element) => element.pause())
  }
  const record = async (step, name) => {
    const state = await waitForCaptionSize(page, { course: 'agentified', width, name })
    states.push({ width, step, ...state })
    await holdRenderedFrames(page, 42)
  }
  await seek(12.717)
  for (const name of ['Small', 'Medium', 'Large']) {
    await page.getByRole('button', { name: `${name} captions` }).click()
    await record(`L08-01 ${name}`, name)
  }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label="L08 caption"]') && !document.querySelector('[role="group"][aria-label="Caption size"]'))
  states.push({ width, step: 'L08-01 off', time: await video.evaluate((element) => element.currentTime), groupCount: await page.getByRole('group', { name: 'Caption size' }).count() })
  await holdRenderedFrames(page, 42)
  await page.getByRole('button', { name: 'English captions off' }).click()
  await record('L08-01 restored', 'Large')
  for (const [scene, time] of [['L08-02', 45.631], ['L08-03', 78.728], ['L08-04', 108.52], ['L08-05', 143.328], ['L08-06', 162.724], ['L08-07', 168.052], ['L08-08', 247.736]]) {
    await seek(time)
    await page.getByRole('button', { name: 'Medium captions' }).click()
    await record(`${scene} below player`, 'Medium')
  }
  const source = await page.video().path()
  await context.close()
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', `${out}/L08-01-${width}-caption-clearance.mp4`], { encoding: 'utf8' })
  if (result.status !== 0) throw Error(result.stderr || `ffmpeg exited ${result.status}`)
  await unlink(source)
}
await browser.close()
await writeFile(`${out}/walkthrough-state.json`, JSON.stringify({ generatedAt: new Date().toISOString(), states }, null, 2) + '\n')
