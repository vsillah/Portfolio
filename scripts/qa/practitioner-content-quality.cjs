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
    const external = []
    const mutations = []
    const pageErrors = []
    const fixtureResponses = []
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
        return route.continue({ headers: { ...request.headers(), 'x-portfolio-qa-state': fixtureState } })
      }
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', async (response) => {
      const url = new URL(response.url())
      if (url.origin === base && url.pathname === `/api/admin/social-content/${contentId}`) {
        const body = await response.json().catch(() => null)
        if (body?.fixture === true) fixtureResponses.push(body.fixture_state)
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
    await expect(panel.getByText('One queue. One decision owner.')).toBeVisible()
    await expect(panel.getByText('Specificity: specific')).toBeVisible()
    await expect(panel.getByText('Correlation only')).toBeVisible()
    await expect(panel.getByLabel('Deterministic AmaduTown visual candidate')).toBeVisible()
    await expect(page.getByText('Preview fixture is read-only.', { exact: true })).toBeVisible()
    await expect(page.getByText(/No changes, approvals, or rejection decisions can be saved from this route/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Social Content' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Approve Copy' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled()
    await page.screenshot({ path: path.join(out, `${width}-read-only-fixture.png`) })
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px horizontal overflow`)
    await page.screenshot({ path: path.join(out, `${width}-practitioner-review.png`), fullPage: true })

    const expectedScriptHeight = width >= 1024 ? 320 : width >= 640 ? 288 : 256
    const postEditor = page.locator('[data-social-script-editor="post-text"]')
    await expect(postEditor).toBeVisible()
    const postEditorHeight = await postEditor.evaluate((element) => element.getBoundingClientRect().height)
    const postEditorResize = await postEditor.evaluate((element) => getComputedStyle(element).resize)
    assert.ok(postEditorHeight >= expectedScriptHeight, `${width}px post editor is shorter than ${expectedScriptHeight}px`)
    assert.equal(postEditorResize, 'vertical', `${width}px post editor is not vertically resizable`)
    await postEditor.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(out, `${width}-post-script-editor.png`) })

    const visualsUrl = `${base}/admin/social-content/${contentId}?step=visuals`
    await page.goto(visualsUrl, { waitUntil: 'domcontentloaded' })
    const voiceoverEditor = page.locator('[data-social-script-editor="voiceover-script"]')
    await expect(voiceoverEditor).toBeVisible({ timeout: 90000 })
    const voiceoverEditorHeight = await voiceoverEditor.evaluate((element) => element.getBoundingClientRect().height)
    const voiceoverEditorResize = await voiceoverEditor.evaluate((element) => getComputedStyle(element).resize)
    const imagePrompt = page.getByText('Image Prompt', { exact: true }).locator('..').locator('textarea')
    const imagePromptHeight = await imagePrompt.evaluate((element) => element.getBoundingClientRect().height)
    assert.ok(voiceoverEditorHeight >= expectedScriptHeight, `${width}px voiceover editor is shorter than ${expectedScriptHeight}px`)
    assert.equal(voiceoverEditorResize, 'vertical', `${width}px voiceover editor is not vertically resizable`)
    assert.ok(imagePromptHeight < voiceoverEditorHeight, `${width}px non-script image prompt was enlarged with script editors`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px visuals horizontal overflow`)
    await voiceoverEditor.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(out, `${width}-voiceover-script-editor.png`) })

    assert.deepEqual([...new Set(fixtureResponses)], ['blocked', 'ready'], `${width}px did not read both deployed fixture states`)
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
      script_editor_heights: {
        expected_minimum: expectedScriptHeight,
        post_text: postEditorHeight,
        voiceover_script: voiceoverEditorHeight,
        image_prompt_control: imagePromptHeight,
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
