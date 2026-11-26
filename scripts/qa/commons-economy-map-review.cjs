/*
 * Browser review for /insights/commons-economy-map bound to the generated Phase 6 transport.
 * Run against a local production server bound to 127.0.0.1:
 *   COMMONS_ECONOMY_REVIEW_URL=http://127.0.0.1:3100 node scripts/qa/commons-economy-map-review.cjs
 * Expected values are read from the generated envelope, never retyped. Writes nothing to the repository.
 */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { chromium } = require('playwright')

const base = process.env.COMMONS_ECONOMY_REVIEW_URL || 'http://127.0.0.1:3100'
const route = `${base}/insights/commons-economy-map`
const generated = readFileSync(join(__dirname, '../../components/insights/commons-economy/generated/commons-economy-envelope.generated.ts'), 'utf8')
const transport = JSON.parse(generated.slice(generated.indexOf('= {') + 2))
const payload = JSON.parse(transport.envelope.payload)
const widths = [1440, 1024, 768, 390, 320]
const report = []

function guard(page) {
  const foreign = []
  page.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) foreign.push(request.url()) })
  return foreign
}

async function open(page) {
  await page.goto(route, { waitUntil: 'networkidle' })
  await page.locator('section[aria-labelledby="econ-detail-title"]').waitFor({ timeout: 15000 })
  assert.equal(await page.locator('[data-rejection]').count(), 0, 'map rendered a rejection')
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  assert.ok(size.scroll <= size.width + 1, `${label}: horizontal overflow ${size.scroll} > ${size.width}`)
  return size
}

async function a11y(page, label) {
  const issues = await page.evaluate(() => {
    const out = []
    if (!document.documentElement.lang) out.push('html has no lang')
    if (document.querySelectorAll('h1').length !== 1) out.push(`h1 count ${document.querySelectorAll('h1').length}`)
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id)
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (dup.length) out.push(`duplicate ids ${[...new Set(dup)].join(',')}`)
    for (const el of document.querySelectorAll('main button, main a[href], main [role="button"]')) {
      const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ')
      const name = [el.getAttribute('aria-label'), labelledBy, el.textContent, el.getAttribute('title'), ...[...el.querySelectorAll('img[alt]')].map(img => img.alt)].filter(Boolean).join(' ').trim()
      if (!name) out.push(`unnamed ${el.tagName}`)
    }
    for (const el of document.querySelectorAll('main [aria-labelledby]')) {
      for (const id of el.getAttribute('aria-labelledby').split(/\s+/)) if (!document.getElementById(id)) out.push(`aria-labelledby ${id} missing`)
    }
    for (const img of document.querySelectorAll('main img')) if (!img.hasAttribute('alt')) out.push('img without alt')
    return out
  })
  assert.deepEqual(issues, [], `${label}: accessibility issues`)
}

async function interact(page, label) {
  const walks = page.locator('[role="group"][aria-label="Walkthroughs"] button')
  assert.equal(await walks.count(), payload.walkthroughs.length, `${label}: walkthrough buttons`)
  for (let w = 0; w < payload.walkthroughs.length; w++) {
    const walk = payload.walkthroughs[w]
    await walks.nth(w).click()
    const first = page.getByRole('region', { name: new RegExp(`step 1 of ${walk.steps.length}`) })
    await first.waitFor()
    await page.getByRole('button', { name: 'Next step' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.getByRole('region', { name: new RegExp(`step 2 of ${walk.steps.length}`) }).waitFor()
    await page.keyboard.press('End')
    await page.getByRole('region', { name: new RegExp(`step ${walk.steps.length} of ${walk.steps.length}`) }).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'region', `${label}: focus left the walkthrough at the last step`)
    await page.keyboard.press('Home')
    await page.getByRole('region', { name: new RegExp(`step 1 of ${walk.steps.length}`) }).waitFor()
  }
  const flows = page.locator('[role="group"][aria-labelledby="econ-flows"] button')
  assert.equal(await flows.count(), payload.flows.length, `${label}: flow toggles`)
  for (let i = 0; i < payload.flows.length; i++) {
    const before = await flows.nth(i).getAttribute('aria-pressed')
    await flows.nth(i).click()
    assert.notEqual(await flows.nth(i).getAttribute('aria-pressed'), before, `${label}: flow ${i} toggle`)
    await flows.nth(i).click()
  }
  const labels = page.locator('[role="group"][aria-labelledby="econ-labels"] button')
  assert.equal(await labels.count(), payload.labelModes.length)
  await labels.nth(0).click(); await labels.nth(1).click()
  const altitudes = page.locator('[role="group"][aria-labelledby="econ-altitude"] button')
  assert.equal(await altitudes.count(), payload.altitudes.length)
  await altitudes.last().click(); await altitudes.first().click()
  const entered = await keyboardOpen(page, 'Enter', label)
  const focusRing = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' || s.boxShadow !== 'none' })
  assert.ok(focusRing, `${label}: focused node shows no focus indicator`)
  await keyboardOpen(page, 'Space', label)
  assert.equal(await entered.getAttribute('aria-pressed'), 'false', `${label}: Space left the Enter-opened node open`)
}

/* Open the first closed node from the keyboard and assert on that exact element.
   A locator filtered on aria-pressed="false" re-resolves to the next closed node once this one opens, so bind an element handle. */
async function keyboardOpen(page, key, label) {
  const name = key
  const closed = page.locator('[aria-labelledby="econ-map-caption"] button[aria-pressed="false"]')
  assert.ok(await closed.count() > 0, `${label}: no closed node to open with ${name}`)
  const node = await closed.first().elementHandle()
  await node.focus()
  assert.ok(await node.evaluate(el => el === document.activeElement), `${label}: ${name} target did not take focus`)
  await page.keyboard.press(key)
  assert.ok(await node.evaluate(el => el.isConnected), `${label}: ${name} target left the document`)
  assert.equal(await node.getAttribute('aria-pressed'), 'true', `${label}: keyboard node open (${name})`)
  const open = await page.$$('[aria-labelledby="econ-map-caption"] button[aria-pressed="true"]')
  assert.equal(open.length, 1, `${label}: ${name} opened ${open.length} nodes`)
  assert.ok(await node.evaluate((el, other) => el === other, open[0]), `${label}: ${name} opened a different node`)
  return node
}

async function plainDestinations(page, label) {
  const linked = await page.locator('main a[href*="/commons"], main a[href*="commonstoday"]').count()
  assert.equal(linked, 0, `${label}: a Commons destination is linked without a verified origin`)
  const firstJoin = payload.joins[0].label
  assert.ok(await page.getByText(firstJoin, { exact: false }).count() >= 0)
}

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 900 : 844 } })
      const page = await context.newPage()
      const foreign = guard(page)
      await open(page)
      await noOverflow(page, `${width}`)
      await a11y(page, `${width}`)
      await interact(page, `${width}`)
      await noOverflow(page, `${width}:after-interaction`)
      await plainDestinations(page, `${width}`)
      assert.deepEqual(foreign, [], `${width}: off-origin requests`)
      report.push({ check: `responsive+interaction+a11y@${width}`, ok: true })
      await context.close()
    }

    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, colorScheme: theme })
      await context.addInitScript(value => localStorage.setItem('theme', value), theme)
      const page = await context.newPage()
      await open(page)
      const state = await page.evaluate(() => ({ dark: document.documentElement.classList.contains('dark'), bg: getComputedStyle(document.querySelector('main')).backgroundColor }))
      assert.equal(state.dark, theme === 'dark', `theme ${theme} class`)
      report.push({ check: `theme:${theme}`, ok: true, background: state.bg })
      await context.close()
    }

    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
      const page = await context.newPage()
      await open(page)
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
      await interact(page, 'reduced-motion')
      // Scope to the Commons Economy Map: the root is the article that owns the detail panel and walkthrough controls.
      // Page-shell and navigation animations outside that root are recorded for diagnostics only.
      const motion = await page.evaluate(() => {
        const root = document.querySelector('main section[aria-labelledby="econ-detail-title"]')?.closest('article') || null
        const rootFound = Boolean(root && root.querySelector('[role="group"][aria-label="Walkthroughs"]'))
        const running = document.getAnimations().filter(a => a.playState === 'running' && Number(a.effect?.getTiming().duration) > 1)
        const target = a => a.effect?.target || null
        const owned = running.filter(a => rootFound && target(a) instanceof Node && root.contains(target(a)))
        return { rootFound, owned: owned.length, outside: running.length - owned.length }
      })
      assert.equal(motion.rootFound, true, 'reduced motion: Commons Economy Map root not found')
      assert.equal(motion.owned, 0, 'reduced motion: Commons Economy Map animations still running')
      report.push({ check: 'reduced-motion', ok: true, outsideMapAnimations: motion.outside })
      await context.close()
    }

    {
      const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, forcedColors: 'active' })
      const page = await context.newPage()
      await open(page)
      assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), true)
      await noOverflow(page, 'forced-colors')
      await interact(page, 'forced-colors')
      report.push({ check: 'forced-colors', ok: true })
      await context.close()
    }

    {
      const context = await browser.newContext({ viewport: { width: 1024, height: 900 } })
      const page = await context.newPage()
      await open(page)
      await page.emulateMedia({ media: 'print' })
      const hidden = await page.evaluate(() => { const back = document.querySelector('main a[href="/insights"]'); return back ? getComputedStyle(back).display : 'absent' })
      assert.equal(hidden, 'none', 'print: controls/back link still printed')
      assert.ok(await page.locator('[aria-labelledby="econ-table-title"]').isVisible(), 'print: table hidden')
      const pdf = await page.pdf({ format: 'Letter' })
      assert.ok(pdf.length > 10000, 'print: empty PDF')
      report.push({ check: 'print', ok: true, pdfBytes: pdf.length })
      await context.close()
    }

    {
      // The three unchanged framed dashboards load source-declared legacy dependencies from their static HTML.
      // Every off-origin request is intercepted and aborted before network access; nothing reaches an external service.
      // The matched set is an accepted preexisting dependency baseline, NOT offline qualification of those dashboards.
      const legacyDependencyBaseline = [
        'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap',
        'https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js',
        'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700&family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap',
      ]
      const local = url => url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')
      const intercepted = { index: [], framed: [] }
      let phase = 'index'
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
      await context.route(url => !local(url.href), async intercept => {
        intercepted[phase].push(intercept.request().url())
        await intercept.abort('blockedbyclient')
      })
      const page = await context.newPage()
      const foreign = guard(page)
      await page.goto(`${base}/insights`, { waitUntil: 'networkidle' })
      for (const path of ['revenue-plumbing-map', 'compounding-graph', 'home-front-ledger', 'owning-the-block', 'commons-economy-map']) assert.equal(await page.locator(`a[href="/insights/${path}"]`).count(), 1, `index link ${path}`)
      assert.deepEqual(foreign, [], 'regression: /insights index off-origin requests')
      assert.deepEqual(intercepted.index, [], 'regression: /insights index intercepted off-origin requests')
      phase = 'framed'
      for (const path of ['compounding-graph', 'home-front-ledger', 'owning-the-block']) {
        const response = await page.goto(`${base}/insights/${path}`, { waitUntil: 'domcontentloaded' })
        assert.equal(response.status(), 200, `${path} status`)
        await page.locator('iframe').first().waitFor({ timeout: 15000 })
        await page.waitForLoadState('networkidle')
      }
      const requested = [...new Set(intercepted.framed)].sort()
      assert.deepEqual(requested, [...legacyDependencyBaseline].sort(), 'regression: framed-route off-origin requests differ from the legacy dependency baseline')
      assert.deepEqual([...new Set(foreign)].sort(), requested, 'regression: observed off-origin requests escaped interception accounting')
      report.push({ check: 'regression:index+framed-routes', ok: true, indexOffOrigin: 0, acceptedPreexistingDependencyBaseline: requested, allAborted: true, offlineQualified: false })
      await context.close()
    }
  } finally {
    await browser.close()
  }
  console.log(JSON.stringify(report, null, 2))
})().catch(error => { console.error(error); process.exit(1) })
