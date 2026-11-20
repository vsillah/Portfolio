import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { captureCaptionFocus, waitForCaptionSize, waitForCueFrame } from './caption-size-state.mjs'

const base = 'http://127.0.0.1:3121'
const out = 'agentified/workshop/caption-size-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const ids = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => `L${String(start + i).padStart(2, '0')}`)
for (const width of [1280, 390]) {
  for (const course of ['agentified', 'accelerated']) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, recordVideo: undefined })
    const lessonIds = course === 'agentified' ? ['L01', ...ids(5, 16)] : ids(1, 16)
    await page.goto(`${base}/${course}/learningplan`, { waitUntil: 'networkidle' })
    for (const id of lessonIds) {
      console.log(`Checking ${course} ${id} at ${width}px`)
      if (course === 'agentified') await page.goto(`${base}/agentified/learningplan?lesson=${id}`, { waitUntil: 'networkidle' })
      else await page.locator(`button[aria-label^="${id}:"]`).evaluate((button) => button.click())
      const video = page.locator('video')
      await video.waitFor()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
      const cue = await video.evaluate((element) => {
        const cues = Array.from(element.textTracks[0].cues)
        const longest = cues.reduce((a, b) => b.text.length > a.text.length ? b : a)
        return { start: longest.startTime, end: longest.endTime, text: longest.text }
      })
      await video.evaluate((element, time) => { element.currentTime = time; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, cue.start + .05)
      await waitForCueFrame(page, cue.start + .05)
      const baselineScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      let geometry = null
      for (const size of ['S', 'M', 'L']) {
        const name = { S: 'Small', M: 'Medium', L: 'Large' }[size]
        await page.getByRole('button', { name: `${name} captions` }).click()
        const state = await waitForCaptionSize(page, { course, width, name })
        const expectsBand = course === 'accelerated' || width === 390 || size === 'L'
        const check = await page.evaluate(() => {
          const video = document.querySelector('video')
          const rect = video.getBoundingClientRect()
          const band = document.querySelector('[aria-label$=" caption"]')
          return { video: [Math.round(rect.width), Math.round(rect.height)], band: band?.textContent ?? null, bandFont: band ? getComputedStyle(band).fontSize : null, scrollWidth: document.documentElement.scrollWidth }
        })
        if (geometry && check.video.join() !== geometry.join()) throw Error(`${course} ${id} ${width}: video changed with ${size}`)
        geometry = check.video
        if (check.scrollWidth > baselineScrollWidth + 1) throw Error(`${course} ${id} ${width}: new horizontal overflow at ${size}`)
        if (Boolean(check.band) !== expectsBand) throw Error(`${course} ${id} ${width}: wrong caption surface at ${size}`)
        if (check.band && !check.band.includes(cue.text.replaceAll('\n', ' ').slice(0, 12))) throw Error(`${course} ${id} ${width}: wrong active cue at ${size}`)
        results.push({ course, id, width, size, cueStart: cue.start, cueEnd: cue.end, cueLength: cue.text.length, selected: state.pressed[0], stored: state.stored, trackMode: state.trackMode, ...check })
        if ((course === 'agentified' && id === 'L07' || course === 'accelerated' && ['L01', 'L09'].includes(id)) && width === 390) await captureCaptionFocus(page, `${out}/${course}-${id}-${width}-${size}.png`)
        if (width === 1280 && (course === 'agentified' && id === 'L07' || course === 'accelerated' && id === 'L09')) await video.locator('../..').screenshot({ path: `${out}/${course}-${id}-${width}-${size}.png` })
      }
      const toggle = page.getByRole('button', { name: 'English captions on' })
      await toggle.click()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]') && [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'English captions off' && button.getAttribute('aria-pressed') === 'false'))
      await page.getByRole('button', { name: 'English captions off' }).click()
      await waitForCaptionSize(page, { course, width, name: 'Large' })
      const restored = await page.locator('[aria-label$=" caption"]').count()
      if (results.at(-1).band && restored !== 1) throw Error(`${course} ${id} ${width}: active cue did not return while paused`)
    }
    await page.close()
  }
}
await browser.close()
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2))
console.log(`PASS ${results.length} lesson/size checks`)
