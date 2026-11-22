import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { waitForCueFrame } from './caption-size-state.mjs'

const out = 'agentified/workshop/l07-05-caption-clearance-review'
const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const captionHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const playerHead = '7bb6267c9fb98172679e161aafa208dfc7a276c3'
const binding = JSON.parse(await readFile('lib/agentified-illustrated-bindings.json', 'utf8')).bindings.L07
const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
if (await digest(`public${binding.video}`) !== binding.compositeSha256 || await digest(`public${binding.captions}`) !== binding.captionsSha256) throw Error('Approved L07 source drifted')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } })
  const route = `${base}/agentified/learningplan?lesson=L07&rev=${captionHead}-${playerHead.slice(0, 10)}`
  await page.goto(route, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(({ video, captions }) => { const v = document.querySelector('video'); return v?.querySelector('source')?.getAttribute('src') === video && v.querySelector('track')?.getAttribute('src') === captions && v.textTracks[0]?.cues?.length > 0 }, { video: binding.video, captions: binding.captions })
  const geometry = await video.evaluate((v) => { const b = v.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)] })
  const seek = async (time) => { await video.evaluate((v, target) => { v.currentTime = target; v.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time); await waitForCueFrame(page, time); await video.evaluate((v) => v.pause()) }
  const inspect = async (label, expectedTime, size, enabled = true) => {
    const state = await page.evaluate(() => { const v = document.querySelector('video'); const track = v.textTracks[0]; const band = document.querySelector('[aria-label="L07 caption"]'); const vb = v.getBoundingClientRect(); const bb = band?.getBoundingClientRect(); return { time: v.currentTime, mode: track.mode, active: Array.from(track.cues ?? []).filter((cue) => cue.startTime <= v.currentTime && v.currentTime < cue.endTime).map((cue) => ({ text: cue.text, line: cue.line, start: cue.startTime, end: cue.endTime })), band: band?.textContent ?? null, bandCount: document.querySelectorAll('[aria-label="L07 caption"]').length, bandTop: bb?.top ?? null, videoBottom: vb.bottom, font: band ? getComputedStyle(band).fontSize : null, geometry: [Math.round(vb.width), Math.round(vb.height)], controls: v.controls, rail: Boolean(document.querySelector('[aria-label="L07 video controls"]')), size: v.dataset.captionSize, sizeGroup: document.querySelectorAll('[role="group"][aria-label="Caption size"]').length } })
    const external = width === 390 || size === 'L' || expectedTime >= 127.108 && expectedTime < 153.479
    if (Math.abs(state.time - expectedTime) > .25 || state.geometry.join() !== geometry.join() || state.controls !== (width === 1280) || state.rail !== (width === 390) || state.size !== size) throw Error(`${width} ${label}: player drift ${JSON.stringify(state)}`)
    if (enabled) {
      if (state.mode !== (external ? 'hidden' : 'showing') || state.active.length > 1 || state.bandCount !== (external && state.active.length ? 1 : 0) || external && state.active.length && (state.band !== state.active[0].text || state.font !== { S: '14px', M: '18px', L: '24px' }[size]) || state.bandTop !== null && state.bandTop < state.videoBottom - 1 || state.sizeGroup !== 1) throw Error(`${width} ${label}: caption drift ${JSON.stringify(state)}`)
      if (width === 1280 && size === 'M' && expectedTime >= 153.479 && expectedTime < 160.078 && state.active.length && state.active[0].line !== 52) throw Error(`${width} ${label}: existing L07-06 cue placement drifted`)
    } else if (state.mode !== 'disabled' || state.bandCount || state.sizeGroup) throw Error(`${width} ${label}: captions-off drift ${JSON.stringify(state)}`)
    states.push({ width, label, expectedTime, size, enabled, external, route, ...state })
  }
  for (const [label, time] of [['before', 127.107], ['scene-start', 127.108], ['collision', 128], ['midpoint', 140.293], ['scene-end-minus', 153.478], ['adjacent-start', 153.479], ['adjacent-mid', 156.779]]) {
    await seek(time)
    await inspect(label, time, 'M')
    if (!['collision', 'midpoint'].includes(label)) continue
    for (const [size, name] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
      await page.getByRole('button', { name: `${name} captions` }).click()
      await inspect(`${label}-${size}-on`, time, size)
      await page.locator('[class*="playerShell"]').screenshot({ path: `${out}/L07-05-${width}-${label}-${size}-on.png` })
      await page.getByRole('button', { name: 'English captions on' }).click()
      await inspect(`${label}-${size}-off`, time, size, false)
      await page.getByRole('button', { name: 'English captions off' }).click()
      await inspect(`${label}-${size}-restored`, time, size)
    }
    await page.getByRole('button', { name: 'Medium captions' }).click()
  }
  for (const boundary of [127.108, 153.479]) {
    await seek(boundary - .25)
    await video.evaluate(async (v) => { v.muted = true; await v.play() })
    await page.waitForFunction((target) => document.querySelector('video')?.currentTime >= target, boundary + .2)
    await video.evaluate((v) => v.pause())
    await inspect(`played-through-${boundary}`, boundary + .2, 'M')
    await page.locator('[class*="playerShell"]').screenshot({ path: `${out}/L07-05-${width}-played-through-${boundary}.png` })
  }
  if (width === 390) {
    await seek(128)
    await page.getByRole('button', { name: 'Play video' }).click()
    await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 128.3)
    await page.getByRole('button', { name: 'Pause video' }).click()
    await video.evaluate((v) => { v.muted = false })
    await page.getByRole('button', { name: 'Mute video', exact: true }).click()
    if (!await video.evaluate((v) => v.muted)) throw Error('Mobile mute control failed')
    await page.getByRole('button', { name: 'Unmute video', exact: true }).click()
    await page.getByRole('slider', { name: 'Seek video' }).press('ArrowRight')
    await seek(128)
    await inspect('mobile-controls-restored', 128, 'M')
  }
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(({ video, captions }) => { const v = document.querySelector('video'); return document.documentElement.classList.contains('dark') && v?.querySelector('source')?.getAttribute('src') === video && v.querySelector('track')?.getAttribute('src') === captions && v.textTracks[0]?.cues?.length > 0 }, { video: binding.video, captions: binding.captions })
  await seek(128)
  await inspect('dark-theme', 128, 'M')
  await page.locator('[class*="playerShell"]').screenshot({ path: `${out}/L07-05-${width}-dark-theme.png` })
  await page.close()
}
await browser.close()
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), captionHead, playerHead, binding, states }, null, 2) + '\n')
console.log(`PASS ${states.length} L07-05 learner states`)
