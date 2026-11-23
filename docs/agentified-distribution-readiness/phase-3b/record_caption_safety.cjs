const { chromium } = require('playwright')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const bindings = require(path.join(root, 'lib/agentified-illustrated-bindings.json'))
const audit = require(path.join(root, 'agentified/workshop/presentation-illustration-audit/audit-boundaries.json'))
const mobileTeachingDetails = require(path.join(root, 'app/agentified/mobile-teaching-details.json'))
const output = path.join(root, 'agentified/workshop/caption-safety-review')
const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision || '')) throw new Error('Pass the code commit SHA')
const lessons = ['L01', ...Array.from({ length: 12 }, (_, index) => `L${String(index + 5).padStart(2, '0')}`)]
const clearanceScenes = [
  { id: 'L07-01', start: 0, end: 27.99, line: 4, captureStart: 12.5 },
  { id: 'L07-06', start: 153.479, end: 160.078, line: 52, captureStart: 155.4 },
]
const reviewScenes = [...clearanceScenes, { id: 'L07-08', start: 233.648, end: 251.332, captureStart: 241 }]
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const cueSource = (lesson) => {
  const source = bindings.bindings[lesson].captions
  const blocks = fs.readFileSync(path.join(root, 'public', source), 'utf8').replace(/\r/g, '').split(/\n\n+/)
  return blocks.filter((block) => block.includes(' --> ')).map((block) => {
    const [timing, ...lines] = block.split('\n')
    const [start, end] = timing.split(' --> ')
    return { start, end, text: lines.join('\n').trimEnd() }
  })
}
const timestamp = (seconds) => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23)

async function readPlayer(page, lesson) {
  await page.waitForFunction((id) => document.querySelector('video')?.getAttribute('aria-label')?.startsWith(id + ' '), lesson)
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2 && document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await page.waitForTimeout(350)
  return page.locator('video')
}

async function run() {
  for (const scene of reviewScenes) {
    const source = audit.rows.find((row) => row.scene_id === scene.id)
    if (source?.start_seconds !== scene.start || source?.end_seconds !== scene.end) throw new Error(`${scene.id}: source scene boundary drift`)
  }
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const observations = []
  try {
    for (const [name, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()
      for (const lesson of lessons) {
        const url = `http://127.0.0.1:3121/agentified/learningplan?lesson=${lesson}&rev=${revision}`
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
        if (response.status() !== 200) throw new Error(`${name} ${lesson}: HTTP ${response.status()}`)
        const player = await readPlayer(page, lesson)
        const state = await player.evaluate((video) => {
          const track = video.textTracks[0]
          return {
            src: new URL(video.currentSrc).pathname,
            captions: new URL(video.querySelector('track').src).pathname,
            controls: video.controls,
            width: video.getBoundingClientRect().width,
            height: video.getBoundingClientRect().height,
            mode: track.mode,
            cues: Array.from(track.cues, (cue) => ({ start: cue.startTime, end: cue.endTime, text: cue.text, line: cue.line, snap: cue.snapToLines })),
          }
        })
        const expected = cueSource(lesson)
        if (state.cues.length !== expected.length || !state.controls || Math.abs(state.width / state.height - 16 / 9) > 0.02 || state.captions !== bindings.bindings[lesson].captions || state.mode !== (name === 'mobile' ? 'hidden' : 'showing')) throw new Error(`${name} ${lesson}: media or cue count drift`)
        state.cues.forEach((cue, index) => {
          const source = expected[index]
          if (timestamp(cue.start) !== source.start || timestamp(cue.end) !== source.end || cue.text !== source.text) throw new Error(`${name} ${lesson} cue ${index}: text or timing drift`)
          const scene = name === 'desktop' && lesson === 'L07' ? clearanceScenes.find(({ start, end }) => cue.start >= start && cue.start < end) : null
          if (scene ? cue.line !== scene.line || cue.snap !== false : cue.line !== 'auto' || cue.snap !== true) throw new Error(`${name} ${lesson} cue ${index}: unexpected placement`)
        })
        const seek = async (time, expectedText) => {
          await player.evaluate((video, seconds) => { video.pause(); video.currentTime = seconds; video.dispatchEvent(new Event('seeking')) }, time)
          await page.waitForFunction(({ time, expectedText, mode }) => {
            const video = document.querySelector('video')
            const band = document.querySelector(`[aria-label="${video?.getAttribute('aria-label')?.slice(0, 3)} caption"]`)
            return video && Math.abs(video.currentTime - time) < 0.1 && video.textTracks[0].mode === mode && (mode === 'hidden' && expectedText ? band?.textContent === expectedText : !band)
          }, { time, expectedText, mode: name === 'mobile' ? 'hidden' : 'showing' }, { timeout: 5000 })
        }
        for (const cue of state.cues) {
          const time = (cue.start + cue.end) / 2
          const expectedText = state.cues.filter((item) => item.start <= time && time < item.end).map((item) => item.text).join('\n')
          await seek(time, expectedText)
        }
        const gap = state.cues.find((cue, index) => index + 1 < state.cues.length && state.cues[index + 1].start - cue.end >= 0.1)
        if (gap) await seek((gap.end + state.cues[state.cues.indexOf(gap) + 1].start) / 2, '')
        const readingPanels = mobileTeachingDetails.scenes.filter((scene) => scene.lessonId === lesson)
        for (const scene of readingPanels) {
          const time = (scene.startSeconds + scene.endSeconds) / 2
          await player.evaluate((video, seconds) => { video.currentTime = seconds; video.dispatchEvent(new Event('seeking')) }, time)
          await page.waitForFunction((id) => document.querySelector('aside[aria-label$="source wording"]')?.getAttribute('aria-label')?.startsWith(id + ' '), scene.sceneId)
          const panel = await page.evaluate(() => {
            const video = document.querySelector('video')
            const aside = document.querySelector('aside[aria-label$="source wording"]')
            const band = document.querySelector('[aria-label$=" caption"]')
            return { display: getComputedStyle(aside).display, top: aside.getBoundingClientRect().top, videoBottom: video.getBoundingClientRect().bottom, bandBottom: band?.getBoundingClientRect().bottom ?? null }
          })
          if (panel.display !== (name === 'mobile' ? 'block' : 'none') || (name === 'mobile' && panel.top < Math.max(panel.videoBottom, panel.bandBottom ?? 0) - 1)) throw new Error(`${name} ${scene.sceneId}: reading panel obstruction`)
        }
        const toggleCue = lesson === 'L07' ? state.cues.find((cue) => cue.start <= 242.7 && 242.7 < cue.end) : state.cues[0]
        const midpoint = lesson === 'L07' ? 242.7 : (toggleCue.start + toggleCue.end) / 2
        const expectedToggleText = state.cues.filter((cue) => cue.start <= midpoint && midpoint < cue.end).map((cue) => cue.text).join('\n')
        await seek(midpoint, expectedToggleText)
        const read = () => player.evaluate((video) => ({ mode: video.textTracks[0].mode, paused: video.paused, width: video.getBoundingClientRect().width, height: video.getBoundingClientRect().height, band: document.querySelector(`[aria-label="${video.getAttribute('aria-label').slice(0, 3)} caption"]`)?.textContent ?? null }))
        const before = await read()
        if (name === 'mobile') await page.getByRole('button', { name: 'English captions on' }).click()
        else await player.evaluate((video) => { video.textTracks[0].mode = 'disabled' })
        const off = await read()
        if (name === 'mobile') await page.getByRole('button', { name: 'English captions off' }).click()
        else await player.evaluate((video) => { video.textTracks[0].mode = 'showing' })
        const restored = await read()
        const states = { before, off, restored }
        if (before.mode !== (name === 'mobile' ? 'hidden' : 'showing') || !before.paused || (name === 'mobile' && before.band !== expectedToggleText) || off.mode !== 'disabled' || off.band !== null || restored.mode !== before.mode || !restored.paused || (name === 'mobile' && restored.band !== expectedToggleText) || [before, off, restored].some((item) => Math.abs(item.width - state.width) > 1 || Math.abs(item.height - state.height) > 1)) throw new Error(`${name} ${lesson}: caption toggle, paused restoration, or player size drift: ${JSON.stringify(states)}`)
        observations.push({ viewport: name, lesson, url, cueCount: state.cues.length, activeCueChecks: state.cues.length, cueGapChecked: Boolean(gap), mappedReadingPanels: readingPanels.map((scene) => scene.sceneId), movedCues: name === 'desktop' && lesson === 'L07' ? Object.fromEntries(clearanceScenes.map((scene) => [scene.id, state.cues.filter((cue) => cue.start >= scene.start && cue.start < scene.end).length])) : {}, states })
        console.log(`${name} ${lesson}: ${state.cues.length} active cue checks, ${readingPanels.length} reading panels, paused restoration passed`)
      }
      await context.close()

      for (const scene of reviewScenes) {
        const recording = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: output, size: { width, height } } })
        const review = await recording.newPage()
        const url = `http://127.0.0.1:3121/agentified/learningplan?lesson=L07&rev=${revision}`
        await review.goto(url, { waitUntil: 'domcontentloaded' })
        const player = await readPlayer(review, 'L07')
        await player.scrollIntoViewIfNeeded()
        await player.evaluate((video, seconds) => { video.currentTime = seconds; video.play() }, scene.captureStart)
        await review.waitForTimeout(1800)
        const inspect = () => player.evaluate((video) => {
          const time = video.currentTime
          return { mode: video.textTracks[0].mode, controls: video.controls, width: video.getBoundingClientRect().width, height: video.getBoundingClientRect().height, expected: Array.from(video.textTracks[0].cues ?? []).filter((cue) => cue.startTime <= time && time < cue.endTime).map((cue) => cue.text).join('\n'), band: document.querySelector('[aria-label="L07 caption"]')?.textContent ?? null }
        })
        const on = await inspect()
        if (!on.controls || Math.abs(on.width / on.height - 16 / 9) > 0.02 || on.mode !== (name === 'mobile' ? 'hidden' : 'showing') || (name === 'mobile' ? on.band !== on.expected || !on.band : on.band !== null)) throw new Error(`${name} ${scene.id}: caption-on recording state failed: ${JSON.stringify(on)}`)
        await review.screenshot({ path: path.join(output, `${name}-${scene.id}-captions-on.png`) })
        await player.evaluate((video) => video.pause())
        if (name === 'mobile') await review.getByRole('button', { name: 'English captions on' }).click()
        else await player.evaluate((video) => { video.textTracks[0].mode = 'disabled' })
        await review.waitForTimeout(700)
        const off = await inspect()
        if (off.mode !== 'disabled' || off.band !== null || off.width !== on.width || off.height !== on.height) throw new Error(`${name} ${scene.id}: caption-off recording state failed`)
        await review.screenshot({ path: path.join(output, `${name}-${scene.id}-captions-off.png`) })
        if (name === 'mobile') await review.getByRole('button', { name: 'English captions off' }).click()
        else await player.evaluate((video) => { video.textTracks[0].mode = 'showing' })
        const restored = await inspect()
        if (restored.mode !== on.mode || (name === 'mobile' && restored.band !== restored.expected) || restored.width !== on.width || restored.height !== on.height) throw new Error(`${name} ${scene.id}: paused restoration recording state failed`)
        await review.waitForTimeout(700)
        await review.screenshot({ path: path.join(output, `${name}-${scene.id}-paused-restored.png`) })
        await recording.close()
        const webm = await review.video().path()
        const mp4 = path.join(output, `${name}-${scene.id}-walkthrough.mp4`)
        execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
        fs.unlinkSync(webm)
        execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
        observations.push({ viewport: name, lesson: 'L07', scene: scene.id, reviewUrl: url, recording: path.relative(root, mp4) })
      }
    }
  } finally { await browser.close() }
  const evidence = fs.readdirSync(output).filter((file) => /\.(png|mp4)$/.test(file)).sort().map((file) => ({ path: path.relative(root, path.join(output, file)), sha256: sha(path.join(output, file)) }))
  const receipt = { schemaVersion: 3, codeCommit: revision, lessons, mobileCaptionSystem: { maxWidth: 620, onTrackMode: 'hidden', offTrackMode: 'disabled' }, clearanceScenes: clearanceScenes.map(({ id, start, end, line }) => ({ id, start, end, line })), reviewScenes: reviewScenes.map(({ id, start, end }) => ({ id, start, end })), observations, evidence }
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(`PASS: ${observations.filter((item) => item.cueCount).length} lesson/viewport cue and state sweeps; ${evidence.length} evidence files`)
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
