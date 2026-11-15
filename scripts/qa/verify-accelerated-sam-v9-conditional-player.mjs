import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const out = path.resolve('artifacts/accelerated-sam-contextual-review-2026-11-14')
const browser = await chromium.launch({ headless: true })
const checks = []

try {
  for (const [aspect, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await page.goto(`http://127.0.0.1:3109/artifacts/accelerated-sam-contextual-review-2026-11-14/review-player-v9-conditional.html?aspect=${aspect}`)
    await page.waitForFunction(() => window.reviewPlayer?.video.readyState >= 2 && document.querySelector('track').readyState === 2)
    for (const [label, second] of [['opening', 1], ['second', 9], ['third-copy', 17], ['third-plate', 18], ['last-copy', 25], ['last-plate', 26]]) {
      await page.evaluate(async second => { const v = window.reviewPlayer.video; await new Promise(resolve => { v.addEventListener('seeked', resolve, { once: true }); v.currentTime = second }) }, second)
      for (const on of [false, true]) {
        if (await page.evaluate(() => window.reviewPlayer.captionsOn) !== on) await page.locator('#caption-toggle').click()
        await page.waitForTimeout(250)
        const state = await page.evaluate(() => {
          const v = window.reviewPlayer.video, band = document.getElementById('caption-band')
          const vb = v.getBoundingClientRect(), cb = band.getBoundingClientRect()
          return { time: v.currentTime, controls: v.controls, trackMode: v.textTracks[0].mode, activeCueCount: v.textTracks[0].activeCues?.length ?? 0, bandText: band.textContent, bandVisible: getComputedStyle(band).display !== 'none', bandScrollHeight: band.scrollHeight, bandClientHeight: band.clientHeight, videoBounds: [vb.x, vb.y, vb.width, vb.height], bandBounds: [cb.x, cb.y, cb.width, cb.height] }
        })
        assert.equal(state.controls, true)
        assert.equal(await page.locator('#caption-toggle').getAttribute('aria-pressed'), String(on))
        assert.equal(state.activeCueCount, on ? 1 : 0)
        if (aspect === 'mobile') {
          assert.equal(state.bandVisible, on)
          assert.equal(state.videoBounds[3], on ? 748 : 844)
          if (on) {
            assert(state.bandText.length > 10)
            assert(state.bandScrollHeight <= state.bandClientHeight, `${label}: caption clipped`)
            assert(state.bandBounds[1] >= state.videoBounds[1] + state.videoBounds[3], `${label}: band overlaps video/controls`)
          }
        }
        const file = `v9-conditional-${aspect}-${label}-${on ? 'on' : 'off'}-chromium.png`
        await page.screenshot({ path: path.join(out, file) })
        checks.push({ aspect, label, captionsOn: on, screenshot: file, ...state })
      }
    }
    await page.evaluate(() => window.reviewPlayer.setCaptions(false))
    await page.evaluate(() => window.reviewPlayer.video.play())
    await page.waitForFunction(() => window.reviewPlayer.video.currentTime > 25.5, null, { timeout: 10000 })
    await page.evaluate(async () => { const v = window.reviewPlayer.video; await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('end timeout')), 8000); v.addEventListener('ended', () => { clearTimeout(timer); resolve() }, { once: true }); v.currentTime = 31.6; v.play() }) })
    await page.evaluate(() => window.reviewPlayer.video.play())
    await page.waitForFunction(() => window.reviewPlayer.video.currentTime > .5 && window.reviewPlayer.video.currentTime < 2, null, { timeout: 10000 })
    checks.push({ aspect, label: 'replay-after-ended', passed: true })
    await page.close()
  }
  await fs.writeFile(path.join(out, 'v9-conditional-player-review.json'), JSON.stringify({ schema: 'accelerated_sam_v9_conditional_player_review', checks }, null, 2) + '\n')
  console.log('PASS: caption-off full frame, caption-on separate mobile band, all four states, controls, and replay')
} finally { await browser.close() }
