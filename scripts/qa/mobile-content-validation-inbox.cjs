const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4038').replace(/\/$/, '')
const routePath = '/admin/social-content?candidateQa=durable-candidates&workflow=evidence'
const outputDir = path.resolve('docs/social-content/qa/mobile-content-validation-inbox')
const tempDir = path.resolve('test-results/mobile-content-validation-inbox')
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(tempDir, { recursive: true })

const fixture = JSON.parse(execFileSync(
  path.resolve('node_modules/.bin/tsx'),
  ['-e', "import { buildSocialCandidateProjectionQaFixture } from './lib/social-candidate-projection-qa-fixture'; console.log(JSON.stringify({ coverage: buildSocialCandidateProjectionQaFixture() }))"],
  { encoding: 'utf8' },
))

const user = { id: 'privacy-safe-mobile-qa-admin', email: 'qa@example.invalid', role: 'authenticated', aud: 'authenticated', user_metadata: {}, app_metadata: {} }
const session = { access_token: 'privacy-safe-qa-token', refresh_token: 'privacy-safe-qa-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user }

async function runScenario(browser, scenario) {
  const { width, height, theme, colorScheme } = scenario
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    recordVideo: { dir: tempDir, size: { width: 1440, height: 900 } },
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

  const requests = []
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (method !== 'GET' && url.pathname.startsWith('/api/')) requests.push(`${method} ${url.pathname}`)
    if (url.hostname === 'va.vercel-scripts.com' || url.hostname === 'vercel.live') return route.abort()
    if (url.pathname === '/auth/v1/user') return json(user)
    if (url.pathname === '/rest/v1/user_profiles') return json([{ id: user.id, email: user.email, role: 'admin' }])
    if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
    if (url.pathname === '/api/admin/social-content/source-coverage') return json(fixture)
    if (url.origin === new URL(base).origin && url.pathname.startsWith('/api/')) return json({ items: [], configs: [], intakes: [] })
    if (url.origin !== new URL(base).origin) return route.abort()
    return route.continue()
  })

  const page = await context.newPage()
  const video = page.video()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${base}${routePath}`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/candidateQa=durable-candidates/)
  await expect(page.getByTestId('synthetic-candidate-qa-banner')).toBeVisible({ timeout: 90000 })
  await expect(page.getByTestId('mobile-decision-inbox')).toBeVisible()
  await expect(page.getByRole('button', { name: /Publish|Schedule|Approve candidate|Generate/i })).toHaveCount(0)

  const inbox = page.getByTestId('mobile-decision-inbox')
  await inbox.getByRole('tab', { name: 'Candidates' }).click()
  await expect(page).toHaveURL(/#candidate-inbox$/)
  await expect(inbox.getByRole('tab', { name: 'Candidates' })).toHaveAttribute('aria-selected', 'true')
  await page.waitForTimeout(700)
  const candidate = page.getByTestId('trend-work-candidate').first()
  await candidate.getByText(/Source lineage/i).click()
  await expect(candidate.getByTestId('candidate-source-lineage')).toBeVisible()
  await expect(candidate.getByRole('link', { name: 'Open source evidence' }).first()).toHaveAttribute('href', /^https:\/\//)
  await page.waitForTimeout(900)

  await expect(page.getByText('Candidate page 1 of 2 · 5 matches')).toBeVisible()
  await page.getByRole('button', { name: 'Next candidates' }).click()
  await expect(page.getByText('Candidate page 2 of 2 · 5 matches')).toBeVisible()
  await expect(page.getByTestId('trend-work-candidate')).toContainText('Dark Castle Chess')
  const candidateSearch = page.getByPlaceholder('Search review candidates')
  await candidateSearch.fill('MentorRI')
  await expect(page.getByText('Candidate page 1 of 1 · 1 matches')).toBeVisible()
  await expect(page.getByTestId('trend-work-candidate')).toContainText('MentorRI')
  await page.getByRole('button', { name: 'Reset candidate search' }).click()
  await expect(page.getByText('Candidate page 1 of 2 · 5 matches')).toBeVisible()
  await page.waitForTimeout(900)

  await page.getByTestId('collectors-metric').click()
  await expect(page).toHaveURL(/#source-run-history$/)
  await expect(inbox.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('source-run-history')).toContainText('Opening this inbox only reads the latest approved projection')
  await page.waitForTimeout(800)

  await page.getByTestId('receipts-metric').click()
  await expect(page).toHaveURL(/#candidate-inbox$/)
  await expect(inbox.getByRole('tab', { name: 'Candidates' })).toHaveAttribute('aria-selected', 'true')
  await page.getByTestId('products-metric').click()
  await expect(page).toHaveURL(/#candidate-inbox$/)
  await page.getByTestId('priority-gaps-metric').click()
  await expect(page).toHaveURL(/#source-blockers$/)
  await expect(inbox.getByRole('tab', { name: 'Blockers' })).toHaveAttribute('aria-selected', 'true')
  const blockers = page.getByTestId('source-blocker-inbox')
  await expect(blockers).toContainText('Candidate policy blockers')
  await expect(blockers.getByRole('link', { name: 'Review source policy' })).toHaveAttribute('href', '/admin/source-protocol')
  await expect(page.getByTestId('slack-disabled-specification')).toContainText('Disabled')
  await expect(page.getByTestId('slack-disabled-specification')).toContainText('No Slack connection')
  await page.goBack()
  await expect(page).toHaveURL(/#candidate-inbox$/)
  await page.goForward()
  await expect(page).toHaveURL(/#source-blockers$/)
  await page.waitForTimeout(1000)

  await page.screenshot({ path: path.join(outputDir, `${width}-${theme}-decision-inbox.png`), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme} ${width}px horizontal overflow`)
  assert.deepEqual(requests, [], `${theme} ${width}px emitted API mutations`)
  assert.deepEqual(pageErrors, [], `${theme} ${width}px page errors`)

  await page.waitForTimeout(1000)
  await context.close()
  return video.path()
}

;(async () => {
  const browser = await chromium.launch()
  const scenarios = [
    { width: 1440, height: 900, theme: 'light', colorScheme: 'light' },
    { width: 768, height: 900, theme: 'system', colorScheme: 'dark' },
    { width: 390, height: 844, theme: 'dark', colorScheme: 'dark' },
  ]
  const clips = []
  try {
    for (const scenario of scenarios) clips.push(await runScenario(browser, scenario))
  } finally {
    await browser.close()
  }

  const output = path.join(outputDir, 'mobile-content-validation-inbox-walkthrough.mp4')
  const inputs = clips.flatMap((clip) => ['-i', clip])
  const filters = clips.map((_, index) => `[${index}:v]fps=30,scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${index}]`).join(';')
  const concatInputs = clips.map((_, index) => `[v${index}]`).join('')
  execFileSync('ffmpeg', [
    '-y', ...inputs,
    '-filter_complex', `${filters};${concatInputs}concat=n=${clips.length}:v=1:a=0[outv]`,
    '-map', '[outv]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
  ], { stdio: 'inherit' })

  const result = {
    route: `${base}${routePath}`,
    scenarios,
    screenshots: scenarios.map(({ width, theme }) => `${width}-${theme}-decision-inbox.png`),
    walkthrough: path.basename(output),
    tabs: ['Candidates', 'Run history', 'Blockers'],
    candidate_page_size: 4,
    candidate_records: 5,
    metric_destinations_checked: ['Collectors', 'Receipts', 'Products', 'Priority gaps'],
    browser_back_forward_checked: true,
    external_writes: 0,
    api_mutations: 0,
    slack_connection: false,
    passed: true,
  }
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
