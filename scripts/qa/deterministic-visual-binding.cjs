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

async function pauseAtWorkflowStep(page, step) {
  const locator = page.locator(`[data-visual-workflow-step="${step}"]`)
  await locator.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
  })
  await page.waitForTimeout(650)
}

;(async () => {
  const browser = await chromium.launch()
  const results = []
  const themes = [
    { name: 'system-light', preference: 'system', colorScheme: 'light', resolved: 'light' },
    { name: 'dark', preference: 'dark', colorScheme: 'dark', resolved: 'dark' },
  ]

  for (const theme of themes) {
    for (const width of [390, 768, 1440]) {
      const height = width === 390 ? 844 : 1000
      const external = []
      const unexpectedMutations = []
      const pageErrors = []
      const fixtureResponses = []
      let renderRequests = 0
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme.colorScheme,
        recordVideo: { dir: tempDir, size: { width, height } },
        serviceWorkers: 'block',
      })
      await context.addInitScript(({ session, themePreference }) => {
        localStorage.setItem('theme', themePreference)
        const originalGetItem = Storage.prototype.getItem
        Storage.prototype.getItem = function getItem(key) {
          if (/^sb-.*-auth-token$/.test(key)) return JSON.stringify(session)
          if (key === 'theme') return themePreference
          return originalGetItem.call(this, key)
        }
      }, { session, themePreference: theme.preference })
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

      const evidencePrefix = `${width}-${theme.name}`
      await page.goto(routeFor('ready'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Synthetic production-equivalent fixture')).toBeVisible({ timeout: 90000 })
      await page.waitForFunction(({ resolved }) => document.documentElement.classList.contains('dark') === (resolved === 'dark'), { resolved: theme.resolved })
      const themeState = await page.evaluate(() => ({ preference: localStorage.getItem('theme'), darkClass: document.documentElement.classList.contains('dark') }))
      assert.equal(themeState.preference, theme.preference, `${evidencePrefix} persisted theme preference`)
      assert.equal(themeState.darkClass, theme.resolved === 'dark', `${evidencePrefix} resolved theme class`)

      const renderStatus = page.getByLabel('Deterministic visual render status')
      const effectiveInputs = page.getByLabel('Inputs used for this render')
      await expect(renderStatus.getByText('Ready to render')).toBeVisible()
      await expect(renderStatus.getByText('Provider none')).toBeVisible()
      await expect(effectiveInputs.getByText('architecture', { exact: true }).first()).toBeVisible()
      await expect(effectiveInputs.getByText('Inputs used for this render')).toBeVisible()
      await expect(effectiveInputs.getByText(/Constraint/)).toBeVisible()
      await expect(page.getByRole('textbox', { name: /image prompt/i })).toHaveCount(0)
      await expect(page.getByText('No image prompt is used by the deterministic renderer.')).toBeVisible()
      const workflowOrder = await page.locator('[data-visual-workflow-step]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-visual-workflow-step')))
      assert.deepEqual(workflowOrder, ['format', 'configuration', 'render', 'preview', 'decision'], `${evidencePrefix} workflow order`)
      await expect(page.getByText(/Gemini, HeyGen, n8n media, and other media providers stay off/i)).toBeVisible()
      const renderButton = page.getByRole('button', { name: 'Render deterministic visual' })
      await expect(renderButton).toBeEnabled()
      await pauseAtWorkflowStep(page, 'format')
      await pauseAtWorkflowStep(page, 'configuration')
      await pauseAtWorkflowStep(page, 'render')
      await revealBelowStickyHeader(page, renderStatus)
      await page.waitForTimeout(1000)
      await page.screenshot({ path: path.join(outputDir, `${evidencePrefix}-ready.png`) })

      await renderButton.click()
      await expect(page.getByRole('button', { name: 'Review asset current' })).toBeDisabled()
      await expect(renderStatus.getByText('Asset current')).toBeVisible()
      await expect(renderStatus.getByText(/provider none · external call false/i)).toBeVisible()
      const reviewAsset = page.getByAltText('Deterministic AmaduTown review asset').first()
      await expect(reviewAsset).toBeVisible()
      await revealBelowStickyHeader(page, renderStatus)
      await page.waitForTimeout(1200)
      await page.screenshot({ path: path.join(outputDir, `${evidencePrefix}-current.png`) })
      await revealBelowStickyHeader(page, reviewAsset)
      await page.waitForTimeout(1000)
      await page.screenshot({ path: path.join(outputDir, `${evidencePrefix}-current-asset.png`) })
      await pauseAtWorkflowStep(page, 'decision')

      const visualAudit = await page.evaluate(({ resolved }) => {
        const parse = (value) => {
          const parts = value.match(/[\d.]+/g)?.map(Number) || []
          return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 }
        }
        const composite = (front, back) => {
          const alpha = front.a + back.a * (1 - front.a)
          if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }
          return {
            r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
            g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
            b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
            a: alpha,
          }
        }
        const luminance = ({ r, g, b }) => {
          const values = [r, g, b].map((channel) => {
            const value = channel / 255
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
          return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
        }
        const effectiveBackground = (element) => {
          const ancestors = []
          let current = element
          while (current) {
            ancestors.unshift(current)
            current = current.parentElement
          }
          let color = { r: 255, g: 255, b: 255, a: 1 }
          for (const ancestor of ancestors) color = composite(parse(getComputedStyle(ancestor).backgroundColor), color)
          return color
        }
        const contrast = (foreground, background) => {
          const lighter = Math.max(luminance(foreground), luminance(background))
          const darker = Math.min(luminance(foreground), luminance(background))
          return (lighter + 0.05) / (darker + 0.05)
        }
        const contrastChecks = Array.from(document.querySelectorAll('[data-contrast-audit]')).map((element) => {
          const styles = getComputedStyle(element)
          const background = effectiveBackground(element)
          const foreground = composite(parse(styles.color), background)
          const ratio = contrast(foreground, background)
          const fontSize = Number.parseFloat(styles.fontSize)
          const fontWeight = Number.parseInt(styles.fontWeight, 10) || 400
          const minimum = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5
          return { name: element.getAttribute('data-contrast-audit'), ratio: Number(ratio.toFixed(2)), minimum }
        })
        const surfaces = Array.from(document.querySelectorAll('[data-theme-surface]')).map((element) => {
          const background = effectiveBackground(element)
          return { name: element.getAttribute('data-theme-surface'), luminance: Number(luminance(background).toFixed(3)) }
        })
        const laneElement = document.querySelector('[data-social-detail-content]')
        const lane = laneElement.getBoundingClientRect()
        const laneStyles = getComputedStyle(laneElement)
        const horizontalPadding = Number.parseFloat(laneStyles.paddingLeft) + Number.parseFloat(laneStyles.paddingRight)
        return {
          resolvedTheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          contentLane: { left: Number(lane.left.toFixed(1)), right: Number(lane.right.toFixed(1)), width: Number(lane.width.toFixed(1)), usableWidth: Number((lane.width - horizontalPadding).toFixed(1)), viewportWidth: innerWidth },
          contrastChecks,
          surfaces,
          darkPanelLeakage: resolved === 'light' ? surfaces.filter((surface) => surface.luminance < 0.45).map((surface) => surface.name) : [],
          lightPanelLeakage: resolved === 'dark' ? surfaces.filter((surface) => surface.luminance > 0.45).map((surface) => surface.name) : [],
        }
      }, { resolved: theme.resolved })
      assert.equal(visualAudit.resolvedTheme, theme.resolved, `${evidencePrefix} visual audit theme`)
      assert.ok(visualAudit.contentLane.width > 0, `${evidencePrefix} content lane width`)
      assert.ok(visualAudit.contentLane.usableWidth > 0, `${evidencePrefix} usable content lane width`)
      assert.ok(visualAudit.contentLane.left >= 0 && visualAudit.contentLane.right <= width + 1, `${evidencePrefix} content lane bounds`)
      assert.ok(visualAudit.contrastChecks.length >= 4, `${evidencePrefix} contrast sample coverage`)
      for (const check of visualAudit.contrastChecks) assert.ok(check.ratio >= check.minimum, `${evidencePrefix} ${check.name} contrast ${check.ratio} < ${check.minimum}`)
      assert.deepEqual(visualAudit.darkPanelLeakage, [], `${evidencePrefix} dark review-panel leakage`)
      assert.deepEqual(visualAudit.lightPanelLeakage, [], `${evidencePrefix} light review-panel leakage`)

      await page.goto(routeFor('missing_candidate'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('The deterministic HTML/SVG candidate is missing or incomplete.')).toBeVisible({ timeout: 90000 })
      await expect(page.getByText('Render blocked')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Render deterministic visual' })).toBeDisabled()
      await revealBelowStickyHeader(page, page.getByLabel('Deterministic visual render status'))
      await page.waitForTimeout(900)
      await page.screenshot({ path: path.join(outputDir, `${evidencePrefix}-missing-candidate.png`) })

      await page.goto(routeFor('architecture_mismatch'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Architecture visuals require explicit connectors between every adjacent node.')).toBeVisible({ timeout: 90000 })
      await expect(page.getByText(/Provide exactly three labeled architecture nodes and two labeled connectors/i)).toBeVisible()
      await expect(page.getByText('Render blocked')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Render deterministic visual' })).toBeDisabled()
      await revealBelowStickyHeader(page, page.getByLabel('Deterministic visual render status'))
      await page.waitForTimeout(900)
      await page.screenshot({ path: path.join(outputDir, `${evidencePrefix}-architecture-mismatch.png`) })

      await page.goto(routeFor('storage_unavailable'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Internal Social Content storage is unavailable.')).toBeVisible({ timeout: 90000 })
      await expect(page.getByText(/No provider fallback is allowed/i)).toBeVisible()
      await revealBelowStickyHeader(page, page.getByLabel('Deterministic visual render status'))
      await page.waitForTimeout(900)
      await page.screenshot({ path: path.join(outputDir, `${evidencePrefix}-storage-blocked.png`) })

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${evidencePrefix} horizontal overflow`)
      assert.equal(renderRequests, 1, `${evidencePrefix} should issue one synthetic render request`)
      assert.deepEqual(unexpectedMutations, [], `${evidencePrefix} emitted an unexpected mutation`)
      assert.deepEqual(external, [], `${evidencePrefix} emitted an external request`)
      assert.deepEqual(pageErrors, [], `${evidencePrefix} emitted a page error`)
      results.push({
        width,
        height,
        theme: theme.name,
        persisted_theme: theme.preference,
        resolved_theme: theme.resolved,
        route: routeFor('ready'),
        fixture_states: ['ready', 'current', 'missing_candidate', 'architecture_mismatch', 'storage_unavailable'],
        fixture_responses: fixtureResponses,
        workflow_order: workflowOrder,
        deterministic_image_prompt_controls: 0,
        content_lane: visualAudit.contentLane,
        contrast_checks: visualAudit.contrastChecks,
        theme_surfaces: visualAudit.surfaces,
        dark_panel_leakage: visualAudit.darkPanelLeakage,
        light_panel_leakage: visualAudit.lightPanelLeakage,
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
      const mp4 = path.join(outputDir, `${evidencePrefix}-walkthrough.mp4`)
      execFileSync('ffmpeg', [
        '-y', '-i', rawVideo,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        mp4,
      ], { stdio: 'ignore' })
      fs.unlinkSync(rawVideo)
    }
  }

  await browser.close()
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
