import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.SERVICES_GALLERY_BASE_URL || 'http://127.0.0.1:4312'
const revision = process.env.SERVICES_GALLERY_REVISION || 'local'
const outputDir = path.resolve('docs/qa/services-gallery-parity')
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const viewport of viewports) {
  const rawDir = path.join(outputDir, `raw-${viewport.name}`)
  rmSync(rawDir, { recursive: true, force: true })
  mkdirSync(rawDir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    recordVideo: { dir: rawDir, size: { width: viewport.width, height: viewport.height } },
  })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/services?rev=${revision}`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'AI Customer Support Chatbot' }).waitFor()

  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < pageHeight; y += Math.round(viewport.height * 0.72)) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(300)
  const pendingCount = await page.getByText('Service visual pending', { exact: true }).count()
  if (pendingCount !== 0) throw new Error(`${viewport.name}: ${pendingCount} service cards still show pending visuals`)

  const firstService = page.getByRole('heading', { name: 'AI Customer Support Chatbot' })
  await firstService.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-service-grid.png`) })

  await page.getByRole('link', { name: 'View details' }).first().click()
  await page.waitForURL(/\/services\/[0-9a-f-]+/)
  await page.getByRole('heading', { name: 'AI Customer Support Chatbot' }).waitFor()
  await page.waitForTimeout(500)
  const visibleGalleryImages = await page.locator('img').evaluateAll((images) =>
    images.filter((image) => image.getBoundingClientRect().width > 200 && image.naturalWidth > 0).length,
  )
  if (visibleGalleryImages === 0) throw new Error(`${viewport.name}: service detail gallery did not load an image`)
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-service-detail.png`) })

  const video = page.video()
  await context.close()
  const recordedPath = await video.path()
  const mp4Path = path.join(outputDir, `${viewport.name}-walkthrough.mp4`)
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', recordedPath,
    '-c:v', 'libx264', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4Path,
  ])
  execFileSync('ffmpeg', ['-v', 'error', '-i', mp4Path, '-f', 'null', '-'], { stdio: 'ignore' })
  rmSync(rawDir, { recursive: true, force: true })
}

await browser.close()
console.log(JSON.stringify({ baseUrl, revision, outputs: readdirSync(outputDir).sort() }, null, 2))
