import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceCommit = '471bfbaeeea5f5ec37d2ff74ac4a52b59cb68c45'
const baseUrl = 'http://localhost:3187'
const outputDir = path.dirname(fileURLToPath(import.meta.url))
const tempDir = await mkdtemp(path.join(tmpdir(), 'youtube-homepage-preview-'))
const browser = await chromium.launch({ headless: true })

try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({
      viewport: { width, height },
      storageState: { cookies: [], origins: [] },
      recordVideo: { dir: tempDir, size: { width, height } },
    })
    await context.route('**/*', (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() !== 'GET' || !['localhost', '127.0.0.1'].includes(url.hostname)) {
        return route.abort()
      }
      return route.continue()
    })
    const page = await context.newPage()
    await page.goto(`${baseUrl}/?revision=${sourceCommit}`, { waitUntil: 'domcontentloaded' })
    const footer = page.getByRole('contentinfo', { name: 'YouTube API Services' })
    await footer.scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    await footer.screenshot({ path: path.join(outputDir, `homepage-preview-${name}.png`) })
    const privacyLink = footer.getByRole('link', { name: 'Privacy Policy' })
    await privacyLink.focus()
    await page.waitForTimeout(650)
    await page.keyboard.press('Enter')
    await page.getByRole('heading', { name: 'Privacy Policy', exact: true }).waitFor()
    await page.waitForTimeout(850)
    const video = page.video()
    await context.close()
    const webmPath = await video.path()
    const outputPath = path.join(outputDir, `homepage-preview-${name}.mp4`)
    const result = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', webmPath,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath,
    ], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(`MP4 conversion failed: ${result.stderr}`)
    await rename(webmPath, path.join(tempDir, `${name}.webm`))
  }
} finally {
  await browser.close()
  await rm(tempDir, { recursive: true, force: true })
}
