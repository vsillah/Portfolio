import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4312'
const revision = process.env.QA_REVISION || 'working-tree'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/facebook-comment-refresh-selector-2026-11-19')
const rawVideoDir = path.join(outputDir, 'raw-video')
const contentId = 'afe74739-e547-4714-8840-3ff5792c4ccc'
const facebookPublishId = 'd8a8bb5b-dd1d-4e4b-8568-64917fbb1f3a'
const route = `${baseUrl}/admin/social-content/${contentId}?qa_fixture=facebook_comment_refresh_v1&facebook_canary=20261119&rev=${encodeURIComponent(revision)}&step=status`
const viewports = [
  { label: 'desktop-1440', width: 1440, height: 900 },
  { label: 'mobile-390', width: 390, height: 844 },
]

await mkdir(rawVideoDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const outputs = []

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    recordVideo: {
      dir: path.join(rawVideoDir, viewport.label),
      size: { width: viewport.width, height: viewport.height },
    },
  })
  const page = await context.newPage()
  const video = page.video()
  const writes = []
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`)
  })

  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const panel = page.getByRole('heading', { name: 'Comment response panel' })
  await panel.waitFor({ state: 'visible' })
  await panel.evaluate((element) => {
    element.scrollIntoView({ block: 'start', behavior: 'instant' })
    const scrollParent = element.closest('[data-admin-scroll-container]')
    if (scrollParent instanceof HTMLElement) scrollParent.scrollTop = Math.max(0, scrollParent.scrollTop - 72)
  })

  const destination = page.getByLabel('Published destination for comment refresh')
  const limit = page.getByLabel('Comment limit')
  const refresh = page.getByRole('button', { name: 'Refresh comments' })
  if (await refresh.isEnabled()) throw new Error(`${viewport.label}: refresh must start disabled for an ambiguous multi-platform item.`)
  await page.waitForTimeout(900)
  await destination.selectOption(facebookPublishId)
  await limit.selectOption('5')
  if (!(await refresh.isEnabled())) throw new Error(`${viewport.label}: refresh did not enable after the exact Facebook destination was selected.`)
  await page.getByText(/Selected: Facebook/).waitFor({ state: 'visible' })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: path.join(outputDir, `${viewport.label}.png`), fullPage: false })

  if (writes.length) throw new Error(`${viewport.label}: unexpected write requests: ${writes.join(', ')}`)

  await context.close()
  const rawPath = await video?.path()
  if (!rawPath) throw new Error(`${viewport.label}: Playwright did not produce a walkthrough video.`)
  const stableWebmPath = path.join(outputDir, `${viewport.label}.webm`)
  const mp4Path = path.join(outputDir, `${viewport.label}.mp4`)
  await rename(rawPath, stableWebmPath)
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', stableWebmPath,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    mp4Path,
  ])
  outputs.push({ viewport: `${viewport.width}x${viewport.height}`, screenshot: `${viewport.label}.png`, mp4: `${viewport.label}.mp4` })
}

await browser.close()
console.log(JSON.stringify({ route, revision, outputDir, outputs, externalEffects: 'none' }, null, 2))
