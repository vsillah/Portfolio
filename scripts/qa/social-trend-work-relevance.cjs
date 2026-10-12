const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4042').replace(/\/$/, '')
const baseOrigin = new URL(base).origin
const outputDir = path.resolve('docs/social-content/qa/trend-work-relevance')
const tempDir = path.resolve('test-results/trend-work-relevance')
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(tempDir, { recursive: true })

const user = { id: 'trend-work-qa-admin', email: 'qa@example.invalid', role: 'authenticated', aud: 'authenticated', user_metadata: {}, app_metadata: {} }
const session = { access_token: 'privacy-safe-qa-token', refresh_token: 'privacy-safe-qa-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user }
const at = '2026-10-12T16:00:00.000Z'
const source = (key, label, count) => ({ key, label, status: 'ready', freshness: count ? 'fresh' : 'never', last_successful_scan: count ? at : null, scanned_at: at, receipt_count: count, product_count: count ? 2 : 0, collector_failure: null, recovery_action: `Restore the approved ${label} receipt path.` })
const candidate = (identity, label, event, basis, topics, score, receipts) => ({
  candidate_key: `trend-work:${identity}`, status: 'review_only', product_identity: identity, product_label: label,
  topic_identities: topics, title: `${label}: where current momentum meets demonstrated work`, triggering_event: event,
  why_vambah_can_speak: basis, content_angle: `Connect current momentum to demonstrated ${label} work.`, suggested_hook: 'The signal is moving.',
  evidence_summary: 'Approved privacy-safe evidence only.', source_receipt_ids: receipts, external_receipt_ids: [receipts[0]], work_receipt_ids: receipts.slice(1),
  freshness: 'fresh', priority_score: score, priority_reasons: ['Current approved public momentum', 'Stable product identity'], dedupe_fingerprint: `${identity}-fingerprint`,
  claim_boundaries: ['Development does not prove deployment.'], side_effects: { content_generation: false, approval: false, provider_call: false, draft_creation: false, schedule: false, publish: false },
})

const coverage = {
  version: 'social_topic_live_coverage_v1', generated_at: at, status: 'ready', review_only: true,
  source_policy: 'approved_privacy_safe_summaries_and_operational_receipts_only',
  sources: [
    source('public_momentum', 'Approved public news + social trends', 2),
    source('codex_insights', 'Codex insights + approved Open Brain', 1),
    source('repository_documents', 'Approved Portfolio repository evidence', 2),
    source('github_development', 'GitHub development', 1),
    source('vercel_deployments', 'Vercel deployments', 0),
    source('operational_records', 'Convex + Supabase approved records', 0),
    source('meeting_summaries', 'Approved meeting summaries', 0),
    source('owned_media_summaries', 'Approved owned-media summaries', 0),
    source('app_prototypes', 'App prototypes', 1),
    source('public_catalog', 'Public catalog + site', 2),
  ],
  products: [
    { product_identity: 'dark_castle_chess', label: 'Dark Castle Chess', current_stage: 'publicly_cataloged', stages: ['insight', 'in_development', 'publicly_cataloged'], receipt_count: 3, source_groups: ['public_momentum', 'github_development', 'public_catalog'], latest_evidence_at: at, gaps: [], historical_gaps: ['No production deployment evidence'], priority: true, priority_order: 1, priority_source: 'approved_metadata' },
    { product_identity: 'jev', label: 'Jev', current_stage: 'in_development', stages: ['insight', 'in_development'], receipt_count: 3, source_groups: ['public_momentum', 'repository_documents'], latest_evidence_at: at, gaps: [], historical_gaps: ['No public catalog/site release evidence'], priority: true, priority_order: 2, priority_source: 'approved_metadata' },
  ],
  receipts: Array.from({ length: 8 }, (_, index) => ({ receipt_id: `fixture-receipt-${index + 1}` })),
  gaps: [], historical_gaps: ['Dark Castle Chess: No production deployment evidence', 'Jev: No public catalog/site release evidence'], blockers: [],
  boundaries: [
    'Raw private conversations and transcripts are never collected.',
    'A branch or pull request proves development, not deployment.',
    'Trend joins remain review-only and cannot generate, approve, draft, schedule, or publish content.',
  ],
  trend_work_relevance: {
    version: 'trend_work_relevance_v1', generated_at: at, status: 'ready', review_only: true, blockers: [], source_receipt_count: 8,
    fresh_momentum_count: 2, stale_momentum_count: 0, deduplicated_momentum_count: 0, privacy_rejected_count: 0,
    candidates: [
      candidate('jev', 'Jev', 'Approved public momentum highlights governed capability analysis.', '2 approved firsthand Portfolio receipts connect this public signal to Jev.', ['governed_capability_analysis'], 96, ['jev-momentum', 'jev-analysis', 'jev-portfolio']),
      candidate('dark_castle_chess', 'Dark Castle Chess', 'Approved public momentum highlights explainable chess learning.', '2 approved firsthand Portfolio receipts connect this public signal to Dark Castle Chess.', ['explainable_chess_learning'], 94, ['dcc-momentum', 'dcc-github', 'dcc-product']),
    ],
  },
}

;(async () => {
  const browser = await chromium.launch()
  const results = []
  for (const width of [1440, 768, 390]) {
    const height = width === 390 ? 844 : 1000
    const mutations = []
    const external = []
    const pageErrors = []
    const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: tempDir, size: { width, height } }, serviceWorkers: 'block' })
    await context.addInitScript(({ session }) => {
      localStorage.setItem('theme', 'dark')
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
      if (url.origin !== baseOrigin) { external.push(`${method} ${url.origin}${url.pathname}`); return route.abort() }
      if (method !== 'GET' && url.pathname.startsWith('/api/')) mutations.push(`${method} ${url.pathname}`)
      if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
      if (url.pathname === '/api/admin/social-content/source-coverage') return json({ coverage })
      if (url.pathname.startsWith('/api/')) return json({ items: [], configs: [], intakes: [], references: [], stats: { draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 }, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
      return route.continue()
    })

    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`${base}/admin/social-content?workflow=evidence`, { waitUntil: 'domcontentloaded' })
    const section = page.getByTestId('trend-work-relevance')
    await expect(section).toBeVisible({ timeout: 90000 })
    await expect(section.getByTestId('trend-work-candidate')).toHaveCount(2)
    await expect(section.getByText('Jev', { exact: true })).toBeVisible()
    await expect(section.getByText('Dark Castle Chess', { exact: true })).toBeVisible()
    await expect(section.getByText('2 joined candidates')).toBeVisible()
    await expect(section.getByText(/no copy, approval, provider call, draft, schedule, or post is created here/i)).toBeVisible()
    await section.scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    assert.equal(overflow, false, `${width}px horizontal overflow`)
    assert.equal(mutations.length, 0, `${width}px QA made a mutation: ${mutations.join(', ')}`)
    assert.equal(external.length, 0, `${width}px QA made an external request: ${external.join(', ')}`)
    assert.equal(pageErrors.length, 0, `${width}px QA emitted a page error: ${pageErrors.join(', ')}`)
    await page.screenshot({ path: path.join(outputDir, `${width}-trend-work-relevance.png`), fullPage: true })
    await section.screenshot({ path: path.join(outputDir, `${width}-trend-work-relevance-panel.png`) })
    results.push({ width, route: `${base}/admin/social-content?workflow=evidence`, candidates: ['jev', 'dark_castle_chess'], mutations: 0, external_requests: 0, page_errors: [], horizontal_overflow: false })
    const video = page.video()
    await context.close()
    const raw = await video.path()
    execFileSync('ffmpeg', ['-y', '-i', raw, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(outputDir, `${width}-walkthrough.mp4`)], { stdio: 'ignore' })
    fs.unlinkSync(raw)
  }
  await browser.close()
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
})().catch((error) => { console.error(error); process.exit(1) })
