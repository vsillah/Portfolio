import { chromium } from 'playwright'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { execFileSync, spawnSync } from 'node:child_process'
import { holdRenderedFrames, waitForCueFrame } from './caption-size-state.mjs'

const out = 'agentified/workshop/l07-05-caption-clearance-review'
const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const captionHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const playerHead = '7bb6267c9fb98172679e161aafa208dfc7a276c3'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
for (const width of [1280, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, recordVideo: { dir: out, size: { width, height: 844 } } })
  const page = await context.newPage()
  const route = `${base}/agentified/learningplan?lesson=L07&rev=${captionHead}-${playerHead.slice(0, 10)}`
  await page.goto(route, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.querySelector('source')?.getAttribute('src')?.includes('/l07/') && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await video.evaluate((v) => v.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const seek = async (time) => { await video.evaluate((v, target) => { v.currentTime = target; v.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time); await waitForCueFrame(page, time); await video.evaluate((v) => v.pause()) }
  const record = async (label) => { await video.evaluate((v) => window.scrollTo({ top: window.scrollY + v.getBoundingClientRect().top - 100, behavior: 'instant' })); const state = await page.evaluate(() => { const v = document.querySelector('video'); return { time: v.currentTime, mode: v.textTracks[0].mode, cue: Array.from(v.textTracks[0].cues ?? []).filter((cue) => cue.startTime <= v.currentTime && v.currentTime < cue.endTime).map((cue) => cue.text), band: document.querySelector('[aria-label="L07 caption"]')?.textContent ?? null, size: v.dataset.captionSize, controls: v.controls } }); states.push({ width, route, label, ...state }); await holdRenderedFrames(page, 42) }
  await seek(126.9)
  await record('adjacent L07-04 native')
  await seek(128)
  await record('L07-05 caption clear')
  for (const name of ['Small', 'Medium', 'Large']) { await page.getByRole('button', { name: `${name} captions` }).click(); await record(`${name} captions`) }
  await page.getByRole('button', { name: 'English captions on' }).click()
  await record('captions off')
  await page.getByRole('button', { name: 'English captions off' }).click()
  await record('paused caption restored')
  await page.getByRole('button', { name: 'Medium captions' }).click()
  await seek(153.7)
  await record('adjacent L07-06 native')
  const source = await page.video().path()
  await context.close()
  const target = `${out}/L07-05-${width}-${captionHead.slice(0, 10)}.mp4`
  const converted = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', target], { encoding: 'utf8' })
  if (converted.status !== 0) throw Error(`MP4 conversion failed: ${converted.stderr}`)
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', target, '-f', 'null', '-'], { encoding: 'utf8' })
  if (decoded.status !== 0) throw Error(`MP4 decode failed: ${decoded.stderr}`)
  await unlink(source)
}
await browser.close()
await writeFile(`${out}/walkthrough-state.json`, JSON.stringify({ generatedAt: new Date().toISOString(), captionHead, playerHead, states }, null, 2) + '\n')
console.log(`PASS ${states.length} walkthrough states and two decoded MP4s`)
