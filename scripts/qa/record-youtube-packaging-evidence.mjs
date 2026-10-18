import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3128'
const revision = process.env.QA_REVISION || 'working-tree'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/youtube-packaging-evidence-2026-10-18')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'youtube-packaging-evidence-walkthrough.mp4')
const route = '/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef'
const shared = `step=visuals&review=mobile&qa_fixture=channel_native_video_v2&video_package_state=ready&rev=${encodeURIComponent(revision)}`
const boundUrl = `${baseUrl}${route}?${shared}&packaging_state=bound`
const missingUrl = `${baseUrl}${route}?${shared}&packaging_state=missing_thumbnail`

await mkdir(rawVideoDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: authState,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } },
  colorScheme: 'dark',
})
const page = await context.newPage()
const recording = page.video()
const savedState = JSON.parse(await readFile(authState, 'utf8'))
const savedLocalStorage = savedState.origins?.flatMap((entry) => entry.localStorage ?? []) ?? []
await page.addInitScript((entries) => {
  for (const entry of entries) localStorage.setItem(entry.name, entry.value)
}, savedLocalStorage)

async function noOverflow(label) {
  const result = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  if (result.scroll > result.client + 1) throw new Error(`${label} has horizontal overflow: ${JSON.stringify(result)}`)
}

async function load(url, expectedStatus) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const packaging = page.getByLabel('YouTube Shorts packaging evidence')
  await packaging.waitFor({ state: 'visible' })
  await packaging.scrollIntoViewIfNeeded()
  await page.waitForTimeout(350)
  await packaging.getByRole('status').filter({ hasText: expectedStatus }).waitFor({ state: 'visible' })
  if (await page.getByText('LinkedIn Preview', { exact: true }).count()) throw new Error('YouTube packaging fixture rendered LinkedIn preview chrome.')
  return packaging
}

let packaging = await load(boundUrl, 'Asset-package evidence ready')
await noOverflow('desktop bound')
await packaging.getByText('AI Scored It. Who Makes the Call?', { exact: true }).first().waitFor({ state: 'visible' })
await packaging.getByText('AI SCORED IT. / WHO DECIDES?', { exact: true }).first().waitFor({ state: 'visible' })
await packaging.getByAltText(/YouTube Shorts bound thumbnail/).waitFor({ state: 'visible' })
await page.screenshot({ path: path.join(outputDir, 'jev-packaging-bound-desktop-1440.png'), fullPage: true })

await packaging.getByText('Title evidence', { exact: true }).click()
await packaging.getByText('Formula and decision logic', { exact: true }).first().waitFor({ state: 'visible' })
await packaging.getByText('Thumbnail evidence', { exact: true }).click()
await packaging.getByText('Visual-neighbor comparison and source map', { exact: true }).click()
const cohort = packaging.getByTestId('youtube-thumbnail-research-cohort')
await cohort.getByText('9:16 candidate · 3 first-party · 2 public comparators', { exact: true }).waitFor({ state: 'visible' })
await cohort.getByText('Jev 9:16 candidate', { exact: true }).waitFor({ state: 'visible' })
if (await cohort.getByRole('link', { name: /Public Short:/ }).count() !== 2) throw new Error('The rendered comparison did not expose exactly two score-qualified public Short links.')
const evidenceHrefs = await cohort.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
if (evidenceHrefs.some((href) => !href || !/^https?:\/\//.test(href))) throw new Error(`Evidence links must be absolute and openable: ${JSON.stringify(evidenceHrefs)}`)
await page.screenshot({ path: path.join(outputDir, 'jev-packaging-cohort-desktop-1440.png'), fullPage: true })
await page.waitForTimeout(700)

packaging = await load(missingUrl, 'Asset package blocked')
await noOverflow('desktop missing thumbnail')
await packaging.getByRole('img', { name: 'YouTube Shorts thumbnail missing' }).waitFor({ state: 'visible' })
const blockerText = await packaging.getByRole('alert').innerText()
if (!blockerText.includes('Thumbnail evidence is missing its actual bound review asset.')) {
  throw new Error(`Missing-thumbnail recovery copy was not rendered: ${blockerText}`)
}
await page.screenshot({ path: path.join(outputDir, 'jev-packaging-missing-thumbnail-desktop-1440.png'), fullPage: true })
await page.waitForTimeout(700)

await page.setViewportSize({ width: 390, height: 844 })
packaging = await load(boundUrl, 'Asset-package evidence ready')
await noOverflow('mobile bound')
await page.screenshot({ path: path.join(outputDir, 'jev-packaging-bound-mobile-390.png'), fullPage: true })
await page.waitForTimeout(700)

packaging = await load(missingUrl, 'Asset package blocked')
await noOverflow('mobile missing thumbnail')
await packaging.getByRole('img', { name: 'YouTube Shorts thumbnail missing' }).waitFor({ state: 'visible' })
await page.screenshot({ path: path.join(outputDir, 'jev-packaging-missing-thumbnail-mobile-390.png'), fullPage: true })
await page.waitForTimeout(700)

await context.close()
await browser.close()
const rawPath = await recording?.path()
if (!rawPath) throw new Error('Playwright did not produce a packaging walkthrough video.')
const webmPath = path.join(outputDir, 'youtube-packaging-evidence-walkthrough.webm')
await rename(rawPath, webmPath)
await execFileAsync('ffmpeg', ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4Path])
await unlink(webmPath)

const results = {
  revision,
  baseUrl,
  boundUrl,
  missingUrl,
  screenshots: [
    'jev-packaging-bound-desktop-1440.png',
    'jev-packaging-cohort-desktop-1440.png',
    'jev-packaging-missing-thumbnail-desktop-1440.png',
    'jev-packaging-bound-mobile-390.png',
    'jev-packaging-missing-thumbnail-mobile-390.png',
  ],
  mp4: path.basename(mp4Path),
  viewports: ['1440x900', '390x844'],
  externalActionsEnabled: 0,
}
await writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
console.log(JSON.stringify(results, null, 2))
