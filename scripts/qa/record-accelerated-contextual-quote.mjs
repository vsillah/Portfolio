// Synthetic, privacy-safe recording. No account session or provider call is used.
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const origin = process.env.QA_ORIGIN || 'http://localhost:3096'
const output = path.join(process.cwd(), 'docs/qa/accelerated-member-commerce')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })

for (const [name, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce',
    recordVideo: { dir: output, size: { width, height } } })
  const page = await context.newPage()
  await page.goto(`${origin}/member/quote?qa=quote&rev=contextual-recording`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Already in your Decision File' }).waitFor()
  await page.waitForTimeout(900)
  await page.locator('fieldset').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.locator('fieldset').first().getByRole('radio', { name: 'Remote' }).check()
  await page.getByRole('heading', { name: 'Current fit' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.getByText(/Why 2 options fell away/).click()
  await page.waitForTimeout(900)
  await page.locator('fieldset').first().getByRole('radio', { name: 'In person' }).check()
  await page.locator('fieldset').filter({ hasText: 'budget range' }).getByRole('radio', { name: 'Under $500' }).check()
  await page.getByRole('heading', { name: 'Current fit' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
  await page.locator('fieldset').first().getByRole('radio', { name: 'Remote' }).check()
  await page.getByRole('heading', { name: 'Current fit' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  const video = page.video()
  await context.close()
  const source = path.join(output, `accelerated-member-${name}-walkthrough.webm`)
  await video.saveAs(source)
  await fs.unlink(await video.path())
  console.log(source)
}
await browser.close()
