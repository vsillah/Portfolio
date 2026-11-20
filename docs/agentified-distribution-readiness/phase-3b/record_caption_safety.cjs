const { chromium } = require('playwright')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const bindings = require(path.join(root, 'lib/agentified-illustrated-bindings.json'))
const output = path.join(root, 'agentified/workshop/caption-safety-review')
const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision || '')) throw new Error('Pass the code commit SHA')
const lessons = ['L01', ...Array.from({ length: 12 }, (_, index) => `L${String(index + 5).padStart(2, '0')}`)]
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
            ratio: video.getBoundingClientRect().width / video.getBoundingClientRect().height,
            cues: Array.from(track.cues, (cue) => ({ start: cue.startTime, end: cue.endTime, text: cue.text, line: cue.line, snap: cue.snapToLines })),
          }
        })
        const expected = cueSource(lesson)
        if (state.cues.length !== expected.length || !state.controls || Math.abs(state.ratio - 16 / 9) > 0.02 || state.captions !== bindings.bindings[lesson].captions) throw new Error(`${name} ${lesson}: media or cue count drift`)
        state.cues.forEach((cue, index) => {
          const source = expected[index]
          if (timestamp(cue.start) !== source.start || timestamp(cue.end) !== source.end || cue.text !== source.text) throw new Error(`${name} ${lesson} cue ${index}: text or timing drift`)
          const opening = name === 'desktop' && lesson === 'L07' && cue.start < 27.67
          if (opening ? cue.line !== 4 || cue.snap !== false : cue.line !== 'auto' || cue.snap !== true) throw new Error(`${name} ${lesson} cue ${index}: unexpected placement`)
        })
        const midpoint = lesson === 'L07' ? 14 : Math.min(state.cues[0].end - 0.05, state.cues[0].start + 0.3)
        console.log(`${name} ${lesson}: ${state.cues.length} cues; paused-state check at ${midpoint.toFixed(3)}s`)
        await player.evaluate((video, time) => { video.pause(); video.currentTime = time }, midpoint)
        await page.waitForFunction((time) => Math.abs(document.querySelector('video').currentTime - time) < 0.1 && document.querySelector('video').textTracks[0].activeCues?.length > 0, midpoint)
        const read = () => player.evaluate((video) => ({ mode: video.textTracks[0].mode, paused: video.paused, active: video.textTracks[0].activeCues?.length ?? 0 }))
        const before = await read()
        await player.evaluate((video) => { video.textTracks[0].mode = 'disabled' })
        await page.waitForTimeout(350)
        const off = await read()
        await player.evaluate((video) => { video.textTracks[0].mode = 'showing' })
        await page.waitForFunction(() => document.querySelector('video').textTracks[0].activeCues?.length > 0)
        const restored = await read()
        const states = { before, off, restored }
        if (states.before.mode !== 'showing' || !states.before.paused || states.off.mode !== 'disabled' || states.off.active !== 0 || states.restored.mode !== 'showing' || !states.restored.paused || states.restored.active !== states.before.active) throw new Error(`${name} ${lesson}: caption toggle or paused restoration drift`)
        observations.push({ viewport: name, lesson, url, cueCount: state.cues.length, openingCuesMoved: name === 'desktop' && lesson === 'L07' ? state.cues.filter((cue) => cue.start < 27.67).length : 0, states })
      }
      await context.close()

      const recording = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: output, size: { width, height } } })
      const review = await recording.newPage()
      const url = `http://127.0.0.1:3121/agentified/learningplan?lesson=L07&rev=${revision}`
      await review.goto(url, { waitUntil: 'domcontentloaded' })
      const player = await readPlayer(review, 'L07')
      await player.scrollIntoViewIfNeeded()
      await player.evaluate((video) => { video.currentTime = 12.5; video.play() })
      await review.waitForTimeout(1800)
      await review.screenshot({ path: path.join(output, `${name}-L07-01-captions-on.png`) })
      await player.evaluate((video) => video.pause())
      await player.evaluate((video) => { video.textTracks[0].mode = 'disabled' })
      await review.waitForTimeout(700)
      await review.screenshot({ path: path.join(output, `${name}-L07-01-captions-off.png`) })
      await player.evaluate((video) => { video.textTracks[0].mode = 'showing' })
      await review.waitForTimeout(700)
      await review.screenshot({ path: path.join(output, `${name}-L07-01-paused-restored.png`) })
      await recording.close()
      const webm = await review.video().path()
      const mp4 = path.join(output, `${name}-L07-01-walkthrough.mp4`)
      execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
      fs.unlinkSync(webm)
      execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
      observations.push({ viewport: name, lesson: 'L07', reviewUrl: url, recording: path.relative(root, mp4) })
    }
  } finally { await browser.close() }
  const evidence = fs.readdirSync(output).filter((file) => /\.(png|mp4)$/.test(file)).sort().map((file) => ({ path: path.relative(root, path.join(output, file)), sha256: sha(path.join(output, file)) }))
  const receipt = { schemaVersion: 1, codeCommit: revision, lessons, observations, evidence }
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(`PASS: ${observations.length - 2} lesson/viewport cue and state sweeps; ${evidence.length} evidence files`)
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
