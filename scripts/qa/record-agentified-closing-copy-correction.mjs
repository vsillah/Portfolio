import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.argv[2] || 'http://127.0.0.1:3168'
const revision = process.argv[3]
if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('Pass the exact 40-character review commit')

const output = path.resolve('docs/qa/agentified-closing-copy-correction')
mkdirSync(output, { recursive: true })
const lessons = ['L02', 'L08', 'L16']
const receipts = JSON.parse(readFileSync('agentified/workshop/presentation-illustration-audit/composite-receipts.json', 'utf8'))
const forbidden = /operating file v\d+|\bfile pending\b|audit pending|human editorial|source review/i
const browser = await chromium.launch({ headless: true })

async function capture(label, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    recordVideo: { dir: output, size: { width, height } },
  })
  await context.route('https://**/*', route => route.abort())
  const page = await context.newPage()

  for (const lesson of lessons) {
    await page.goto('about:blank')
    await page.goto(`${base}/agentified/learningplan?lesson=${lesson}&revision=${revision}`)
    const lessonButton = page.locator('button').filter({ hasText: lesson }).first()
    if (!await lessonButton.isVisible()) await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
    await lessonButton.click()
    const video = page.locator(`video[aria-label^="${lesson} "]`)
    await video.waitFor({ state: 'visible' })
    await video.evaluate(node => new Promise((resolve, reject) => {
      if (node.readyState >= 1) return resolve()
      node.addEventListener('loadedmetadata', resolve, { once: true })
      node.addEventListener('error', reject, { once: true })
    }))
    await video.scrollIntoViewIfNeeded()
    const receipt = receipts.composites.find(item => item.lesson_id === lesson)
    const finalPresenter = receipt?.protected_windows.filter(([, , kind]) => kind === 'native presenter').at(-1)
    if (!finalPresenter) throw new Error(`${lesson}: missing final presenter receipt`)
    const target = (finalPresenter[0] + finalPresenter[1]) / 2
    await video.evaluate((node, time) => new Promise(resolve => {
      node.addEventListener('seeked', resolve, { once: true })
      node.currentTime = time
    }), target)
    await video.evaluate(node => node.play())
    await page.waitForTimeout(500)
    await video.evaluate(node => node.pause())
    await video.evaluate(node => {
      const top = node.getBoundingClientRect().top + window.scrollY
      window.scrollTo(0, Math.max(0, top - 96))
    })
    await page.waitForTimeout(100)
    await page.screenshot({ path: path.join(output, `${label}-${lesson.toLowerCase()}-closing.png`) })
    if (forbidden.test(await page.locator('body').innerText())) throw new Error(`${lesson}: internal closing copy is visible`)
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      offenders: [...document.querySelectorAll('body *')]
        .filter(element => element.namespaceURI !== 'http://www.w3.org/2000/svg')
        .map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right }))
        .filter(element => element.right > window.innerWidth + 8)
        .slice(0, 5),
    }))
    if (geometry.offenders.length) throw new Error(`${lesson}: horizontal overflow ${JSON.stringify(geometry)}`)
  }

  const recording = page.video()
  await context.close()
  const webm = await recording.path()
  const mp4 = path.join(output, `${label}-walkthrough.mp4`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', mp4])
  unlinkSync(webm)
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'default=noprint_wrappers=1', mp4], { encoding: 'utf8' })
  if (!probe.includes('codec_name=h264')) throw new Error(`${label}: MP4 encode failed`)
  console.log(`${label}: ${probe.trim().replaceAll('\n', ', ')}`)
}

try {
  await capture('desktop', 1440, 900)
  await capture('mobile', 390, 844)
  console.log(`Closing-copy QA passed: ${base}/agentified/learningplan?lesson=L16&revision=${revision}`)
} finally {
  await browser.close()
}
