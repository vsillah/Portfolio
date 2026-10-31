import { execFileSync } from 'node:child_process'
import { mkdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const outputDir = dirname(fileURLToPath(import.meta.url))
const rawDir = join(outputDir, 'raw')
const reviewUrl = process.env.REVIEW_URL ?? 'http://127.0.0.1:3231/admin/social-content/dark-castle-youtube-master-review?rev=eec10fc8#thumbnail-heading'

mkdirSync(rawDir, { recursive: true })

const browser = await chromium.launch({ headless: true })

async function capture(name, viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: 'dark',
    recordVideo: { dir: rawDir, size: viewport },
  })
  const page = await context.newPage()
  await page.goto(reviewUrl, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Review the thumbnail directions' }).scrollIntoViewIfNeeded()
  await page.getByText('Direction C approved', { exact: true }).waitFor()
  await page.waitForTimeout(900)

  await page.getByTestId('thumbnail-option-B').click()
  await page.getByText('Previewing direction B', { exact: true }).waitFor()
  await page.getByText(/Approved direction remains C/i).waitFor()
  await page.waitForTimeout(1200)

  await page.getByTestId('thumbnail-option-C').click()
  await page.getByText('Direction C approved', { exact: true }).waitFor()
  await page.waitForTimeout(1200)

  await page.screenshot({ path: join(outputDir, `${name}.png`), fullPage: false })
  const video = page.video()
  await context.close()
  const webm = await video.path()
  const mp4 = join(outputDir, `${name}.mp4`)
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', webm,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
  ])
  unlinkSync(webm)
}

await capture('desktop', { width: 1440, height: 900 })
await capture('mobile', { width: 390, height: 844 })
await browser.close()
