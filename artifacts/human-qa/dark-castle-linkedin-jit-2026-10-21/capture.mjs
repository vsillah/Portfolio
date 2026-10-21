import { chromium } from 'playwright'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const output = resolve(root, 'artifacts/human-qa/dark-castle-linkedin-jit-2026-10-21')
const url = 'http://127.0.0.1:5218/admin/social-content/9817a689-0565-48ed-8c97-c2db40c1ec45?qa_fixture=social_campaign_review_assets_v1&rev=03178d07'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []

for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const videoDir = resolve(output, `${name}-source`)
  await mkdir(videoDir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: { width, height } },
  })
  await context.route('**/*', (route) => {
    const target = new URL(route.request().url())
    if (target.hostname === '127.0.0.1' || target.protocol === 'data:' || target.protocol === 'blob:') return route.continue()
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.getByText('JIT refresh required before a current content decision').waitFor({ state: 'visible' })
  const approvalDisabled = await page.getByRole('button', { name: 'Approve Copy' }).isDisabled()
  const rejectDisabled = await page.getByRole('button', { name: 'Reject', exact: true }).isDisabled()
  const visual = page.getByRole('img', { name: /approved gameplay captures/i }).first()
  await visual.scrollIntoViewIfNeeded()
  await page.waitForTimeout(750)
  const visualLoaded = await visual.evaluate((element) => element.complete && element.naturalWidth === 1200)
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  if (!approvalDisabled || !rejectDisabled || !visualLoaded || !noOverflow) throw new Error(`${name}: review gate, image, or width failed ${JSON.stringify({ approvalDisabled, rejectDisabled, visualLoaded, noOverflow })}`)

  await page.keyboard.press('Home')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: resolve(output, `${name}-top.png`) })
  await page.locator('section[aria-label="Dark Castle Chess: Remember the Decision review-only visual packet"]').scrollIntoViewIfNeeded()
  if (name === 'mobile') await page.mouse.wheel(0, -170)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: resolve(output, `${name}-visual.png`) })
  await page.getByText('JIT refresh required before a current content decision').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1800)
  await page.screenshot({ path: resolve(output, `${name}-jit-blocked.png`) })
  await page.getByText('Trace every visible claim').click()
  await page.getByRole('link', { name: 'Explore position capture' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1800)
  await page.screenshot({ path: resolve(output, `${name}-lineage.png`) })
  results.push({ name, width, height, approvalDisabled, rejectDisabled, visualLoaded, noOverflow, url })
  await context.close()
  await rename(await page.video().path(), resolve(output, `${name}.webm`))
}

await browser.close()
await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results))
