const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4034').replace(/\/$/, '')
const baseOrigin = new URL(base).origin
const contentId = 'deterministic-visual-binding-qa'
const outputDir = path.resolve('docs/social-content/qa/visual-approval-summary')
const tempDir = path.resolve('test-results/visual-approval-summary')
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
const themes = [
  { name: 'light', preference: 'light', colorScheme: 'light', resolved: 'light' },
  { name: 'dark', preference: 'dark', colorScheme: 'dark', resolved: 'dark' },
  { name: 'system', preference: 'system', colorScheme: 'light', resolved: 'light' },
]
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
]
const routeFor = (state) => `${base}/admin/social-content/${contentId}?step=visuals&qa=visual-approval-summary&qa_state=${state}`

async function assertTheme(page, theme) {
  await page.waitForFunction(
    ({ resolved }) => document.documentElement.classList.contains('dark') === (resolved === 'dark'),
    { resolved: theme.resolved },
  )
  const state = await page.evaluate(() => ({
    preference: localStorage.getItem('theme'),
    resolved: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  }))
  assert.equal(state.preference, theme.preference)
  assert.equal(state.resolved, theme.resolved)
}

async function assertApprovedSummary(page) {
  const currentReview = page.getByLabel('Current review action')
  await expect(currentReview.getByText('Visual asset approved')).toBeVisible()
  await expect(currentReview.locator('[data-contrast-audit="current-review-state"]')).toHaveText('Approved')
  const visualStep = page.getByRole('button', { name: 'Approval step 3: Amina Visuals' })
  await expect(visualStep.getByText('Current visual approved')).toBeVisible()
  await expect(visualStep.getByText('Approved', { exact: true })).toBeVisible()
  await expect(page.getByText('Visual assets: Approved').first()).toBeVisible()
  await expect(page.getByText(/Receipt provider-none-[a-f0-9]+ · provider none · external call false/i)).toBeVisible()
  await expect(page.getByAltText('Deterministic AmaduTown review asset').first()).toBeVisible()
}

;(async () => {
  const browser = await chromium.launch()
  const results = []
  const videos = []

  for (const theme of themes) {
    for (const viewport of viewports) {
      const prefix = `${viewport.width}-${theme.name}`
      const externalRequests = []
      const mutationRequests = []
      const pageErrors = []
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme.colorScheme,
        recordVideo: { dir: tempDir, size: { width: viewport.width, height: viewport.height } },
        serviceWorkers: 'block',
      })
      await context.addInitScript(({ browserSession, themePreference }) => {
        localStorage.setItem('theme', themePreference)
        const originalGetItem = Storage.prototype.getItem
        Storage.prototype.getItem = function getItem(key) {
          if (/^sb-.*-auth-token$/.test(key)) return JSON.stringify(browserSession)
          if (key === 'theme') return themePreference
          return originalGetItem.call(this, key)
        }
      }, { browserSession: session, themePreference: theme.preference })

      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const method = request.method()
        const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })

        if (url.hostname === 'va.vercel-scripts.com' || url.hostname === 'vercel.live') return route.abort()
        if (url.pathname === '/auth/v1/user') return json(user)
        if (url.pathname === '/rest/v1/user_profiles') return json([{ id: user.id, email: user.email, role: 'admin' }])
        if (url.origin !== baseOrigin) {
          externalRequests.push(`${method} ${url.origin}${url.pathname}`)
          return route.abort()
        }
        if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
        if (url.pathname === `/api/admin/social-content/${contentId}` && method === 'GET') return route.continue()
        if (url.pathname.startsWith('/api/')) {
          if (method !== 'GET') mutationRequests.push(`${method} ${url.pathname}`)
          return json({ items: [], configs: [], references: [], data: [] })
        }
        return route.continue()
      })

      const page = await context.newPage()
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.goto(routeFor('approved'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Synthetic production-equivalent fixture')).toBeVisible({ timeout: 90000 })
      await assertTheme(page, theme)
      await assertApprovedSummary(page)

      const nextAction = page.getByText('Next action and blockers')
      await nextAction.click()
      await expect(page.getByLabel('Current review action').getByText(/current visual is approved.*media package gate/i)).toBeVisible()
      await page.getByRole('link', { name: 'Open current decision' }).click()
      await expect(page.locator('#social-visual-assets-gate')).toBeFocused()
      await page.getByText('Next: media package').click()
      await expect(page.getByRole('button', { name: 'Prepare Asset Packet' })).toBeVisible()
      await page.screenshot({ path: path.join(outputDir, `${prefix}-approved-summary.png`), fullPage: true })

      await page.reload({ waitUntil: 'domcontentloaded' })
      await assertTheme(page, theme)
      await assertApprovedSummary(page)

      await page.goto(routeFor('stale'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByLabel('Deterministic visual render status')).toHaveAttribute('data-visual-operator-state', 'rendered_stale')
      await expect(page.getByRole('button', { name: 'Approve Visuals' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Render updated visual' })).toBeEnabled()
      await expect(page.getByLabel('Current review action').getByText('Pending')).toBeVisible()
      await page.screenshot({ path: path.join(outputDir, `${prefix}-stale-fail-closed.png`), fullPage: true })

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${prefix} horizontal overflow`)
      assert.deepEqual(externalRequests, [], `${prefix} external requests`)
      assert.deepEqual(mutationRequests, [], `${prefix} mutation requests`)
      assert.deepEqual(pageErrors, [], `${prefix} page errors`)

      const video = page.video()
      await context.close()
      const rawVideo = await video.path()
      const mp4 = path.join(outputDir, `${prefix}-walkthrough.mp4`)
      execFileSync('ffmpeg', ['-y', '-i', rawVideo, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
      fs.unlinkSync(rawVideo)
      const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp4], { encoding: 'utf8' }).trim())
      assert.ok(Number.isFinite(duration) && duration > 1, `${prefix} playable MP4`)
      videos.push(mp4)
      results.push({
        route: routeFor('approved'),
        stale_route: routeFor('stale'),
        viewport,
        theme,
        approved_summary: true,
        reload_preserved: true,
        stale_fail_closed: true,
        horizontal_overflow: false,
        external_requests: 0,
        mutation_requests: 0,
        page_errors: [],
        video: path.relative(process.cwd(), mp4),
        duration_seconds: Number(duration.toFixed(2)),
      })
    }
  }

  await browser.close()
  const combinedVideo = path.join(outputDir, 'social-visual-approval-summary-walkthrough.mp4')
  const videoInputs = videos.flatMap((video) => ['-i', video])
  const normalizedStreams = videos.map((_, index) => (
    `[${index}:v]scale=1440:1024:force_original_aspect_ratio=decrease,pad=1440:1024:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${index}]`
  ))
  const concatStreams = videos.map((_, index) => `[v${index}]`).join('')
  execFileSync('ffmpeg', [
    '-y',
    ...videoInputs,
    '-filter_complex', `${normalizedStreams.join(';')};${concatStreams}concat=n=${videos.length}:v=1:a=0[outv]`,
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    combinedVideo,
  ], { stdio: 'ignore' })
  const combinedDuration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', combinedVideo], { encoding: 'utf8' }).trim())
  assert.ok(Number.isFinite(combinedDuration) && combinedDuration > videos.length, 'combined MP4 is playable')
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify({ results, combined_video: path.relative(process.cwd(), combinedVideo), combined_duration_seconds: Number(combinedDuration.toFixed(2)) }, null, 2)}\n`)
  console.log(JSON.stringify({ checks: results.length, combined_video: combinedVideo, combined_duration_seconds: Number(combinedDuration.toFixed(2)) }, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
