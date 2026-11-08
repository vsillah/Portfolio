import { chromium } from 'playwright'
import { mkdirSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const base = process.argv[2] || 'http://localhost:3219'
const revision = process.argv[3]
if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('Pass the exact review commit')
const out = path.resolve('docs/qa/agentified-l05-l08-learning-plan')
mkdirSync(out, { recursive: true })
const lessons = [
  ['L05', '1cd79d31', 237.687, '03:57', 174.7895],
  ['L06', '991cb8b6', 258.96, '04:18', 198.7925],
  ['L07', '869a0ff4', 251.332, '04:11', 188.515],
  ['L08', '3c5b399f', 257.68, '04:17', 192.6535],
]
const browser = await chromium.launch({ headless: true })

async function choose(page, id, narrow) {
  if (narrow) await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
  await page.locator('aside[aria-label="Lessons"] button').filter({ has: page.locator(`span:text-is("${id}")`) }).click()
}

async function capture(label, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', recordVideo: { dir: out, size: { width, height } } })
  await context.route('https://**/*', (route) => route.abort())
  const page = await context.newPage()
  await page.goto(`${base}/agentified/learningplan?lesson=L05&revision=${revision}`)
  const narrow = width <= 900
  for (const [id, hash, duration, display, countdown] of lessons) {
    if (id !== 'L05') await choose(page, id, narrow)
    const video = page.locator(`video[aria-label^="${id} "]`)
    await video.waitFor({ state: 'visible' })
    await video.evaluate((node) => new Promise((resolve, reject) => { if (node.readyState >= 1) return resolve(); node.addEventListener('loadedmetadata', resolve, { once: true }); node.addEventListener('error', reject, { once: true }) }))
    const media = await video.evaluate((node) => ({ duration: node.duration, source: node.querySelector('source')?.getAttribute('src'), captions: node.querySelector('track')?.getAttribute('src'), defaultCaptions: node.querySelector('track')?.default, trackMode: node.textTracks[0]?.mode }))
    if (Math.abs(media.duration - duration) > 0.03 || !media.source?.includes(`continuous-${hash}`) || !media.captions?.endsWith('.vtt') || !media.defaultCaptions || media.trackMode !== 'showing') throw new Error(`${id} media mismatch: ${JSON.stringify(media)}`)
    if (!(await page.getByText(`Ready · ${display}`).isVisible())) throw new Error(`${id} not ready`)
    if (!(await page.locator(`#answer-${id}`).isVisible())) throw new Error(`${id} worksheet missing`)
    if (!(await page.getByText('Spoken audio').isVisible())) await page.getByText(`Read along with ${id} transcript`).click()
    if (!(await page.getByText('Spoken audio').isVisible())) throw new Error(`${id} transcript missing`)
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) throw new Error(`${id} horizontal overflow`)
    await video.evaluate((node, time) => new Promise((resolve) => { node.addEventListener('seeked', resolve, { once: true }); node.currentTime = time }), countdown + 3)
    await video.evaluate((node) => node.play())
    await page.waitForTimeout(500)
    await video.evaluate((node) => node.pause())
    await page.screenshot({ path: path.join(out, `${label}-${id.toLowerCase()}-countdown.png`) })
    if (id === 'L05') {
      await video.evaluate((node) => { node.currentTime = 1; return node.play() })
      await page.waitForTimeout(1200)
      await video.evaluate((node) => node.pause())
      await page.locator('#answer-L05').fill('Synthetic operating map: named owner, source check, and human review.')
      await page.waitForTimeout(350)
    }
    await page.waitForTimeout(1200)
  }
  await choose(page, 'L09', narrow)
  if (await page.locator('video').count() || !(await page.getByText('Video locked').isVisible())) throw new Error('L09 lock failed')
  await page.getByRole('link', { name: 'Open Operating File' }).click()
  await page.getByRole('heading', { name: 'Operating File' }).waitFor({ state: 'visible' })
  if (await page.locator('#file-L05').inputValue() !== 'Synthetic operating map: named owner, source check, and human review.') throw new Error('Operating File did not persist')
  await page.locator('#L05').getByRole('link', { name: 'Open lesson' }).click()
  await page.getByText('Ready · 03:57').waitFor({ state: 'visible' })
  if (await page.locator('#answer-L05').inputValue() !== 'Synthetic operating map: named owner, source check, and human review.') throw new Error('Worksheet return failed')
  const seconds = await page.evaluate(() => JSON.parse(localStorage.getItem('amadutown:agentified:guest-progress:v1') || '{}').videoSeconds?.L05)
  if (!Number.isInteger(seconds) || seconds < 0) throw new Error('Guest playback position missing')
  await page.waitForTimeout(500)
  const recording = page.video()
  await context.close()
  const webm = await recording.path()
  const mp4 = path.join(out, `${label}-walkthrough.mp4`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', mp4])
  unlinkSync(webm)
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'default=noprint_wrappers=1', mp4], { encoding: 'utf8' })
  if (!probe.includes('codec_name=h264')) throw new Error('MP4 encode failed')
  console.log(`${label}: ${probe.trim().replaceAll('\n', ', ')}, saved seconds ${seconds}`)
}
try {
  await capture('desktop', 1440, 900)
  await capture('tablet', 820, 1000)
  await capture('mobile', 390, 844)
  console.log('Rendered L05-L08 guest QA passed at desktop, tablet, mobile')
} finally { await browser.close() }
