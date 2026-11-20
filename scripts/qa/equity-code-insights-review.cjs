const assert = require('node:assert/strict')
const { mkdirSync, writeFileSync, unlinkSync } = require('node:fs')
const { join, relative } = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright')

const base = process.env.REVIEW_BASE || 'http://localhost:4173'
const out = join(process.cwd(), 'docs/qa/equity-code-insights')
mkdirSync(out, { recursive: true })

async function pause(page) { await page.waitForTimeout(700) }
async function visitIndex(page) {
  await page.goto(`${base}/insights`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Explore the systems' }).waitFor()
  for (const path of ['revenue-plumbing-map', 'compounding-graph', 'home-front-ledger', 'owning-the-block']) {
    assert.equal(await page.locator(`a[href="/insights/${path}"]`).count(), 1)
  }
  await pause(page)
}

async function inspectWidth(page, label, width, report) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  report.push({ label, ...size })
  assert.equal(size.width, width, `${label} viewport width`)
  assert.ok(size.scroll <= size.width + 1, `${label} has page-level horizontal overflow: ${size.scroll} > ${size.width}`)
}

async function walkthrough(browser, label, viewport, report) {
  const context = await browser.newContext({ viewport, recordVideo: { dir: out, size: viewport } })
  const page = await context.newPage()
  await visitIndex(page)
  await inspectWidth(page, `${label}:index`, viewport.width, report)

  await page.locator('a[href="/insights/compounding-graph"]').click()
  await page.locator('#magrows .magrow').first().waitFor()
  await pause(page)
  await inspectWidth(page, `${label}:graph`, viewport.width, report)
  await page.locator('#colorby button[data-c="impact"]').click()
  assert.equal(await page.locator('#colorby button[data-c="impact"]').getAttribute('aria-pressed'), 'true')
  await page.locator('#magrows .magrow').first().press('Enter')
  assert.notEqual((await page.locator('#panel h2').innerText()).trim(), 'Start at the center')
  await pause(page)
  await page.locator('#chips button').first().click()
  await pause(page)

  await visitIndex(page)
  await page.locator('a[href="/insights/home-front-ledger"]').click()
  await page.locator('#lenses button').first().waitFor()
  await pause(page)
  await inspectWidth(page, `${label}:ledger`, viewport.width, report)
  await page.locator('#lenses button').filter({ hasText: 'Black Americans' }).click()
  await page.locator('#slider').focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('#slider').inputValue(), '1')
  await page.locator('#tab-sources').click()
  assert.equal(await page.locator('#tab-sources').getAttribute('aria-expanded'), 'true')
  assert.ok(await page.locator('#sources a[href^="http"]').count() > 0)
  await pause(page)

  await visitIndex(page)
  await page.locator('a[href="/insights/owning-the-block"]').click()
  await page.locator('#uses button').first().waitFor()
  await pause(page)
  await inspectWidth(page, `${label}:block`, viewport.width, report)
  await page.locator('#cb-hz').click()
  assert.equal(await page.locator('#cb-hz').getAttribute('aria-pressed'), 'true')
  await page.locator('#uses button').first().press('Enter')
  await pause(page)
  await page.locator('#svg .node').first().press('Enter')
  await pause(page)

  await visitIndex(page)
  await context.close()
  return page.video().path()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = []
  try {
    for (const [label, viewport] of [
      ['desktop', { width: 1440, height: 900 }],
      ['mobile', { width: 390, height: 844 }],
    ]) {
      const sourceVideo = await walkthrough(browser, label, viewport, report)
      const video = join(out, `${label}.mp4`)
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', sourceVideo, '-c:v', 'libx264', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video])
      unlinkSync(sourceVideo)
      report.push({ label, video: relative(process.cwd(), video) })
    }
    const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const page = await reduced.newPage()
    for (const path of ['compounding-graph', 'home-front-ledger', 'owning-the-block']) {
      await page.goto(`${base}/insights/${path}`, { waitUntil: 'domcontentloaded' })
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
      report.push({ label: `reduced-motion:${path}`, active: true })
    }
    await reduced.close()
    writeFileSync(join(out, 'review-results.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
