#!/usr/bin/env node
// Capture the disposable learner fixture after its L07 binding is set to this candidate.
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1024) throw new Error('Pass the local review port')
const here = __dirname
const hash = '8c3cbcddd420977f2664931e73878e2b1e939a6b7ee0c961ff2c1b42c6eb9446'
const route = `http://127.0.0.1:${port}/agentified/learningplan?lesson=L07`
const evidence = path.join(here, 'route-evidence')
fs.mkdirSync(evidence, { recursive: true })

async function seek(page, time) {
  await page.locator('video').evaluate((video, seconds) => { video.pause(); video.currentTime = seconds }, time)
  await page.waitForFunction(seconds => {
    const video = document.querySelector('video')
    return video && !video.seeking && video.readyState >= 3 && Math.abs(video.currentTime - seconds) < 0.05
  }, time)
}

async function capture(browser, name, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: evidence, size: { width, height } },
  })
  const page = await context.newPage()
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Specify the work and the team' }).waitFor()
    await page.locator('video').waitFor()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 3)
    const source = await page.locator('video').evaluate(video => video.currentSrc)
    if (!source.includes(`/review-${hash.slice(0, 8)}/`)) throw new Error(`Unexpected media: ${source}`)
    await page.locator('video').scrollIntoViewIfNeeded()
    await seek(page, 233.8)
    await page.waitForTimeout(1300)
    await seek(page, 246.3)
    await page.waitForTimeout(2200)
    if (name === 'mobile') await page.getByRole('button', { name: 'Large captions' }).click()
    await page.waitForTimeout(1300)
    await page.getByRole('button', { name: 'English captions on' }).click()
    await page.waitForTimeout(900)
    await page.getByRole('button', { name: 'English captions off' }).click()
    await seek(page, 251.3)
    await page.waitForTimeout(1100)
    await page.locator('video').evaluate(video => { video.currentTime = video.duration; video.pause() })
    await page.waitForTimeout(850)
    await page.locator('video').evaluate(video => { video.currentTime = 0; video.play() })
    await page.waitForTimeout(900)
    await page.locator('video').evaluate(video => video.pause())
    return { source, route: page.url(), viewport: `${width}x${height}` }
  } finally {
    await context.close()
    const webm = await page.video().path()
    const mp4 = path.join(evidence, `L07-closing-${name}-learner-route.mp4`)
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
    fs.unlinkSync(webm)
    execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const results = []
    results.push(await capture(browser, 'desktop', 1280, 844))
    results.push(await capture(browser, 'mobile', 390, 844))
    fs.writeFileSync(path.join(evidence, 'route-capture.json'), JSON.stringify({ hash, results }, null, 2) + '\n')
    console.log(JSON.stringify(results, null, 2))
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
