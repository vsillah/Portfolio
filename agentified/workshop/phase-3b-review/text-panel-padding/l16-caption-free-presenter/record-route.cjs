#!/usr/bin/env node
// Exercise the review-only L16 candidate in the disposable learner worktree.
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1024) throw new Error('Pass the local review port')
const here = __dirname
const candidate = path.join(here, 'L16-caption-free-presenter-candidate.mp4')
const hash = createHash('sha256').update(fs.readFileSync(candidate)).digest('hex')
const route = `http://127.0.0.1:${port}/agentified/learningplan?lesson=L16&rev=${hash.slice(0, 8)}`
const evidence = path.join(here, 'route-evidence')
fs.mkdirSync(evidence, { recursive: true })

async function seek(page, seconds) {
  await page.locator('video').evaluate((video, value) => { video.pause(); video.currentTime = value }, seconds)
  await page.waitForFunction(value => {
    const video = document.querySelector('video')
    return video && !video.seeking && video.readyState >= 3 && Math.abs(video.currentTime - value) < 0.08
  }, seconds)
  await page.waitForTimeout(300)
}

async function state(page) {
  return page.evaluate(() => {
    const video = document.querySelector('video')
    const band = document.querySelector('[aria-label="L16 caption"]')
    const end = document.querySelector('[role="status"][aria-label^="L16 complete"]')
    return {
      time: Number(video.currentTime.toFixed(3)), paused: video.paused, ended: video.ended,
      track: video.textTracks[0]?.mode, activeCues: Array.from(video.textTracks[0]?.activeCues || [], cue => cue.text),
      band: band?.textContent || null, endVisible: Boolean(end),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })
}

async function capture(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: evidence, size: { width, height } } })
  const page = await context.newPage()
  const checks = []
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  let source
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Audit the operating file' }).waitFor()
    await page.locator('video').waitFor()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 3)
    source = await page.locator('video').evaluate(video => video.currentSrc)
    if (!source.includes(`/review-${hash.slice(0, 8)}/`)) throw new Error(`Unexpected media: ${source}`)
    const media = await page.locator('video').evaluate(video => ({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, tracks: video.textTracks.length, captionSrc: video.querySelector('track')?.src }))
    if (Math.abs(media.duration - 267.309) > 0.015 || media.width !== 1920 || media.height !== 1080 || media.tracks !== 1 || !media.captionSrc.includes('/approved-e890f6a9/agentified-l16-native-captions.vtt')) throw new Error(`Unexpected media: ${JSON.stringify(media)}`)
    checks.push({ check: 'loaded candidate and approved VTT', ...media })
    await page.locator('video').scrollIntoViewIfNeeded()

    for (const seconds of [0.5, 2.5, 4.5, 8, 12, 15.7, 16.3, 257.9, 258.5, 260.7, 263, 265, 266.5]) {
      await seek(page, seconds)
      const observed = await state(page)
      if (observed.overflowX || observed.endVisible || !observed.paused) throw new Error(`Presentation drift at ${seconds}: ${JSON.stringify(observed)}`)
      if ([0.5, 2.5, 15.7, 16.3, 257.9, 258.5, 260.7, 266.5].includes(seconds)) await page.screenshot({ path: path.join(evidence, `${name}-${String(seconds).replace('.', 'p')}-on-M.png`) })
      checks.push({ check: 'paused seek', seconds, ...observed })
    }
    await seek(page, 2.5)
    if (!(await state(page)).band?.includes('full Operating File')) throw new Error('Opening independent caption missing')
    await seek(page, 260.7)
    if (!(await state(page)).band?.includes('disposition real')) throw new Error('Closing independent caption missing')

    await page.getByRole('button', { name: 'English captions on' }).click()
    for (const seconds of [2.5, 260.7]) {
      await seek(page, seconds)
      const observed = await state(page)
      if (observed.track !== 'disabled' || observed.band) throw new Error(`Captions not off at ${seconds}: ${JSON.stringify(observed)}`)
      await page.screenshot({ path: path.join(evidence, `${name}-${String(seconds).replace('.', 'p')}-off.png`) })
      checks.push({ check: 'captions off', seconds, ...observed })
    }
    await page.getByRole('button', { name: 'English captions off' }).click()
    for (const [label, size] of [['Small', 'S'], ['Medium', 'M'], ['Large', 'L']]) {
      await page.getByRole('button', { name: `${label} captions` }).click()
      for (const seconds of [2.5, 260.7]) {
        await seek(page, seconds)
        const observed = await state(page)
        const selected = await page.locator('video').getAttribute('data-caption-size')
        if (selected !== size || !observed.band || observed.overflowX) throw new Error(`Caption size ${label} failed at ${seconds}: ${JSON.stringify(observed)}`)
        await page.screenshot({ path: path.join(evidence, `${name}-${String(seconds).replace('.', 'p')}-on-${size}.png`) })
        checks.push({ check: 'caption size', seconds, selected: label, observed: size, band: observed.band })
      }
    }
    await page.getByRole('button', { name: 'Medium captions' }).click()
    if (name === 'mobile') {
      await seek(page, 3)
      await page.getByRole('button', { name: 'Play video' }).click()
      await page.waitForTimeout(450)
      await page.getByRole('button', { name: 'Pause video' }).click()
      if (!(await state(page)).paused) throw new Error('Mobile pause failed')
      checks.push({ check: 'mobile play and pause' })
      await page.getByRole('button', { name: 'Mute video' }).click()
      await page.getByRole('button', { name: 'Unmute video' }).click()
      checks.push({ check: 'mobile mute and unmute' })
      await page.getByRole('slider', { name: 'Seek video' }).fill('260.7')
      await page.waitForTimeout(300)
      if (Math.abs((await state(page)).time - 260.7) > 0.2) throw new Error('Mobile seek control failed')
      checks.push({ check: 'mobile seek control' })
      await page.screenshot({ path: path.join(evidence, `${name}-controls.png`) })
    } else {
      await seek(page, 260.7)
      await page.locator('video').evaluate(video => video.play())
      await page.waitForTimeout(450)
      await page.locator('video').evaluate(video => video.pause())
      if (!(await state(page)).paused) throw new Error('Desktop pause failed')
      checks.push({ check: 'desktop media play and pause' })
    }

    await seek(page, 266.5)
    if ((await state(page)).endVisible) throw new Error('Completion obscured final presenter passage')
    await page.screenshot({ path: path.join(evidence, `${name}-before-completion.png`) })
    await page.locator('video').evaluate(video => video.play())
    await page.waitForFunction(() => document.querySelector('video')?.ended, null, { timeout: 10000 })
    await page.getByRole('status', { name: /L16 complete/ }).waitFor()
    await page.waitForTimeout(450)
    checks.push({ check: 'completion only after video ended', ...(await state(page)) })
    await page.screenshot({ path: path.join(evidence, `${name}-ended.png`) })
    await page.locator('video').evaluate(video => video.play())
    await page.waitForTimeout(450)
    const replay = await state(page)
    if (replay.time >= 5 || replay.endVisible) throw new Error(`Replay failed: ${JSON.stringify(replay)}`)
    checks.push({ check: 'replay', ...replay })
    await page.screenshot({ path: path.join(evidence, `${name}-replay.png`) })
    await page.locator('video').evaluate(video => video.pause())
    if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`)
    return { source, route: page.url(), viewport: `${width}x${height}`, hash, checks, errors }
  } finally {
    await context.close()
    const webm = await page.video().path()
    const mp4 = path.join(evidence, `L16-caption-free-${name}-learner-route.mp4`)
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
    console.log(JSON.stringify(results.map(({ viewport, checks }) => ({ viewport, checks: checks.length })), null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
