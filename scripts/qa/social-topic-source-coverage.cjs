const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4032').replace(/\/$/, '')
const baseOrigin = new URL(base).origin
const contentId = 'topic-source-coverage-qa'
const outputDir = path.resolve('docs/social-content/qa/topic-source-coverage')
const tempDir = path.resolve('test-results/topic-source-coverage')
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(tempDir, { recursive: true })

const user = {
  id: 'synthetic-admin', email: 'qa@example.invalid', role: 'authenticated', aud: 'authenticated',
  user_metadata: {}, app_metadata: {},
}
const session = {
  access_token: 'synthetic-preview-token', refresh_token: 'synthetic-preview-refresh',
  expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user,
}

;(async () => {
  const browser = await chromium.launch()
  const results = []
  for (const width of [390, 768, 1440]) {
    const height = width === 390 ? 844 : 1000
    let fixtureState = 'blocked'
    const external = []
    const mutations = []
    const pageErrors = []
    const fixtureResponses = []
    let liveBacklogRequests = 0
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: tempDir, size: { width, height } },
      serviceWorkers: 'block',
      extraHTTPHeaders: process.env.VERCEL_OIDC_TOKEN
        ? { 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN }
        : undefined,
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
      if (method !== 'GET' && url.pathname.startsWith('/api/')) mutations.push(`${method} ${url.pathname}`)
      if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
      if (url.pathname === '/api/admin/social-content/topic-backlog') {
        liveBacklogRequests += 1
        return json({ items: [], coverage_report: null })
      }
      if (url.pathname === '/api/admin/social-content/calibration-library') return json({ references: [], counts: { total: 0 } })
      if (url.pathname.startsWith('/api/') && url.pathname !== `/api/admin/social-content/${contentId}`) {
        return json({ items: [], data: [], configs: [], references: [], count: 0 })
      }
      if (url.pathname === `/api/admin/social-content/${contentId}`) {
        return route.continue({
          headers: {
            ...request.headers(),
            'x-portfolio-topic-coverage-state': fixtureState,
          },
        })
      }
      return route.continue()
    })

    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', async (response) => {
      const url = new URL(response.url())
      if (url.origin === baseOrigin && url.pathname === `/api/admin/social-content/${contentId}`) {
        const body = await response.json().catch(() => null)
        if (body?.fixture === true) fixtureResponses.push(body.fixture_state)
      }
    })

    const blockedUrl = `${base}/admin/social-content/${contentId}?step=copy&qa=topic-source-coverage&qa_state=blocked`
    await page.goto(blockedUrl, { waitUntil: 'domcontentloaded' })
    const blockedSurface = page.getByRole('main')
    await expect(page.getByText('Synthetic QA fixture')).toBeVisible({ timeout: 90000 })
    await expect(page.getByText('Preview-only · Read-only')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Coverage blocked' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Agentified', exact: true })).toBeVisible()
    await expect(page.getByText('Needs receipt')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Meeting summaries' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Actionable blockers and recovery' })).toBeVisible()
    await expect(page.getByText('No approved source receipts are attached to the blocked synthetic candidate.')).toBeVisible()
    await expect(blockedSurface.getByRole('button')).toHaveCount(0)
    await expect(blockedSurface.getByLabel('LinkedIn post preview')).toHaveCount(0)
    await expect(blockedSurface.getByLabel('Post Text')).toHaveCount(0)
    await page.waitForTimeout(1200)
    const recoveryPanel = page.getByRole('heading', { name: 'Actionable blockers and recovery' }).locator('..')
    await recoveryPanel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1200)
    await expect(recoveryPanel.getByText('Restore approved-summary read access and retry.')).toBeVisible()
    await expect(recoveryPanel.getByText('Approve a privacy-safe Agentified summary.')).toBeVisible()
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(outputDir, `${width}-blocked.png`), fullPage: true })

    fixtureState = 'ready'
    const readyUrl = `${base}/admin/social-content/${contentId}?step=copy&qa=topic-source-coverage`
    await page.goto(readyUrl, { waitUntil: 'domcontentloaded' })
    const readySurface = page.getByRole('main')
    await expect(page.getByRole('heading', { name: 'Coverage ready' })).toBeVisible({ timeout: 90000 })
    await expect(page.getByRole('heading', { name: 'Dark Castle Chess' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Accelerated' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Agentified', exact: true })).toBeVisible()
    await expect(page.getByText('Review-only backlog candidates')).toBeVisible()
    await expect(page.getByText('No selection action')).toBeVisible()
    await expect(page.getByText('publications:agentified', { exact: true })).toBeVisible()
    await expect(readySurface.getByRole('button')).toHaveCount(0)
    await page.waitForTimeout(1200)
    await page.getByText('Review-only backlog candidates').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1200)
    await expect(page.getByText('medium priority · 70')).toBeVisible()
    await expect(page.getByText('Boundary: Verify performance claims before drafting.')).toBeVisible()
    await page.waitForTimeout(900)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px horizontal overflow`)
    await page.screenshot({ path: path.join(outputDir, `${width}-ready.png`), fullPage: true })

    assert.deepEqual([...new Set(fixtureResponses)], ['blocked', 'ready'], `${width}px did not read both deployed fixture states`)
    assert.equal(liveBacklogRequests, 0, `${width}px fixture requested the live topic backlog`)
    assert.equal(mutations.length, 0, `${width}px QA made a mutation`)
    assert.equal(external.length, 0, `${width}px QA made an external request: ${external.join(', ')}`)
    assert.equal(pageErrors.length, 0, `${width}px QA emitted a page error`)
    results.push({
      width,
      route: readyUrl,
      source: base.includes('.vercel.app') ? 'deployed_preview_fixture' : 'local_preview_fixture',
      fixture_responses: [...new Set(fixtureResponses)],
      product_coverage: ['dark_castle_chess', 'accelerated', 'agentified'],
      source_collection_states: ['ready', 'blocked'],
      evidence_only_surface: true,
      absent_affordances: ['post_editor', 'social_preview', 'save', 'approve', 'provider', 'upload', 'schedule', 'publish'],
      live_backlog_requests: 0,
      provider_calls: 0,
      external_requests: 0,
      mutations: 0,
      page_errors: [],
    })
    const video = page.video()
    await context.close()
    const rawVideo = await video.path()
    const mp4 = path.join(outputDir, `${width}-walkthrough.mp4`)
    execFileSync('ffmpeg', ['-y', '-i', rawVideo, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
    fs.unlinkSync(rawVideo)
  }
  await browser.close()
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
