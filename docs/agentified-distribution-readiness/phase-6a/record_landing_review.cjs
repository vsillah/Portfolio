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
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' })
      const page = await context.newPage()
      await page.goto(route, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Public open learning' }).waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      if (overflow) throw new Error(`${name}: horizontal overflow`)
      const offer = await page.getByRole('heading', { name: 'Public open learning' }).boundingBox()
      const cover = await page.locator('img[alt="Agentified cover"]').boundingBox()
      const cta = await page.getByRole('link', { name: /start the free workshop/i }).boundingBox()
      const purchase = await page.getByRole('link', { name: /get the book/i }).boundingBox()
      if (!offer || !cover || !cta || !purchase || cta.y >= purchase.y) throw new Error(`${name}: learning action hierarchy failed`)
      if (name === 'mobile' && offer.y >= cover.y) throw new Error('mobile: learning offer must precede cover')
      if (name === 'desktop' && cover.x >= offer.x) throw new Error('desktop: cover must remain left of learning offer')
      const landing = path.join(output, `${name}-landing.png`)
      const copy = path.join(output, `${name}-copy.png`)
      const coverFrame = path.join(output, `${name}-cover.png`)
      const lesson = path.join(output, `${name}-transcript-led.png`)
      await page.screenshot({ path: landing })
      await page.evaluate((targetY) => window.scrollTo(0, targetY), name === 'mobile' ? 550 : 250)
      await page.waitForTimeout(800)
      await page.screenshot({ path: copy })
      await page.locator('img[alt="Agentified cover"]').scrollIntoViewIfNeeded()
      await page.waitForTimeout(400)
      await page.screenshot({ path: coverFrame })
      await page.getByRole('link', { name: /start the free workshop/i }).click()
      await page.getByText('Guest work stays on this device.', { exact: false }).waitFor()
      const l02 = page.getByRole('button', { name: /L02: Start with the decision, Text only/ })
      if (!await l02.isVisible()) await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
      await l02.click()
      await page.getByText('Use the transcript and worksheet while the video is unavailable.').waitFor()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: lesson })
      await context.close()
      const mp4 = path.join(output, `${name}-walkthrough.mp4`)
      execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
        '-loop', '1', '-framerate', '24', '-t', '2.5', '-i', landing,
        '-loop', '1', '-framerate', '24', '-t', '2.5', '-i', copy,
        '-loop', '1', '-framerate', '24', '-t', '2.5', '-i', coverFrame,
        '-loop', '1', '-framerate', '24', '-t', '2.5', '-i', lesson,
        '-filter_complex', '[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[out]',
        '-map', '[out]', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
      execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', mp4], { encoding: 'utf8' }))
      evidence.push({ viewport: name, width, height, route, video: path.relative(root, mp4), videoSha256: hash(mp4), durationSeconds: Number(probe.format.duration), screenshots: ['landing', 'copy', 'cover', 'transcript-led'].map((suffix) => { const file = path.join(output, `${name}-${suffix}.png`); return { path: path.relative(root, file), sha256: hash(file) } }) })
    }
  } finally { await browser.close() }
  fs.writeFileSync(path.join(output, 'review-receipt.json'), JSON.stringify({ schemaVersion: 1, commit: revision, evidence }, null, 2) + '\n')
  console.log(JSON.stringify(evidence.map(({ viewport, video, videoSha256, durationSeconds }) => ({ viewport, video, videoSha256, durationSeconds })), null, 2))
}
record().catch((error) => { console.error(error); process.exitCode = 1 })
