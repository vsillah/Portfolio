#!/usr/bin/env node
// Record the ordinary Learning Plan route at the exact committed Signals v9 head.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const commit = process.argv[2]
assert.match(commit ?? '', /^[0-9a-f]{40}$/)
const route = `http://localhost:3108/accelerated/learningplan?rev=${commit}`
const bindings = JSON.parse(await fs.readFile('lib/accelerated-signals-v9-bindings.json', 'utf8')).lessons
const out = path.resolve('artifacts/accelerated-signals-v9-learner-2026-11-15/exact-head')
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const [aspect, viewport] of [['desktop', { width: 1280, height: 720 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, recordVideo: { dir: out, size: viewport } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    for (const id of ['L01', 'L02', 'L05']) {
      await page.locator(`button[aria-label^="${id}:"]`).evaluate(el => el.click())
      const section = page.locator(`section[aria-label="${id} guided video"]`)
      const video = section.locator('video')
      await video.waitFor()
      assert.equal(await video.locator('source').getAttribute('src'), bindings[id].variants[aspect === 'mobile' ? 'portrait' : 'desktop'].path)
      await page.waitForFunction(id => document.querySelector(`section[aria-label="${id} guided video"] video`)?.readyState >= 1, id)
      const scroll = async () => {
        await section.evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'instant' }))
        await page.waitForTimeout(250)
      }
      await scroll()
      await page.screenshot({ path: path.join(out, `${aspect}-${id.toLowerCase()}-poster.png`) })
      await page.waitForTimeout(500)
      await video.evaluate(async el => { el.muted = true; await el.play() })
      await page.waitForFunction(id => document.querySelector(`section[aria-label="${id} guided video"] video`)?.currentTime > .2, id)
      await page.waitForTimeout(500)
      await video.evaluate(el => el.pause())
      assert(await video.evaluate(el => el.paused))
      await page.screenshot({ path: path.join(out, `${aspect}-${id.toLowerCase()}-paused.png`) })
      await page.waitForTimeout(400)
      for (const [index, window] of bindings[id].focus_windows.entries()) {
        await video.evaluate((el, t) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('seek timeout')), 15000)
          el.addEventListener('seeked', () => { clearTimeout(timer); resolve() }, { once: true })
          el.currentTime = t
        }), window.start_seconds + 1)
        await page.waitForTimeout(350)
        await scroll()
        if (aspect === 'mobile') {
          await page.waitForFunction(id => document.querySelector(`section[aria-label="${id} guided video"] [aria-label="${id} caption"]`), id)
          assert.equal(await section.locator('[data-signals-focus]').getAttribute('data-signals-focus'), 'true')
        }
        await page.screenshot({ path: path.join(out, `${aspect}-${id.toLowerCase()}-focus-${index}-caption-on.png`) })
        await page.waitForTimeout(700)
        await page.getByRole('button', { name: 'English captions on' }).click()
        assert.equal(await section.locator(`[aria-label="${id} caption"]`).count(), 0)
        await page.screenshot({ path: path.join(out, `${aspect}-${id.toLowerCase()}-focus-${index}-caption-off.png`) })
        await page.waitForTimeout(500)
        await page.getByRole('button', { name: 'English captions off' }).click()
      }
      const duration = await video.evaluate(el => el.duration)
      await video.evaluate(async (el, t) => {
        el.currentTime = t
        await el.play()
      }, duration - .15)
      await section.getByRole('status', { name: `${id} video finished` }).waitFor({ timeout: 15000 })
      await scroll()
      await page.screenshot({ path: path.join(out, `${aspect}-${id.toLowerCase()}-end.png`) })
      await page.waitForTimeout(700)
      await video.evaluate(async el => { el.currentTime = 0; await el.play() })
      await page.waitForFunction(id => document.querySelector(`section[aria-label="${id} guided video"] video`)?.currentTime > .2, id)
      assert.equal(await section.getByRole('status', { name: `${id} video finished` }).count(), 0)
      await page.screenshot({ path: path.join(out, `${aspect}-${id.toLowerCase()}-replay.png`) })
      await page.waitForTimeout(500)
      await video.evaluate(el => el.pause())
      results.push({ aspect, lesson: id, source: bindings[id].variants[aspect === 'mobile' ? 'portrait' : 'desktop'].path, poster: true, playback: true, pause: true, focus_windows: bindings[id].focus_windows.length, caption_on_off: true, end_screen: true, replay: true })
    }
    assert.deepEqual(errors, [])
    const raw = await page.video().path()
    await context.close()
    await fs.rename(raw, path.join(out, `${aspect}-route-${commit.slice(0, 10)}.webm`))
  }
} finally { await browser.close() }
await fs.writeFile(path.join(out, 'route-observations.json'), JSON.stringify({ schema: 'accelerated_signals_v9_exact_head_route_v1', commit, route, results }, null, 2) + '\n')
console.log(`PASS: ${results.length} lesson/viewport walkthroughs on ${route}`)
