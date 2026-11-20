const assert = require('node:assert/strict')
const { mkdirSync, unlinkSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright')

const revision = process.env.REVIEW_REVISION || execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
const noVideo = process.env.REVIEW_NO_VIDEO === '1'
const base = process.env.REVIEW_BASE || 'http://localhost:4173'
const out = join(process.cwd(), 'docs/qa/insights-return-navigation')
const routes = ['compounding-graph', 'home-front-ledger', 'owning-the-block']
mkdirSync(out, { recursive: true })

async function openMenu(page) {
  const menu = page.getByRole('dialog', { name: 'Site navigation' })
  if (!await menu.isVisible()) await page.getByRole('button', { name: 'Toggle menu' }).click()
  await menu.waitFor()
  assert.equal(await menu.getByRole('link', { name: 'Home' }).getAttribute('href'), '/#home')
  assert.equal(await menu.getByRole('link', { name: 'Insights' }).getAttribute('href'), '/insights')
  const bounds = await menu.evaluate(el => {
    const rect = el.getBoundingClientRect()
    return { left: rect.left, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight }
  })
  assert.ok(bounds.left >= 0 && bounds.right <= bounds.width + 1, 'menu has horizontal clipping')
  assert.ok(bounds.bottom <= bounds.height + 1, 'menu is outside viewport')
  return menu
}

async function chooseTheme(page, name, expected) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForFunction(() => window.scrollY === 0)
  const menu = await openMenu(page)
  if (!noVideo) await page.waitForTimeout(450)
  await menu.getByRole('button', { name: `${name} theme` }).click()
  await menu.waitFor({ state: 'hidden' })
  assert.equal(await page.evaluate(() => localStorage.getItem('theme')), expected)
  await page.waitForFunction(value => document.documentElement.classList.contains('dark') === (value === 'dark'), expected)
  const iframe = page.locator('iframe')
  await page.waitForFunction(value => document.querySelector('iframe')?.contentDocument?.documentElement.dataset.theme === value, expected === 'system' ? 'light' : expected)
  assert.equal(await iframe.count(), 1)
}

async function inspectOwning(page, theme) {
  await page.frameLocator('iframe').locator('#city .u-water').waitFor()
  const state = await page.locator('iframe').evaluate(frame => {
    const doc = frame.contentDocument
    const svg = doc.querySelector('#svg')
    const children = [...svg.children]
    const css = selector => getComputedStyle(doc.querySelector(selector))
    const labels = [...doc.querySelectorAll('#nodes .lbl,#nodes .sub')]
    return {
      theme: doc.documentElement.dataset.theme,
      body: css('body').backgroundColor,
      cityPointerEvents: css('#city').pointerEvents,
      cityBehindData: children.indexOf(doc.querySelector('#city')) < children.indexOf(doc.querySelector('#pipes')) && children.indexOf(doc.querySelector('#city')) < children.indexOf(doc.querySelector('#bandlabels')) && children.indexOf(doc.querySelector('#city')) < children.indexOf(doc.querySelector('#nodes')),
      nodes: doc.querySelectorAll('#nodes .node').length,
      connectors: doc.querySelectorAll('#pipes .pipe').length,
      covers: doc.querySelectorAll('#city .u-cover').length,
      shafts: doc.querySelectorAll('#city .u-shaft-in').length,
      roofs: doc.querySelectorAll('#nodes .deco').length,
      water: css('#city .u-water').stroke,
      sewer: css('#city .u-sewer').fill,
      connector: css('#pipes .pipe').stroke,
      labelsInsideCanvas: labels.every(label => {
        const box = label.getBBox()
        return box.x >= 0 && box.y >= 0 && box.x + box.width <= 980 && box.y + box.height <= 700
      }),
    }
  })
  assert.equal(state.theme, theme)
  assert.equal(state.body, theme === 'light' ? 'rgb(243, 245, 248)' : 'rgb(14, 17, 24)')
  assert.equal(state.cityPointerEvents, 'none')
  assert.equal(state.cityBehindData, true)
  assert.equal(state.nodes, 18)
  assert.equal(state.connectors, 34)
  assert.equal(state.covers, 2)
  assert.equal(state.shafts, 2)
  assert.ok(state.roofs > 0)
  assert.notEqual(state.water, state.connector)
  assert.notEqual(state.sewer, state.water)
  assert.equal(state.labelsInsideCanvas, true)
  return state
}

async function exerciseOwning(page) {
  const frame = page.frameLocator('iframe')
  await frame.locator('#nodes .node[data-id="commons"]').press('Enter')
  assert.equal(await frame.locator('#nar h2').innerText(), 'Roxbury Commons')
  await frame.locator('#uses button[data-use="join"]').click()
  assert.equal(await frame.locator('#uses button[data-use="join"]').getAttribute('aria-pressed'), 'true')
  assert.equal(await frame.locator('#nar h2').innerText(), 'A neighbor joins')
}

async function showBlockFigure(page, viewport) {
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe')
    const figure = iframe.contentDocument.querySelector('.fig')
    const top = window.scrollY + iframe.getBoundingClientRect().top + figure.getBoundingClientRect().top
    window.scrollTo(0, Math.max(0, top - 100))
  })
  await page.waitForTimeout(1700)
  if (viewport.width === 390) {
    const figure = page.frameLocator('iframe').locator('.fig')
    await figure.evaluate(el => { el.scrollLeft = el.scrollWidth - el.clientWidth })
    await page.waitForTimeout(1700)
    await figure.evaluate(el => { el.scrollLeft = 0 })
    await page.waitForTimeout(1700)
  }
}

async function inspect(page, viewport, route) {
  await page.goto(`${base}/insights/${route}?rev=${revision}`, { waitUntil: 'domcontentloaded' })
  const frame = page.frameLocator('iframe')
  await frame.locator('h1').waitFor()
  await page.getByRole('button', { name: 'Toggle menu' }).waitFor()
  await page.waitForFunction(() => {
    const iframe = document.querySelector('iframe')
    return iframe && getComputedStyle(iframe).visibility === 'visible' && iframe.contentDocument.documentElement.dataset.theme && iframe.getBoundingClientRect().height >= iframe.contentDocument.documentElement.scrollHeight - 2
  })
  const measurements = await page.evaluate(() => {
    const nav = document.querySelector('nav')
    const iframe = document.querySelector('iframe')
    const nr = nav.getBoundingClientRect(), fr = iframe.getBoundingClientRect()
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      navBottom: nr.bottom,
      frameTop: fr.top,
      frameHeight: fr.height,
      frameContentHeight: iframe.contentDocument.documentElement.scrollHeight,
      frameScrollWidth: iframe.contentDocument.documentElement.scrollWidth,
    }
  })
  assert.equal(measurements.width, viewport.width)
  assert.ok(measurements.scrollWidth <= viewport.width + 1, `${route} ${viewport.width}: page overflow`)
  assert.ok(measurements.frameScrollWidth <= viewport.width + 1, `${route} ${viewport.width}: frame overflow`)
  assert.ok(measurements.frameTop >= measurements.navBottom, `${route} ${viewport.width}: menu overlaps dashboard`)
  assert.ok(measurements.frameHeight >= measurements.frameContentHeight - 2, `${route} ${viewport.width}: frame clips dashboard`)
  assert.equal(await page.locator('a.insight-return-nav__home').count(), 0)
  assert.equal(await page.locator('a[href="/"]').first().getAttribute('href'), '/')
  return { route, width: viewport.width, ...measurements }
}

async function exerciseDashboard(page, route) {
  const frame = page.frameLocator('iframe')
  if (route === 'compounding-graph') {
    await frame.locator('#colorby button[data-c="impact"]').click()
    assert.equal(await frame.locator('#colorby button[data-c="impact"]').getAttribute('aria-pressed'), 'true')
    await frame.locator('#magrows .magrow').first().click()
    assert.notEqual((await frame.locator('#panel h2').innerText()).trim(), 'Start at the center')
  } else if (route === 'home-front-ledger') {
    await frame.locator('#lenses button').filter({ hasText: 'Black Americans' }).click()
    await frame.locator('#slider').focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    assert.equal(await frame.locator('#slider').inputValue(), '1')
  } else {
    await frame.locator('#cb-hz').click()
    assert.equal(await frame.locator('#cb-hz').getAttribute('aria-pressed'), 'true')
    await frame.locator('#uses button').first().click()
  }
}

async function walkthrough(browser, viewport, report) {
  const record = !noVideo && viewport.width !== 768
  const context = await browser.newContext({ viewport, colorScheme: 'light', ...(record ? { recordVideo: { dir: out, size: viewport } } : {}) })
  const page = await context.newPage()
  try {
    for (const route of routes) {
      report.checks.push(await inspect(page, viewport, route))
      if (record) await page.waitForTimeout(700)
      await chooseTheme(page, 'Dark', 'dark')
      assert.equal(await page.locator('iframe').evaluate(el => el.contentDocument.documentElement.dataset.theme), 'dark')
      if (route === 'owning-the-block') {
        report.checks.push({ route, theme: 'dark', source: await inspectOwning(page, 'dark') })
        await exerciseOwning(page)
        if (record) await showBlockFigure(page, viewport)
      }
      if (record) await page.waitForTimeout(600)
      await chooseTheme(page, 'Light', 'light')
      if (route === 'owning-the-block') {
        report.checks.push({ route, theme: 'light', source: await inspectOwning(page, 'light') })
        await exerciseOwning(page)
        if (record) await showBlockFigure(page, viewport)
      }
      await chooseTheme(page, 'System', 'system')
      if (route === 'owning-the-block') report.checks.push({ route, theme: 'system-light', source: await inspectOwning(page, 'light') })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.frameLocator('iframe').locator('h1').waitFor()
      assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'system')
      await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.documentElement.dataset.theme === 'light')
      assert.equal(await page.locator('iframe').evaluate(el => el.contentDocument.documentElement.dataset.theme), 'light')
      await page.getByRole('button', { name: 'Toggle menu' }).focus()
      assert.equal(await page.getByRole('button', { name: 'Toggle menu' }).evaluate(el => el.matches(':focus-visible')), true)
      const menu = await openMenu(page)
      const homeLink = menu.getByRole('link', { name: 'Home' })
      await homeLink.focus()
      assert.equal(await homeLink.evaluate(el => el.matches(':focus-visible')), true)
      await page.keyboard.press('Escape')
      await menu.waitFor({ state: 'hidden' })
      await exerciseDashboard(page, route)
      if (record) await page.waitForTimeout(700)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForFunction(() => window.scrollY === 0)
      const links = await openMenu(page)
      await links.getByRole('link', { name: 'Insights' }).click()
      await page.getByRole('heading', { name: 'Explore the systems' }).waitFor()
      if (record) await page.waitForTimeout(400)
    }
    await page.goto(`${base}/insights/${routes[0]}?rev=${revision}`, { waitUntil: 'domcontentloaded' })
    await page.frameLocator('iframe').locator('h1').waitFor()
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe')
      return iframe && getComputedStyle(iframe).visibility === 'visible' && iframe.contentDocument.documentElement.dataset.theme
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    const menu = await openMenu(page)
    await menu.getByRole('link', { name: 'Home' }).click()
    await page.waitForURL(`${base}/#home`)
    if (record) await page.waitForTimeout(500)
    const sourceVideo = record ? await page.video().path() : null
    await context.close()
    if (record) {
      const video = join(out, viewport.width === 390 ? 'mobile-390x844.mp4' : 'desktop-1440x900.mp4')
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', sourceVideo, '-c:v', 'libx264', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video])
      unlinkSync(sourceVideo)
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1', video])
      report.videos.push(video.replace(`${process.cwd()}/`, ''))
    }
  } finally { if (page.context().pages().length) await context.close().catch(() => {}) }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = { revision, base, checks: [], videos: [] }
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
      await walkthrough(browser, viewport, report)
    }
    const systemDark = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
    await systemDark.addInitScript(() => localStorage.setItem('theme', 'system'))
    const systemPage = await systemDark.newPage()
    await systemPage.goto(`${base}/insights/owning-the-block?rev=${revision}`, { waitUntil: 'domcontentloaded' })
    await systemPage.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.documentElement.dataset.theme === 'dark')
    report.checks.push({ route: 'owning-the-block', theme: 'system-dark', source: await inspectOwning(systemPage, 'dark') })
    await systemDark.close()
    if (!noVideo) writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ revision, checks: report.checks.length, videos: report.videos }, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
