const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

const revision = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Pass the exact reviewed commit SHA')
const root = path.resolve(__dirname, '../../..')
const output = path.join(__dirname, 'qa')
const route = `http://127.0.0.1:3188/agentified?rev=${revision}`
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
fs.mkdirSync(output, { recursive: true })

async function record() {
  const browser = await chromium.launch({ headless: true })
  const evidence = []
  try {
    for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: output, size: { width, height } }, serviceWorkers: 'block' })
      const page = await context.newPage()
      await page.goto(route, { waitUntil: 'networkidle' })
      await page.getByText('The Agentified workshop is public open learning.', { exact: false }).waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      if (overflow) throw new Error(`${name}: horizontal overflow`)
      await page.screenshot({ path: path.join(output, `${name}-landing.png`) })
      await page.waitForTimeout(1000)
      await page.getByText('The Agentified workshop is public open learning.', { exact: false }).scrollIntoViewIfNeeded()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: path.join(output, `${name}-copy.png`) })
      await page.getByRole('link', { name: /open the workshop/i }).scrollIntoViewIfNeeded()
      await page.waitForTimeout(800)
      await page.getByRole('link', { name: /open the workshop/i }).click()
      await page.getByText('Guest work stays on this device.', { exact: false }).waitFor()
      const l02 = page.getByRole('button', { name: /L02: Start with the decision, Text only/ })
      if (!await l02.isVisible()) await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
      await l02.click()
      await page.getByText('Use the transcript and worksheet while the video is unavailable.').waitFor()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: path.join(output, `${name}-transcript-led.png`) })
      await page.goto(route, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      await context.close()
      const webm = await page.video().path()
      const mp4 = path.join(output, `${name}-walkthrough.mp4`)
      execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
      fs.unlinkSync(webm)
      execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', mp4], { encoding: 'utf8' }))
      evidence.push({ viewport: name, width, height, route, video: path.relative(root, mp4), videoSha256: hash(mp4), durationSeconds: Number(probe.format.duration), screenshots: ['landing', 'copy', 'transcript-led'].map((suffix) => { const file = path.join(output, `${name}-${suffix}.png`); return { path: path.relative(root, file), sha256: hash(file) } }) })
    }
  } finally { await browser.close() }
  fs.writeFileSync(path.join(output, 'review-receipt.json'), JSON.stringify({ schemaVersion: 1, commit: revision, evidence }, null, 2) + '\n')
  console.log(JSON.stringify(evidence.map(({ viewport, video, videoSha256, durationSeconds }) => ({ viewport, video, videoSha256, durationSeconds })), null, 2))
}
record().catch((error) => { console.error(error); process.exitCode = 1 })
