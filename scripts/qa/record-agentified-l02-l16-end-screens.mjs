import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:3166'
const revision = process.argv[3]
if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('Pass the exact review commit')

const out = path.resolve('docs/qa/agentified-l02-l16-end-screens')
mkdirSync(out, { recursive: true })

const cases = [
  { id: 'L02', boundary: 504, expected: 'Up next, L03' },
  { id: 'L04', boundary: 597, expected: 'Up next, L05' },
  { id: 'L15', boundary: 246.324, expected: 'Up next, L16' },
  { id: 'L16', boundary: 267.222, expected: 'Agentified course complete' },
]

const browser = await chromium.launch({ headless: true })

async function seek(video, time) {
  await video.evaluate((node, value) => new Promise((resolve) => {
    node.addEventListener('seeked', resolve, { once: true })
    node.currentTime = value
  }), time)
}

async function choose(page, id, narrow) {
  if (narrow) await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
  await page.locator('aside[aria-label="Lessons"] button').filter({ has: page.locator(`span:text-is("${id}")`) }).click()
}

async function capture(label, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: out, size: { width, height } },
  })
  await context.route('https://**/*', (route) => route.abort())
  const page = await context.newPage()
  await page.goto(`${base}/agentified/learningplan?lesson=L02&revision=${revision}`)
  const narrow = width <= 900

  for (const testCase of cases) {
    if (testCase.id !== 'L02') await choose(page, testCase.id, narrow)
    const video = page.locator(`video[aria-label^="${testCase.id} "]`)
    await video.waitFor({ state: 'visible' })
    await video.scrollIntoViewIfNeeded()
    await video.evaluate((node) => new Promise((resolve, reject) => {
      if (node.readyState >= 1) return resolve()
      node.addEventListener('loadedmetadata', resolve, { once: true })
      node.addEventListener('error', reject, { once: true })
    }))

    await seek(video, testCase.boundary - 0.05)
    if (await page.getByRole('status').count()) throw new Error(`${testCase.id} end screen appeared before the caption boundary`)

    await seek(video, testCase.boundary + 0.03)
    const endScreen = page.getByRole('status', { name: new RegExp(testCase.expected, 'i') })
    await endScreen.waitFor({ state: 'visible' })
    await page.waitForTimeout(420)
    const geometry = await endScreen.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      const stage = node.parentElement?.getBoundingClientRect()
      const descendants = [...node.querySelectorAll('*')].map((element) => element.getBoundingClientRect())
      return {
        bottomGap: stage ? stage.bottom - rect.bottom : 0,
        stageWidth: stage?.width ?? 0,
        width: rect.width,
        height: rect.height,
        childOverflow: descendants.some((child) => child.width > 0 && child.height > 0 && (child.left < rect.left - 1 || child.right > rect.right + 1 || child.top < rect.top - 1 || child.bottom > rect.bottom + 1)),
      }
    })
    const minimumControlClearance = Math.min(96, Math.max(38, geometry.stageWidth * 0.095))
    if (geometry.bottomGap + 1 < minimumControlClearance) throw new Error(`${testCase.id} end screen covers native controls: ${JSON.stringify({ ...geometry, minimumControlClearance })}`)
    if (geometry.width <= 0 || geometry.height <= 0) throw new Error(`${testCase.id} end screen is blank`)
    if (geometry.childOverflow) throw new Error(`${testCase.id} end-screen content is clipped: ${JSON.stringify(geometry)}`)
    const layoutOverflow = await page.evaluate(() => [...document.querySelectorAll('body *')].some((element) => {
      if (element instanceof SVGElement) return false
      const rect = element.getBoundingClientRect()
      return rect.left < -2 || rect.right > window.innerWidth + 2
    }))
    if (layoutOverflow) throw new Error(`${testCase.id} horizontal layout overflow`)

    if (testCase.id === 'L02') {
      const nextPoster = endScreen.locator('img')
      if (!(await nextPoster.getAttribute('src'))?.includes('l03-poster.webp')) throw new Error('L02 does not show the actual L03 cover')
      await page.waitForTimeout(700)
      await seek(video, testCase.boundary - 1)
      await endScreen.waitFor({ state: 'hidden' })
      await seek(video, testCase.boundary + 0.03)
      await endScreen.waitFor({ state: 'visible' })
      await page.waitForTimeout(420)
    }

    if (testCase.id === 'L16' && await endScreen.locator('img').count() !== 1) throw new Error('L16 course-complete treatment is missing its brand mark')
    await page.screenshot({ path: path.join(out, `${label}-${testCase.id.toLowerCase()}.png`), fullPage: false })
    await page.waitForTimeout(850)
  }

  const recording = page.video()
  await context.close()
  const webm = await recording.path()
  const mp4 = path.join(out, `${label}-walkthrough.mp4`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', mp4])
  unlinkSync(webm)
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_name,width,height', '-of', 'default=noprint_wrappers=1', mp4], { encoding: 'utf8' })
  if (!probe.includes('codec_name=h264')) throw new Error(`${label} MP4 encode failed`)
  console.log(`${label}: ${probe.trim().replaceAll('\n', ', ')}`)
}

try {
  await capture('desktop', 1440, 900)
  await capture('mobile', 390, 844)
  console.log('Agentified L02-L16 end-screen rendered QA passed')
} finally {
  await browser.close()
}
