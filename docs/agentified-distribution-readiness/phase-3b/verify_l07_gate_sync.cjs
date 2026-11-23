const { chromium } = require('playwright')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const output = path.join(root, 'agentified/workshop/l07-gate-sync-review')
const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision || '')) throw new Error('Pass the code commit SHA')
const url = `http://127.0.0.1:3121/agentified/learningplan?lesson=L07&rev=${revision}`
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

async function run() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const observations = []
  try {
    for (const [viewport, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height } })
      await context.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      const video = page.locator('video')
      await video.waitFor()
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1)
      await page.waitForTimeout(500)
      const sample = async (label, seconds, expected) => {
        await video.evaluate((element, time) => {
          element.pause()
          element.currentTime = time
        }, seconds)
        try {
          await page.waitForFunction((time) => Math.abs(document.querySelector('video').currentTime - time) < 0.0005 && !document.querySelector('video').seeking, seconds, { timeout: 3000 })
        } catch (error) {
          const actual = await video.evaluate((element) => ({ time: element.currentTime, seeking: element.seeking, readyState: element.readyState, duration: element.duration, error: element.error?.message }))
          throw new Error(`${viewport} ${label} seek timeout: ${JSON.stringify(actual)}`, { cause: error })
        }
        try {
          await page.waitForFunction((visible) => Boolean(document.querySelector('aside[aria-label^="L07-07 "]')) === visible, expected, { timeout: 3000 })
        } catch (error) {
          const actual = await video.evaluate((element) => ({ time: element.currentTime, paused: element.paused, readyState: element.readyState, seeking: element.seeking, error: element.error?.message }))
          throw new Error(`${viewport} ${label} visibility timeout: ${JSON.stringify(actual)}`, { cause: error })
        }
        const state = await page.evaluate(() => {
          const video = document.querySelector('video')
          const detail = document.querySelector('aside[aria-label^="L07-07 "]')
          return { time: video.currentTime, paused: video.paused, detail: detail?.textContent ?? null, display: detail ? getComputedStyle(detail).display : null, controls: video.controls, captions: video.querySelector('track')?.getAttribute('src'), images: detail?.querySelectorAll('img').length ?? 0, links: detail?.querySelectorAll('a').length ?? 0 }
        })
        if (Boolean(state.detail) !== expected || (expected && (state.detail !== 'Human review remains the gate.' || state.display !== (viewport === 'mobile' ? 'block' : 'none'))) || !state.controls || state.images || state.links) throw new Error(`${viewport} ${label}: ${JSON.stringify(state)}`)
        observations.push({ viewport, label, ...state })
        if (expected) {
          await (viewport === 'mobile' ? page.locator('aside[aria-label^="L07-07 "]') : video).scrollIntoViewIfNeeded()
          await page.screenshot({ path: path.join(output, `${viewport}-${label}.png`) })
        }
      }
      await sample('before', 188.514, false)
      await sample('at-start', 188.515, true)
      await sample('inside', 210, true)
      await sample('at-end', 233.515, false)
      await sample('other-l07-scene', 140, false)
      const otherScene = await page.locator('aside[aria-label^="L07-05 "]').count()
      if (otherScene !== 1) throw new Error(`${viewport} L07-05 was displaced`)
      observations.push({ viewport, label: 'other-l07-scene-preserved', visible: true })
      await sample('natural-entry-base', 188.1, false)
      await video.evaluate((element) => element.play())
      await page.waitForFunction(() => document.querySelector('video').currentTime >= 188.515 && Boolean(document.querySelector('aside[aria-label^="L07-07 "]')), { timeout: 10000 })
      observations.push({ viewport, label: 'natural-entry', time: await video.evaluate((element) => element.currentTime), visible: true })
      await sample('natural-exit-base', 233.1, true)
      await video.evaluate((element) => element.play())
      await page.waitForFunction(() => document.querySelector('video').currentTime >= 233.515 && !document.querySelector('aside[aria-label^="L07-07 "]'), { timeout: 10000 })
      observations.push({ viewport, label: 'natural-exit', time: await video.evaluate((element) => element.currentTime), visible: false })
      await sample('paused-seek-back', 210, true)
      await sample('paused-seek-out', 233.515, false)
      await page.evaluate(() => {
        const key = 'amadutown:agentified:guest-progress:v1'
        const state = JSON.parse(localStorage.getItem(key))
        state.videoSeconds.L07 = 210
        localStorage.setItem(key, JSON.stringify(state))
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1 && Math.abs(document.querySelector('video').currentTime - 210) < 0.001 && Boolean(document.querySelector('aside[aria-label^="L07-07 "]')))
      observations.push({ viewport, label: 'restored-progress', time: await page.locator('video').evaluate((element) => element.currentTime), visible: true })
      await page.close()
      await context.close()
    }
  } finally {
    await browser.close()
  }
  const files = fs.readdirSync(output).filter((file) => file.endsWith('.png')).sort()
  const receipt = { codeCommit: revision, route: url, viewports: ['1280x800', '390x844'], checks: observations, artifacts: Object.fromEntries(files.map((file) => [file, sha(path.join(output, file))])), source: { component: sha(path.join(root, 'app/agentified/AgentifiedLessonHero.tsx')), cueMap: sha(path.join(root, 'app/agentified/mobile-teaching-details.json')) } }
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(`${observations.length} browser observations; receipt ${path.join(output, 'receipt.json')}`)
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
