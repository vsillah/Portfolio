import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.ACCELERATED_RELEASE_BASE_URL || 'http://127.0.0.1:4310'
const revision = process.env.ACCELERATED_RELEASE_REVISION || 'local'
const outputDir = path.resolve('docs/qa/accelerated-public-release')

mkdirSync(outputDir, { recursive: true })

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const browser = await chromium.launch({ headless: true })

for (const viewport of viewports) {
  const rawDir = path.join(outputDir, `raw-${viewport.name}`)
  rmSync(rawDir, { recursive: true, force: true })
  mkdirSync(rawDir, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    recordVideo: {
      dir: rawDir,
      size: { width: viewport.width, height: viewport.height },
    },
  })
  const page = await context.newPage()

  await page.goto(`${baseUrl}/?rev=${revision}#services`, { waitUntil: 'networkidle' })
  const flagshipHeading = page.getByRole('heading', { name: 'Flagship workshops' })
  await flagshipHeading.waitFor({ state: 'visible' })
  await flagshipHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.screenshot({
    path: path.join(outputDir, `${viewport.name}-homepage-flagship-workshops.png`),
    fullPage: false,
  })

  await page.goto(`${baseUrl}/services?rev=${revision}`, { waitUntil: 'networkidle' })
  const servicesFlagshipHeading = page.getByRole('heading', { name: 'Flagship workshops' })
  await servicesFlagshipHeading.waitFor({ state: 'visible' })
  await servicesFlagshipHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.screenshot({
    path: path.join(outputDir, `${viewport.name}-services-flagship-workshops.png`),
    fullPage: false,
  })

  await page.goto(`${baseUrl}/?rev=${revision}#publications`, { waitUntil: 'networkidle' })
  const acceleratedHeading = page.getByRole('heading', {
    name: 'Accelerated: Building Smarter Products with AI',
  })
  await acceleratedHeading.waitFor({ state: 'visible' })
  await acceleratedHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.screenshot({
    path: path.join(outputDir, `${viewport.name}-homepage-publication.png`),
    fullPage: false,
  })

  const workshopLink = page.getByRole('link', { name: 'Explore the book and workshop' })
  await workshopLink.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.screenshot({
    path: path.join(outputDir, `${viewport.name}-homepage-workshop-link.png`),
    fullPage: false,
  })
  await workshopLink.click()
  await page.waitForURL(/\/accelerated(?:\?|$)/)
  await page.getByRole('heading', { name: 'Accelerated', exact: true }).waitFor()
  await page.waitForTimeout(1200)
  await page.screenshot({
    path: path.join(outputDir, `${viewport.name}-accelerated-landing.png`),
    fullPage: false,
  })

  await page.mouse.wheel(0, Math.round(viewport.height * 0.75))
  await page.waitForTimeout(1000)
  await page.mouse.wheel(0, -Math.round(viewport.height * 0.75))
  await page.waitForTimeout(700)

  await page.getByRole('link', { name: 'Start the learning plan' }).click()
  await page.waitForURL(/\/accelerated\/learningplan/)
  await page.getByRole('heading', { name: 'Sixteen lessons. One decision file.' }).waitFor()
  await page.waitForTimeout(1200)

  const video = page.video()
  await context.close()
  const recordedPath = await video.path()
  const mp4Path = path.join(outputDir, `${viewport.name}-walkthrough.mp4`)
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    recordedPath,
    '-c:v',
    'libx264',
    '-crf',
    '21',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    mp4Path,
  ])
  execFileSync('ffmpeg', ['-v', 'error', '-i', mp4Path, '-f', 'null', '-'], {
    stdio: 'ignore',
  })
  rmSync(rawDir, { recursive: true, force: true })
}

await browser.close()

console.log(
  JSON.stringify(
    {
      baseUrl,
      revision,
      outputs: readdirSync(outputDir).sort(),
    },
    null,
    2,
  ),
)
