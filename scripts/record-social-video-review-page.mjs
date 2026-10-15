#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback
}

const root = resolve(argument('root', 'artifacts/human-qa/artifact-video-review-2026-10-14'))
const screenshotPath = resolve(root, argument('screenshot', 'review-page.png'))
const evidenceScreenshotPath = resolve(root, argument('evidence-screenshot', 'review-page-qa-evidence.png'))
const mobileScreenshotPath = resolve(root, argument('mobile-screenshot', 'review-page-mobile.png'))
const walkthroughPath = resolve(root, argument('walkthrough', 'review-page-walkthrough.mp4'))
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url ?? '/').split('?')[0])
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
  const filePath = resolve(root, relative)
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const file = await stat(filePath)
    response.writeHead(200, {
      'content-type': mime[extname(filePath)] ?? 'application/octet-stream',
      'content-length': file.size,
      'cache-control': 'no-store',
    })
    createReadStream(filePath).pipe(response)
  } catch {
    response.writeHead(404).end('Not found')
  }
})

await new Promise((accept) => server.listen(0, '127.0.0.1', accept))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Local review server did not start.')
const videoDir = await mkdtemp(join(tmpdir(), 'social-video-review-'))
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
const video = page.video()

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await page.locator('#jev').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.locator('#jev summary').click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: evidenceScreenshotPath, fullPage: true })
  await page.locator('#jev video').first().evaluate(async (element) => {
    element.muted = true
    await element.play()
  })
  await page.waitForTimeout(3200)
  await page.locator('#jev video').first().evaluate((element) => element.pause())
  await page.locator('#jev .package-grid').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#jev .approved').scrollIntoViewIfNeeded()
  await page.screenshot({ path: mobileScreenshotPath, fullPage: false })
  await page.waitForTimeout(900)
} finally {
  await context.close()
  await browser.close()
  server.close()
}

const rawVideoPath = await video.path()
execFileSync('ffmpeg', [
  '-y',
  '-i', rawVideoPath,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '22',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  walkthroughPath,
], { stdio: 'inherit' })

console.log(JSON.stringify({ screenshotPath, evidenceScreenshotPath, mobileScreenshotPath, walkthroughPath }, null, 2))
