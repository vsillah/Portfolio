#!/usr/bin/env node
// Exercise the candidate through a disposable, synthetic L08 learner route.
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1024) throw new Error('Pass the local review port')
const here = __dirname
const candidate = path.join(here, 'L08-caption-free-presenter-candidate.mp4')
const hash = createHash('sha256').update(fs.readFileSync(candidate)).digest('hex')
const route = `http://127.0.0.1:${port}/agentified/learningplan?lesson=L08&rev=${hash.slice(0, 8)}`
const evidence = path.join(here, 'route-evidence')
fs.mkdirSync(evidence, { recursive: true })

async function seek(page, seconds) {
  await page.locator('video').evaluate((video, value) => { video.pause(); video.currentTime = value }, seconds)
  await page.waitForFunction(value => {
    const video = document.querySelector('video')
    return video && !video.seeking && video.readyState >= 3 && Math.abs(video.currentTime - value) < 0.08
  }, seconds)
  await page.waitForTimeout(450)
}

async function capture(browser, name, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: evidence, size: { width, height } },
  })
  const page = await context.newPage()
  const checks = []
  let source
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Make handoffs testable' }).waitFor()
    await page.locator('video').waitFor()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 3)
    source = await page.locator('video').evaluate(video => video.currentSrc)
    if (!source.includes(`/review-${hash.slice(0, 8)}/`)) throw new Error(`Unexpected media: ${source}`)
    await page.locator('video').scrollIntoViewIfNeeded()
    const media = await page.locator('video').evaluate(video => ({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, tracks: video.textTracks.length }))
    if (Math.abs(media.duration - 257.68) > 0.06 || media.width !== 1920 || media.height !== 1080 || media.tracks !== 1) throw new Error(`Unexpected media metadata: ${JSON.stringify(media)}`)
    checks.push({ check: 'loaded candidate and VTT', ...media })

    for (const seconds of [0.5, 6, 12.8, 13.6, 14.4, 246.9, 247.6, 251, 254.4, 254.9]) {
      await seek(page, seconds)
      await page.screenshot({ path: path.join(evidence, `${name}-${String(seconds).replace('.', 'p')}-on-M.png`) })
      const state = await page.locator('video').evaluate(video => ({ time: video.currentTime, paused: video.paused, track: video.textTracks[0]?.mode }))
      checks.push({ check: 'seek', seconds, ...state })
    }
    await page.getByRole('button', { name: 'English captions on' }).click()
    for (const seconds of [1, 12.8, 247.7, 254.3]) {
      await seek(page, seconds)
      await page.screenshot({ path: path.join(evidence, `${name}-${String(seconds).replace('.', 'p')}-off.png`) })
      const state = await page.locator('video').evaluate(video => video.textTracks[0]?.mode)
      if (state !== 'disabled') throw new Error(`Captions still on at ${seconds}: ${state}`)
      checks.push({ check: 'captions off', seconds, mode: state })
    }
    await page.getByRole('button', { name: 'English captions off' }).click()
    for (const [label, size] of [['Small', 'S'], ['Large', 'L'], ['Medium', 'M']]) {
      await page.getByRole('button', { name: `${label} captions` }).click()
      await seek(page, 251)
      const observed = await page.locator('video').getAttribute('data-caption-size')
      if (observed !== size) throw new Error(`Caption size ${label} became ${observed}`)
      await page.screenshot({ path: path.join(evidence, `${name}-251-on-${size}.png`) })
      checks.push({ check: 'caption size', selected: label, observed })
    }
    if (name === 'mobile') {
      await page.getByRole('button', { name: 'Play video' }).click()
      await page.waitForTimeout(800)
      await page.getByRole('button', { name: 'Pause video' }).click()
      checks.push({ check: 'mobile play/pause' })
      await page.getByRole('button', { name: 'Mute video' }).click()
      await page.getByRole('button', { name: 'Unmute video' }).click()
      checks.push({ check: 'mobile sound' })
      await page.getByRole('slider', { name: 'Video volume level' }).press('End')
      await page.getByRole('slider', { name: 'Video volume level' }).press('Home')
      checks.push({ check: 'mobile volume' })
      await page.getByRole('slider', { name: 'Seek video' }).fill('250')
      checks.push({ check: 'mobile seek' })
    }
    await seek(page, 253.7)
    await page.locator('video').evaluate(video => video.play())
    await page.waitForFunction(() => document.querySelector('video')?.ended)
    const ended = await page.getByRole('status', { name: /L08 complete/ }).count()
    if (!ended) throw new Error('End screen missing')
    checks.push({ check: 'completion', endScreen: ended })
    await page.locator('video').evaluate(video => video.play())
    await page.waitForTimeout(500)
    const replay = await page.locator('video').evaluate(video => video.currentTime)
    if (replay >= 5) throw new Error(`Replay did not restart: ${replay}`)
    checks.push({ check: 'replay', time: replay })
    await page.locator('video').evaluate(video => video.pause())
    return { source, route: page.url(), viewport: `${width}x${height}`, hash, checks }
  } finally {
    await context.close()
    const webm = await page.video().path()
    const mp4 = path.join(evidence, `L08-caption-free-${name}-learner-route.mp4`)
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
    fs.unlinkSync(webm)
    execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const results = [await capture(browser, 'desktop', 1280, 844), await capture(browser, 'mobile', 390, 844)]
    fs.writeFileSync(path.join(evidence, 'route-capture.json'), JSON.stringify({ hash, results }, null, 2) + '\n')
    console.log(JSON.stringify(results, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
