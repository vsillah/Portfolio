import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

const root = process.cwd()
const output = path.join(root, 'public/showcases/service-prototypes')
const evidence = path.join(root, 'docs/qa/service-prototypes')
const origin = process.env.PROTOTYPE_ORIGIN || 'http://127.0.0.1:5467'
const slugs = ['ai-lead-chatbot', 'lead-workflow-agent', 'website-ux-refresh', 'accelerated-cohort', 'self-paced-course', 'premium-masterclass']
await fs.mkdir(output, { recursive: true })
await fs.mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const manifest = []
async function primeIllustrations(page) {
  for (const image of await page.locator('[data-sam-plate] img').all()) {
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((element) => element.decode())
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}
for (const slug of slugs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  for (let view = 1; view <= 3; view++) {
    const url = `${origin}/service-prototypes/${slug}?view=${view}`
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('[data-prototype]').waitFor()
    if (await page.getByRole('button', { name: 'Light mode' }).isVisible()) await page.getByRole('button', { name: 'Light mode' }).click()
    const raw = await page.screenshot({ animations: 'disabled' })
    const image = path.join(output, `${slug}-${view}.webp`)
    await sharp(raw).webp({ quality: 86 }).toFile(image)
    manifest.push({ slug, view, url, imageUrl: `/showcases/service-prototypes/${slug}-${view}.webp`, source: `Rendered local interactive route at ${url}`, width: 1440, height: 900 })
  }
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${origin}/service-prototypes/${slug}?view=1`, { waitUntil: 'networkidle' })
    await primeIllustrations(page)
    await page.screenshot({ path: path.join(evidence, `${slug}-${width}.png`), fullPage: true, animations: 'disabled' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) throw new Error(`${slug} overflows at ${width}px`)
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${origin}/service-prototypes/${slug}?view=1`, { waitUntil: 'networkidle' })
    if (await page.getByRole('button', { name: 'Dark mode' }).isVisible()) await page.getByRole('button', { name: 'Dark mode' }).click()
    await primeIllustrations(page)
    const darkCapture = await page.screenshot({ fullPage: true, animations: 'disabled' })
    await sharp(darkCapture).webp({ quality: 88 }).toFile(path.join(evidence, `${slug}-${width}-dark.webp`))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) throw new Error(`${slug} overflows in dark mode at ${width}px`)
  }
  await page.close()
}
await fs.writeFile(path.join(evidence, 'capture-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
await browser.close()
console.log(`Captured ${manifest.length} gallery frames, plus mobile and tablet evidence for ${slugs.length} routes.`)
