#!/usr/bin/env node
// Read-only exact-route caption sweep for L01/L02/L05 mobile v9 learner media.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const binding = JSON.parse(await fs.readFile('lib/accelerated-signals-v9-bindings.json', 'utf8'))
const browser = await chromium.launch({ headless: true })
const out = path.resolve('artifacts/accelerated-signals-v9-learner-2026-11-15')
await fs.mkdir(out, { recursive: true })
const observations = []
try {
  for (const id of ['L01', 'L02', 'L05']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
    await page.goto('http://localhost:3108/accelerated/learningplan?review=signals-v9-mobile-caption', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    await page.locator(`button[aria-label^="${id}:"]`).evaluate(el => el.click())
    const video = page.locator(`section[aria-label="${id} guided video"] video`)
    await video.waitFor({ timeout: 10000 })
    assert.equal(await video.locator('source').getAttribute('src'), binding.lessons[id].variants.portrait.path)
    await page.waitForFunction(id => document.querySelector(`section[aria-label="${id} guided video"] track`)?.readyState === 2, id, { timeout: 15000 })
    await video.evaluate(async el => { el.muted = true; await el.play() })
    await page.waitForFunction(id => document.querySelector(`section[aria-label="${id} guided video"] video`)?.currentTime > .25, id, { timeout: 10000 })
    await video.evaluate(el => el.pause())
    const cues = await video.evaluate(el => Array.from(el.textTracks[0].cues ?? []).map(cue => ({ start: cue.startTime, end: cue.endTime, text: cue.text })))
    assert(cues.length > 10, `${id}: missing caption cues`)
    let maxBandHeight = 0
    for (const [index, cue] of cues.entries()) {
      const time = Math.min(cue.end - .05, cue.start + Math.min(.3, (cue.end - cue.start) / 2))
      await video.evaluate((el, target) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error(`seek ${target} timeout`)), 15000); el.addEventListener('seeked', () => { clearTimeout(timer); resolve() }, { once: true }); el.currentTime = target }), time)
      await page.waitForFunction(({ id, text }) => document.querySelector(`section[aria-label="${id} guided video"] [aria-label="${id} caption"]`)?.textContent === text, { id, text: cue.text }, { timeout: 4000 })
      const on = await page.evaluate(id => { const section = document.querySelector(`section[aria-label="${id} guided video"]`), video = section.querySelector('video'), stage = video.parentElement, band = section.querySelector(`[aria-label="${id} caption"]`), s = stage.getBoundingClientRect(), b = band.getBoundingClientRect(); return { stageHeight: s.height, stageBottom: s.bottom, bandTop: b.top, bandHeight: b.height, bandScrollHeight: band.scrollHeight, bandClientHeight: band.clientHeight, mode: video.textTracks[0].mode, focus: stage.dataset.signalsFocus, width: s.width } }, id)
      assert(on.mode === 'hidden' && on.bandTop >= on.stageBottom + 6 && on.bandScrollHeight <= on.bandClientHeight + 1, `${id} cue ${index}: caption/control or visual overlap ${JSON.stringify(on)}`)
      assert(on.stageHeight > 0 && on.width > 0, `${id} cue ${index}: collapsed presentation`)
      maxBandHeight = Math.max(maxBandHeight, on.bandHeight)
      const toggle = page.getByRole('button', { name: 'English captions on' })
      await toggle.click()
      const off = await page.evaluate(id => { const section = document.querySelector(`section[aria-label="${id} guided video"]`), video = section.querySelector('video'), stage = video.parentElement; return { stageHeight: stage.getBoundingClientRect().height, bandCount: section.querySelectorAll(`[aria-label="${id} caption"]`).length, mode: video.textTracks[0].mode } }, id)
      assert(off.mode === 'disabled' && off.bandCount === 0 && Math.abs(off.stageHeight - on.stageHeight) < 1, `${id} cue ${index}: caption-off reduced surface ${JSON.stringify(off)}`)
      await page.getByRole('button', { name: 'English captions off' }).click()
      if (index === 0 || index === cues.length - 1 || binding.lessons[id].focus_windows.some(window => time >= window.start_seconds && time < window.end_seconds)) {
        await page.locator(`section[aria-label="${id} guided video"]`).screenshot({ path: path.join(out, `${id.toLowerCase()}-caption-${index}-on-mobile.png`) })
      }
    }
    observations.push({ lesson: id, cue_count: cues.length, all_cues_exact: true, all_on_off_states_clear: true, max_band_height: maxBandHeight, focus_windows: binding.lessons[id].focus_windows })
    console.log(`PASS ${id}: ${cues.length} caption-on and off states`)
    await page.close()
  }
} finally { await browser.close() }
await fs.writeFile(path.join(out, 'caption-layout-sweep.json'), JSON.stringify({ schema: 'accelerated_signals_v9_mobile_caption_sweep_v1', viewport: [390, 844], observations }, null, 2) + '\n')
