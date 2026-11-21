import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { waitForCaptionSize, waitForCueFrame } from './caption-size-state.mjs'

const base = 'http://127.0.0.1:3121'
const out = 'agentified/workshop/l08-caption-clearance-review/visual-audit'
await mkdir(out, { recursive: true })
const audit = JSON.parse(await readFile('agentified/workshop/presentation-illustration-audit/audit-boundaries.json', 'utf8'))
const scenes = audit.rows.filter((row) => /^L08-/.test(row.scene_id) || row.scene_id === 'L07-08' || row.scene_id === 'L09-01')
const browser = await chromium.launch({ headless: true })
const results = []
for (const width of [1280, 390]) {
  const height = width === 390 ? 844 : 720
  const page = await browser.newPage({ viewport: { width, height } })
  for (const scene of scenes) {
    const lesson = scene.scene_id.slice(0, 3)
    await page.goto(`${base}/agentified/learningplan?lesson=${lesson}`, { waitUntil: 'networkidle' })
    const video = page.locator('video')
    await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
    const media = video.locator('../..')
    for (const [sample, time] of [['boundary', scene.boundary_sample_seconds], ['midpoint', scene.midpoint_sample_seconds]]) {
      await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
      await waitForCueFrame(page, time)
      const pausedTime = await video.evaluate((element) => { element.pause(); return element.currentTime })
      await page.getByRole('button', { name: 'Medium captions' }).click()
      const cue = await video.evaluate((element) => [...element.textTracks[0].cues].filter((item) => item.startTime <= element.currentTime && element.currentTime < item.endTime).map((item) => ({ start: item.startTime, end: item.endTime, text: item.text })))
      if (cue.length > 1) throw Error(`${scene.scene_id} ${width} ${sample}: duplicate source cues`)
      const external = lesson === 'L08' || width === 390
      if (cue.length) await waitForCaptionSize(page, { course: 'agentified', width, name: 'Medium' })
      else await page.waitForFunction(({ external }) => document.querySelector('video')?.textTracks[0]?.mode === (external ? 'hidden' : 'showing') && !document.querySelector('[aria-label$=" caption"]'), { external })
      const on = await page.evaluate(() => {
        const video = document.querySelector('video')
        const box = video.getBoundingClientRect()
        const band = document.querySelector('[aria-label$=" caption"]')
        const bandBox = band?.getBoundingClientRect()
        return { video: [Math.round(box.width), Math.round(box.height)], trackMode: video.textTracks[0]?.mode, bandCount: document.querySelectorAll('[aria-label$=" caption"]').length, bandText: band?.textContent ?? null, bandBelowVideo: bandBox ? bandBox.top >= box.bottom : null }
      })
      if (on.trackMode !== (external ? 'hidden' : 'showing') || on.bandCount !== Number(external && Boolean(cue.length)) || external && cue.length && (on.bandText !== cue[0].text || !on.bandBelowVideo)) throw Error(`${scene.scene_id} ${width} ${sample}: missing, duplicate, misplaced, or changed caption ${JSON.stringify({ cue, on })}`)
      await media.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 80, behavior: 'instant' }))
      await page.mouse.move(5, 5)
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const videoBox = await video.boundingBox()
      const toggleBox = await page.getByRole('button', { name: 'English captions on' }).boundingBox()
      const bandBox = on.bandCount ? await page.locator('[aria-label$=" caption"]').boundingBox() : null
      if (!videoBox || !toggleBox) throw Error(`${scene.scene_id} ${width} ${sample}: screenshot bounds missing`)
      const x = Math.max(0, Math.floor(videoBox.x - 8))
      const y = Math.max(0, Math.floor(videoBox.y - 8))
      const right = Math.min(width, Math.ceil(videoBox.x + videoBox.width + 8))
      const bottom = Math.min(height, Math.ceil(Math.max(videoBox.y + videoBox.height, toggleBox.y + toggleBox.height, bandBox ? bandBox.y + bandBox.height : 0) + 18))
      if (right <= x || bottom <= y || videoBox.y < 70 || bottom >= height) throw Error(`${scene.scene_id} ${width} ${sample}: capture clipped ${JSON.stringify({ x, y, right, bottom, videoBox, toggleBox, bandBox })}`)
      const clip = { x, y, width: right - x, height: bottom - y }
      const prefix = `${out}/${scene.scene_id}-${sample}-${width}`
      await page.screenshot({ path: `${prefix}-on.png`, clip })
      await page.getByRole('button', { name: 'English captions on' }).click()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]') && !document.querySelector('[role="group"][aria-label="Caption size"]'))
      const off = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return { time: element.currentTime, video: [Math.round(box.width), Math.round(box.height)] } })
      if (off.video.join() !== on.video.join() || Math.abs(off.time - pausedTime) > .1) throw Error(`${scene.scene_id} ${width} ${sample}: off moved geometry or cue time`)
      await page.screenshot({ path: `${prefix}-off.png`, clip })
      await page.getByRole('button', { name: 'English captions off' }).click()
      if (cue.length) await waitForCaptionSize(page, { course: 'agentified', width, name: 'Medium' })
      results.push({ scene: scene.scene_id, lesson, sample, time, width, cue, on, off, clip })
      console.log(`${scene.scene_id} ${sample} ${width}: ${on.trackMode}, ${cue.length ? 'cue' : 'gap'}`)
    }
  }
  await page.close()
}
await browser.close()
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base, scenes: scenes.map((scene) => scene.scene_id), results }, null, 2) + '\n')
console.log(`PASS ${results.length} caption frame states`)
