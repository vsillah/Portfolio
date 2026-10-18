import { copyFile, mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const guard = spawnSync(process.execPath, ['scripts/qa/assert-youtube-thumbnail-human-qa-ready.mjs'], { cwd: root, encoding: 'utf8' })
if (guard.status !== 0) throw new Error(`Human-QA capture blocked: ${guard.stderr || guard.stdout}`)

const output = path.resolve(root, 'artifacts/human-qa/youtube-thumbnail-v5-2026-10-18')
await mkdir(output, { recursive: true })
const revision = process.env.QA_REVISION
if (!revision) throw new Error('QA_REVISION is required')
const origin = process.env.QA_ORIGIN ?? 'http://127.0.0.1:5319'
const targets = [
  ['dark-castle', 'c12378f2-36de-4bf7-8c5d-0ce754e727eb', 'Evidence-ready thumbnail reading REMEMBER THE WHY'],
  ['ai-audit', '3dad4cca-72b7-4705-8fb6-273bf7500ce6', 'Evidence-ready thumbnail reading WHO OWNS THE CLEANUP?'],
]
const urlFor = (id) => `${origin}/admin/social-content/${id}?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=${revision}`

const browser = await chromium.launch({ headless: true })
for (const [name, id, imageName] of targets) {
  for (const viewport of [{ suffix: 'desktop', width: 1440, height: 900 }, { suffix: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
    await page.goto(urlFor(id), { waitUntil: 'networkidle' })
    const gate = page.getByRole('region', { name: 'YouTube thumbnail evidence gate' })
    await gate.waitFor({ state: 'visible' })
    const thumbnail = page.getByRole('img', { name: imageName })
    await thumbnail.waitFor({ state: 'visible' })
    await thumbnail.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, `${name}-${viewport.suffix}.png`) })
    await page.close()
  }
}

const videoDirectory = path.join(output, '.video-source')
await rm(videoDirectory, { recursive: true, force: true })
const videoContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: videoDirectory, size: { width: 1280, height: 720 } } })
const videoPage = await videoContext.newPage()
const video = videoPage.video()
for (const [, id, imageName] of targets) {
  await videoPage.goto(urlFor(id), { waitUntil: 'networkidle' })
  const gate = videoPage.getByRole('region', { name: 'YouTube thumbnail evidence gate' })
  await gate.waitFor({ state: 'visible' })
  const thumbnail = videoPage.getByRole('img', { name: imageName })
  await thumbnail.waitFor({ state: 'visible' })
  await thumbnail.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
  await videoPage.waitForTimeout(3500)
}
await videoPage.close()
await videoContext.close()
const recordedPath = await video.path()
await copyFile(recordedPath, path.join(output, 'youtube-thumbnail-v5-walkthrough.webm'))
await browser.close()
console.log(JSON.stringify({ output, revision, targets: targets.map(([name]) => name) }))
