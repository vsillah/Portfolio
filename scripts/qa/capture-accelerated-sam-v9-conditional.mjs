import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const out = path.resolve('artifacts/accelerated-sam-contextual-review-2026-11-14')
const browser = await chromium.launch({ headless: true })
const results = []

try {
  for (const [aspect, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width, height } } })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:3109/artifacts/accelerated-sam-contextual-review-2026-11-14/review-player-v9-conditional.html?aspect=${aspect}`)
    await page.waitForFunction(() => window.reviewPlayer?.video.readyState >= 2 && document.querySelector('track').readyState === 2)
    await page.evaluate(() => { window.reviewPlayer.video.muted = true; window.reviewPlayer.setCaptions(false) })
    const marker = await page.evaluate(() => { const m = document.createElement('div'); m.id = 'qa-marker'; m.style.cssText = 'position:fixed;inset:0;background:#ff00ff;z-index:999999'; document.body.append(m); return performance.now() })
    await page.waitForTimeout(600)
    const start = await page.evaluate(async () => { document.getElementById('qa-marker').remove(); const v = window.reviewPlayer.video; const wall = performance.now(); await v.play(); return { wall, media: v.currentTime } })
    await page.waitForFunction(() => window.reviewPlayer.video.currentTime >= 4)
    await page.locator('#caption-toggle').click()
    const on = await page.evaluate(() => ({ wall: performance.now(), media: window.reviewPlayer.video.currentTime }))
    await page.waitForFunction(() => window.reviewPlayer.video.currentTime >= 30)
    await page.locator('#caption-toggle').click()
    const off = await page.evaluate(() => ({ wall: performance.now(), media: window.reviewPlayer.video.currentTime }))
    await page.waitForFunction(() => window.reviewPlayer.video.ended, null, { timeout: 10000 })
    const end = await page.evaluate(() => ({ wall: performance.now(), media: window.reviewPlayer.video.currentTime }))
    await page.waitForTimeout(500)
    const raw = await page.video().path()
    await context.close()
    const named = path.join(out, `accelerated-sam-signals-${aspect}-player-capture-v9-conditional.webm`)
    await fs.copyFile(raw, named)
    results.push({ aspect, raw: path.relative(process.cwd(), named), markerWall: marker, start, captionsOn: on, captionsOff: off, end })
    console.log(JSON.stringify(results.at(-1)))
  }
  await fs.writeFile(path.join(out, 'player-capture-events-v9-conditional.json'), JSON.stringify(results, null, 2) + '\n')
} finally { await browser.close() }
