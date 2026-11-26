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
  // Phase 7: the sheet opens on the first walkthrough at its first step, and nothing plays until Play is pressed.
  const lead = payload.walkthroughs[0]
  assert.equal(await walks.nth(0).getAttribute('aria-pressed'), 'true', `${label}: first walkthrough is not selected on load`)
  assert.equal(await page.getByRole('region', { name: new RegExp(`^${lead.label}, step 1 of ${lead.steps.length}$`) }).count(), 1, `${label}: lead walkthrough is not open at step 1`)
  assert.equal(await page.getByRole('button', { name: 'Play', exact: true }).count(), 1, `${label}: Play control missing`)
  assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).count(), 0, `${label}: playing without being asked`)
  for (const name of ['Restart', 'Previous step', 'Next step']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1, `${label}: ${name} control missing`)
  // Phase 7 visual-first: the path is marked on the plate on load, the path's stops are on the first screen, and the long account is folded but never out of the document.
  const figure = page.locator('[aria-labelledby="econ-map-caption"]')
  assert.equal(await figure.getByText(`On the walk · step 1`, { exact: true }).count(), 1, `${label}: first stop is not marked on the plate`)
  assert.equal(await figure.locator('[role="group"], [role="region"]').count(), 0, `${label}: controls are inside the plate figure`)
  const fold = await page.evaluate(() => {
    const rail = document.querySelector('[role="region"][aria-label*=", step 1 of "] ol').getBoundingClientRect()
    const plate = document.querySelector('[aria-labelledby="econ-map-caption"]').getBoundingClientRect()
    return { height: innerHeight, scrollY, railBottom: rail.bottom, plateTop: plate.top }
  })
  assert.equal(fold.scrollY, 0, `${label}: page scrolled on load`)
  assert.ok(fold.railBottom <= fold.height, `${label}: the route of the path is below the fold (${Math.round(fold.railBottom)} > ${fold.height})`)
  assert.ok(fold.plateTop < fold.height, `${label}: the plate starts below the fold (${Math.round(fold.plateTop)} >= ${fold.height})`)
  const more = page.getByRole('button', { name: 'More detail', exact: true })
  assert.equal(await more.getAttribute('aria-expanded'), 'false', `${label}: detail is not folded on load`)
  const full = page.locator('#econ-step-full')
  for (const duty of lead.steps[0].responsibilities) assert.ok((await full.getByText(duty.who, { exact: false }).count()) >= 1, `${label}: folded account lost "${duty.key}"`)
  assert.equal(await full.evaluate(el => Boolean(el.closest('[hidden], [aria-hidden="true"], [inert]')) || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden'), false, `${label}: folded account is hidden from assistive technology`)
  await more.click()
  assert.equal(await page.getByRole('button', { name: 'Less detail', exact: true }).getAttribute('aria-expanded'), 'true', `${label}: More detail did not open`)
  assert.ok(await full.evaluate(el => el.getBoundingClientRect().height > 40), `${label}: opened account is not shown`)
  await page.getByRole('button', { name: 'Less detail', exact: true }).click()
  // Phase 7 photo story: one staged frame for the current step in the console, the selected path as a captioned strip below the fold, every picture with real alt text and loaded from this origin.
  const panel = page.getByRole('region', { name: new RegExp(`^${lead.label}, step 1 of ${lead.steps.length}$`) }).locator('img')
  assert.equal(await panel.count(), 1, `${label}: console photo panel missing`)
  assert.ok((await panel.getAttribute('src')).endsWith(`/insights/commons-economy-map/${lead.steps[0].id}.webp`), `${label}: console photo is not the first step's frame`)
  assert.equal(await figure.locator('img').count(), 0, `${label}: a photograph is inside the plate figure`)
  const photos = await page.evaluate(async () => {
    const strip = document.querySelector('[aria-labelledby="econ-photos-title"]')
    const mapRoot = document.querySelector('[aria-labelledby="econ-map-caption"]')?.closest('article')
    if (!mapRoot) throw new Error('Commons Economy Map root is missing')
    const imgs = [...mapRoot.querySelectorAll('img')]
    imgs.forEach(img => { img.loading = 'eager' })
    await Promise.all(imgs.map(img => img.complete && img.naturalWidth ? null : new Promise(done => { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }) })))
    const con = document.querySelector('[role="region"][aria-label*=", step 1 of "] img').getBoundingClientRect(), plate = document.querySelector('[aria-labelledby="econ-map-caption"]').getBoundingClientRect()
    return { stripTop: strip.getBoundingClientRect().top + scrollY, height: innerHeight, stripCount: strip.querySelectorAll('li img').length, current: strip.querySelectorAll('li[aria-current="step"]').length,
      broken: imgs.filter(img => !img.naturalWidth).length, thinAlt: imgs.filter(img => (img.getAttribute('alt') || '').trim().length < 40 || !/^Illustrative /.test(img.alt)).length,
      staged: [...strip.querySelectorAll('figcaption')].filter(el => !/A staged picture: /.test(el.textContent)).length, plateWidth: plate.width, panelWidth: con.width }
  })
  assert.equal(photos.stripCount, lead.steps.length, `${label}: photo strip does not cover the path`)
  assert.equal(photos.current, 1, `${label}: photo strip does not mark the current step`)
  assert.ok(photos.stripTop > photos.height, `${label}: photo strip is above the fold`)
  assert.equal(photos.broken, 0, `${label}: a photograph failed to load`)
  assert.equal(photos.thinAlt, 0, `${label}: a photograph lacks meaningful alt text`)
  assert.equal(photos.staged, 0, `${label}: a photo caption does not say it is staged`)
  assert.ok(photos.panelWidth * 2 < photos.plateWidth, `${label}: the photo panel is not subordinate to the plate (${Math.round(photos.panelWidth)} of ${Math.round(photos.plateWidth)})`)
  for (let w = 0; w < payload.walkthroughs.length; w++) {
    const walk = payload.walkthroughs[w]
    await walks.nth(w).click()
    const first = page.getByRole('region', { name: new RegExp(`step 1 of ${walk.steps.length}`) })
    await first.waitFor()
    // Wayfinding: every step has one mark on the rail and the same mark on its node, beside a number and a name, and every rail numeral's ink sits in the middle of its box.
    const way = await page.evaluate(ids => {
      const rail = [...document.querySelectorAll('[role="region"][aria-label*=", step "] ol > li')], plate = document.querySelector('[aria-labelledby="econ-map-caption"]')
      const ink = li => { const box = li.querySelector('span[aria-hidden="true"]'), digit = box.firstElementChild, range = document.createRange(); range.selectNodeContents(digit)
        const r = range.getBoundingClientRect(), b = box.getBoundingClientRect(), cs = getComputedStyle(digit), c = document.createElement('canvas').getContext('2d')
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; const m = c.measureText(digit.textContent), base = r.top + m.fontBoundingBoxAscent
        return { n: digit.textContent, dx: (r.left - m.actualBoundingBoxLeft + r.left + m.actualBoundingBoxRight) / 2 - (b.left + b.right) / 2, dy: (base - m.actualBoundingBoxAscent + base + m.actualBoundingBoxDescent) / 2 - (b.top + b.bottom) / 2, square: Math.abs(b.width - b.height) }
      }
      return { count: rail.length, steps: ids.map((id, i) => { const onRail = rail[i] ? [...rail[i].querySelectorAll('[data-step-mark]')] : [], onPlate = [...plate.querySelectorAll(`[data-step-mark="${id}"]`)]
        return { id, rail: onRail.map(el => el.getAttribute('data-step-mark')), plate: onPlate.length, same: onRail.length === 1 && onPlate.length === 1 && onRail[0].innerHTML === onPlate[0].innerHTML, hidden: [...onRail, ...onPlate].every(el => el.getAttribute('aria-hidden') === 'true' && !el.textContent), numbered: rail[i] ? /^\d/.test(rail[i].textContent) && rail[i].textContent.length > 8 : false, tagged: onPlate.every(el => /step \d/i.test(el.parentElement.textContent)), ink: rail[i] ? ink(rail[i]) : null } }),
        distinct: new Set([...plate.querySelectorAll('[data-step-mark]')].map(el => el.innerHTML)).size, plateTotal: plate.querySelectorAll('[data-step-mark]').length, stray: document.querySelectorAll('main [data-step-mark]').length }
    }, walk.steps.map(step => step.id))
    assert.equal(way.count, walk.steps.length, `${label}: ${walk.id} rail length`)
    assert.equal(way.plateTotal, walk.steps.length, `${label}: ${walk.id} plate carries ${way.plateTotal} marks`)
    assert.equal(way.distinct, walk.steps.length, `${label}: ${walk.id} marks are not all different`)
    assert.equal(way.stray, walk.steps.length * 2, `${label}: ${walk.id} a mark is printed somewhere else`)
    for (const step of way.steps) {
      assert.deepEqual(step.rail, [step.id], `${label}: rail stop of ${step.id} carries ${step.rail}`)
      assert.equal(step.plate, 1, `${label}: ${step.id} is marked ${step.plate} times on the plate`)
      assert.ok(step.same, `${label}: ${step.id} rail and plate marks differ`)
      assert.ok(step.hidden, `${label}: ${step.id} mark is exposed to assistive technology`)
      assert.ok(step.numbered && step.tagged, `${label}: ${step.id} mark stands without its number and name`)
      assert.ok(Math.abs(step.ink.dx) <= 0.75 && Math.abs(step.ink.dy) <= 0.75 && step.ink.square < 0.5, `${label}: rail numeral ${step.ink.n} of ${walk.id} is off centre by ${step.ink.dx.toFixed(2)}, ${step.ink.dy.toFixed(2)}`)
    }
    await page.getByRole('button', { name: 'Next step' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.getByRole('region', { name: new RegExp(`step 2 of ${walk.steps.length}`) }).waitFor()
    assert.ok((await page.getByRole('region', { name: new RegExp(`step 2 of ${walk.steps.length}`) }).locator('img').getAttribute('src')).endsWith(`/${walk.steps[1].id}.webp`), `${label}: photo did not follow ${walk.id} to step 2`)
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
  // Phase 7: one Roxbury Commons model. No version or term comparison is offered as a control; the source stays credited under Sources and method.
  assert.equal(await page.locator('[aria-labelledby="econ-labels"], #econ-labels').count(), 0, `${label}: term comparison control still printed`)
  for (const mode of payload.labelModes) assert.equal(await page.getByRole('button', { name: mode.label, exact: true }).count(), 0, `${label}: label mode ${mode.id} still offered`)
  for (const id of ['proposed', 'roxbury']) {
    const layer = payload.layers.find(item => item.id === id)
    for (const name of new Set([layer.label.book, layer.label.commons])) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0, `${label}: model layer ${id} still offered as a choice`)
    assert.equal(await page.locator('details', { hasText: 'Sources and method' }).getByText(layer.line, { exact: false }).count(), 1, `${label}: ${id} provenance missing from Sources and method`)
  }
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
