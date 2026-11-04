import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const revision = process.env.REVISION
if (!revision || !/^[0-9a-f]{40}$/.test(revision)) throw new Error('Set REVISION to the exact source commit')
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3105'
const output = resolve('docs/qa/accelerated-l01-approved-binding/walkthrough.mp4')
const temporary = mkdtempSync(join(tmpdir(), 'accelerated-l01-qa-'))
mkdirSync(dirname(output), { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: temporary, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
await page.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname
  return ['localhost', '127.0.0.1'].includes(host) ? route.continue() : route.abort()
})
await page.goto(`${base}/service-prototypes/accelerated-cohort?view=3&rev=${revision}`)
await page.getByRole('heading', { name: 'Sixteen lessons. One decision file.' }).waitFor()
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Watch L01 guided video · 09:00' }).click()
const video = page.getByLabel('L01 Build smarter, stay human guided video')
await video.waitFor()
await page.waitForTimeout(900)
await video.evaluate(async (element) => { await (element).play() })
await page.waitForTimeout(2600)
await page.getByRole('button', { name: 'English captions on' }).click()
await page.waitForTimeout(450)
await page.getByRole('button', { name: 'English captions off' }).click()
await video.evaluate((element) => { element.currentTime = 248.5 })
await page.waitForTimeout(1300)
await video.evaluate((element) => { element.pause() })
await page.getByText('Read along with L01 transcript').click()
await page.waitForTimeout(2000)
await page.getByRole('button', { name: /Return to Learning plan/ }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: /^L02:/ }).click()
await page.getByRole('button', { name: /Watch L02 guided video/ }).waitFor()
await page.waitForTimeout(1500)
await page.getByRole('button', { name: /^L16:/ }).click()
await page.getByRole('button', { name: /Watch L16 guided video/ }).waitFor()
await page.waitForTimeout(1400)

await context.close()
const source = await page.video().path()
await browser.close()
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', output])
console.log(output)
