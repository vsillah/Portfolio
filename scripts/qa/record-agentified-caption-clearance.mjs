import { chromium } from 'playwright'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { holdRenderedFrames, waitForCaptionSize, waitForCueFrame } from './caption-size-state.mjs'

const out = 'agentified/workshop/l09-l16-caption-audit'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
const scenes = [['L09', 1.5], ['L10', 35.2], ['L11', 63.16], ['L12', 67.86], ['L13', 58.087], ['L14', 1.5], ['L15', 30.282], ['L16', 35.712]]
for (const width of [1280, 390]) {
  const height = width === 390 ? 844 : 720
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } })
  const page = await context.newPage()
  for (const [lesson, time] of scenes) {
    await page.goto(`http://127.0.0.1:3121/agentified/learningplan?lesson=${lesson}`, { waitUntil: 'networkidle' })
    const video = page.locator('video')
    await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
    await video.locator('../..').evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 50, behavior: 'instant' }))
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    await video.evaluate((element) => element.pause())
    const cue = await video.evaluate((element) => [...element.textTracks[0].cues].filter((item) => item.startTime <= element.currentTime && element.currentTime < item.endTime).map((item) => item.text))
    if (cue.length !== 1) throw Error(`${lesson}: chosen walkthrough time has no single active cue`)
    for (const name of lesson === 'L09' ? ['Small', 'Medium', 'Large'] : ['Medium']) {
      await page.getByRole('button', { name: `${name} captions` }).click()
      const state = await waitForCaptionSize(page, { course: 'agentified', width, name })
      if (state.bandText !== cue[0]) throw Error(`${lesson} ${name}: source cue changed`)
      states.push({ width, lesson, time, name, cue: cue[0], trackMode: state.trackMode, bandText: state.bandText })
      await holdRenderedFrames(page, 45)
    }
    if (lesson === 'L09') {
      await page.getByRole('button', { name: 'English captions on' }).click()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]') && !document.querySelector('[role="group"][aria-label="Caption size"]'))
      await holdRenderedFrames(page, 45)
      await page.getByRole('button', { name: 'English captions off' }).click()
      await waitForCaptionSize(page, { course: 'agentified', width, name: 'Large' })
      await holdRenderedFrames(page, 45)
    }
  }
  const source = await page.video().path()
  await context.close()
  const target = `${out}/L09-L16-${width}-caption-clearance.mp4`
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', target], { encoding: 'utf8' })
  if (result.status !== 0) throw Error(result.stderr || `ffmpeg exited ${result.status}`)
  const probe = spawnSync('ffmpeg', ['-v', 'error', '-i', target, '-f', 'null', '-'], { encoding: 'utf8' })
  if (probe.status !== 0) throw Error(`unplayable ${target}: ${probe.stderr}`)
  await unlink(source)
}
await browser.close()
await writeFile(`${out}/walkthrough-state.json`, JSON.stringify({ generatedAt: new Date().toISOString(), states }, null, 2) + '\n')
