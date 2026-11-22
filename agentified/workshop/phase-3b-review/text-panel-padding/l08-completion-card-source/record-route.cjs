#!/usr/bin/env node
// Run against the temporary player-head checkout with the L08 candidate binding.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1024) throw new Error('Pass the local review port')
const revision = '7bb6267c9-f709e881-302b83e1'
const route = `http://127.0.0.1:${port}/agentified/learningplan?lesson=L08&rev=${revision}`
const videoPath = `/agentified/lessons/l08/review-f709e881/L08-caption-free-presenter-candidate.mp4`
const vttPath = '/agentified/lessons/l08/continuous-3c5b399f/agentified-l08-continuous-narration-captions.vtt'
const evidence = path.join(__dirname, 'route-evidence')
fs.mkdirSync(evidence, { recursive: true })

async function seek(page, seconds) {
  await page.locator('video').evaluate((video, value) => { video.pause(); video.currentTime = value }, seconds)
  await page.waitForFunction(value => {
    const video = document.querySelector('video')
    return video && !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - value) < 0.08
  }, seconds)
}

async function measure(page) {
  return page.evaluate(() => {
    const find = selector => {
      const element = document.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right, visibility: style.visibility, opacity: Number(style.opacity), objectFit: style.objectFit }
    }
    return {
      stage: find('[aria-label="L08 Make handoffs testable lesson cover"]'),
      video: find('video'),
      screen: find('[aria-label^="L08 complete"]'),
      card: find('[class*="endScreenNext"]'),
      poster: find('[class*="endScreenNext"] img'),
      rail: find('[aria-label="L08 video controls"]'),
      nativeControls: document.querySelector('video')?.controls,
      posterSource: document.querySelector('[class*="endScreenNext"] img')?.getAttribute('src'),
      mediaSource: document.querySelector('video')?.currentSrc,
      captionsSource: document.querySelector('video track')?.src,
    }
  })
}

async function capture(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: evidence, size: { width, height } } })
  const page = await context.newPage()
  const checks = []
  try {
    await page.route('**/*', request => new URL(request.request().url()).hostname === '127.0.0.1' ? request.continue() : request.abort())
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Make handoffs testable' }).waitFor()
    await page.locator('video').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2)
    const initial = await measure(page)
    assert(initial.mediaSource.endsWith(videoPath))
    assert(initial.captionsSource.endsWith(vttPath))
    assert.equal(initial.screen, null)
    checks.push({ check: 'candidate and VTT loaded', mediaSource: initial.mediaSource, captionsSource: initial.captionsSource })

    await seek(page, 253.7)
    const before = await measure(page)
    assert.equal(before.screen, null)
    assert.equal(before.video.visibility, 'visible')
    await page.screenshot({ path: path.join(evidence, `${name}-before-completion.png`) })
    checks.push({ check: 'before completion', seconds: 253.7, stage: before.stage, nativeControls: before.nativeControls })

    await seek(page, 255)
    await page.waitForTimeout(450)
    const resting = await measure(page)
    assert(resting.screen && resting.card && resting.poster && resting.rail)
    assert.equal(resting.video.visibility, 'hidden')
    assert.equal(resting.nativeControls, false)
    assert(Math.abs(resting.stage.x - resting.screen.x) < 0.1)
    assert(Math.abs(resting.stage.y - resting.screen.y) < 0.1)
    assert(Math.abs(resting.stage.width - resting.screen.width) < 0.1)
    assert(Math.abs(resting.stage.height - resting.screen.height) < 0.1)
    assert(Math.abs(resting.poster.width / resting.poster.height - 16 / 9) < 0.03)
    assert(resting.poster.x >= resting.card.x && resting.poster.right <= resting.card.right)
    assert(resting.poster.y >= resting.card.y && resting.poster.bottom <= resting.card.bottom)
    assert(resting.card.bottom <= (name === 'desktop' ? resting.rail.y : resting.screen.bottom) + 0.1)
    assert.equal(resting.poster.objectFit, 'contain')
    await page.screenshot({ path: path.join(evidence, `${name}-resting-light.png`) })
    checks.push({ check: 'paused resting screen owns full viewfinder and full 16:9 poster', resting })

    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: path.join(evidence, `${name}-resting-dark.png`) })
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    checks.push({ check: 'dark theme resting state' })

    await page.getByRole('button', { name: 'English captions on' }).click()
    assert(await page.getByRole('button', { name: 'English captions off' }).isVisible())
    await page.screenshot({ path: path.join(evidence, `${name}-resting-captions-off.png`) })
    await page.getByRole('button', { name: 'English captions off' }).click()
    for (const [label, size] of [['Small', 'S'], ['Large', 'L'], ['Medium', 'M']]) {
      await page.getByRole('button', { name: `${label} captions` }).click()
      assert.equal(await page.locator('video').getAttribute('data-caption-size'), size)
    }
    checks.push({ check: 'captions off/on and Aa S/L/M' })

    await page.getByRole('button', { name: 'Mute video' }).click()
    await page.getByRole('button', { name: 'Unmute video' }).click()
    await page.getByRole('slider', { name: 'Video volume level' }).press('Home')
    await page.getByRole('slider', { name: 'Video volume level' }).press('End')
    await page.getByRole('slider', { name: 'Seek video' }).fill('250')
    await page.waitForFunction(() => !document.querySelector('[aria-label^="L08 complete"]'))
    assert.equal((await measure(page)).video.visibility, 'visible')
    await page.screenshot({ path: path.join(evidence, `${name}-seek-back.png`) })
    checks.push({ check: 'sound, volume, seek back and video restoration' })

    await seek(page, 254.5)
    await page.locator('video').evaluate(video => video.pause())
    assert((await measure(page)).screen)
    checks.push({ check: 'pause near endpoint restores resting screen' })
    await seek(page, 253.7)
    await page.locator('video').evaluate(video => video.play())
    await page.waitForFunction(() => document.querySelector('video')?.ended)
    assert((await measure(page)).screen)
    await page.screenshot({ path: path.join(evidence, `${name}-ended.png`) })
    checks.push({ check: 'natural end of playback' })

    await page.getByRole('button', { name: 'Play video' }).click()
    await page.waitForFunction(() => { const video = document.querySelector('video'); return video && video.currentTime < 2 && !document.querySelector('[aria-label^="L08 complete"]') })
    await page.locator('video').evaluate(video => video.pause())
    await page.screenshot({ path: path.join(evidence, `${name}-replay.png`) })
    checks.push({ check: 'replay restores video' })

    await seek(page, 255)
    await page.getByRole('button', { name: 'Next lesson · L09' }).click()
    await page.getByRole('heading', { name: 'Measure trust and choose review posture' }).waitFor()
    await page.getByRole('heading', { name: 'Measure trust and choose review posture' }).scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -90))
    await page.screenshot({ path: path.join(evidence, `${name}-l09-destination.png`) })
    checks.push({ check: 'footer next control reaches L09', title: 'Measure trust and choose review posture' })
    return { viewport: `${width}x${height}`, route, checks }
  } finally {
    await context.close()
    const webm = await page.video().path()
    const mp4 = path.join(evidence, `L08-completion-card-${name}-learner-route.mp4`)
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
    fs.unlinkSync(webm)
    execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const results = [await capture(browser, 'desktop', 1280, 844), await capture(browser, 'mobile', 390, 844)]
    fs.writeFileSync(path.join(evidence, 'route-capture.json'), JSON.stringify({ results }, null, 2) + '\n')
    console.log(JSON.stringify(results.map(({ viewport, checks }) => ({ viewport, checks: checks.map(item => item.check) })), null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
