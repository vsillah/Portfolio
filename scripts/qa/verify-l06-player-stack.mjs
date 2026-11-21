import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { waitForCueFrame } from './caption-size-state.mjs'

const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const out = 'agentified/workshop/l06-player-stack-reconciliation'
const captionHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const playerHead = 'afdd4e2c191225eebe839e68040bf9547bda77de'
const binding = JSON.parse(await readFile('lib/agentified-illustrated-bindings.json', 'utf8')).bindings.L06
const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
if (await digest(`public${binding.video}`) !== binding.compositeSha256 || await digest(`public${binding.captions}`) !== binding.captionsSha256) throw Error('L06 learner binding drifted')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } })
  const route = `${base}/agentified/learningplan?lesson=L06&rev=${captionHead}-${playerHead.slice(0, 10)}`
  await page.goto(route, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(({ video, captions }) => { const v = document.querySelector('video'); return v?.querySelector('source')?.getAttribute('src') === video && v.querySelector('track')?.getAttribute('src') === captions && v.textTracks[0]?.cues?.length > 0 }, { video: binding.video, captions: binding.captions })
  const sources = await video.evaluate((v) => ({ video: v.querySelector('source')?.getAttribute('src'), captions: v.querySelector('track')?.getAttribute('src') }))
  if (sources.video !== binding.video || sources.captions !== binding.captions) throw Error(`${width}: source path drifted ${JSON.stringify(sources)} expected ${JSON.stringify({ video: binding.video, captions: binding.captions })}`)
  const geometry = await video.evaluate((v) => { const b = v.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)] })
  const seek = async (time) => { await video.evaluate((v, t) => { v.currentTime = t; v.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time); await waitForCueFrame(page, time); await video.evaluate((v) => v.pause()) }
  const inspect = async (label, expectedTime, size, expectedOn = true) => {
    const state = await page.evaluate(() => { const v = document.querySelector('video'); const band = document.querySelector('[aria-label="L06 caption"]'); const vb = v.getBoundingClientRect(); const bb = band?.getBoundingClientRect(); return { time: v.currentTime, mode: v.textTracks[0].mode, active: Array.from(v.textTracks[0].cues ?? []).filter((cue) => cue.startTime <= v.currentTime && v.currentTime < cue.endTime).map((cue) => cue.text), band: band?.textContent ?? null, bandCount: document.querySelectorAll('[aria-label="L06 caption"]').length, font: band ? getComputedStyle(band).fontSize : null, bandTop: bb?.top ?? null, videoBottom: vb.bottom, geometry: [Math.round(vb.width), Math.round(vb.height)], controls: v.controls, rail: Boolean(document.querySelector('[aria-label="L06 video controls"]')), size: v.dataset.captionSize, endScreen: Boolean(document.querySelector('[role="status"][aria-label^="L06 complete."]')) } })
    if (Math.abs(state.time - expectedTime) > .25 || (label !== 'fullscreen' && state.geometry.join() !== geometry.join()) || state.controls !== (width === 1280) || state.rail !== (width === 390) || state.size !== size) throw Error(`${width} ${label}: player drift ${JSON.stringify(state)}`)
    if (expectedOn) {
      if (state.mode !== 'hidden' || state.active.length > 1 || state.bandCount !== (state.active.length && !state.endScreen ? 1 : 0) || state.active.length && !state.endScreen && (state.band !== state.active[0] || state.font !== { S: '14px', M: '18px', L: '24px' }[size]) || state.bandTop !== null && state.bandTop < state.videoBottom - 1) throw Error(`${width} ${label}: caption drift ${JSON.stringify(state)}`)
    } else if (state.mode !== 'disabled' || state.bandCount) throw Error(`${width} ${label}: captions-off drift ${JSON.stringify(state)}`)
    states.push({ width, label, expectedTime, size, expectedOn, route, ...state })
    return state
  }
  await seek(20.7168)
  for (const [size, name] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
    await page.getByRole('button', { name: `${name} captions` }).click()
    await inspect(`${size}-paused`, 20.7168, size)
    await page.locator('[class*="playerShell"]').screenshot({ path: `${out}/L06-01-${width}-${size}-paused.png` })
    await page.getByRole('button', { name: 'English captions on' }).click()
    await inspect(`${size}-off`, 20.7168, size, false)
    await page.getByRole('button', { name: 'English captions off' }).click()
    await inspect(`${size}-restored`, 20.7168, size)
  }
  await page.getByRole('button', { name: 'Medium captions' }).click()
  if (width === 390) {
    await page.getByRole('button', { name: 'Play video' }).click()
    await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 21.1)
    await page.getByRole('button', { name: 'Pause video' }).click()
    await seek(20.7168)
    await inspect('rail-play-pause', 20.7168, 'M')
    await page.getByRole('button', { name: 'Mute video' }).click()
    if (!await video.evaluate((v) => v.muted)) throw Error('Mobile mute control failed')
    await page.getByRole('button', { name: 'Unmute video' }).click()
    if (await video.evaluate((v) => v.muted)) throw Error('Mobile unmute control failed')
    await page.getByRole('slider', { name: 'Video volume level' }).press('ArrowLeft')
    await page.getByRole('slider', { name: 'Seek video' }).press('ArrowRight')
    if (await video.evaluate((v) => v.currentTime) <= 20.7168) throw Error('Mobile seek control failed')
  }
  await seek(28.638)
  await inspect('L06-01-end-minus', 28.638, 'M')
  await seek(28.639)
  await inspect('L06-02-start', 28.639, 'M')
  await page.locator('[class*="playerShell"]').screenshot({ path: `${out}/L06-02-${width}-boundary.png` })
  await seek(28.389)
  await video.evaluate(async (v) => { v.muted = true; await v.play() })
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 28.839)
  await video.evaluate((v) => v.pause())
  await inspect('natural-L06-02', 28.839, 'M')
  if (width === 390) {
    await page.getByRole('button', { name: 'Enter fullscreen' }).click()
    await page.waitForFunction(() => Boolean(document.fullscreenElement))
    await inspect('fullscreen', 28.839, 'M')
    await page.locator('[class*="playerShell"]').screenshot({ path: `${out}/L06-02-${width}-fullscreen.png` })
    await page.getByRole('button', { name: 'Exit fullscreen' }).click()
    await page.waitForFunction(() => !document.fullscreenElement)
    await inspect('fullscreen-restored', 28.839, 'M')
  }
  await page.close()
}
await browser.close()
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), captionHead, playerHead, binding, states }, null, 2) + '\n')
console.log(`PASS ${states.length} L06-01/player-stack states`)
