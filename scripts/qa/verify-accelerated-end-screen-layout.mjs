#!/usr/bin/env node
// Rendered regression sweep for the shared Accelerated lesson end screen.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const bindings = require('../../lib/accelerated-contextual-bindings.json')
const endBindings = require('../../lib/accelerated-end-screen-bindings.json')
const base = process.env.ACCELERATED_QA_URL || 'http://localhost:3107/service-prototypes/accelerated-cohort?qa=end-screen-fix'
const out = path.resolve('artifacts/accelerated-end-screen-fix-2026-11-14')
await fs.mkdir(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const [label, width, height] of [['desktop', 1440, 900], ['mid', 768, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Learning plan' }).click()
    await page.locator('button[aria-label^="L01:"]').waitFor({ state: 'attached' })
    console.log(`Reviewing ${label} (${width}x${height})`)
    for (const item of endBindings.lessons) {
      const id = item.lessonId
      await page.locator(`button[aria-label^="${id}:"]`).evaluate((el) => el.click())
      const stage = page.locator(`section[aria-label="${id} guided video"] video`).locator('..')
      const video = stage.locator('video')
      const duration = bindings.lessons[id]?.duration_seconds ?? item.finalCaptionEnd.split(':').map(Number).reduce((sum, part) => sum * 60 + part, 0)
      await video.evaluate((el, seconds) => {
        Object.defineProperty(el, 'duration', { configurable: true, value: seconds })
        el.dispatchEvent(new Event('ended'))
      }, duration)
      const end = stage.locator(`[aria-label="${id} video finished"]`)
      await end.waitFor({ state: 'visible' })
      await stage.evaluate((el) => el.scrollIntoView({ block: 'end' }))
      await page.waitForTimeout(300)
      const geometry = await stage.evaluate((el) => {
        const overlay = el.querySelector('[role="status"]')
        const r = el.getBoundingClientRect()
        const o = overlay.getBoundingClientRect()
        const style = getComputedStyle(overlay)
        const bottomHit = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), Math.min(innerHeight - 1, r.bottom - 5))
        return { stage: [r.width, r.height], stagePosition: [r.top, r.bottom], overlay: [o.width, o.height], offsets: [o.left - r.left, o.top - r.top, r.right - o.right, r.bottom - o.bottom], background: style.backgroundImage, pointerEvents: style.pointerEvents, bottomHit: bottomHit?.tagName, controls: el.querySelector('video').controls, overflow: el.scrollWidth > el.clientWidth || overlay.scrollHeight > overlay.clientHeight }
      })
      assert(geometry.offsets.every((value) => Math.abs(value) <= 1), `${label} ${id}: overlay does not cover stage: ${JSON.stringify(geometry.offsets)}`)
      assert(!geometry.background.includes('rgba('), `${label} ${id}: translucent overlay`)
      assert.equal(geometry.pointerEvents, 'none', `${label} ${id}: native controls blocked`)
      assert.equal(geometry.bottomHit, 'VIDEO', `${label} ${id}: lower player control layer inaccessible: ${JSON.stringify(geometry)}`)
      assert.equal(geometry.controls, true, `${label} ${id}: native controls missing`)
      assert.equal(geometry.overflow, false, `${label} ${id}: end screen overflows`)
      assert.equal(await video.locator('track[kind="captions"]').count(), 1, `${label} ${id}: caption track missing`)
      assert.equal(await page.getByRole('button', { name: /^English captions (on|off)$/ }).count(), 1, `${label} ${id}: caption control missing`)
      assert.equal(await page.locator(`section[aria-label="${id} guided video"] details`).count(), 1, `${label} ${id}: transcript missing`)
      if (id === 'L13') {
        await stage.scrollIntoViewIfNeeded()
        await stage.screenshot({ path: path.join(out, `l13-after-${label}.png`) })
        if (label === 'desktop') {
          const before = await page.addStyleTag({ content: '[class*="lessonEndScreen"]{inset:0 0 25%!important;background:linear-gradient(110deg,rgba(13,38,46,.98),rgba(22,51,58,.95))!important;pointer-events:auto!important}' })
          await stage.screenshot({ path: path.join(out, 'l13-before-desktop.png') })
          await before.evaluate((el) => el.remove())
        }
        const nextAction = end.getByRole('button', { name: /^Continue to L14:/ })
        assert.equal(await nextAction.evaluate((el) => getComputedStyle(el).pointerEvents), 'auto', `${label}: next lesson action blocked`)
        await nextAction.click()
        assert.equal(await page.locator('button[aria-label^="L14:"]').getAttribute('aria-current'), 'true', `${label}: next lesson action failed`)
      }
      results.push({ viewport: label, lesson: id, ...geometry })
    }
    await page.close()
  }
  await fs.writeFile(path.join(out, 'layout-sweep.json'), JSON.stringify({ url: base, checks: results }, null, 2) + '\n')
  console.log(`PASS: ${results.length} ended lesson states at desktop, mid, and mobile widths`)
} finally {
  await browser.close()
}
