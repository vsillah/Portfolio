const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4033').replace(/\/$/, '')
const baseOrigin = new URL(base).origin
const contentId = 'deterministic-visual-binding-qa'
const outputDir = path.resolve('docs/social-content/qa/deterministic-visual-binding')
const tempDir = path.resolve('test-results/deterministic-visual-binding')
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(tempDir, { recursive: true })

const user = {
  id: 'synthetic-admin',
  email: 'qa@example.invalid',
  role: 'authenticated',
  aud: 'authenticated',
  user_metadata: {},
  app_metadata: {},
}
const session = {
  access_token: 'synthetic-preview-token',
  refresh_token: 'synthetic-preview-refresh',
  expires_at: 4102444800,
  expires_in: 3600,
  token_type: 'bearer',
  user,
}

const routeFor = (state) => `${base}/admin/social-content/${contentId}?step=visuals&qa=deterministic-visual-binding&qa_state=${state}`

async function revealBelowStickyHeader(page, locator) {
  await locator.evaluate((element) => {
    element.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' })
  })
}

;(async () => {
  const browser = await chromium.launch()
  const results = []

  for (const width of [390, 768, 1440]) {
    const height = width === 390 ? 844 : 1000
    const external = []
    const unexpectedMutations = []
    const pageErrors = []
    const fixtureResponses = []
    let renderRequests = 0
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: tempDir, size: { width, height } },
      serviceWorkers: 'block',
    })
    await context.addInitScript(({ session }) => {
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = function getItem(key) {
        if (/^sb-.*-auth-token$/.test(key)) return JSON.stringify(session)
        return originalGetItem.call(this, key)
      }
    }, { session })
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

      if (url.hostname === 'va.vercel-scripts.com' || url.hostname === 'vercel.live') return route.abort()
      if (url.pathname === '/auth/v1/user') return json(user)
      if (url.pathname === '/rest/v1/user_profiles') return json([{ id: user.id, email: user.email, role: 'admin' }])
      if (url.origin !== baseOrigin) {
        external.push(`${method} ${url.origin}${url.pathname}`)
        return route.abort()
      }
      if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
      if (url.pathname === `/api/admin/social-content/${contentId}/render-deterministic-visual`) {
        if (method !== 'POST') unexpectedMutations.push(`${method} ${url.pathname}`)
        else renderRequests += 1
        return route.continue()
      }
      if (url.pathname === `/api/admin/social-content/${contentId}`) return route.continue()
      if (url.pathname.startsWith('/api/')) {
        if (method !== 'GET') unexpectedMutations.push(`${method} ${url.pathname}`)
        return json({ items: [], data: [], configs: [], references: [], count: 0 })
      }
      return route.continue()
    })

    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', async (response) => {
      const url = new URL(response.url())
      if (url.origin !== baseOrigin || !url.pathname.startsWith(`/api/admin/social-content/${contentId}`)) return
      const body = await response.json().catch(() => null)
      if (body?.fixture === true) fixtureResponses.push({ path: url.pathname, state: body.fixture_state || body.render?.state || null })
    })

    await page.goto(routeFor('ready'), { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Synthetic production-equivalent fixture')).toBeVisible({ timeout: 90000 })
    const renderStatus = page.getByLabel('Deterministic visual render status')
    await expect(renderStatus.getByText('Ready to render')).toBeVisible()
    await expect(renderStatus.getByText('Provider none')).toBeVisible()
    await expect(renderStatus.getByText('architecture', { exact: true })).toBeVisible()
    await expect(page.getByText(/Gemini, HeyGen, n8n media, and other media providers stay off/i)).toBeVisible()
    const renderButton = page.getByRole('button', { name: 'Render deterministic visual' })
    await expect(renderButton).toBeEnabled()
    await revealBelowStickyHeader(page, renderStatus)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(outputDir, `${width}-ready.png`) })

    await renderButton.click()
    await expect(page.getByRole('button', { name: 'Review asset current' })).toBeDisabled()
    await expect(renderStatus.getByText('Asset current')).toBeVisible()
    await expect(renderStatus.getByText(/provider none · external call false/i)).toBeVisible()
    const reviewAsset = page.getByAltText('Deterministic AmaduTown review asset').first()
    await expect(reviewAsset).toBeVisible()
    await revealBelowStickyHeader(page, renderStatus)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: path.join(outputDir, `${width}-current.png`) })
    await revealBelowStickyHeader(page, reviewAsset)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(outputDir, `${width}-current-asset.png`) })

    await page.goto(routeFor('missing_candidate'), { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('The deterministic HTML/SVG candidate is missing or incomplete.')).toBeVisible({ timeout: 90000 })
    await expect(page.getByText('Render blocked')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Render deterministic visual' })).toBeDisabled()
    await revealBelowStickyHeader(page, page.getByLabel('Deterministic visual render status'))
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(outputDir, `${width}-missing-candidate.png`) })

    await page.goto(routeFor('architecture_mismatch'), { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Architecture visuals require explicit connectors between every adjacent node.')).toBeVisible({ timeout: 90000 })
    await expect(page.getByText(/Provide exactly three labeled architecture nodes and two labeled connectors/i)).toBeVisible()
    await expect(page.getByText('Render blocked')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Render deterministic visual' })).toBeDisabled()
    await revealBelowStickyHeader(page, page.getByLabel('Deterministic visual render status'))
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(outputDir, `${width}-architecture-mismatch.png`) })

    await page.goto(routeFor('storage_unavailable'), { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Internal Social Content storage is unavailable.')).toBeVisible({ timeout: 90000 })
    await expect(page.getByText(/No provider fallback is allowed/i)).toBeVisible()
    await revealBelowStickyHeader(page, page.getByLabel('Deterministic visual render status'))
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(outputDir, `${width}-storage-blocked.png`) })

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px horizontal overflow`)
    assert.equal(renderRequests, 1, `${width}px should issue one synthetic render request`)
    assert.deepEqual(unexpectedMutations, [], `${width}px emitted an unexpected mutation`)
    assert.deepEqual(external, [], `${width}px emitted an external request`)
    assert.deepEqual(pageErrors, [], `${width}px emitted a page error`)
    results.push({
      width,
      height,
      route: routeFor('ready'),
      fixture_states: ['ready', 'current', 'missing_candidate', 'architecture_mismatch', 'storage_unavailable'],
      fixture_responses: fixtureResponses,
      provider: 'none',
      provider_calls: 0,
      shared_database_writes: 0,
      shared_storage_writes: 0,
      external_actions: 0,
      synthetic_render_requests: renderRequests,
      horizontal_overflow: false,
      page_errors: [],
    })

    const video = page.video()
    await context.close()
    const rawVideo = await video.path()
    const mp4 = path.join(outputDir, `${width}-walkthrough.mp4`)
    execFileSync('ffmpeg', [
      '-y', '-i', rawVideo,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      mp4,
    ], { stdio: 'ignore' })
    fs.unlinkSync(rawVideo)
  }

  await browser.close()
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
