import { chromium } from 'playwright'
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { waitForCueFrame } from './caption-size-state.mjs'

const base = 'http://127.0.0.1:3121'
const out = 'agentified/workshop/l09-l16-caption-audit'
const rows = JSON.parse(await readFile('agentified/workshop/presentation-illustration-audit/audit-boundaries.json', 'utf8')).rows.filter((row) => /^L(09|10|11|12|13|14|15|16)-/.test(row.scene_id))
const browser = await chromium.launch({ headless: true })
const results = []
for (const width of [1280, 390]) {
  for (const lesson of ['L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16']) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
    await page.goto(`${base}/agentified/learningplan?lesson=${lesson}`, { waitUntil: 'networkidle' })
    const video = page.locator('video')
    await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
    await page.getByRole('button', { name: 'Medium captions' }).click()
    const baselineScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    for (const scene of rows.filter((row) => row.scene_id.startsWith(`${lesson}-`) && (!process.env.CAPTION_AUDIT_ONLY || row.scene_id === process.env.CAPTION_AUDIT_ONLY))) {
      for (const [sample, time] of [['boundary', scene.boundary_sample_seconds], ['midpoint', scene.midpoint_sample_seconds]]) {
        await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
        await waitForCueFrame(page, time)
        const pausedTime = await video.evaluate((element) => { element.pause(); return element.currentTime })
        const on = await page.evaluate(() => {
          const video = document.querySelector('video')
          const band = document.querySelector('[aria-label$=" caption"]')
          const v = video.getBoundingClientRect()
          const b = band?.getBoundingClientRect()
          return { mode: video.textTracks[0].mode, cue: [...video.textTracks[0].cues].filter((item) => item.startTime <= video.currentTime && video.currentTime < item.endTime).map((item) => ({ start: item.startTime, end: item.endTime, text: item.text })), band: band?.textContent ?? null, bandCount: document.querySelectorAll('[aria-label$=" caption"]').length, video: [Math.round(v.width), Math.round(v.height)], videoBottom: v.bottom, bandTop: b?.top ?? null, scrollWidth: document.documentElement.scrollWidth }
        })
        if (on.mode !== 'hidden' || on.cue.length > 1 || on.bandCount !== on.cue.length || on.cue[0] && on.band !== on.cue[0].text || on.bandTop !== null && on.bandTop < on.videoBottom - 1 || on.scrollWidth > baselineScrollWidth + 1) throw Error(`${scene.scene_id} ${sample} ${width}: invalid on state ${JSON.stringify({ baselineScrollWidth, ...on })}`)
        const prefix = `${out}/${scene.scene_id}-${sample}-${width}`
        const videoBox = await video.boundingBox()
        const bandBox = await page.locator(`[aria-label="${lesson} caption"]`).boundingBox().catch(() => null)
        const bottom = bandBox ? bandBox.y + bandBox.height : videoBox.y + videoBox.height
        let cached = false
        if (process.env.CAPTION_AUDIT_REUSE_IMAGES === '1') {
          try { await access(`${prefix}-on.jpg`); cached = true } catch { /* Capture a missing frame. */ }
        }
        if (!cached) await page.screenshot({ path: `${prefix}-on.jpg`, type: 'jpeg', quality: 83, clip: { x: videoBox.x, y: videoBox.y, width: videoBox.width, height: bottom - videoBox.y } })
        let off = null
        if (scene.scene_id.endsWith('-01') && sample === 'boundary') {
          await page.getByRole('button', { name: 'English captions on' }).click()
          await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]') && !document.querySelector('[role="group"][aria-label="Caption size"]'))
          off = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return { time: element.currentTime, video: [Math.round(box.width), Math.round(box.height)] } })
          if (Math.abs(off.time - pausedTime) > .1 || off.video.join() !== on.video.join()) throw Error(`${scene.scene_id} ${sample} ${width}: off changed time or geometry ${JSON.stringify({ pausedTime, off, onVideo: on.video })}`)
          await page.getByRole('button', { name: 'English captions off' }).click()
          await page.waitForFunction((cueText) => document.querySelector('video')?.textTracks[0]?.mode === 'hidden' && document.querySelector('[aria-label$=" caption"]')?.textContent === cueText, on.cue[0].text)
        }
        results.push({ scene: scene.scene_id, sample, width, time, baselineScrollWidth, on, off })
        await writeFile(`${out}/clearance-progress.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2) + '\n')
        console.log(`${scene.scene_id} ${sample} ${width}: ${on.cue.length ? 'cue' : 'gap'}`)
      }
    }
    await page.close()
  }
}
await browser.close()
await mkdir(out, { recursive: true })
await writeFile(`${out}/clearance-receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2) + '\n')
await unlink(`${out}/clearance-progress.json`)
console.log(`PASS ${results.length} desktop/mobile scene samples`)
