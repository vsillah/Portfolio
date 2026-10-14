import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3000'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/channel-native-video-review-2026-10-14')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'channel-native-video-review.mp4')
const routes = [
  { key: 'jev', id: 'f966123f-05eb-48ec-a7c2-970afce642ef' },
  { key: 'dark-castle', id: '21c492c2-9279-4e08-afc9-49207935a681' },
]

await mkdir(rawVideoDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: authState,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
const video = page.video()

async function openReview(route, viewportLabel) {
  const url = `${baseUrl}/admin/social-content/${route.id}?step=copy`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const surface = page.getByLabel('YouTube Shorts channel-native video review')
  await surface.waitFor({ state: 'visible' })
  await page.getByText('Video Script', { exact: true }).waitFor({ state: 'visible' })
  if (await page.getByText('LinkedIn Preview', { exact: true }).count()) throw new Error(`${route.key} rendered LinkedIn preview chrome.`)
  if (await surface.getByRole('button', { name: /disabled$/ }).count() !== 6) throw new Error(`${route.key} did not expose all six disabled external actions.`)
  for (const button of await surface.getByRole('button', { name: /disabled$/ }).all()) {
    if (await button.isEnabled()) throw new Error(`${route.key} exposed an enabled external action.`)
  }

  await surface.evaluate((element) => {
    const header = document.querySelector('[data-social-detail-header]')
    const headerHeight = header?.getBoundingClientRect().height ?? 0
    const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 16
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(outputDir, `${route.key}-${viewportLabel}.png`) })
  await surface.getByText('Source lineage and privacy boundaries', { exact: true }).click()
  await surface.getByText('Receipt status', { exact: true }).click()
  const privacyBoundary = surface.getByText(/Privacy boundary:/).first()
  await privacyBoundary.waitFor({ state: 'visible' })
  await privacyBoundary.evaluate((element) => {
    const header = document.querySelector('[data-social-detail-header]')
    const headerHeight = header?.getBoundingClientRect().height ?? 0
    const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 16
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outputDir, `${route.key}-${viewportLabel}-evidence.png`) })

  const decisionQueue = surface.getByRole('link', { name: 'Open canonical Decision Queue' })
  const expectedHref = await decisionQueue.getAttribute('href')
  if (!expectedHref?.startsWith('/admin/agents/coordination?proposal=')) throw new Error(`${route.key} is not routed to the canonical Decision Queue.`)
  await decisionQueue.click()
  await page.waitForURL(/\/admin\/agents\/coordination\?proposal=/)
  await page.goBack({ waitUntil: 'domcontentloaded' })
  await surface.waitFor({ state: 'visible' })
}

for (const route of routes) await openReview(route, 'desktop-1440')

await page.setViewportSize({ width: 390, height: 844 })
for (const route of routes) await openReview(route, 'mobile-390')

await context.close()
await browser.close()

const rawPath = await video?.path()
if (!rawPath) throw new Error('Playwright did not produce a walkthrough video.')
const stableWebmPath = path.join(outputDir, 'channel-native-video-review.webm')
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

console.log(JSON.stringify({ outputDir, mp4Path, routes: routes.map((route) => route.id), viewports: ['1440x900', '390x844'] }, null, 2))
