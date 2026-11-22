import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { waitForCueFrame } from './caption-size-state.mjs'

const out = 'agentified/workshop/l07-caption-clearance-review'
const binding = JSON.parse(await readFile('lib/agentified-illustrated-bindings.json', 'utf8')).bindings.L07
const sha = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
if (await sha(`public${binding.video}`) !== 'b9016102fc8272f1c51f1fcee9b5f0aafe5c8928988beaf970645e337446a5b4' || await sha(`public${binding.captions}`) !== '984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21') throw Error('L07 QA source drift')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
const samples = [
  ['01-start', .4], ['01-presenter', 8.2], ['01-end', 27.8],
  ['02-start', 28.1], ['02-mid', 45], ['02-end', 65.3],
  ['03-start', 65.6], ['03-mid', 79.082], ['03-end', 92.5],
  ['04-start', 92.8], ['04-mid', 109], ['04-end', 126.9],
  ['05-start', 127.2], ['05-mid', 140.3], ['05-end', 153.2],
  ['06-start', 153.55], ['06-mid', 156.779], ['06-end', 159.9],
  ['07-start', 160.2], ['07-fields', 175], ['07-gate-before', 188.514], ['07-gate-start', 188.515], ['07-blank', 196.863], ['07-gate-end', 233.515], ['07-end', 233.6],
  ['08-start', 233.8], ['08-presenter', 242.5], ['08-close', 246], ['end-screen', 248.2],
]
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    const route = `http://127.0.0.1:3137/agentified/learningplan?lesson=L07&rev=602d43d21-7bb6267c9f-b11360d1dc-3ca22b8816`
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.waitForFunction(({ video, captions }) => { const v = document.querySelector('video'); return v?.querySelector('source')?.getAttribute('src') === video && v.querySelector('track')?.getAttribute('src') === captions && v.textTracks[0]?.cues?.length > 0 }, { video: binding.video, captions: binding.captions })
    const video = page.locator('video')
    const geometry = await video.evaluate((v) => { const b = v.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)] })
    const seek = async (time) => { await video.evaluate((v, t) => { v.currentTime = t; v.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time); await waitForCueFrame(page, time); await video.evaluate((v) => v.pause()) }
    const inspect = async (label, time, size, enabled = true) => {
      await page.waitForTimeout(100)
      const s = await page.evaluate(() => { const v = document.querySelector('video'); const track = v.textTracks[0]; const band = document.querySelector('[aria-label="L07 caption"]'); const vb = v.getBoundingClientRect(); const bb = band?.getBoundingClientRect(); return { time: v.currentTime, mode: track.mode, cues: Array.from(track.cues ?? []).filter((c) => c.startTime <= v.currentTime && v.currentTime < c.endTime).map((c) => ({ text: c.text, start: c.startTime, end: c.endTime })), band: band?.textContent ?? null, bandCount: document.querySelectorAll('[aria-label="L07 caption"]').length, bandTop: bb?.top ?? null, videoBottom: vb.bottom, font: band ? getComputedStyle(band).fontSize : null, geometry: [Math.round(vb.width), Math.round(vb.height)], controls: v.controls, mobileControls: Boolean(document.querySelector('[aria-label="L07 video controls"]')), size: v.dataset.captionSize, detail: Boolean(document.querySelector('[aria-label="L07-07 Human review remains the gate. source wording"]')), end: Boolean(document.querySelector('[class*="endScreen"]')) } })
      const external = width === 390 || size === 'L' || time < 233.648
      const expectBand = enabled && external && !s.end && s.cues.length > 0
      if (Math.abs(s.time - time) > .25 || s.geometry.join() !== geometry.join() || s.controls !== (width === 1280) || s.mobileControls !== (width === 390) || s.size !== size) throw Error(`${width} ${label} player drift ${JSON.stringify(s)}`)
      if (s.mode !== (enabled ? external ? 'hidden' : 'showing' : 'disabled') || s.cues.length > 1 || s.bandCount !== Number(expectBand) || expectBand && (s.band !== s.cues[0].text || s.font !== { S: '14px', M: '18px', L: '24px' }[size]) || s.bandTop !== null && s.bandTop < s.videoBottom - 1) throw Error(`${width} ${label} caption drift ${JSON.stringify(s)}`)
      if (label === '07-blank' && s.cues.length) throw Error('L07-07 blank writing window has a cue')
      if (label.startsWith('07-gate') && s.detail !== (time >= 188.515 && time < 233.515)) throw Error(`${width} ${label} teaching detail timing drift ${JSON.stringify(s)}`)
      states.push({ width, label, expectedTime: time, size, enabled, external, route, ...s })
    }
    for (const [label, time] of samples) {
      await seek(time)
      await inspect(label, time, 'M')
      if (['01-presenter', '02-mid', '03-mid', '04-mid', '05-mid', '06-mid', '07-fields', '07-blank', '08-presenter'].includes(label)) {
        for (const [size, name] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
          await page.getByRole('button', { name: `${name} captions` }).click()
          await inspect(`${label}-${size}-on`, time, size)
          await page.locator('[class*="playerShell"]').screenshot({ path: `${out}/L07-${width}-${label}-${size}.png` })
          await page.getByRole('button', { name: 'English captions on' }).click()
          await inspect(`${label}-${size}-off`, time, size, false)
          await page.getByRole('button', { name: 'English captions off' }).click()
          await inspect(`${label}-${size}-restored`, time, size)
        }
        await page.getByRole('button', { name: 'Medium captions' }).click()
      }
    }
    for (const boundary of [27.99, 65.494, 92.669, 127.108, 153.479, 160.078, 188.515, 233.515, 233.648]) {
      await seek(boundary - .25)
      await video.evaluate(async (v) => { v.muted = true; await v.play() })
      await page.waitForFunction((t) => document.querySelector('video')?.currentTime >= t, boundary + .2)
      await video.evaluate((v) => v.pause())
      await inspect(`played-${boundary}`, boundary + .2, 'M')
    }
    await seek(251.1)
    await video.evaluate(async (v) => { v.muted = true; await v.play() })
    await page.waitForFunction(() => document.querySelector('video')?.ended)
    if (!await page.locator('[class*="endScreen"]').count()) throw Error(`${width} completion missing`)
    await seek(65.6)
    await inspect('replay-seek', 65.6, 'M')
    if (width === 390) {
      await page.getByRole('button', { name: 'Play video' }).click()
      await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 65.9)
      await page.getByRole('button', { name: 'Pause video' }).click()
      await video.evaluate((v) => { v.muted = false })
      await page.getByRole('button', { name: 'Mute video', exact: true }).click()
      if (!await video.evaluate((v) => v.muted)) throw Error('Mobile mute failed')
      await page.getByRole('button', { name: 'Unmute video', exact: true }).click()
      await page.getByRole('slider', { name: 'Seek video' }).press('ArrowRight')
    }
    await page.close()
  }
} finally { await browser.close() }
await writeFile(`${out}/matrix.json`, JSON.stringify({ binding, heads: { caption: '602d43d21', player: '7bb6267c9fb98172679e161aafa208dfc7a276c3', candidate: 'b11360d1dc0b63a1d9c7ea126aa50dea196fa649', detail: '3ca22b88162de93182d07eee89fbc062feea129f' }, states }, null, 2) + '\n')
console.log(`PASS ${states.length} L07 states`)
