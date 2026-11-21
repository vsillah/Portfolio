import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { waitForCueFrame } from './caption-size-state.mjs'

const base = 'http://127.0.0.1:3121'
const out = 'agentified/workshop/l09-l16-caption-audit'
await mkdir(out, { recursive: true })
const rows = JSON.parse(await readFile('agentified/workshop/presentation-illustration-audit/audit-boundaries.json', 'utf8')).rows.filter((row) => /^L(09|10|11|12|13|14|15|16)-/.test(row.scene_id))
const browser = await chromium.launch({ headless: true })
const results = []
for (const lesson of ['L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(`${base}/agentified/learningplan?lesson=${lesson}`, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  await page.getByRole('button', { name: 'Medium captions' }).click()
  for (const scene of rows.filter((row) => row.scene_id.startsWith(`${lesson}-`))) {
    for (const [sample, time] of [['boundary', scene.boundary_sample_seconds], ['midpoint', scene.midpoint_sample_seconds]]) {
      await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
      await waitForCueFrame(page, time)
      const pausedTime = await video.evaluate((element) => { element.pause(); return element.currentTime })
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'showing' && !document.querySelector('[aria-label$=" caption"]'))
      const on = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return { mode: element.textTracks[0]?.mode, cue: [...element.textTracks[0].cues].filter((item) => item.startTime <= element.currentTime && element.currentTime < item.endTime).map((item) => ({ start: item.startTime, end: item.endTime, text: item.text })), video: [Math.round(box.width), Math.round(box.height)] } })
      if (on.cue.length > 1) throw Error(`${scene.scene_id} ${sample}: duplicate source cues`)
      const prefix = `${out}/${scene.scene_id}-${sample}`
      await video.screenshot({ path: `${prefix}-on.jpg`, type: 'jpeg', quality: 83 })
      await page.getByRole('button', { name: 'English captions on' }).click()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[role="group"][aria-label="Caption size"]'))
      const off = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return { time: element.currentTime, video: [Math.round(box.width), Math.round(box.height)] } })
      if (Math.abs(off.time - pausedTime) > .1 || off.video.join() !== on.video.join()) throw Error(`${scene.scene_id} ${sample}: toggle changed time or geometry`)
      await video.screenshot({ path: `${prefix}-off.jpg`, type: 'jpeg', quality: 83 })
      await page.getByRole('button', { name: 'English captions off' }).click()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'showing')
      results.push({ scene: scene.scene_id, sample, time, lesson, on, off })
      console.log(`${scene.scene_id} ${sample}: ${on.cue.length ? 'cue' : 'gap'}`)
    }
  }
  await page.close()
}
await browser.close()
await writeFile(`${out}/raw-audit.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2) + '\n')
console.log(`CAPTURED ${results.length} desktop scene samples`)
