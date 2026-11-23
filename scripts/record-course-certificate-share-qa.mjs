import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const revision = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('Pass the exact 40-character commit hash')
const output = join(process.cwd(), 'docs/qa/course-certificate-share-20261123')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const destinations = ['https://www.linkedin.com/**', 'https://www.facebook.com/**', 'https://twitter.com/**']

async function capture(course, viewport, step) {
  const mobile = viewport === 'mobile'
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, colorScheme: 'dark' })
  await context.addInitScript(({ fail }) => {
    window.__qaClipboardCalls = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText(value) {
      window.__qaClipboardCalls.push(value)
      return fail && window.__qaClipboardCalls.length === 1 ? Promise.reject(new Error('Synthetic clipboard denial')) : Promise.resolve()
    } } })
  }, { fail: step === 'failure' || step === 'retry' })
  let intercepted = 0
  for (const destination of destinations) await context.route(destination, route => { intercepted++; return route.fulfill({ status: 200, contentType: 'text/html', body: 'Synthetic share destination' }) })
  const page = await context.newPage()
  const url = course === 'agentified'
    ? `http://127.0.0.1:3189/member/dashboard?qa=agentified-credential&certificate=claimed&certificateTheme=dark&rev=${revision}`
    : `http://127.0.0.1:3189/member/dashboard?qa=completion-ready&rev=${revision}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (course === 'accelerated') {
    await page.getByRole('button', { name: 'Claim certificate' }).click()
    await page.getByLabel('Claimed Accelerated completion certificate').waitFor()
    if (!await page.getByRole('button', { name: 'Copy verification link' }).isEnabled()) throw new Error('Verification utility regressed')
  }
  const heading = page.getByRole('heading', { name: 'Share your achievement' })
  await heading.waitFor()
  await heading.scrollIntoViewIfNeeded()
  if (await page.getByRole('button', { name: /copy message|retry copying/i }).count()) throw new Error(`${course} default copy visible`)
  const links = ['LinkedIn', 'Facebook', 'X'].map(platform => page.getByRole('link', { name: `Share on ${platform}` }))
  const y = []
  for (const link of links) {
    const box = await link.boundingBox()
    if (!box || box.width < 44 || box.height < 44) throw new Error(`${course} ${viewport} small share target`)
    y.push(box.y)
  }
  if (Math.max(...y) - Math.min(...y) > 3 || await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`${course} ${viewport} layout regression`)
  if (step !== 'default') {
    const platform = step === 'x' ? 'X' : step === 'success' ? 'LinkedIn' : 'Facebook'
    const link = page.getByRole('link', { name: `Share on ${platform}` })
    const href = await link.getAttribute('href')
    const popupPromise = context.waitForEvent('page')
    if (mobile && step === 'failure') { await link.focus(); await page.keyboard.press('Enter') }
    else await link.click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    if (popup.url() !== href || intercepted !== 1 || context.pages().length !== 2) throw new Error(`${course} ${viewport} duplicate or wrong destination`)
    const calls = await page.evaluate(() => window.__qaClipboardCalls)
    if (platform === 'X' ? calls.length !== 0 : calls.length !== 1 || !calls[0].endsWith(course === 'accelerated' ? 'https://amadutown.com/accelerated' : 'https://amadutown.com/agentified') || /Course Learner|AT-ACC|AT-AGT|verify\/|f{64}/i.test(calls[0])) throw new Error(`${course} ${viewport} clipboard drift`)
    if (step === 'failure' || step === 'retry') {
      const retry = page.getByRole('button', { name: 'Retry copying message' })
      await retry.waitFor()
      if (step === 'retry') {
        await retry.click()
        await page.getByRole('status').filter({ hasText: 'Message copied.' }).waitFor()
        if (await retry.count() || (await page.evaluate(() => window.__qaClipboardCalls)).length !== 2 || intercepted !== 1) throw new Error(`${course} ${viewport} retry drift`)
      }
    } else if (await page.getByRole('button', { name: 'Retry copying message' }).count()) throw new Error(`${course} ${viewport} unexpected retry`)
  }
  await heading.scrollIntoViewIfNeeded()
  const file = join(output, `${course}-${viewport}-${step}.png`)
  await page.screenshot({ path: file })
  await context.close()
  return file
}

try {
  for (const course of ['accelerated', 'agentified']) for (const viewport of ['desktop', 'mobile']) {
    const frames = []
    for (const step of ['default', 'success', 'failure', 'retry', 'x']) frames.push(await capture(course, viewport, step))
    const list = join(output, `${course}-${viewport}-frames.txt`)
    writeFileSync(list, frames.map(file => `file '${file}'\nduration 3`).join('\n') + `\nfile '${frames.at(-1)}'\n`)
    const video = join(output, `${course}-${viewport}.mp4`)
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', video])
    execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-f', 'null', '-'])
  }
  console.log(`Recorded ${revision} to ${output}`)
} finally { await browser.close() }
