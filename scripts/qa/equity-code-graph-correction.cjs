const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdirSync, unlinkSync, writeFileSync } = require('node:fs')
const { join, relative } = require('node:path')
const { chromium } = require('playwright')

const base = process.env.REVIEW_BASE || 'http://localhost:4173'
const output = join(process.cwd(), 'docs/qa/equity-code-insights')
mkdirSync(output, { recursive: true })

async function measureLabels(page) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame) })
  return page.evaluate(() => {
    const svg = document.querySelector('#g')
    const nodes = [...svg.querySelectorAll('.node')]
    const bounds = (element) => {
      const b = element.getBBox()
      return { l: b.x, t: b.y, r: b.x + b.width, b: b.y + b.height }
    }
    const overlaps = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5
    const labels = nodes.flatMap((node) => [...node.querySelectorAll('text')].map((text) => ({
      id: node.getAttribute('data-id'), box: bounds(text),
    })))
    const circles = nodes.map((node) => ({ id: node.getAttribute('data-id'), box: bounds(node.querySelector('circle')) }))
    const spokes = [...svg.querySelectorAll('.spoke')].map(bounds)
    const viewBox = svg.viewBox.baseVal
    let labelLabel = 0, labelCircle = 0, labelSpoke = 0, clipped = 0
    labels.forEach((label, i) => {
      for (let j = i + 1; j < labels.length; j++) if (labels[j].id !== label.id && overlaps(label.box, labels[j].box)) labelLabel++
      circles.forEach((circle) => { if (circle.id !== label.id && overlaps(label.box, circle.box)) labelCircle++ })
      spokes.forEach((spoke) => { if (overlaps(label.box, spoke)) labelSpoke++ })
      if (label.box.l < viewBox.x || label.box.t < viewBox.y || label.box.r > viewBox.x + viewBox.width || label.box.b > viewBox.y + viewBox.height) clipped++
    })
    return { nodes: nodes.length, labelLabel, labelCircle, labelSpoke, clipped, viewBox: [viewBox.x, viewBox.y, viewBox.width, viewBox.height] }
  })
}

async function record(browser, label, viewport) {
  const context = await browser.newContext({ viewport, recordVideo: { dir: output, size: viewport } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/insights?review=graph-correction`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Explore the systems' }).waitFor()
  await page.waitForTimeout(1100)
  await page.locator('a[href="/insights/compounding-graph"]').click()
  await page.locator('#g .node').first().waitFor()
  const initial = await measureLabels(page)
  assert.equal(initial.nodes, 35)
  for (const key of ['labelLabel', 'labelCircle', 'labelSpoke', 'clipped']) assert.equal(initial[key], 0, `${label} ${key}`)
  const width = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }))
  assert.equal(width.viewport, viewport.width)
  assert.ok(width.page <= width.viewport + 1, `${label} page overflow`)
  await page.locator('#g').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)

  await page.locator('#colorby button[data-c="impact"]').click()
  assert.equal(await page.locator('#colorby button[data-c="impact"]').getAttribute('aria-pressed'), 'true')
  await page.locator('#g .node').nth(12).press('Enter')
  assert.notEqual((await page.locator('#panel h2').innerText()).trim(), 'Start at the center')
  await page.waitForTimeout(1200)
  await page.locator('#colorby button[data-c="status"]').click()
  await page.waitForTimeout(900)

  await page.locator('#magrows .magrow').filter({ hasText: 'USDA lending discrimination' }).press('Enter')
  await page.waitForTimeout(1100)
  await page.locator('#chips button').first().click()
  await page.waitForTimeout(1100)
  await page.locator('#scrub').focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
  await page.locator('details').filter({ hasText: 'Sources for the figures' }).locator('summary').click()
  await page.waitForTimeout(1100)

  const after = await measureLabels(page)
  for (const key of ['labelLabel', 'labelCircle', 'labelSpoke', 'clipped']) assert.equal(after[key], 0, `${label} after interaction ${key}`)
  assert.deepEqual(errors, [], `${label} page errors`)
  await context.close()
  const sourceVideo = await page.video().path()
  const video = join(output, `${label}-graph-correction.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', sourceVideo, '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video])
  unlinkSync(sourceVideo)
  return { label, viewport, width, initial, after, video: relative(process.cwd(), video) }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const results = []
    for (const [label, viewport] of [
      ['desktop', { width: 1440, height: 900 }],
      ['mobile', { width: 390, height: 844 }],
    ]) results.push(await record(browser, label, viewport))
    writeFileSync(join(output, 'graph-correction-results.json'), JSON.stringify(results, null, 2) + '\n')
    console.log(JSON.stringify(results, null, 2))
  } finally { await browser.close() }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
