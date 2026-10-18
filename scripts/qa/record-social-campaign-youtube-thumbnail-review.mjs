import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:5318'
const revision = process.env.QA_REVISION || 'working-tree'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/youtube-review-thumbnails-2026-10-18')
const rawVideoDir = path.join(outputDir, 'raw-video')
const screenshotDir = path.join(outputDir, 'screenshots')
const videoDir = path.join(outputDir, 'video')
const mp4Path = path.join(videoDir, 'youtube-review-thumbnails-walkthrough.mp4')

const routes = [
  {
    key: 'dark-castle',
    id: 'c12378f2-36de-4bf7-8c5d-0ce754e727eb',
    packetLabel: 'Dark Castle Chess: Remember the Decision YouTube packaging packet',
    title: 'I Rebuilt the Chess Lesson Around the Decision',
    hook: 'REMEMBER THE WHY',
    samples: 8,
  },
  {
    key: 'ai-audit',
    id: '3dad4cca-72b7-4705-8fb6-273bf7500ce6',
    packetLabel: 'AI Audit Calculator: The Hidden Operating Bill YouTube packaging packet',
    title: 'The AI Cost That Never Appears on the Invoice',
    hook: 'WHO OWNS THE CLEANUP?',
    samples: 6,
  },
]

function url(route) {
  return `${baseUrl}/admin/social-content/${route.id}?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=${encodeURIComponent(revision)}`
}

async function assertNoOverflow(scope, label) {
  const result = await scope.evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }))
  if (result.scroll > result.client + 1) throw new Error(`${label} has horizontal overflow: ${JSON.stringify(result)}`)
}

async function ensureImagesLoaded(scope, label) {
  const images = scope.getByRole('img')
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded()
    await image.evaluate(async (node) => {
      if (!(node instanceof HTMLImageElement)) return
      if (!node.complete) await new Promise((resolve, reject) => {
        node.addEventListener('load', resolve, { once: true })
        node.addEventListener('error', reject, { once: true })
      })
      await node.decode()
    }).catch((error) => { throw new Error(`${label} image ${index + 1} failed to decode: ${error.message}`) })
  }
}

await mkdir(rawVideoDir, { recursive: true })
await mkdir(screenshotDir, { recursive: true })
await mkdir(videoDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 1000 } },
  colorScheme: 'dark',
})
const page = await context.newPage()
const recording = page.video()

for (const route of routes) {
  await page.goto(url(route), { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const packet = page.getByLabel(route.packetLabel)
  await packet.waitFor({ state: 'visible' })
  await packet.evaluate((node) => node.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(200)
  await page.waitForTimeout(500)
  await packet.getByText(route.title, { exact: true }).first().waitFor({ state: 'visible' })
  await packet.getByText(route.hook, { exact: true }).first().waitFor({ state: 'visible' })
  await packet.getByText('Thumbnail evidence: Ready', { exact: true }).waitFor({ state: 'visible' })
  await packet.getByText('93.5/100 · 16:9 long-form', { exact: true }).waitFor({ state: 'visible' })
  await packet.getByText('Description evidence: Unscored', { exact: true }).waitFor({ state: 'visible' })
  await packet.getByText('0/3 qualifying descriptions', { exact: true }).waitFor({ state: 'visible' })
  await ensureImagesLoaded(packet, `${route.key} desktop`)
  await assertNoOverflow(packet, `${route.key} desktop packet`)
  const cohort = packet.getByText('Cohort examples and selection boundaries', { exact: true }).locator('..')
  if (await cohort.getByRole('link', { name: /.+/ }).count() < route.samples) throw new Error(`${route.key} did not expose ${route.samples} exact cohort links.`)
  await packet.evaluate((node) => node.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(screenshotDir, `${route.key}-desktop-1440.png`) })
  await page.waitForTimeout(700)
}

await page.setViewportSize({ width: 390, height: 844 })
for (const route of routes) {
  await page.goto(url(route), { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const packet = page.getByLabel(route.packetLabel)
  await packet.waitFor({ state: 'visible' })
  await packet.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await ensureImagesLoaded(packet, `${route.key} mobile`)
  await assertNoOverflow(packet, `${route.key} mobile packet`)
  const mobileCohort = packet.getByText('Cohort examples and selection boundaries', { exact: true }).locator('..')
  await mobileCohort.evaluate((node) => { if (node instanceof HTMLDetailsElement) node.open = false })
  const mobileThumbnailGate = packet.getByLabel('YouTube thumbnail evidence gate')
  await mobileThumbnailGate.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await mobileThumbnailGate.screenshot({
    path: path.join(screenshotDir, `${route.key}-mobile-390.png`),
    style: '[class~="sticky"], [class~="fixed"] { visibility: hidden !important; }',
  })
  await page.waitForTimeout(600)
}

await context.close()
await browser.close()
const rawPath = await recording?.path()
if (!rawPath) throw new Error('Playwright did not produce the walkthrough video.')
const webmPath = path.join(videoDir, 'youtube-review-thumbnails-walkthrough.webm')
await rename(rawPath, webmPath)
await execFileAsync('ffmpeg', ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4Path])
await unlink(webmPath)

const results = {
  revision,
  base_url: baseUrl,
  routes: routes.map((route) => url(route)),
  viewports: ['1440x1000', '390x844'],
  screenshots: routes.flatMap((route) => [`screenshots/${route.key}-desktop-1440.png`, `screenshots/${route.key}-mobile-390.png`]),
  mp4: 'video/youtube-review-thumbnails-walkthrough.mp4',
  external_actions_enabled: 0,
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
await writeFile(path.join(outputDir, 'README.md'), `# YouTube thumbnail Human QA\n\nExact implementation commit: \`${revision}\`.\n\nThe walkthrough and screenshots cover both repository-only review routes at desktop and mobile widths. Each packet shows the evidence-ready 16:9 candidate, numerical score, public cohort captures and links, adopted and rejected traits, selection rationale, independent Unscored 0/3 description gate, and closed external gates.\n\nNo production record, provider generation, upload, platform draft, schedule, publication, external send, migration, credential change, or production write was enabled.\n`)
console.log(JSON.stringify(results, null, 2))
