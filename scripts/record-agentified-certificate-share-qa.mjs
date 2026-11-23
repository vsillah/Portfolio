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

async function capture(label, width, height, scene, theme, copy = false) {
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
  }
  if (copy) {
    await page.getByRole('button', { name: /Copy (complete message|message to share)/ }).click()
    await page.getByText('Complete message copied. Paste and review it before posting.').waitFor()
  }
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
    await capture('desktop-copied', 1280, 800, 'claimed', 'dark', true),
    await capture('desktop-verified', 1280, 800, 'verified', 'light'),
    await capture('desktop-revoked', 1280, 800, 'revoked', 'dark'),
    await capture('desktop-eligible', 1280, 800, 'eligible', 'light'),
    await capture('desktop-blocked', 1280, 800, 'blocked', 'dark'),
  ]
  const mobile = [
    await capture('mobile-claimed', 390, 844, 'claimed', 'dark'),
    await capture('mobile-copied', 390, 844, 'claimed', 'dark', true),
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
