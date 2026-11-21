import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { waitForCueFrame } from './caption-size-state.mjs'

const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const candidateBase = process.env.CAPTION_CANDIDATE_BASE ?? 'http://127.0.0.1:8767'
const out = 'agentified/workshop/l05-caption-clearance-review'
const candidateDir = 'agentified/workshop/l05-01-caption-clearance-review/candidate'
const codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const candidateCommit = 'd047960edcf58bc2c75b3a944fe22a5d8ad25bb4'
const binding = JSON.parse(await readFile('lib/agentified-illustrated-bindings.json', 'utf8')).bindings.L05
const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
const source = { video: binding.video, captions: binding.captions, videoHash: await digest(`public${binding.video}`), captionsHash: await digest(`public${binding.captions}`) }
if (source.videoHash !== binding.compositeSha256 || source.captionsHash !== binding.captionsSha256) throw Error('Approved L05 binding drifted')
await mkdir(out, { recursive: true })
const rows = JSON.parse(await readFile('agentified/workshop/presentation-illustration-audit/audit-boundaries.json', 'utf8')).rows.filter((row) => row.scene_id.startsWith('L05-'))
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
  const openingCues = await video.evaluate((element) => Array.from(element.textTracks[0].cues ?? []).filter((cue) => cue.startTime < 11.91).map((cue) => ({ start: cue.startTime, end: cue.endTime, text: cue.text, line: cue.line, snapToLines: cue.snapToLines })))
  if (openingCues.length !== 8 || openingCues.some((cue) => cue.line !== (width === 390 ? 'auto' : 10) || cue.snapToLines !== (width === 390))) throw Error(`${width}: protected-opening cue placement drifted ${JSON.stringify(openingCues)}`)
  learner.push({ width, label: 'protected-opening-cue-placement', openingCues })
  const seek = async (time, size = 'M') => {
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    const external = width === 390 || size === 'L' || (time >= 11.91)
    await page.waitForFunction((mode) => document.querySelector('video')?.textTracks[0]?.mode === mode, external ? 'hidden' : 'showing')
    await video.evaluate((element) => element.pause())
  }
  const inspect = async (label, time, size = 'M') => {
    const state = await page.evaluate(() => { const video = document.querySelector('video'); const track = video.textTracks[0]; const band = document.querySelector('[aria-label="L05 caption"]'); const vb = video.getBoundingClientRect(); const bb = band?.getBoundingClientRect(); return { time: video.currentTime, mode: track.mode, active: Array.from(track.cues ?? []).filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => cue.text), band: band?.textContent ?? null, bandCount: document.querySelectorAll('[aria-label="L05 caption"]').length, bandTop: bb?.top ?? null, videoBottom: vb.bottom, font: band ? getComputedStyle(band).fontSize : null, video: [Math.round(vb.width), Math.round(vb.height)], controls: video.controls, selected: [...document.querySelectorAll('[role="group"][aria-label="Caption size"] button[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label')), scrollWidth: document.documentElement.scrollWidth, endScreen: Boolean(document.querySelector('[role="status"][aria-label^="L05 complete."]')) } })
    const external = width === 390 || size === 'L' || (time >= 11.91)
    if (state.mode !== (external ? 'hidden' : 'showing') || state.bandCount !== (external && state.active.length && time < 234.398 ? 1 : 0) || external && state.active.length && state.band !== state.active[0] || state.bandTop !== null && state.bandTop < state.videoBottom - 1 || state.video.join() !== baseline.join() || !state.controls || state.scrollWidth > baselineScroll + 1 || state.endScreen !== (time >= 234.398)) throw Error(`${width} ${label}: ${JSON.stringify(state)}`)
    if (external && state.active.length && state.font !== { S: '14px', M: '18px', L: '24px' }[size]) throw Error(`${width} ${label}: font drifted`)
    learner.push({ width, label, expectedTime: time, size, external, ...state })
    return state
  }
  const samples = [['presenter', 8], ['presenter-end', 11.909], ['teaching-start', 11.91], ...rows.flatMap((row) => [[`${row.scene_id}-start`, row.scene_id === 'L05-01' ? 11.91 : row.start_seconds], [`${row.scene_id}-mid`, row.midpoint_sample_seconds], [`${row.scene_id}-end-minus`, (row.scene_id === 'L05-08' ? 234.398 : row.end_seconds) - .001]]), ['end', 234.398], ['end-after', 235]]
  for (const [label, time] of samples) {
    await seek(time)
    await inspect(label, time)
    if (label === 'presenter' || label === 'presenter-end' || label === 'teaching-start' || label === 'end' || label === 'end-after' || label.includes('L05-')) await video.locator('../..').screenshot({ path: `${out}/L05-${width}-${label}.png` })
    if (label === 'presenter' || label.endsWith('-mid')) {
      for (const [size, name] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
        await page.getByRole('button', { name: `${name} captions` }).click()
        await page.waitForFunction(({ size, width }) => { const video = document.querySelector('video'); if (!video || video.dataset.captionSize !== size) return false; const external = width === 390 || size === 'L' || video.currentTime >= 11.91; const active = Array.from(video.textTracks[0].cues ?? []).some((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime); return video.textTracks[0].mode === (external ? 'hidden' : 'showing') && document.querySelectorAll('[aria-label="L05 caption"]').length === (external && active && video.currentTime < 234.398 ? 1 : 0) }, { size, width })
        const on = await inspect(`${label}-${size}-on`, time, size)
        if (on.selected.join() !== `${name} captions`) throw Error(`${width} ${label} ${size}: Aa selection drifted`)
        await video.locator('../..').screenshot({ path: `${out}/L05-${width}-${label}-${size}-on.png` })
        await page.getByRole('button', { name: 'English captions on' }).click()
        const off = await page.evaluate(() => ({ mode: document.querySelector('video').textTracks[0].mode, bands: document.querySelectorAll('[aria-label="L05 caption"]').length, sizes: document.querySelectorAll('[role="group"][aria-label="Caption size"]').length }))
        if (off.mode !== 'disabled' || off.bands || off.sizes) throw Error(`${width} ${label} ${size}: off state ${JSON.stringify(off)}`)
        learner.push({ width, label: `${label}-${size}-off`, time, off })
        if (['presenter', 'L05-01-mid', 'L05-04-mid', 'L05-08-mid'].includes(label)) await video.locator('../..').screenshot({ path: `${out}/L05-${width}-${label}-${size}-off.png` })
        await page.getByRole('button', { name: 'English captions off' }).click()
        await inspect(`${label}-${size}-restored`, time, size)
      }
      await page.getByRole('button', { name: 'Medium captions' }).click()
    }
  }
  for (const boundary of [11.91, 24.779, 52.822, 78.582, 105.56, 136.581, 144.329, 219.992, 234.398]) {
    await seek(boundary - .25)
    await video.evaluate(async (element) => { element.muted = true; await element.play() })
    await page.waitForFunction((target) => document.querySelector('video')?.currentTime >= target, boundary + .2)
    await video.evaluate((element) => element.pause())
    await inspect(`played-through-${boundary}`, boundary + .2)
    await video.locator('../..').screenshot({ path: `${out}/L05-${width}-played-through-${boundary}.png` })
  }
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.documentElement.classList.contains('dark') && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await seek(92.071)
  await video.evaluate(async (element) => { element.muted = true; await element.play() })
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 92.3)
  await video.evaluate((element) => element.pause())
  await inspect('dark-theme', 92.3)
  await video.locator('../..').screenshot({ path: `${out}/L05-${width}-dark-theme.png` })
  await page.close()
}
const candidate = []
for (const [layout, width] of [['desktop', 1280], ['mobile', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
  await page.goto(`${candidateBase}/${candidateDir}/review.html?layout=${layout}&revision=d047960e`, { waitUntil: 'domcontentloaded' })
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
const candidateHashes = Object.fromEntries(await Promise.all(['L05-01-desktop.mp4', 'L05-01-desktop.vtt', 'L05-01-mobile.mp4', 'L05-01-mobile.vtt'].map(async (name) => [name, await digest(`${candidateDir}/${name}`)])))
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), codeCommit, candidateCommit, base, candidateBase, source, candidateHashes, learner, candidate }, null, 2) + '\n')
console.log(`PASS ${learner.length} learner states; ${candidate.length} fixed-candidate states`)
