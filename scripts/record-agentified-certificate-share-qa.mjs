import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const revision = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('Pass the exact 40-character commit hash')
const output = join(process.cwd(), 'docs/qa/agentified-certificate-20261123/share')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const base = `http://127.0.0.1:3189/member/dashboard?qa=agentified-credential&rev=${revision}`

async function capture(label, width, height, scene, theme, { copy = false, focus = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme === 'dark' ? 'dark' : 'light', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  await page.goto(`${base}&certificate=${scene}&certificateTheme=${theme}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Workshop completion' }).waitFor()
  const share = page.getByRole('heading', { name: 'Share your achievement' })
  if (scene === 'eligible' || scene === 'blocked') {
    if (await share.count()) throw new Error(`Share leaked into ${scene}`)
  } else {
    await share.waitFor()
    await share.scrollIntoViewIfNeeded()
    const links = ['LinkedIn', 'Facebook', 'X'].map(platform => page.getByRole('link', { name: `Share on ${platform}` }))
    const positions = []
    for (const link of links) {
      const box = await link.boundingBox()
      if (!box || box.width < 44 || box.height < 44) throw new Error(`${label}: brand touch target under 44px`)
      positions.push(box.y)
    }
    if (Math.max(...positions) - Math.min(...positions) > 3) throw new Error(`${label}: brand links wrapped`)
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`${label}: horizontal overflow`)
  }
  if (copy) {
    await page.getByRole('button', { name: /Copy (complete message|message to share)/ }).click()
    await page.getByText('Complete message copied. Paste and review it before posting.').waitFor()
  }
  if (focus) {
    const link = page.getByRole('link', { name: 'Share on LinkedIn' })
    await link.focus()
    if (!await link.evaluate(element => element === document.activeElement)) throw new Error(`${label}: keyboard focus failed`)
  }
  const path = join(output, `${label}.png`)
  await page.screenshot({ path })
  await context.close()
  return path
}

async function capturePlatform(label, width, height, platform, theme, { fail = false, keyboard = false } = {}) {
  const destination = {
    LinkedIn: 'https://www.linkedin.com/sharing/share-offsite/',
    Facebook: 'https://www.facebook.com/sharer/sharer.php',
    X: 'https://twitter.com/intent/tweet',
  }[platform]
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme === 'dark' ? 'dark' : 'light' })
  await context.addInitScript(({ failCopy }) => {
    window.__qaClipboardCalls = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText(text) {
      window.__qaClipboardCalls.push(text)
      return failCopy ? Promise.reject(new Error('Synthetic clipboard denial')) : Promise.resolve()
    } } })
  }, { failCopy: fail })
  let intercepted = 0
  await context.route('https://www.linkedin.com/**', route => { intercepted++; return route.fulfill({ status: 200, contentType: 'text/html', body: 'Synthetic share destination' }) })
  await context.route('https://www.facebook.com/**', route => { intercepted++; return route.fulfill({ status: 200, contentType: 'text/html', body: 'Synthetic share destination' }) })
  await context.route('https://twitter.com/**', route => { intercepted++; return route.fulfill({ status: 200, contentType: 'text/html', body: 'Synthetic share destination' }) })
  const page = await context.newPage()
  await page.goto(`${base}&certificate=claimed&certificateTheme=${theme}`, { waitUntil: 'domcontentloaded' })
  const link = page.getByRole('link', { name: `Share on ${platform}` })
  await link.waitFor()
  const expectedUrl = await link.getAttribute('href')
  if (!expectedUrl?.startsWith(destination)) throw new Error(`${label}: destination drift`)
  const popupPromise = context.waitForEvent('page')
  if (keyboard) { await link.focus(); await page.keyboard.press('Enter') }
  else await link.click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  if (popup.url() !== expectedUrl || context.pages().length !== 2 || intercepted !== 1) throw new Error(`${label}: expected exactly one intercepted destination`)
  const calls = await page.evaluate(() => window.__qaClipboardCalls)
  if (platform === 'X' ? calls.length !== 0 : calls.length !== 1 || !calls[0].endsWith('https://amadutown.com/agentified') || /Course Learner|AT-AGT|verify\/|f{64}/i.test(calls[0])) throw new Error(`${label}: clipboard payload drift`)
  const status = platform === 'X' ? 'X opens with a shorter message and the workshop link. Review it before posting.' : fail ? `Message could not be copied. ${platform} opened with the workshop link. Use the separate Copy message action to try again.` : `Message copied. Paste and review it before posting on ${platform}.`
  await page.getByRole('status').filter({ hasText: status }).waitFor()
  await page.getByRole('heading', { name: 'Share your achievement' }).scrollIntoViewIfNeeded()
  const path = join(output, `${label}.png`)
  await page.screenshot({ path })
  await context.close()
  return path
}

function video(label, frames) {
  const list = join(output, `${label}-frames.txt`)
  writeFileSync(list, frames.map(path => `file '${path}'\nduration 3`).join('\n') + `\nfile '${frames.at(-1)}'\n`)
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', join(output, `${label}.mp4`)])
  execFileSync('ffmpeg', ['-v', 'error', '-i', join(output, `${label}.mp4`), '-f', 'null', '-'])
}

try {
  const desktop = [
    await capture('desktop-claimed', 1280, 800, 'claimed', 'dark'),
    await capture('desktop-copied', 1280, 800, 'claimed', 'dark', { copy: true }),
    await capturePlatform('desktop-linkedin-copied', 1280, 800, 'LinkedIn', 'dark'),
    await capturePlatform('desktop-facebook-copy-failed', 1280, 800, 'Facebook', 'light', { fail: true }),
    await capturePlatform('desktop-x-intent', 1280, 800, 'X', 'dark'),
    await capture('desktop-focused', 1280, 800, 'claimed', 'light', { focus: true }),
    await capture('desktop-verified', 1280, 800, 'verified', 'light'),
    await capture('desktop-revoked', 1280, 800, 'revoked', 'dark'),
    await capture('desktop-eligible', 1280, 800, 'eligible', 'light'),
    await capture('desktop-blocked', 1280, 800, 'blocked', 'dark'),
  ]
  const mobile = [
    await capture('mobile-claimed', 390, 844, 'claimed', 'dark'),
    await capture('mobile-copied', 390, 844, 'claimed', 'dark', { copy: true }),
    await capturePlatform('mobile-facebook-copied', 390, 844, 'Facebook', 'dark'),
    await capturePlatform('mobile-linkedin-copy-failed', 390, 844, 'LinkedIn', 'light', { fail: true, keyboard: true }),
    await capture('mobile-focused', 390, 844, 'claimed', 'light', { focus: true }),
    await capture('mobile-long-name', 390, 844, 'long-name', 'light'),
    await capture('mobile-verified', 390, 844, 'verified', 'dark'),
    await capture('mobile-revoked', 390, 844, 'revoked', 'light'),
    await capture('mobile-eligible', 390, 844, 'eligible', 'dark'),
    await capture('mobile-blocked', 390, 844, 'blocked', 'light'),
  ]
  video('desktop-share-walkthrough', desktop)
  video('mobile-share-walkthrough', mobile)
  console.log(`Recorded exact revision ${revision} to ${output}`)
} finally {
  await browser.close()
}
