import { chromium } from 'playwright'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { execFileSync, spawnSync } from 'node:child_process'
import { holdRenderedFrames, waitForCueFrame } from './caption-size-state.mjs'

const codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const candidateCommit = 'd047960edcf58bc2c75b3a944fe22a5d8ad25bb4'
const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const candidateBase = process.env.CAPTION_CANDIDATE_BASE ?? 'http://127.0.0.1:8767'
const out = 'agentified/workshop/l05-01-caption-clearance-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
const finish = async (page, context, path) => {
  const source = await page.video().path()
  await context.close()
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', path], { encoding: 'utf8' })
  if (result.status !== 0) throw Error(`MP4 conversion failed: ${result.stderr}`)
  const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'null', '-'], { encoding: 'utf8' })
  if (decode.status !== 0) throw Error(`MP4 decode failed: ${decode.stderr}`)
  await unlink(source)
}
for (const width of [1280, 390]) {
  const height = width === 390 ? 844 : 720
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } })
  const page = await context.newPage()
  const route = `${base}/agentified/learningplan?lesson=L05&rev=${codeCommit}`
  await page.goto(route, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await page.getByRole('button', { name: 'Small captions' }).click()
  await page.getByRole('button', { name: 'Medium captions' }).click()
  await video.locator('../..').evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 50, behavior: 'instant' }))
  const seek = async (time, size = 'M') => {
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    await page.waitForFunction((mode) => document.querySelector('video')?.textTracks[0]?.mode === mode, width === 390 || size === 'L' || (time >= 11.91 && time < 24.779) ? 'hidden' : 'showing')
    await video.evaluate((element) => element.pause())
  }
  const record = async (step) => {
    const state = await page.evaluate(() => { const video = document.querySelector('video'); return { time: video.currentTime, mode: video.textTracks[0].mode, cue: Array.from(video.textTracks[0].cues ?? []).filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => cue.text), band: document.querySelector('[aria-label="L05 caption"]')?.textContent ?? null, size: video.dataset.captionSize, controls: video.controls } })
    states.push({ surface: 'learner', width, route, codeCommit, step, ...state })
    await holdRenderedFrames(page, 42)
  }
  await seek(8)
  await record('protected native presenter')
  await seek(11.909)
  await record('presenter final frame')
  await seek(11.91)
  await record('teaching transition without cue')
  await seek(19.314)
  for (const name of ['Small', 'Medium', 'Large']) {
    await page.getByRole('button', { name: `${name} captions` }).click()
    await record(`L05-01 ${name} band`)
  }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await record('L05-01 captions off')
  await page.getByRole('button', { name: 'English captions off' }).click()
  await record('L05-01 captions restored')
  await seek(21.7, 'L')
  await record('L05-01 cue gap')
  await page.getByRole('button', { name: 'Medium captions' }).click()
  await seek(24.779)
  await record('L05-02 adjacent native caption')
  await finish(page, context, `${out}/L05-learner-${width}-${codeCommit.slice(0, 10)}.mp4`)
}
for (const [layout, width] of [['desktop', 1280], ['mobile', 390]]) {
  const height = width === 390 ? 844 : 720
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } })
  const page = await context.newPage()
  const route = `${candidateBase}/${out}/candidate/review.html?layout=${layout}&revision=d047960e`
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 4 && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await video.evaluate(async (element) => { element.muted = true; await element.play() })
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 6.8)
  await video.evaluate((element) => element.pause())
  const record = async (step) => {
    const state = await page.evaluate(() => { const video = document.querySelector('video'); return { time: video.currentTime, mode: video.textTracks[0].mode, cue: Array.from(video.textTracks[0].cues ?? []).filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => cue.text), band: document.querySelector('#band').textContent, controls: video.controls } })
    states.push({ surface: 'fixed-candidate', layout, width, route, codeCommit, candidateCommit, step, ...state })
    await holdRenderedFrames(page, 42)
  }
  for (const name of ['Small', 'Medium', 'Large']) {
    await page.getByRole('button', { name: `${name} captions` }).click()
    await record(`${name} band`)
  }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await record('captions off')
  await page.getByRole('button', { name: 'English captions off' }).click()
  await record('captions restored')
  await finish(page, context, `${out}/L05-candidate-${layout}-${codeCommit.slice(0, 10)}.mp4`)
}
await browser.close()
await writeFile(`${out}/walkthrough-state.json`, JSON.stringify({ generatedAt: new Date().toISOString(), codeCommit, candidateCommit, states }, null, 2) + '\n')
console.log(`PASS ${states.length} walkthrough states and four decoded MP4s`)
