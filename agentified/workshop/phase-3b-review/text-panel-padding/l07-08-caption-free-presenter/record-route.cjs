#!/usr/bin/env node
// Record the disposable synthetic learner route after its temporary L07 binding is set.
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1024) throw new Error('Pass the local review port')
const here = __dirname
const candidate = path.join(here, 'L07-caption-free-closing-candidate.mp4')
const hash = createHash('sha256').update(fs.readFileSync(candidate)).digest('hex')
const route = `http://127.0.0.1:${port}/agentified/learningplan?lesson=L07&rev=${hash.slice(0, 8)}`
const evidence = path.join(here, 'route-evidence')
fs.mkdirSync(evidence, { recursive: true })

async function seek(page, seconds) {
  await page.locator('video').evaluate((video, value) => { video.pause(); video.currentTime = value }, seconds)
  await page.waitForFunction(value => {
    const video = document.querySelector('video')
    return video && !video.seeking && video.readyState >= 3 && Math.abs(video.currentTime - value) < 0.06
  }, seconds)
  await page.waitForTimeout(1300)
}

async function capture(browser, name, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: evidence, size: { width, height } },
  })
  const page = await context.newPage()
  let source
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    if (await page.getByRole('button', { name: 'Expand lesson navigation' }).count()) {
      await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
      await page.getByRole('button', { name: 'Collapse lesson navigation' }).waitFor()
    }
    await page.getByRole('button', { name: /L07: Specify the work and the team/ }).click()
    await page.getByRole('heading', { name: 'Specify the work and the team' }).waitFor()
    await page.locator('video').waitFor()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 3)
    source = await page.locator('video').evaluate(video => video.currentSrc)
    if (!source.includes(`/review-${hash.slice(0, 8)}/`)) throw new Error(`Unexpected media: ${source}`)
    await page.locator('video').scrollIntoViewIfNeeded()

    for (const seconds of [233.8, 236.2, 239.4, 241.6, 243.8, 245.3]) await seek(page, seconds)
    await page.getByRole('button', { name: 'English captions on' }).click()
    await seek(page, 246.3)
    await page.getByRole('button', { name: 'English captions off' }).click()
    await page.getByRole('button', { name: 'Small captions' }).click()
    await seek(page, 246.3)
    await page.getByRole('button', { name: 'Medium captions' }).click()
    await seek(page, 246.3)
    await page.getByRole('button', { name: 'Large captions' }).click()
    await seek(page, 246.3)
    await seek(page, 251.1)
    await page.locator('video').evaluate(video => video.play())
    await page.waitForFunction(() => document.querySelector('video')?.ended)
    await page.waitForTimeout(700)
    await page.locator('video').evaluate(video => video.play())
    await page.waitForTimeout(600)
    await page.locator('video').evaluate(video => video.pause())
    return { source, route: page.url(), viewport: `${width}x${height}`, hash }
  } finally {
    await context.close()
    const webm = await page.video().path()
    const mp4 = path.join(evidence, `L07-caption-free-${name}-learner-route.mp4`)
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
    fs.unlinkSync(webm)
    execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const results = [
      await capture(browser, 'desktop', 1280, 844),
      await capture(browser, 'mobile', 390, 844),
    ]
    fs.writeFileSync(path.join(evidence, 'route-capture.json'), JSON.stringify({ hash, results }, null, 2) + '\n')
    console.log(JSON.stringify(results, null, 2))
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
