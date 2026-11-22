#!/usr/bin/env node
// Exact synthetic learner-route review in the disposable player checkout only.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { chromium } = require('playwright')

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1024) throw new Error('Pass local review port')
const here = __dirname
const candidate = path.join(here, 'L07-01-source-brief-candidate.mp4')
const hash = createHash('sha256').update(fs.readFileSync(candidate)).digest('hex')
const route = `http://127.0.0.1:${port}/agentified/learningplan?lesson=L07&rev=${hash.slice(0, 8)}`
const evidence = path.join(here, 'route-evidence')
fs.mkdirSync(evidence, { recursive: true })

async function seek(page, seconds) {
  await page.locator('video').evaluate((video, value) => { video.pause(); video.currentTime = value }, seconds)
  await page.waitForFunction(value => {
    const video = document.querySelector('video')
    return video && !video.seeking && video.readyState >= 3 && Math.abs(video.currentTime - value) < 0.08
  }, seconds, { timeout: 15000 })
  await page.waitForTimeout(400)
  return page.locator('video').evaluate(video => ({ time: video.currentTime, paused: video.paused, readyState: video.readyState, trackMode: video.textTracks[0]?.mode, captionSize: video.dataset.captionSize }))
}

async function capture(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: evidence, size: { width, height } } })
  const page = await context.newPage()
  const checks = []
  let videoPath
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    // The query selects L07 directly. Mobile navigation may remain collapsed.
    await page.getByRole('heading', { name: 'Specify the work and the team' }).waitFor()
    await page.locator('video').waitFor()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 3)
    const source = await page.locator('video').evaluate(video => video.currentSrc)
    assert(source.includes(`/review-${hash.slice(0, 8)}/`), `unexpected media ${source}`)
    await page.locator('video').scrollIntoViewIfNeeded()
    const box = await page.locator('video').boundingBox()
    assert(box && box.width > 280 && box.height > 150)
    if (name === 'mobile') assert(Math.abs(box.width - 292) < 2 && Math.abs(box.height - 164.25) < 2, JSON.stringify(box))
    checks.push({ action: 'load', source, videoBox: box, route: page.url() })

    for (const [label, seconds] of [['opening', 2.55], ['notes', 3.2], ['false-claim', 5.1], ['wrong-claim', 6.4], ['source-wording', 8.2], ['post-presenter', 10.4], ['source-question', 26], ['next-scene', 28.5]]) {
      const state = await seek(page, seconds)
      if (['notes', 'source-wording', 'post-presenter', 'source-question', 'next-scene'].includes(label)) {
        await page.screenshot({ path: path.join(evidence, `${name}-${label}.png`) })
      }
      checks.push({ action: `seek-${label}`, ...state })
    }

    const captionOff = page.getByRole('button', { name: 'English captions on' })
    const captionOn = page.getByRole('button', { name: 'English captions off' })
    assert(await captionOff.count(), 'caption toggle absent')
    await captionOff.click()
    checks.push({ action: 'captions-off', ...(await seek(page, 8.2)) })
    await page.screenshot({ path: path.join(evidence, `${name}-captions-off.png`) })
    await captionOn.click()
    checks.push({ action: 'captions-on', ...(await seek(page, 8.2)) })
    await page.screenshot({ path: path.join(evidence, `${name}-captions-on.png`) })
    for (const [size, button] of [['S', 'Small captions'], ['M', 'Medium captions'], ['L', 'Large captions']]) {
      await page.getByRole('button', { name: button }).click()
      const state = await seek(page, 8.2)
      assert.equal(state.captionSize, size)
      await page.screenshot({ path: path.join(evidence, `${name}-captions-${size}.png`) })
      checks.push({ action: `Aa-${size}`, ...state })
    }
    await page.getByRole('button', { name: 'Medium captions' }).click()

    if (name === 'mobile') {
      await seek(page, 3.2)
      await page.getByRole('button', { name: 'Play video' }).click()
      await page.getByRole('button', { name: 'Pause video' }).waitFor()
      await page.getByRole('button', { name: 'Pause video' }).click()
      await page.getByRole('button', { name: 'Play video' }).waitFor()
      checks.push({ action: 'mobile-play-pause', ...(await page.locator('video').evaluate(video => ({ paused: video.paused, time: video.currentTime }))) })
      await page.getByRole('slider', { name: 'Seek video' }).fill('8.2')
      checks.push({ action: 'mobile-seek-control', ...(await seek(page, 8.2)) })
      await page.getByRole('button', { name: 'Mute video' }).click()
      assert(await page.getByRole('button', { name: 'Unmute video' }).count())
      await page.getByRole('button', { name: 'Unmute video' }).click()
      await page.getByRole('slider', { name: 'Video volume level' }).press('Home')
      await page.getByRole('slider', { name: 'Video volume level' }).press('End')
      await page.getByRole('button', { name: 'Enter fullscreen' }).click()
      await page.getByRole('button', { name: 'Exit fullscreen' }).waitFor()
      await page.getByRole('button', { name: 'Exit fullscreen' }).click()
      checks.push({ action: 'mobile-sound-fullscreen', passed: true })
    } else {
      await page.locator('video').evaluate(async video => { await video.play(); video.pause() })
      checks.push({ action: 'desktop-native-play-pause', passed: await page.locator('video').evaluate(video => video.paused) })
    }
    for (const seconds of [188.8, 201, 232.9, 234, 243, 246.3]) checks.push({ action: `adjacent-${seconds}`, ...(await seek(page, seconds)) })
    await page.screenshot({ path: path.join(evidence, `${name}-L07-07-08.png`) })
    await seek(page, 251.1)
    await page.locator('video').evaluate(video => video.play())
    await page.waitForFunction(() => document.querySelector('video')?.ended, null, { timeout: 10000 })
    assert(await page.getByRole('status', { name: /L07 complete/ }).count())
    checks.push({ action: 'completion', passed: true })
    await page.locator('video').evaluate(video => video.play())
    await page.waitForTimeout(500)
    await page.locator('video').evaluate(video => video.pause())
    checks.push({ action: 'replay', passed: await page.locator('video').evaluate(video => video.currentTime < 1 && video.paused) })
    return { name, width, height, route: page.url(), source, hash, checks }
  } finally {
    const recording = page.video()
    await context.close()
    videoPath = await recording.path()
    const mp4 = path.join(evidence, `L07-01-${name}-learner-route.mp4`)
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', videoPath, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
    fs.unlinkSync(videoPath)
    execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const results = [await capture(browser, 'desktop', 1280, 844), await capture(browser, 'mobile', 390, 844)]
    fs.writeFileSync(path.join(evidence, 'route-capture.json'), JSON.stringify({ candidateSha256: hash, results }, null, 2) + '\n')
    console.log(JSON.stringify(results.map(result => ({ name: result.name, route: result.route, checks: result.checks.length })), null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
