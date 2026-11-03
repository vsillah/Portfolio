import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const output = path.join(process.cwd(), 'docs/qa/service-prototypes')
const origin = process.env.PROTOTYPE_ORIGIN || 'http://127.0.0.1:5467'
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: output, size: { width: 1280, height: 800 } } })
const page = await context.newPage()
for (const slug of ['ai-lead-chatbot', 'lead-workflow-agent', 'website-ux-refresh', 'accelerated-cohort', 'self-paced-course', 'premium-masterclass']) {
  await page.goto(`${origin}/service-prototypes/${slug}?view=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1100)
  const tabs = page.getByRole('navigation', { name: 'Experience views' }).getByRole('button')
  await tabs.nth(1).click()
  await page.waitForTimeout(1000)
  await tabs.nth(2).click()
  await page.waitForTimeout(1000)
}
const video = page.video()
await context.close()
await video.saveAs(path.join(output, 'service-prototypes-source.webm'))
await fs.unlink(await video.path())
await browser.close()
console.log(path.join(output, 'service-prototypes-source.webm'))
