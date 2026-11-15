#!/usr/bin/env node
// Read-only learner player audit: poster, pause, natural ending, and replay.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const sourceMap = JSON.parse(await fs.readFile('docs/qa/accelerated-video-posters/source-map.json', 'utf8'))
const expected = new Map(sourceMap.posters.map(item => [item.lesson, item]))
const browser = await chromium.launch({ headless: true })
const output = []
for (const [aspect, width, height] of [['desktop', 1280, 720], ['portrait', 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  for (let n = 1; n <= 16; n++) {
    const id = `L${String(n).padStart(2, '0')}`
    const result = { id, aspect, viewport: [width, height], checks: {}, failures: [] }
    const page = await context.newPage()
    try {
      await page.goto('http://localhost:3108/accelerated/learningplan', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(650)
      await page.locator(`button[aria-label^="${id}:"]`).evaluate(el => el.click())
      const stage = page.locator(`section[aria-label="${id} guided video"] [class*="videoStage"]`)
      const video = page.locator(`section[aria-label="${id} guided video"] video`)
      await video.waitFor({ timeout: 12000 })
      const item = expected.get(id)
      const poster = aspect === 'portrait' && item.portraitOutput ? '/' + item.portraitOutput.path.replace(/^public\//, '') : item.lessonBinding
      const initial = await video.evaluate(el => ({ poster: el.getAttribute('poster'), paused: el.paused, ended: el.ended, time: el.currentTime }))
      result.checks.resting_poster = initial.poster === poster && initial.paused && !initial.ended && initial.time < .1 && await stage.getAttribute('data-ended') === 'false'
      if (!result.checks.resting_poster) result.failures.push(`resting poster/state: ${JSON.stringify(initial)} expected ${poster}`)
      await page.waitForFunction(selector => document.querySelector(selector)?.readyState >= 1, `section[aria-label="${id} guided video"] video`, { timeout: 20000 })
      await video.evaluate(async el => { el.muted = true; await el.play() })
      await page.waitForFunction(selector => document.querySelector(selector)?.currentTime > .3, `section[aria-label="${id} guided video"] video`, { timeout: 15000 })
      await video.evaluate(el => el.pause())
      await page.waitForTimeout(450)
      const paused = await video.evaluate(el => ({ paused: el.paused, ended: el.ended, time: el.currentTime, className: el.className, opacity: getComputedStyle(el).opacity, display: getComputedStyle(el).display }))
      result.checks.paused_frame = paused.paused && !paused.ended && paused.time > .3 && paused.className.includes('videoReveal') && paused.opacity === '1' && paused.display !== 'none' && await stage.getAttribute('data-ended') === 'false'
      if (!result.checks.paused_frame) result.failures.push(`paused frame: ${JSON.stringify(paused)}`)
      const duration = await video.evaluate(el => el.duration)
      if (!Number.isFinite(duration) || duration <= 1) throw Error(`bad duration ${duration}`)
      await video.evaluate((el, time) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('seek timeout')), 15000); el.addEventListener('seeked', () => { clearTimeout(timer); resolve() }, { once: true }); el.currentTime = time }), duration - .35)
      await video.evaluate(async el => { await el.play() })
      await page.waitForFunction(selector => document.querySelector(selector)?.ended === true, `section[aria-label="${id} guided video"] video`, { timeout: 15000 })
      const end = page.getByRole('status', { name: `${id} video finished` })
      await end.waitFor({ timeout: 5000 })
      const coverage = await page.evaluate(selector => { const s = document.querySelector(selector), e = s?.querySelector('[role="status"]'); if (!s || !e) return null; const a = s.getBoundingClientRect(), b = e.getBoundingClientRect(), style = getComputedStyle(e); return { dx: Math.abs(a.left - b.left), dy: Math.abs(a.top - b.top), dw: Math.abs(a.width - b.width), dh: Math.abs(a.height - b.height), background: style.backgroundImage, color: style.backgroundColor, zIndex: style.zIndex } }, `section[aria-label="${id} guided video"] [class*="videoStage"]`)
      result.checks.ending_coverage = !!coverage && coverage.dx <= 1 && coverage.dy <= 1 && coverage.dw <= 1 && coverage.dh <= 1 && coverage.zIndex === '1' && coverage.background !== 'none' && await stage.getAttribute('data-ended') === 'true'
      if (!result.checks.ending_coverage) result.failures.push(`ending coverage: ${JSON.stringify(coverage)}`)
      await video.evaluate(async el => { await el.play() })
      await page.waitForFunction(selector => { const el = document.querySelector(selector); return el && el.currentTime > .1 && el.currentTime < 3 && !el.ended }, `section[aria-label="${id} guided video"] video`, { timeout: 15000 })
      result.checks.replay = await stage.getAttribute('data-ended') === 'false' && await end.count() === 0
      if (!result.checks.replay) result.failures.push('replay did not return to lesson video')
    } catch (error) { result.failures.push(String(error.message || error)) }
    output.push(result)
    console.log(`${result.failures.length ? 'FAIL' : 'PASS'} ${aspect} ${id}: ${result.failures.join('; ')}`)
    await page.close()
  }
  await context.close()
}
await browser.close()
const receipt = { schema: 'accelerated_player_state_audit_v1', route: 'http://localhost:3108/accelerated/learningplan', scope: 'read-only L01-L16 desktop and 390x844', results: output }
const dest = path.resolve('artifacts/accelerated-l12-poster-qa/momentum-opening-candidate-2026-11-15/player-state-audit-2026-11-15.json')
await fs.writeFile(dest, JSON.stringify(receipt, null, 2) + '\n')
console.log(dest)
if (output.some(item => item.failures.length)) process.exitCode = 1
