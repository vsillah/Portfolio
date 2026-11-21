import { chromium } from 'playwright'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { execFileSync, spawnSync } from 'node:child_process'
import { holdRenderedFrames, waitForCueFrame } from './caption-size-state.mjs'

const codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const candidateBase = process.env.CAPTION_CANDIDATE_BASE ?? 'http://127.0.0.1:8767'
const out = 'agentified/workshop/l01-05-caption-clearance-review'
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
  const route = `${base}/agentified/learningplan?lesson=L01&rev=${codeCommit}`
  await page.goto(route, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await page.getByRole('button', { name: 'Small captions' }).click()
  await page.waitForFunction(() => document.querySelector('video')?.dataset.captionSize === 'S')
  await page.getByRole('button', { name: 'Medium captions' }).click()
  await page.waitForFunction(() => document.querySelector('video')?.dataset.captionSize === 'M')
  await video.locator('../..').evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 50, behavior: 'instant' }))
  const seek = async (time) => {
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    await page.waitForFunction(({ time, width }) => document.querySelector('video')?.textTracks[0]?.mode === (width === 390 || (time >= 34.585 && time < 74.197 || time >= 114.358 && time < 150.501 || time >= 150.501 && time < 183.059) ? 'hidden' : 'showing'), { time, width })
    await video.evaluate((element) => element.pause())
  }
  const record = async (step) => {
    const state = await page.evaluate(() => { const video = document.querySelector('video'); return { time: video.currentTime, mode: video.textTracks[0].mode, cue: Array.from(video.textTracks[0].cues ?? []).filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => cue.text), band: document.querySelector('[aria-label="L01 caption"]')?.textContent ?? null, size: video.dataset.captionSize, controls: video.controls } })
    states.push({ surface: 'learner', width, route, codeCommit, step, ...state })
    await holdRenderedFrames(page, 42)
  }
  await seek(149)
  await record('L01-04 adjacent boundary')
  await seek(162.78)
  for (const label of ['Small', 'Medium', 'Large']) {
    await page.getByRole('button', { name: `${label} captions` }).click()
    await record(`L01-05 ${label} band`)
  }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await record('L01-05 captions off')
  await page.getByRole('button', { name: 'English captions off' }).click()
  await record('L01-05 captions restored')
  await seek(164.8)
  await record('L01-05 cue gap')
  await page.getByRole('button', { name: 'Medium captions' }).click()
  await seek(185)
  await record('L01-06 adjacent boundary')
  await finish(page, context, `${out}/L01-learner-${width}-${codeCommit.slice(0, 10)}.mp4`)
}
for (const [layout, width] of [['desktop', 1280], ['mobile', 390]]) {
  const height = width === 390 ? 844 : 720
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } })
  const page = await context.newPage()
  const route = `${candidateBase}/${out}/candidate/review.html?layout=${layout}&revision=ff17e8a0`
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 4 && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await video.evaluate(async (element) => { element.muted = true; await element.play() })
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 0.8)
  await video.evaluate((element) => element.pause())
  const record = async (step) => {
    const state = await page.evaluate(() => { const video = document.querySelector('video'); return { time: video.currentTime, mode: video.textTracks[0].mode, cue: Array.from(video.textTracks[0].cues ?? []).filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => cue.text), band: document.querySelector('#band').textContent, controls: video.controls } })
    states.push({ surface: 'fixed-candidate', layout, width, route, codeCommit, candidateCommit: 'ff17e8a0e4ad6e38f2bfa62376fd8d63e2940496', step, ...state })
    await holdRenderedFrames(page, 42)
  }
  for (const label of ['Small', 'Medium', 'Large']) {
    await page.getByRole('button', { name: `${label} captions` }).click()
    await record(`${label} band`)
  }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await record('captions off')
  await page.getByRole('button', { name: 'English captions off' }).click()
  await record('captions restored')
  await finish(page, context, `${out}/L01-candidate-${layout}-${codeCommit.slice(0, 10)}.mp4`)
}
await browser.close()
await writeFile(`${out}/walkthrough-state.json`, JSON.stringify({ generatedAt: new Date().toISOString(), codeCommit, states }, null, 2) + '\n')
console.log(`PASS ${states.length} walkthrough states and four decoded MP4s`)
