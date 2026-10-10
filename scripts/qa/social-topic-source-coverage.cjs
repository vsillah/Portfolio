const { chromium, expect } = require('@playwright/test')
const esbuild = require('esbuild')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')

const base = process.env.SOCIAL_TOPIC_QA_BASE || 'http://127.0.0.1:4032'
const outputDir = path.resolve('docs/social-content/qa/topic-source-coverage')
const tempDir = path.resolve('test-results/topic-source-coverage')
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(tempDir, { recursive: true })

const productCoverage = [
  { product_id: 'dark_castle_chess', label: 'Dark Castle Chess', status: 'ready', receipt_ids: ['receipt-dcc'] },
  { product_id: 'accelerated', label: 'Accelerated', status: 'ready', receipt_ids: ['receipt-accelerated'] },
  { product_id: 'agentified', label: 'Agentified', status: 'ready', receipt_ids: ['receipt-agentified'] },
]
const sourceCollections = [
  { source_group: 'open_brain', status: 'ready', receipt_count: 2, blocker: null },
  { source_group: 'meeting_summaries', status: 'ready', receipt_count: 1, blocker: null },
  { source_group: 'owned_media_summaries', status: 'ready', receipt_count: 1, blocker: null },
  { source_group: 'app_prototypes', status: 'ready', receipt_count: 2, blocker: null },
  { source_group: 'amadutown_catalog', status: 'ready', receipt_count: 4, blocker: null },
]
const approvedReceipt = {
  receipt_id: 'source-receipt:agentified-publication',
  source_id: 'publications:agentified',
  source_kind: 'amadutown_book',
  approval_status: 'approved',
  approved_at: '2026-10-09T12:00:00.000Z',
  approved_by: 'public_catalog_state',
  privacy_classification: 'public_safe',
  provenance: 'public_catalog:publications:agentified',
  summary_sha256: 'a'.repeat(64),
  product_ids: ['agentified'],
  raw_content_included: false,
}
const candidate = {
  id: 'topic-agentified-operating-lesson',
  candidate_key: `topic-${'b'.repeat(40)}`,
  title: 'Agentified: the operating lesson behind the product',
  triggering_event: 'An approved public book summary shows why accountable AI work needs visible source and decision boundaries.',
  source_type: 'portfolio_work',
  source_label: 'Agentified',
  source_ids: ['publications:agentified'],
  why_vambah_can_speak: 'This angle is grounded in an approved AmaduTown publication receipt.',
  brand_goal: 'Maintain recurring, evidence-backed Agentified coverage.',
  content_angle: 'Explain the operating choice behind accountable agent systems.',
  suggested_hook: 'An agent becomes useful when its authority is as visible as its output.',
  audience: 'Operators and product leaders',
  sensitivity: 'public_safe',
  evidence_summary: 'Approved public Agentified summary.',
  claim_boundaries: ['Verify performance claims before drafting.'],
  source_receipts: [approvedReceipt],
  product_ids: ['agentified'],
  priority_score: 70,
  priority_tier: 'medium',
  priority_reasons: ['Required product coverage: Agentified', 'Public-safe summary'],
  dedupe_fingerprint: 'b'.repeat(64),
  status: 'available',
}

async function run() {
  await esbuild.build({
    stdin: {
      contents: "export {tables,user} from './scripts/qa/linkedin-video-fixture';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    packages: 'external',
    outfile: path.join(tempDir, 'fixture.cjs'),
  })
  const fixture = require(path.join(tempDir, 'fixture.cjs'))
  const item = fixture.tables.social_content_queue[0]
  item.status = 'draft'
  item.platform = 'linkedin'
  item.target_platforms = ['linkedin']
  item.rag_context = {
    source: 'agent_ops_social_outreach_goal',
    goal_id: 'qa-source-coverage',
    content_packet_id: 'qa-source-coverage-packet',
    content_calibration: { status: 'ready_for_draft_review' },
    qa_fixture: {
      read_only: false,
      reason: 'Privacy-safe source-coverage fixture.',
      next_action: 'Review product coverage, source scan receipts, topic priority, and blocked recovery. The QA transport rejects every mutation.',
    },
  }

  const browser = await chromium.launch()
  const results = []
  for (const width of [390, 768, 1440]) {
    const height = width === 390 ? 844 : 1000
    let coverageMode = 'ready'
    const external = []
    const pageErrors = []
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: tempDir, size: { width, height } },
      serviceWorkers: 'block',
    })
    await context.addInitScript((user) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify({
        access_token: 'synthetic-token',
        refresh_token: 'synthetic-refresh',
        expires_at: 4102444800,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      }))
    }, fixture.user)
    await context.addInitScript(() => {
      const append = Node.prototype.appendChild
      const insert = Node.prototype.insertBefore
      const isTelemetry = (node) => node instanceof HTMLScriptElement && node.src.startsWith('https://va.vercel-scripts.com/')
      Node.prototype.appendChild = function appendWithoutTelemetry(node) {
        return isTelemetry(node) ? node : append.call(this, node)
      }
      Node.prototype.insertBefore = function insertWithoutTelemetry(node, reference) {
        return isTelemetry(node) ? node : insert.call(this, node, reference)
      }
    })
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (url.origin === 'http://127.0.0.1:3999' && url.pathname === '/auth/v1/user') return json(fixture.user)
      if (url.origin !== base) {
        external.push(`${method} ${url.origin}${url.pathname}`)
        return route.abort()
      }
      if (url.pathname === '/api/user/profile') return json({ profile: { ...fixture.user, role: 'admin' } })
      if (url.pathname === `/api/admin/social-content/${item.id}`) return json({ item })
      if (url.pathname === '/api/admin/social-content/topic-backlog') {
        if (method !== 'GET') throw new Error(`Unexpected topic backlog mutation: ${method}`)
        if (coverageMode === 'ready') {
          return json({
            items: [candidate],
            coverage_report: {
              version: 'social_topic_source_coverage_v1',
              status: 'ready',
              source_receipt_count: 10,
              source_kind_counts: { amadutown_book: 1 },
              source_collections: sourceCollections,
              products: productCoverage,
              blockers: [],
            },
          })
        }
        return json({
          items: [{ ...candidate, source_receipts: [] }],
          coverage_report: {
            version: 'social_topic_source_coverage_v1',
            status: 'blocked',
            source_receipt_count: 9,
            source_kind_counts: {},
            source_collections: sourceCollections.map((source) => source.source_group === 'meeting_summaries'
              ? { ...source, status: 'blocked', receipt_count: 0, blocker: '[source_collection_failed:meeting_summaries] Restore read access and retry.' }
              : source),
            products: productCoverage.map((product) => product.product_id === 'agentified'
              ? { ...product, status: 'blocked', receipt_ids: [], blocker: 'Approve an Agentified summary.' }
              : product),
            blockers: [
              '[source_collection_failed:meeting_summaries] Restore read access and retry.',
              '[product_coverage_receipt_missing:agentified] Approve an Agentified summary.',
            ],
          },
        })
      }
      if (url.pathname.startsWith('/api/')) {
        if (method !== 'GET') throw new Error(`Unexpected fixture mutation: ${method} ${url.pathname}`)
        return json({ data: [], items: [], configs: [], references: [], count: 0 })
      }
      return route.continue()
    })

    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const routeUrl = `${base}/admin/social-content/${item.id}?step=copy&qa=topic-source-coverage`
    await page.goto(routeUrl, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('LinkedIn topics from Agentic Backlog')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText('Coverage: ready')).toBeVisible()
    await expect(page.getByText('Dark Castle Chess: covered')).toBeVisible()
    await expect(page.getByText('Accelerated: covered')).toBeVisible()
    await expect(page.getByText('Agentified: covered')).toBeVisible()
    await expect(page.getByText('meeting summaries: 1')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Use topic' })).toBeEnabled()
    await page.getByText('LinkedIn topics from Agentic Backlog').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1800)
    await page.getByText('Receipts and boundaries').click()
    await expect(page.getByText('1 approved source receipt(s)')).toBeVisible()
    await page.waitForTimeout(1400)
    await page.screenshot({ path: path.join(outputDir, `${width}-ready.png`), fullPage: true })

    coverageMode = 'blocked'
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Coverage: blocked')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText('Agentified: needs receipt')).toBeVisible()
    await expect(page.getByText('meeting summaries: scan blocked')).toBeVisible()
    await expect(page.getByText('Resolve 2 source coverage blocker(s)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Receipts required' })).toBeDisabled()
    await page.getByText('LinkedIn topics from Agentic Backlog').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1800)
    await page.getByText('Resolve 2 source coverage blocker(s)').click()
    await expect(page.getByText(/source_collection_failed:meeting_summaries/)).toBeVisible()
    await page.waitForTimeout(1600)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px horizontal overflow`)
    await page.screenshot({ path: path.join(outputDir, `${width}-blocked.png`), fullPage: true })

    assert.deepEqual(external, [], `${width}px fixture made external requests`)
    assert.deepEqual(pageErrors, [], `${width}px fixture raised page errors`)
    const video = page.video()
    await context.close()
    const rawVideo = await video.path()
    const mp4 = path.join(outputDir, `${width}-walkthrough.mp4`)
    execFileSync('ffmpeg', ['-y', '-i', rawVideo, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
    results.push({ width, route: routeUrl, ready: true, blocked: true, external_requests: 0, production_mutations: 0, page_errors: 0, video: path.relative(process.cwd(), mp4) })
  }
  await browser.close()
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
