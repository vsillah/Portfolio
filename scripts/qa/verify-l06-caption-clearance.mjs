import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { waitForCueFrame } from './caption-size-state.mjs'

const base = process.env.CAPTION_QA_BASE ?? 'http://127.0.0.1:3137'
const candidateBase = process.env.CAPTION_CANDIDATE_BASE ?? 'http://127.0.0.1:8767'
const out = 'agentified/workshop/l06-caption-clearance-review'
const codeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const binding = JSON.parse(await readFile('lib/agentified-illustrated-bindings.json', 'utf8')).bindings.L06
const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
const videoHash = await digest(`public${binding.video}`)
const captionsHash = await digest(`public${binding.captions}`)
if (videoHash !== binding.compositeSha256 || captionsHash !== binding.captionsSha256) throw Error('Approved L06 video or VTT hash drifted')
const source = { video: binding.video, videoHash, captions: binding.captions, captionsHash }
const rows = JSON.parse(await readFile('agentified/workshop/presentation-illustration-audit/audit-boundaries.json', 'utf8')).rows.filter((row) => row.scene_id.startsWith('L06-'))
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const learner = []
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
  await page.goto(`${base}/agentified/learningplan?lesson=L06&rev=${codeCommit}`, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  const currentSource = await video.evaluate((element) => ({ video: element.querySelector('source')?.getAttribute('src'), captions: element.querySelector('track')?.getAttribute('src') }))
  if (currentSource.video !== source.video || currentSource.captions !== source.captions) throw Error(`L06 ${width}: learner binding drifted`)
  const baseline = await page.evaluate(() => { const box = document.querySelector('video').getBoundingClientRect(); return { video: [Math.round(box.width), Math.round(box.height)], scrollWidth: document.documentElement.scrollWidth } })
  const seek = async (time) => {
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    await video.evaluate((element) => element.pause())
  }
  const inspect = async (scene, sample, time, size = 'M') => {
    const state = await page.evaluate(() => {
      const video = document.querySelector('video')
      const band = document.querySelector('[aria-label="L06 caption"]')
      const vb = video.getBoundingClientRect()
      const bb = band?.getBoundingClientRect()
      return { time: video.currentTime, mode: video.textTracks[0].mode, cues: [...video.textTracks[0].cues].filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => ({ start: cue.startTime, end: cue.endTime, text: cue.text })), band: band?.textContent ?? null, bandCount: document.querySelectorAll('[aria-label="L06 caption"]').length, bandFont: band ? getComputedStyle(band).fontSize : null, bandTop: bb?.top ?? null, videoBottom: vb.bottom, video: [Math.round(vb.width), Math.round(vb.height)], controls: video.controls, selected: [...document.querySelectorAll('[role="group"][aria-label="Caption size"] button[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label')), scrollWidth: document.documentElement.scrollWidth }
    })
    const external = width === 390 || size === 'L' || time >= 65.532 && time < 97.482
    const active = state.cues.length === 1
    if (state.cues.length > 1 || state.mode !== (external ? 'hidden' : 'showing') || state.bandCount !== (external && active ? 1 : 0) || external && active && state.band !== state.cues[0].text || state.bandTop !== null && state.bandTop < state.videoBottom - 1 || state.video.join() !== baseline.video.join() || state.scrollWidth > baseline.scrollWidth + 1 || !state.controls) throw Error(`${width} ${scene} ${sample} ${size}: ${JSON.stringify(state)}`)
    if (external && active && state.bandFont !== { S: '14px', M: '18px', L: '24px' }[size]) throw Error(`${width} ${scene} ${sample} ${size}: band font drifted`)
    learner.push({ width, scene, sample, time, size, external, ...state })
    return state
  }
  for (const row of rows) for (const [sample, time] of [['boundary', row.boundary_sample_seconds], ['midpoint', row.midpoint_sample_seconds]]) {
    await seek(time)
    const state = await inspect(row.scene_id, sample, time)
    if (['L06-02', 'L06-03', 'L06-04'].includes(row.scene_id) && sample === 'boundary') await video.locator('../..').screenshot({ path: `${out}/${row.scene_id}-${width}-boundary.png` })
  }
  for (const [sample, time] of [['before', 64.5], ['start-minus', 65.531], ['start', 65.532], ['collision', 77], ['gap', 97.481], ['end', 97.482], ['after', 98.5]]) {
    await seek(time)
    await inspect('L06-03-boundary', sample, time)
    if (sample === 'collision') {
      for (const [size, label] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
        await page.getByRole('button', { name: `${label} captions` }).click()
        const selected = await inspect('L06-03', 'collision', time, size)
        if (selected.selected.join() !== `${label} captions`) throw Error(`${width} ${size}: Aa selection drifted`)
        await video.locator('../..').screenshot({ path: `${out}/L06-03-${width}-${size}-on.png` })
        await page.getByRole('button', { name: 'English captions on' }).click()
        const off = await page.evaluate(() => { const video = document.querySelector('video'); const box = video.getBoundingClientRect(); return { time: video.currentTime, mode: video.textTracks[0].mode, bandCount: document.querySelectorAll('[aria-label="L06 caption"]').length, sizeGroup: document.querySelectorAll('[role="group"][aria-label="Caption size"]').length, video: [Math.round(box.width), Math.round(box.height)] } })
        if (off.mode !== 'disabled' || off.bandCount || off.sizeGroup || Math.abs(off.time - time) > .1 || off.video.join() !== baseline.video.join()) throw Error(`${width} ${size}: off state drifted ${JSON.stringify(off)}`)
        await video.locator('../..').screenshot({ path: `${out}/L06-03-${width}-${size}-off.png` })
        await page.getByRole('button', { name: 'English captions off' }).click()
        const restored = await inspect('L06-03', 'restored', time, size)
        if (restored.selected.join() !== `${label} captions`) throw Error(`${width} ${size}: Aa selection not restored`)
        learner.push({ width, scene: 'L06-03', sample: 'off', size, off })
      }
      await page.getByRole('button', { name: 'Medium captions' }).click()
    }
  }
  await page.close()
}

const candidate = []
for (const [layout, width] of [['desktop', 1280], ['mobile', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
  await page.goto(`${candidateBase}/${out}/candidate/review.html?layout=${layout}&revision=519918b9`, { waitUntil: 'domcontentloaded' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 4 && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await video.evaluate(async (element) => { element.muted = true; await element.play() })
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 2)
  await video.evaluate((element) => element.pause())
  const baseline = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)] })
  for (const [size, label] of [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']]) {
    await page.getByRole('button', { name: `${label} captions` }).click()
    const on = await page.evaluate(() => { const video = document.querySelector('video'); const band = document.querySelector('#band'); const vb = video.getBoundingClientRect(); const bb = band.getBoundingClientRect(); return { time: video.currentTime, mode: video.textTracks[0].mode, cues: [...video.textTracks[0].cues].filter((cue) => cue.startTime <= video.currentTime && video.currentTime < cue.endTime).map((cue) => ({ start: cue.startTime, end: cue.endTime, text: cue.text })), band: band.textContent, bandTop: bb.top, videoBottom: vb.bottom, video: [Math.round(vb.width), Math.round(vb.height)], controls: video.controls, font: getComputedStyle(band).fontSize } })
    if (on.mode !== 'hidden' || on.cues.length !== 1 || on.band !== on.cues[0].text || on.bandTop < on.videoBottom - 1 || on.video.join() !== baseline.join() || !on.controls || on.font !== { S: '14px', M: '18px', L: '24px' }[size]) throw Error(`candidate ${layout} ${size}: ${JSON.stringify(on)}`)
    await page.locator('main').screenshot({ path: `${out}/candidate-${layout}-${size}-on.png` })
    await page.getByRole('button', { name: 'English captions on' }).click()
    const off = await page.evaluate(() => ({ mode: document.querySelector('video').textTracks[0].mode, band: document.querySelector('#band').textContent, sizeHidden: document.querySelector('.sizes').hidden, time: document.querySelector('video').currentTime }))
    if (off.mode !== 'disabled' || off.band || !off.sizeHidden || Math.abs(off.time - on.time) > .1) throw Error(`candidate ${layout} ${size}: off state drifted`)
    await page.locator('main').screenshot({ path: `${out}/candidate-${layout}-${size}-off.png` })
    await page.getByRole('button', { name: 'English captions off' }).click()
    candidate.push({ layout, width, size, on, off })
  }
  await page.close()
}
await browser.close()
const candidateHashes = Object.fromEntries(await Promise.all(['L06-03-desktop.mp4', 'L06-03-desktop.vtt', 'L06-03-mobile.mp4', 'L06-03-mobile.vtt'].map(async (name) => [name, await digest(`${out}/candidate/${name}`)])))
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), codeCommit, candidateCommit: '519918b9df23ae012d5c20c700ffb8a696775afb', base, candidateBase, source, candidateHashes, learner, candidate }, null, 2) + '\n')
console.log(`PASS ${learner.length} learner states; ${candidate.length} fixed-candidate states`)
