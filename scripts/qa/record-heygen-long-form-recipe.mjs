import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3127'
const revision = process.env.QA_REVISION || 'working-tree'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/heygen-long-form-recipe-2026-10-17')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'heygen-long-form-recipe-review.mp4')
const route = `/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2&rev=${encodeURIComponent(revision)}`

await mkdir(rawVideoDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

async function openReview(viewport, colorScheme, recordVideo = false) {
  const blockedExternalRequests = []
  const context = await browser.newContext({
    viewport,
    colorScheme,
    deviceScaleFactor: 1,
    ...(recordVideo ? { recordVideo: { dir: rawVideoDir, size: viewport } } : {}),
  })
  const page = await context.newPage()
  const video = page.video()
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(requestUrl.hostname) && !['data:', 'blob:'].includes(requestUrl.protocol)) {
      blockedExternalRequests.push(route.request().url())
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })

  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  const panel = page.getByRole('region', { name: 'HeyGen long-form production recipe' })
  await panel.waitFor({ state: 'visible' })
  await panel.getByRole('button', { name: 'Provider generation locked' }).waitFor({ state: 'visible' })
  if (await panel.getByRole('button', { name: 'Provider generation locked' }).isEnabled()) throw new Error('Provider generation became enabled in a review-only fixture.')
  if (!await panel.getByText(/account capability, duration, and credits must be verified/i).isVisible()) throw new Error('The unverified account-capability blocker is not visible.')

  await panel.evaluate((element) => {
    let parent = element.parentElement
    while (parent) {
      const style = window.getComputedStyle(parent)
      if (parent.scrollHeight > parent.clientHeight && ['auto', 'scroll'].includes(style.overflowY)) {
        const parentTop = parent.getBoundingClientRect().top
        parent.scrollTop += element.getBoundingClientRect().top - parentTop - 88
        return
      }
      parent = parent.parentElement
    }
    window.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - 88), behavior: 'instant' })
  })
  await page.waitForTimeout(250)
  const viewportCheck = await panel.evaluate((element) => ({
    panelWidth: element.getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }))
  const label = `${viewport.width}x${viewport.height}-${colorScheme}`
  await page.screenshot({ path: path.join(outputDir, `${label}.png`) })

  if (recordVideo) {
    await panel.getByLabel('Review override').first().selectOption('look:sand-workshop')
    await page.waitForTimeout(500)
    await panel.getByLabel('Review override').nth(1).selectOption('environment:product-wall')
    await page.waitForTimeout(500)
    await panel.getByText('Scene, evidence, and packaging plan', { exact: true }).click()
    await panel.getByText('Scene timing', { exact: true }).waitFor({ state: 'visible' })
    await page.waitForTimeout(800)
    await panel.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(outputDir, `${label}-expanded.png`) })
  }

  results.push({ label, viewport, colorScheme, viewportCheck, blockedExternalRequests })
  await context.close()
  return video ? await video.path() : null
}

await openReview({ width: 1440, height: 900 }, 'dark')
await openReview({ width: 768, height: 900 }, 'no-preference')
await openReview({ width: 390, height: 844 }, 'light')
const rawVideoPath = await openReview({ width: 1280, height: 800 }, 'dark', true)

await browser.close()

if (!rawVideoPath) throw new Error('Playwright did not produce a walkthrough video.')
const stableWebmPath = path.join(outputDir, 'heygen-long-form-recipe-review.webm')
await rename(rawVideoPath, stableWebmPath)
await execFileAsync('ffmpeg', [
  '-y',
  '-i', stableWebmPath,
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  mp4Path,
])
await unlink(stableWebmPath)
await rmdir(rawVideoDir).catch(() => undefined)

const report = {
  generated_at: new Date().toISOString(),
  revision,
  route,
  provider_calls: 0,
  external_requests: [],
  blocked_external_requests: [...new Set(results.flatMap((result) => result.blockedExternalRequests))],
  viewports: results,
  mp4: path.relative(process.cwd(), mp4Path),
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(report, null, 2)}\n`)

if (report.blocked_external_requests.some((url) => /heygen|api\.heygen/i.test(url))) throw new Error(`The review attempted a blocked provider request: ${report.blocked_external_requests.join(', ')}`)
if (results.some((result) => result.viewportCheck.documentScrollWidth > result.viewportCheck.viewportWidth)) throw new Error('Horizontal overflow detected in a captured viewport.')

console.log(JSON.stringify(report, null, 2))
