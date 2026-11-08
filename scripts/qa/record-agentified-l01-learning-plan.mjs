import { chromium } from 'playwright'
import { mkdirSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const base = process.argv[2] || 'http://localhost:3217'
const revision = process.argv[3]
if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('Pass the exact 40-character review commit')
const url = `${base}/agentified/learningplan?lesson=L01&revision=${revision}`
const out = path.resolve('docs/qa/agentified-l01-learning-plan')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function inspect(page, label) {
  await page.goto(url)
  const video = page.locator('video[aria-label^="L01 "]')
  await video.waitFor({ state: 'visible' })
  const media = await video.evaluate((node) => ({ duration: node.duration, source: node.querySelector('source')?.getAttribute('src'), captions: node.querySelector('track')?.getAttribute('src'), trackDefault: node.querySelector('track')?.default }))
  if (media.duration !== 540 || !media.source?.includes('corrected-34737c64') || !media.captions?.endsWith('.vtt') || !media.trackDefault) throw new Error(`${label} media mismatch: ${JSON.stringify(media)}`)
  if (!(await page.getByText('Ready · 09:00').isVisible())) throw new Error(`${label} L01 not ready`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  if (overflow) throw new Error(`${label} horizontal overflow`)
  await page.screenshot({ path: path.join(out, `${label}-l01.png`) })
  return video
}

async function encode(page, context, name) {
  const recording = page.video()
  await context.close()
  const webm = await recording.path()
  const mp4 = path.join(out, `${name}.mp4`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', mp4])
  unlinkSync(webm)
  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'default=noprint_wrappers=1', mp4], { encoding: 'utf8' })
  if (!probe.includes('codec_name=h264')) throw new Error(`${name} MP4 did not encode`)
  console.log(`${name}: ${probe.trim().replaceAll('\n', ', ')}`)
}

try {
  for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 820, 1000], ['mobile', 390, 844]]) {
    const record = label !== 'tablet'
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', ...(record ? { recordVideo: { dir: out, size: { width, height } } } : {}) })
    await context.route('https://**/*', (route) => route.abort())
    const page = await context.newPage()
    const video = await inspect(page, label)
    if (record) {
      await video.evaluate((node) => node.play())
      await page.waitForTimeout(1800)
      await video.evaluate((node) => node.pause())
      await page.getByText('Read along with L01 transcript').click()
      if (!(await page.getByText('Spoken audio').isVisible())) throw new Error(`${label} transcript missing`)
      await page.waitForTimeout(1100)
      if (label === 'mobile') await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
      await page.getByRole('button', { name: /^L05 Map the operating system/ }).click()
      if (await page.locator('video').count() || !(await page.getByText('Video locked').isVisible())) throw new Error(`${label} L05 media gate failed`)
      await page.waitForTimeout(1100)
      await page.getByRole('link', { name: 'Open Operating File' }).click()
      await page.getByRole('heading', { name: 'Operating File' }).waitFor({ state: 'visible' })
      await page.waitForTimeout(1100)
      await page.locator('#L01').getByRole('link', { name: 'Open lesson' }).click()
      await page.getByText('Ready · 09:00').waitFor({ state: 'visible' })
      await page.waitForTimeout(1000)
      await encode(page, context, `${label}-walkthrough`)
    } else await context.close()
  }
  console.log(`Rendered guest QA passed at desktop, tablet, and mobile: ${url}`)
} finally { await browser.close() }
