const assert = require('node:assert/strict')
const { mkdirSync, unlinkSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright')

const revision = process.env.REVIEW_REVISION || execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
const base = process.env.REVIEW_BASE || 'http://localhost:4173'
const out = join(process.cwd(), 'docs/qa/insights-return-navigation')
const routes = ['compounding-graph', 'home-front-ledger', 'owning-the-block']
mkdirSync(out, { recursive: true })

async function inspect(page, width, route) {
  await page.goto(`${base}/insights/${route}?rev=${revision}`, { waitUntil: 'domcontentloaded' })
  const nav = page.getByRole('navigation', { name: 'Dashboard navigation' })
  const home = nav.getByRole('link', { name: 'Back to AmaduTown' })
  const all = nav.getByRole('link', { name: 'All insights' })
  await home.waitFor()
  assert.equal(await home.getAttribute('href'), '/')
  assert.equal(await all.getAttribute('href'), '/insights')
  assert.equal(await page.locator('.insight-return-nav').count(), 1)
  const boxes = await page.evaluate(() => {
    const nav = document.querySelector('.insight-return-nav')
    const links = [...nav.querySelectorAll('a')]
    const heading = document.querySelector('h1')
    const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, nav: rect(nav), links: links.map(rect), heading: rect(heading) }
  })
  assert.equal(boxes.width, width)
  assert.ok(boxes.scrollWidth <= width + 1, `${route} ${width}: horizontal overflow`)
  assert.ok(boxes.nav.bottom < boxes.heading.top, `${route} ${width}: navigation overlaps title`)
  for (const box of boxes.links) {
    assert.ok(box.left >= 0 && box.right <= width, `${route} ${width}: clipped link`)
    assert.ok(box.bottom <= boxes.nav.bottom + 1, `${route} ${width}: link outside navigation`)
  }
  const first = boxes.links[0], second = boxes.links[1]
  assert.ok(first.right <= second.left || first.bottom <= second.top, `${route} ${width}: links overlap`)
  await home.focus()
  assert.equal(await home.evaluate(el => el.matches(':focus-visible')), true)
  return { route, width, ...boxes }
}

async function exercise(page, route) {
  if (route === 'compounding-graph') {
    await page.locator('#colorby button[data-c="impact"]').click()
    assert.equal(await page.locator('#colorby button[data-c="impact"]').getAttribute('aria-pressed'), 'true')
    await page.locator('#magrows .magrow').first().click()
    assert.notEqual((await page.locator('#panel h2').innerText()).trim(), 'Start at the center')
  } else if (route === 'home-front-ledger') {
    await page.locator('#lenses button').filter({ hasText: 'Black Americans' }).click()
    await page.locator('#slider').focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.locator('#slider').inputValue(), '1')
  } else {
    await page.locator('#cb-hz').click()
    assert.equal(await page.locator('#cb-hz').getAttribute('aria-pressed'), 'true')
    await page.locator('#uses button').first().click()
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = { revision, base, checks: [], videos: [] }
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
      const record = viewport.width !== 768
      const context = await browser.newContext({ viewport, ...(record ? { recordVideo: { dir: out, size: viewport } } : {}) })
      const page = await context.newPage()
      for (const route of routes) {
        report.checks.push(await inspect(page, viewport.width, route))
        if (record) await page.waitForTimeout(800)
        await exercise(page, route)
        if (record) await page.waitForTimeout(800)
        await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'All insights' }).click()
        await page.getByRole('heading', { name: 'Explore the systems' }).waitFor()
        if (record) await page.waitForTimeout(500)
      }
      await page.goto(`${base}/insights/${routes[0]}?rev=${revision}`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Back to AmaduTown' }).click()
      await page.waitForURL(`${base}/`)
      if (record) await page.waitForTimeout(700)
      const sourceVideo = record ? await page.video().path() : null
      await context.close()
      if (record) {
        const video = join(out, viewport.width === 390 ? 'mobile-390x844.mp4' : 'desktop-1440x900.mp4')
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', sourceVideo, '-c:v', 'libx264', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video])
        unlinkSync(sourceVideo)
        execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1', video])
        report.videos.push(video.replace(`${process.cwd()}/`, ''))
      }
    }
    writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ revision, checks: report.checks.length, videos: report.videos }, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
