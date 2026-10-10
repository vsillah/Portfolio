const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4036').replace(/\/$/, '')
const routePath = '/admin/social-content?workflow=evidence'
const outputDir = path.resolve('docs/social-content/qa/dynamic-source-coverage')
const tempDir = path.resolve('test-results/dynamic-source-coverage')
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(tempDir, { recursive: true })

const user = { id: 'privacy-safe-qa-admin', email: 'qa@example.invalid', role: 'authenticated', aud: 'authenticated', user_metadata: {}, app_metadata: {} }
const session = { access_token: 'privacy-safe-qa-token', refresh_token: 'privacy-safe-qa-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user }

;(async () => {
  const browser = await chromium.launch()
  const liveSnapshot = JSON.parse(execFileSync('npx', ['tsx', 'scripts/qa/social-source-coverage-live-snapshot.ts'], { encoding: 'utf8' }))
  const results = []
  const clips = []
  const scenarios = [
    { width: 1440, theme: 'dark' },
    { width: 1440, theme: 'light' },
    { width: 768, theme: 'dark' },
    { width: 768, theme: 'light' },
    { width: 390, theme: 'dark' },
    { width: 390, theme: 'light' },
  ]

  for (const { width, theme } of scenarios) {
    const height = width === 390 ? 844 : 1000
    const mutations = []
    const providerCalls = []
    const pageErrors = []
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: tempDir, size: { width, height } },
      serviceWorkers: 'block',
      extraHTTPHeaders: process.env.VERCEL_OIDC_TOKEN
        ? { 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN }
        : undefined,
    })
    await context.addInitScript(({ session, theme }) => {
      localStorage.setItem('theme', theme)
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = function getItem(key) {
        if (/^sb-.*-auth-token$/.test(key)) return JSON.stringify(session)
        return originalGetItem.call(this, key)
      }
    }, { session, theme })
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (method !== 'GET' && url.pathname.startsWith('/api/')) mutations.push(`${method} ${url.pathname}`)
      if (/publish|schedule|upload|provider|slack|gmail|linkedin|youtube|tiktok|instagram|facebook/i.test(url.pathname)
        && !url.pathname.includes('/config')) providerCalls.push(`${method} ${url.pathname}`)
      if (url.hostname === 'va.vercel-scripts.com' || url.hostname === 'vercel.live') return route.abort()
      if (url.pathname === '/auth/v1/user') return json(user)
      if (url.pathname === '/rest/v1/user_profiles') return json([{ id: user.id, email: user.email, role: 'admin' }])
      if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
      if (url.pathname === '/api/admin/social-content/source-coverage') return json(liveSnapshot)
      if (url.origin === new URL(base).origin && url.pathname.startsWith('/api/')) {
        return json({ items: [], configs: [], intakes: [], stats: { draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 }, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
      }
      if (url.origin !== new URL(base).origin) return route.abort()
      return route.continue()
    })

    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`${base}${routePath}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin\/social-content\?workflow=evidence/, { timeout: 90000 })
    await expect(page.getByRole('tab', { name: /Launch evidence/i })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Coverage before candidate creation' })).toBeVisible({ timeout: 90000 })
    await expect(page.getByText(/Branches prove development; previews do not prove production/i)).toBeVisible()

    const coverage = page.locator('section[aria-labelledby="source-coverage-heading"]')
    await coverage.scrollIntoViewIfNeeded()
    await page.waitForTimeout(theme === 'light' ? 600 : 150)
    await page.evaluate((nextTheme) => {
      const adminMain = document.querySelector('#admin-main')
      const adminRoot = adminMain?.parentElement?.parentElement
      document.documentElement.classList.toggle('dark', nextTheme === 'dark')
      adminRoot?.classList.toggle('dark', nextTheme === 'dark')
      adminRoot?.setAttribute('data-qa-theme', nextTheme)
    }, theme)
    await page.waitForTimeout(900)
    const priorityList = coverage.getByTestId('priority-coverage-list')
    await expect(priorityList.getByTestId('coverage-product-row')).toHaveCount(3)
    await priorityList.getByTestId('coverage-product-row').first().locator('summary').click()
    const directoryToggle = coverage.getByText('Additional product directory')
    await directoryToggle.click()
    const directoryPage = coverage.getByTestId('additional-product-page')
    const visibleDirectoryRows = await directoryPage.getByTestId('coverage-product-row').count()
    assert.ok(visibleDirectoryRows <= 5, `${theme} ${width}px directory rendered ${visibleDirectoryRows} rows`)
    await directoryToggle.click()
    await coverage.getByText('Collector freshness, failures, and recovery').click()
    await expect(coverage.getByText(/Recovery:/).first()).toBeVisible()
    await page.waitForTimeout(900)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme} ${width}px horizontal overflow`)
    const themeMetrics = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="Search recurring priorities"]')
      const section = document.querySelector('section[aria-labelledby="source-coverage-heading"]')
      const rgbLuma = (value) => {
        const values = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
        return Math.round((values[0] * 0.2126) + (values[1] * 0.7152) + (values[2] * 0.0722))
      }
      const inputStyle = input ? getComputedStyle(input) : null
      const sectionStyle = section ? getComputedStyle(section) : null
      return {
        input_background: inputStyle?.backgroundColor ?? '',
        input_background_luma: rgbLuma(inputStyle?.backgroundColor ?? ''),
        input_text_luma: rgbLuma(inputStyle?.color ?? ''),
        section_background: sectionStyle?.backgroundColor ?? '',
      }
    })
    if (theme === 'dark') {
      assert.ok(themeMetrics.input_background_luma < 120, `dark ${width}px search input is too bright: ${themeMetrics.input_background}`)
      assert.ok(themeMetrics.input_text_luma > 150, `dark ${width}px search text lacks contrast`)
    } else {
      assert.ok(themeMetrics.input_background_luma > 180, `light ${width}px search input is too dark: ${themeMetrics.input_background}`)
      assert.ok(themeMetrics.input_text_luma < 120, `light ${width}px search text lacks contrast`)
    }
    const screenshotName = theme === 'dark' ? `${width}-launch-evidence.png` : `${width}-light-launch-evidence.png`
    await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: true })
    await page.waitForTimeout(700)

    assert.equal(mutations.length, 0, `${theme} ${width}px QA made a mutation: ${mutations.join(', ')}`)
    assert.equal(providerCalls.length, 0, `${theme} ${width}px QA called a provider: ${providerCalls.join(', ')}`)
    assert.equal(pageErrors.length, 0, `${theme} ${width}px QA emitted a page error: ${pageErrors.join(', ')}`)
    const summary = await coverage.innerText()
    results.push({
      width,
      theme,
      route: `${base}${routePath}`,
      source: 'live_read_only_collectors',
      coverage_visible: true,
      shows_freshness: /fresh|aging|stale|No successful scan/i.test(summary),
      shows_lifecycle: /insight|development|preview|production|public/i.test(summary),
      shows_recovery: /Recovery:/i.test(summary),
      priority_products_visible: await priorityList.getByTestId('coverage-product-row').count(),
      directory_rows_bounded: visibleDirectoryRows,
      mutations: 0,
      provider_calls: 0,
      page_errors: [],
      horizontal_overflow: false,
      theme_metrics: themeMetrics,
    })

    const video = page.video()
    await context.close()
    const raw = await video.path()
    const clip = path.join(tempDir, `${theme}-${width}.mp4`)
    execFileSync('ffmpeg', [
      '-y', '-i', raw,
      '-vf', 'scale=1440:1000:force_original_aspect_ratio=decrease,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:color=0x07101c',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', clip,
    ], { stdio: 'ignore' })
    fs.unlinkSync(raw)
    clips.push(clip)
  }

  await browser.close()
  const concatFile = path.join(tempDir, 'clips.txt')
  fs.writeFileSync(concatFile, clips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  const finalVideo = path.join(outputDir, 'dynamic-source-coverage-launch-evidence.mp4')
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', finalVideo], { stdio: 'ignore' })
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify({ finalVideo, results }, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
