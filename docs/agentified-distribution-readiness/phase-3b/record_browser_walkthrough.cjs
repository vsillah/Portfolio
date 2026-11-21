const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision || '')) throw new Error('Pass the reviewed commit SHA')
const output = path.resolve('agentified/workshop/phase-3b-review/browser-walkthrough')
fs.mkdirSync(output, { recursive: true })

async function run() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const [name, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
      for (const id of ['L01', 'L10', 'L16']) {
        const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: output, size: { width, height } } })
        const page = await context.newPage()
        const url = `http://127.0.0.1:3108/agentified/learningplan?lesson=${id}&rev=${revision}`
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        const video = page.locator('video')
        await video.waitFor()
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1)
        await video.scrollIntoViewIfNeeded()
        await page.waitForFunction(() => document.body.textContent.includes('Captions are on.'))
        await page.screenshot({ path: path.join(output, `${id}-${name}-start.png`) })
        await page.waitForTimeout(500)
        await page.evaluate(() => { document.querySelector('video').textTracks[0].mode = 'disabled' })
        await page.waitForFunction(() => document.body.textContent.includes('Captions are off.'))
        await page.waitForTimeout(600)
        await page.evaluate(() => { const video = document.querySelector('video'); video.pause(); video.currentTime = Math.max(0, video.duration - 0.25) })
        await page.waitForTimeout(650)
        await page.screenshot({ path: path.join(output, `${id}-${name}-end-off.png`) })
        await page.evaluate(() => { document.querySelector('video').textTracks[0].mode = 'showing' })
        await page.waitForFunction(() => document.body.textContent.includes('Captions are on.'))
        await page.evaluate(() => { document.querySelector('video').currentTime = 2 })
        await page.waitForTimeout(600)
        await page.evaluate(() => { const video = document.querySelector('video'); void video.play().catch(() => {}); setTimeout(() => video.pause(), 350) })
        await page.waitForTimeout(550)
        await page.getByRole('button', { name: 'Mark lesson complete' }).click()
        await page.waitForTimeout(350)
        await page.getByRole('button', { name: 'Mark as incomplete' }).click()
        await page.waitForTimeout(250)
        await context.close()
        const webm = await page.video().path()
        const mp4 = path.join(output, `${id}-${name}-browser.mp4`)
        execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
        fs.unlinkSync(webm)
        execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
        console.log(`${id} ${name}: ${mp4} ${url}`)
      }
    }
  } finally { await browser.close() }
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
