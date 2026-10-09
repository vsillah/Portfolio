const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4033').replace(/\/$/, '')
const contentId = 'practitioner-content-quality-qa'
const out = path.resolve('docs/social-content/qa/practitioner-content-quality')
const rawVideo = path.resolve('test-results/practitioner-content-quality')
fs.mkdirSync(out, { recursive: true })
fs.mkdirSync(rawVideo, { recursive: true })

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
    let fixtureState = 'blocked'
    let fixtureScriptSize = 'complete'
    const external = []
    const mutations = []
    const pageErrors = []
    const fixtureResponses = []
    const fixtureScriptResponses = []
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      recordVideo: { dir: rawVideo, size: { width, height: width === 390 ? 844 : 1000 } },
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
      if (url.origin !== base) {
        external.push(`${method} ${url.origin}${url.pathname}`)
        return route.abort()
      }
      if (method !== 'GET' && url.pathname.startsWith('/api/')) mutations.push(`${method} ${url.pathname}`)
      if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
      if (url.pathname === '/api/admin/social-content/topic-backlog') return json({ items: [] })
      if (url.pathname === '/api/admin/social-content/calibration-library') return json({ references: [], counts: { total: 0 } })
      if (url.pathname.startsWith('/api/') && url.pathname !== `/api/admin/social-content/${contentId}`) {
        return json({ items: [], data: [], configs: [], references: [], count: 0 })
      }
      if (url.pathname === `/api/admin/social-content/${contentId}`) {
        return route.continue({ headers: {
          ...request.headers(),
          'x-portfolio-qa-state': fixtureState,
          'x-portfolio-qa-script-size': fixtureScriptSize,
        } })
      }
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', async (response) => {
      const url = new URL(response.url())
      if (url.origin === base && url.pathname === `/api/admin/social-content/${contentId}`) {
        const body = await response.json().catch(() => null)
        if (body?.fixture === true) {
          fixtureResponses.push(body.fixture_state)
          fixtureScriptResponses.push(body.fixture_script_size)
        }
      }
    })

    const blockedUrl = `${base}/admin/social-content/${contentId}?step=copy&qa_state=blocked`
    await page.goto(blockedUrl, { waitUntil: 'domcontentloaded' })
    const panel = page.getByRole('region', { name: 'Practitioner evidence and visual review' })
    await expect(panel).toBeVisible({ timeout: 90000 })
    await expect(panel.getByText('Blocked before Human QA')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve Copy' })).toBeDisabled()
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(out, `${width}-blocked-gate.png`), fullPage: true })

    fixtureState = 'ready'
    const readyUrl = `${base}/admin/social-content/${contentId}?step=copy`
    await page.goto(readyUrl, { waitUntil: 'domcontentloaded' })
    await expect(panel).toBeVisible({ timeout: 90000 })
    await expect(panel.getByText('Ready for Human QA')).toBeVisible()
    await expect(panel.getByText('Make the repeated burden visible. Keep judgment human.')).toBeVisible()
    await expect(panel.getByText('Specificity: specific')).toBeVisible()
    await expect(panel.getByText('Correlation only')).toBeVisible()
    await expect(panel.getByText('Framework: applied')).toBeVisible()
    await expect(panel.getByText('Voice: applied')).toBeVisible()
    await expect(panel.getByText('Performance: bounded fallback')).toBeVisible()
    await expect(panel.getByText('Every Friday, three spreadsheets fed one intake decision.')).toBeVisible()
    await expect(panel.getByText('Start with repeated burden, stable rules, and one decision owner.')).toBeVisible()
    await expect(panel.getByLabel('Deterministic AmaduTown visual candidate')).toBeVisible()
    await expect(page.getByText('Preview fixture is read-only.', { exact: true })).toBeVisible()
    await expect(page.getByText(/No changes, approvals, or rejection decisions can be saved from this route/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Social Content' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Approve Copy' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled()
    await page.screenshot({ path: path.join(out, `${width}-read-only-fixture.png`) })
    const detailHeader = page.locator('[data-social-detail-header]')
    await detailHeader.evaluate((element) => { element.style.position = 'static' })
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await panel.getByText('Finished copy', { exact: true }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    const visualCandidate = panel.getByLabel('Deterministic AmaduTown visual candidate')
    await visualCandidate.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await visualCandidate.screenshot({ path: path.join(out, `${width}-argument-visual.png`) })
    await panel.getByText('Visual rationale:', { exact: false }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px horizontal overflow`)
    await panel.screenshot({ path: path.join(out, `${width}-practitioner-review.png`) })
    await detailHeader.evaluate((element) => { element.style.position = '' })

    const expectedMinHeight = 144
    const expectedMaxHeight = width >= 1024 ? 512 : width >= 640 ? 384 : 320
    const sizing = { short: {}, medium: {}, 'over-cap': {} }
    const measureEditor = async ({ step, editorKey, resultKey, size }) => {
      fixtureScriptSize = size
      await page.goto(`${base}/admin/social-content/${contentId}?step=${step}`, { waitUntil: 'domcontentloaded' })
      const editor = page.locator(`[data-social-script-editor="${editorKey}"]`)
      await expect(editor).toBeVisible({ timeout: 90000 })
      const metrics = await editor.evaluate((element) => {
        const styles = getComputedStyle(element)
        return {
          height: element.getBoundingClientRect().height,
          min_height: Number.parseFloat(styles.minHeight),
          max_height: Number.parseFloat(styles.maxHeight),
          client_height: element.clientHeight,
          scroll_height: element.scrollHeight,
          overflow_y: styles.overflowY,
          resize: styles.resize,
        }
      })
      assert.ok(Math.abs(metrics.min_height - expectedMinHeight) <= 1, `${width}px ${resultKey} minimum is not ${expectedMinHeight}px`)
      assert.ok(Math.abs(metrics.max_height - expectedMaxHeight) <= 1, `${width}px ${resultKey} cap is not ${expectedMaxHeight}px`)
      assert.equal(metrics.resize, 'vertical', `${width}px ${resultKey} is not vertically resizable`)
      if (size === 'short') {
        assert.ok(Math.abs(metrics.height - expectedMinHeight) <= 2, `${width}px ${resultKey} short content did not use the readable minimum`)
        assert.equal(metrics.overflow_y, 'hidden', `${width}px ${resultKey} short content unexpectedly scrolls`)
      } else if (size === 'medium') {
        assert.ok(metrics.height >= expectedMinHeight && metrics.height < expectedMaxHeight, `${width}px ${resultKey} medium content did not fit below the responsive cap`)
        assert.equal(metrics.overflow_y, 'hidden', `${width}px ${resultKey} medium content unexpectedly scrolls`)
      } else {
        assert.ok(Math.abs(metrics.height - expectedMaxHeight) <= 2, `${width}px ${resultKey} over-cap content did not stop at the responsive cap`)
        assert.equal(metrics.overflow_y, 'auto', `${width}px ${resultKey} over-cap content did not enable internal scrolling`)
        assert.ok(metrics.scroll_height > metrics.client_height, `${width}px ${resultKey} over-cap content does not overflow internally`)
      }
      if (size === 'medium' || size === 'over-cap') {
        const suffix = size === 'medium' ? '' : '-over-cap'
        const region = editor.locator('xpath=..')
        await page.locator('[data-social-detail-header]').evaluate((element) => { element.style.position = 'static' })
        await region.screenshot({ path: path.join(out, `${width}-${editorKey}-editor${suffix}.png`) })
        await page.locator('[data-social-detail-header]').evaluate((element) => { element.style.position = '' })
      }
      sizing[size][resultKey] = metrics
    }

    for (const size of ['short', 'medium', 'over-cap']) {
      await measureEditor({ step: 'copy', editorKey: 'post-text', resultKey: 'post_text', size })
      await measureEditor({ step: 'visuals', editorKey: 'voiceover-script', resultKey: 'voiceover_script', size })
    }
    fixtureScriptSize = 'complete'
    await page.goto(`${base}/admin/social-content/${contentId}?step=visuals`, { waitUntil: 'domcontentloaded' })
    const imagePrompt = page.getByText('Image Prompt', { exact: true }).locator('..').locator('textarea')
    await expect(imagePrompt).toBeVisible({ timeout: 90000 })
    const imagePromptHeight = await imagePrompt.evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(imagePromptHeight < expectedMinHeight, `${width}px non-script image prompt was enlarged with script editors`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px visuals horizontal overflow`)

    assert.deepEqual([...new Set(fixtureResponses)], ['blocked', 'ready'], `${width}px did not read both deployed fixture states`)
    assert.deepEqual([...new Set(fixtureScriptResponses)].sort(), ['complete', 'medium', 'over-cap', 'short'], `${width}px did not read the complete post and all deployed script-size states`)
    assert.equal(mutations.length, 0, `${width}px QA made a mutation`)
    assert.equal(external.length, 0, `${width}px QA made an external request: ${external.join(', ')}`)
    assert.equal(pageErrors.length, 0, `${width}px QA emitted a page error`)
    results.push({
      width,
      route: readyUrl,
      source: base.includes('.vercel.app') ? 'deployed_preview_fixture' : 'local_preview_fixture',
      fixture_responses: [...new Set(fixtureResponses)],
      specificity: 'specific', gates_observed: ['blocked_before_human_qa', 'ready_for_human_qa'],
      read_only_controls: ['save_draft', 'approve_copy', 'reject'],
      script_editor_sizing: {
        expected_minimum: expectedMinHeight,
        expected_maximum: expectedMaxHeight,
        states: sizing,
        non_script_image_prompt_height: imagePromptHeight,
      },
      provider_calls: 0, external_requests: 0, mutations: 0, page_errors: [],
    })
    const video = page.video()
    await context.close()
    const source = await video.path()
    const mp4 = path.join(out, `${width}-walkthrough.mp4`)
    execFileSync('ffmpeg', ['-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
    fs.unlinkSync(source)
  }
  await browser.close()
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
