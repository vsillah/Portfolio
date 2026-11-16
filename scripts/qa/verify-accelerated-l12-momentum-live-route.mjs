#!/usr/bin/env node
// Browser QA for the natural L12 learner-route media binding.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const root = path.resolve('.')
const out = path.join(root, 'artifacts/accelerated-l12-poster-qa/momentum-opening-candidate-2026-11-15')
const receipt = JSON.parse(await fs.readFile(path.join(root, 'docs/accelerated-course-modules/l09-l16-contextual-binding/l12-momentum-binding-2cd29b4b1aae.json'), 'utf8'))
for (const item of Object.values(receipt.media)) {
  const actual = createHash('sha256').update(await fs.readFile(path.join(root, 'public', item.path))).digest('hex')
  assert.equal(actual, item.sha256, `${item.path}: media hash drifted`)
}
const browser = await chromium.launch({ headless: true })
const results = []
const liveOut = path.join(out, 'bound-route-2026-11-15')
await fs.mkdir(liveOut, { recursive: true })
const route = 'http://localhost:3108/accelerated/learningplan'
const checkedSeekTimes = [1, 24.48, 24.52, 86, 86.04, 100, 459]

async function seek(video, seconds) {
  await video.evaluate((element, target) => new Promise((resolve, reject) => {
    element.pause()
    const timer = setTimeout(() => reject(new Error(`seek timeout at ${target}`)), 12000)
    element.addEventListener('seeked', () => { clearTimeout(timer); resolve() }, { once: true })
    element.currentTime = target
  }), seconds)
  assert(Math.abs((await video.evaluate(element => element.currentTime)) - seconds) < .05)
}

try {
  for (const [aspect, width, height] of [['desktop', 1280, 720], ['portrait', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await page.locator('button[aria-label^="L12:"]').evaluate(element => element.click())
    const video = page.locator('section[aria-label="L12 guided video"] video')
    await video.waitFor({ state: 'visible' })
    const expectedPoster = aspect === 'desktop' ? '/accelerated/posters/l12-poster-desktop-53dd8b6f8e15.webp' : '/accelerated/posters/l12-poster-portrait-167fd50d0554.webp'
    assert.equal(await video.getAttribute('poster'), expectedPoster)
    assert.equal(await video.getAttribute('controls'), '')
    assert.equal(await video.locator('track[kind="captions"]').count(), 1)
    assert.equal(await video.locator('track').getAttribute('src'), '/accelerated/contextual-review/l12/captions-0363e17aba64/l12-captions.vtt')
    const expectedSource = receipt.media[aspect].path
    await page.waitForFunction(expected => document.querySelector('section[aria-label="L12 guided video"] video')?.currentSrc.endsWith(expected), expectedSource, { timeout: 30000 })
    assert.equal(await video.locator('source').getAttribute('src'), expectedSource)
    await page.waitForFunction(() => document.querySelector('section[aria-label="L12 guided video"] video')?.readyState >= 2, null, { timeout: 30000 })
    assert((await video.evaluate(element => element.currentSrc)).endsWith(expectedSource), `${aspect}: candidate is not the natural route source`)
    await video.evaluate((element, offset) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - offset), aspect === 'desktop' ? 70 : 154)
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(liveOut, `${aspect}-learner-paused.png`) })

    // Screenshots of the exact learner route become a silent, privacy-safe walkthrough.
    const frameDir = path.join(liveOut, `${aspect}-walkthrough-frames`)
    await fs.mkdir(frameDir, { recursive: true })
    for (let index = 0; index < 15; index++) {
      await page.screenshot({ path: path.join(frameDir, `frame-${String(index).padStart(3, '0')}.png`) })
      await page.waitForTimeout(65)
    }
    await video.evaluate(async element => { element.muted = true; await element.play() })
    await page.waitForFunction(() => document.querySelector('section[aria-label="L12 guided video"] video')?.currentTime > .3)
    const playStart = await video.evaluate(element => element.currentTime)
    for (let index = 15; index < 75; index++) {
      await page.screenshot({ path: path.join(frameDir, `frame-${String(index).padStart(3, '0')}.png`) })
      await page.waitForTimeout(65)
    }
    const playEnd = await video.evaluate(element => element.currentTime)
    assert(playEnd > playStart + 2, `${aspect}: opening playback did not advance`)
    const mp4 = path.join(liveOut, `${aspect}-learner-paused-to-opening-walkthrough.mp4`)
    const encoded = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '10', '-i', path.join(frameDir, 'frame-%03d.png'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '10', '-movflags', '+faststart', mp4], { encoding: 'utf8' })
    assert.equal(encoded.status, 0, `${aspect}: walkthrough encode failed: ${encoded.stderr}`)
    await fs.rm(frameDir, { recursive: true })

    const observations = []
    for (const seconds of checkedSeekTimes) {
      await seek(video, seconds)
      const state = await video.evaluate(element => ({ time: element.currentTime, ready: element.readyState, width: element.videoWidth, height: element.videoHeight, paused: element.paused, error: element.error?.message || null }))
      assert(state.ready >= 2 && !state.error, `${aspect} ${seconds}: decode failure`)
      if ([24.48, 24.52, 86, 86.04].includes(seconds)) await page.screenshot({ path: path.join(liveOut, `${aspect}-learner-seek-${String(seconds).replace('.', 'p')}.png`) })
      observations.push(state)
    }
    await seek(video, 460.3)
    await video.evaluate(async element => { await element.play() })
    await page.waitForFunction(() => document.querySelector('section[aria-label="L12 guided video"] video')?.ended, null, { timeout: 10000 })
    await video.evaluate(async element => { await element.play() })
    await page.waitForFunction(() => {
      const element = document.querySelector('section[aria-label="L12 guided video"] video')
      return element && element.currentTime > .2 && element.currentTime < 2
    }, null, { timeout: 10000 })
    const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,nb_frames', '-of', 'json', mp4], { encoding: 'utf8' }).stdout)
    assert.equal(probe.streams[0].nb_frames, '75')
    assert.deepEqual([probe.streams[0].width, probe.streams[0].height], [width, height])
    assert.equal(Number(probe.format.duration), 7.5)
    results.push({ aspect, viewport: [width, height], route, candidate: receipt.media[aspect], poster: expectedPoster, route_source: expectedSource, current_src: await video.evaluate(element => element.currentSrc), caption_path: receipt.caption.path, controls: true, seek_times: checkedSeekTimes, seeks: observations, replay_after_end: true, walkthrough: path.relative(root, mp4), walkthrough_audio: 'silent browser capture; candidate audio independently validated', media_time_during_walkthrough: [playStart, playEnd] })
    await context.close()
    console.log(`PASS ${aspect}: play, controls, caption binding, seeks, replay, walkthrough`)
  }
  await fs.writeFile(path.join(liveOut, 'live-route-browser-review-receipt.json'), JSON.stringify({ schema: 'accelerated_l12_momentum_live_route_review_v1', status: 'draft_pr_binding_review', candidate_sha256: Object.fromEntries(Object.entries(receipt.media).map(([aspect, item]) => [aspect, item.sha256])), results }, null, 2) + '\n')
} finally {
  await browser.close()
}
