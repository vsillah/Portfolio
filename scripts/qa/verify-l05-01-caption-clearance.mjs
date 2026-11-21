import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { waitForCueFrame } from './caption-size-state.mjs'

const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const candidateBase = process.env.CAPTION_CANDIDATE_BASE ?? 'http://127.0.0.1:8767'
const out = 'agentified/workshop/l05-01-caption-clearance-review'
const codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const candidateCommit = 'd047960edcf58bc2c75b3a944fe22a5d8ad25bb4'
const binding = JSON.parse(await readFile('lib/agentified-illustrated-bindings.json', 'utf8')).bindings.L05
const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
const source = { video: binding.video, captions: binding.captions, videoHash: await digest(`public${binding.video}`), captionsHash: await digest(`public${binding.captions}`) }
if (source.videoHash !== binding.compositeSha256 || source.captionsHash !== binding.captionsSha256) throw Error('Approved L05 binding drifted')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const learner = []
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
  await page.goto(`${base}/agentified/learningplan?lesson=L05&rev=${codeCommit}`, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await page.getByRole('button', { name: 'Small captions' }).click()
  await page.getByRole('button', { name: 'Medium captions' }).click()
  const loaded = await video.evaluate((element) => ({ video: element.querySelector('source')?.getAttribute('src'), captions: element.querySelector('track')?.getAttribute('src') }))
  if (loaded.video !== source.video || loaded.captions !== source.captions) throw Error(`${width}: learner media drifted`)
  const baseline = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)] })
  const baselineScroll = await page.evaluate(() => document.documentElement.scrollWidth)
  const seek = async (time, size = 'M') => {
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    const external = width === 390 || size === 'L' || (time >= 11.91 && time < 24.779)
    await page.waitForFunction((mode) => document.querySelector('video')?.textTracks[0]?.mode === mode, external ? 'hidden' : 'showing')
    await video.evaluate((element) => element.pause())
  }
  const inspect = async (label, time, size = 'M') => {
    const state = await page.evaluate(() => { const video = document.querySelector('video'); const track = video.textTracks[0]; const band = document.querySelector('[aria-label="L05 caption"]'); const vb = video.getBoundingClientRect(); const bb = band?.getBoundingClientRect(); return { time: video.currentTime, mode: track.mode, active: [...track.cues].filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => cue.text), band: band?.textContent ?? null, bandCount: document.querySelectorAll('[aria-label="L05 caption"]').length, bandTop: bb?.top ?? null, videoBottom: vb.bottom, font: band ? getComputedStyle(band).fontSize : null, video: [Math.round(vb.width), Math.round(vb.height)], controls: video.controls, selected: [...document.querySelectorAll('[role="group"][aria-label="Caption size"] button[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label')), scrollWidth: document.documentElement.scrollWidth } })
    const external = width === 390 || size === 'L' || (time >= 11.91 && time < 24.779)
    if (state.mode !== (external ? 'hidden' : 'showing') || state.bandCount !== (external && state.active.length ? 1 : 0) || external && state.active.length && state.band !== state.active[0] || state.bandTop !== null && state.bandTop < state.videoBottom - 1 || state.video.join() !== baseline.join() || !state.controls || state.scrollWidth > baselineScroll + 1) throw Error(`${width} ${label}: ${JSON.stringify(state)}`)
    if (external && state.active.length && state.font !== { S: '14px', M: '18px', L: '24px' }[size]) throw Error(`${width} ${label}: font drifted`)
    learner.push({ width, label, expectedTime: time, size, external, ...state })
    return state
  }
  for (const [label, time] of [['presenter', 8], ['presenter-end', 11.909], ['teaching-start', 11.91], ['first-teaching-cue', 12.5], ['panel-collision', 19.314], ['cue-gap', 21.7], ['scene-end-minus', 24.778], ['L05-02-start', 24.779], ['L05-02-midpoint', 38.8]]) {
    await seek(time)
    await inspect(label, time)
    if (['presenter-end', 'teaching-start', 'panel-collision', 'L05-02-start'].includes(label)) await video.locator('../..').screenshot({ path: `${out}/L05-01-${width}-${label}.png` })
    if (label === 'panel-collision') {
      for (const [size, name] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
        await page.getByRole('button', { name: `${name} captions` }).click()
        const on = await inspect(`${size}-on`, time, size)
        if (on.selected.join() !== `${name} captions`) throw Error(`${width} ${size}: Aa selection drifted`)
        await video.locator('../..').screenshot({ path: `${out}/L05-01-${width}-${size}-on.png` })
        await page.getByRole('button', { name: 'English captions on' }).click()
        const off = await page.evaluate(() => ({ mode: document.querySelector('video').textTracks[0].mode, bands: document.querySelectorAll('[aria-label="L05 caption"]').length, sizes: document.querySelectorAll('[role="group"][aria-label="Caption size"]').length }))
        if (off.mode !== 'disabled' || off.bands || off.sizes) throw Error(`${width} ${size}: off state ${JSON.stringify(off)}`)
        learner.push({ width, label: `${size}-off`, time, off })
        await video.locator('../..').screenshot({ path: `${out}/L05-01-${width}-${size}-off.png` })
        await page.getByRole('button', { name: 'English captions off' }).click()
        await inspect(`${size}-restored`, time, size)
      }
      await page.getByRole('button', { name: 'Medium captions' }).click()
    }
  }
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.documentElement.classList.contains('dark') && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await seek(19.314)
  await video.evaluate(async (element) => { element.muted = true; await element.play() })
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 19.5)
  await video.evaluate((element) => element.pause())
  await inspect('dark-theme', 19.5)
  await video.locator('../..').screenshot({ path: `${out}/L05-01-${width}-dark-theme.png` })
  await page.close()
}
const candidate = []
for (const [layout, width] of [['desktop', 1280], ['mobile', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
  await page.goto(`${candidateBase}/${out}/candidate/review.html?layout=${layout}&revision=d047960e`, { waitUntil: 'domcontentloaded' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 4 && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await video.evaluate(async (element) => { element.muted = true; await element.play() })
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 6.8)
  await video.evaluate((element) => element.pause())
  const baseline = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)] })
  for (const [size, name] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
    await page.getByRole('button', { name: `${name} captions` }).click()
    const on = await page.evaluate(() => { const video = document.querySelector('video'); const band = document.querySelector('#band'); const vb = video.getBoundingClientRect(); return { time: video.currentTime, mode: video.textTracks[0].mode, active: [...video.textTracks[0].cues].filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => cue.text), band: band.textContent, top: band.getBoundingClientRect().top, videoBottom: vb.bottom, video: [Math.round(vb.width), Math.round(vb.height)], controls: video.controls, font: getComputedStyle(band).fontSize } })
    if (on.mode !== 'hidden' || on.active.length !== 1 || on.band !== on.active[0] || on.top < on.videoBottom - 1 || on.video.join() !== baseline.join() || !on.controls || on.font !== { S: '14px', M: '18px', L: '24px' }[size]) throw Error(`candidate ${layout} ${size}: ${JSON.stringify(on)}`)
    await page.locator('main').screenshot({ path: `${out}/candidate-${layout}-${size}-on.png` })
    await page.getByRole('button', { name: 'English captions on' }).click()
    const off = await page.evaluate(() => ({ mode: document.querySelector('video').textTracks[0].mode, band: document.querySelector('#band').textContent, hidden: document.querySelector('.sizes').hidden }))
    if (off.mode !== 'disabled' || off.band || !off.hidden) throw Error(`candidate ${layout} ${size}: off drifted`)
    candidate.push({ layout, width, size, on, off })
    await page.locator('main').screenshot({ path: `${out}/candidate-${layout}-${size}-off.png` })
    await page.getByRole('button', { name: 'English captions off' }).click()
  }
  await page.close()
}
await browser.close()
const candidateHashes = Object.fromEntries(await Promise.all(['L05-01-desktop.mp4', 'L05-01-desktop.vtt', 'L05-01-mobile.mp4', 'L05-01-mobile.vtt'].map(async (name) => [name, await digest(`${out}/candidate/${name}`)])))
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), codeCommit, candidateCommit, base, candidateBase, source, candidateHashes, learner, candidate }, null, 2) + '\n')
console.log(`PASS ${learner.length} learner states; ${candidate.length} fixed-candidate states`)
