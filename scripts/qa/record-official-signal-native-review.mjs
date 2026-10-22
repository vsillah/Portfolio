import { chromium } from 'playwright'
import { mkdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const out = path.join(root, 'docs/social-content/qa/official-native-review')
await mkdir(out, { recursive: true })
const origin = 'http://127.0.0.1:3991'
const packetId = '11111111-1111-1111-1111-111111111111'
const now = Date.now()
const date = offset => new Date(now + offset).toISOString()
const officialUrl = 'https://developers.openai.com/api/docs/changelog'
const observations = [officialUrl, 'https://example.org/public/agents', 'https://example.net/public/agents'].map((source_url, index) => ({
  id: `source-${index}`, status: index === 2 ? 'review_ready' : 'approved', source_url,
  observation_identity: `public-observation:synthetic-${index}`, observed_at: date(-3600000), expires_at: date(86400000),
  public_attention: { observed: 8, required: 10 }, relevance: { observed: 9, required: 10 },
  evidence_note: 'Synthetic public-value example for local visual QA only.', excluded: false,
}))
const sourceReceipts = observations.map((item, index) => ({
  receipt_id: `public-source:synthetic-${index}`, source_packet_id: item.id, source_url: item.source_url,
  observed_at: item.observed_at, observed_values: { public_attention: 8, relevance: 9 },
  required_values: { public_attention: 10, relevance: 10 }, public_attention_score: 0.8, relevance_score: 0.9,
}))
const receipt = { version: 'public_signal_measurement_v1', receipt_id: 'public-signal-measurement:synthetic-local-qa',
  coverage_identity: 'openai_agents_api', observed_at: date(-3600000), fresh_until: date(86400000),
  sample_size: 3, formula: 'mean_normalized_public_observations_v1', public_attention_score: 0.8,
  public_attention_threshold: 0.65, relevance_score: 0.9, relevance_threshold: 0.65, source_receipts: sourceReceipts }
const packet = { id: packetId, source_url: officialUrl, platform: 'other', creator_name: 'OpenAI', creator_handle: null,
  title: 'Synthetic official Agents API release', caption: null, thumbnail_url: null, hook_transcript: null,
  outlier_score: 0, pattern_status: 'needs_brand_translation', pattern_packet: {}, status: 'review_ready',
  retrieved_at: date(-3600000), updated_at: date(-1000), actor_metadata: { official_signal: {
    coverage_identity: 'openai_agents_api', source_fingerprint: 'synthetic-local-qa',
    published_at: date(-86400000), observed_at: date(-3600000), expires_at: date(86400000),
  } } }
let ready = false
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
  storageState: path.join(root, '.auth/portfolio-admin-storage-state.json'),
  recordVideo: { dir: out, size: { width: 1440, height: 900 } } })
const page = await context.newPage()
await page.route('**/api/admin/**', async route => {
  const url = new URL(route.request().url())
  let body = {}
  if (url.pathname.endsWith('/source-coverage/official-signals')) body = { packets: [{
    id: packetId, title: packet.title, source_url: officialUrl, status: 'review_ready', updated_at: packet.updated_at,
    coverage_identity: 'openai_agents_api', packet_identity: 'synthetic-local-qa', attribution_valid: true,
    observed_at: date(-3600000), expires_at: date(86400000), measurement_status: ready ? 'Receipt ready' : 'Unscored',
    blocked_reason: ready ? null : 'insufficient_attributable_public_sources', observed_value: ready ? null : 2,
    required_value: ready ? null : 3, owner: 'social_content_research', attempt_count: 1, max_attempts: 3,
    measurement_receipt: ready ? receipt : null, observations: ready ? observations.map(item => ({ ...item, status: 'approved' })) : observations,
  }], review_only: true, release_ready: false, exclusions: [] }
  else if (url.pathname.endsWith('/research-packets')) body = { packets: [packet] }
  else if (url.pathname.includes('/work-items')) body = { work_items: [], items: [] }
  else if (url.pathname.includes('/daily-digest')) body = { digest: null }
  else if (url.pathname.includes('/calendar')) body = { items: [] }
  else if (url.pathname.includes('/campaigns')) body = { data: [] }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
const revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
const route = `${origin}/admin/agents/content-intelligence?section=research&packet=${packetId}&rev=${revision}`
await page.goto(route, { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: 'Review official signal' }).waitFor({ timeout: 30000 })
await page.getByRole('button', { name: 'Review official signal' }).click()
await page.getByText('Unscored: insufficient attributable public sources').waitFor()
await page.screenshot({ path: path.join(out, 'desktop-blocked.png'), fullPage: true })
await page.waitForTimeout(1200)
await page.getByText('Observation cohort and exclusions').click()
await page.screenshot({ path: path.join(out, 'desktop-observations.png'), fullPage: true })
await page.waitForTimeout(1200)
ready = true
await page.getByRole('button', { name: 'Refresh evidence' }).click()
await page.getByText('Immutable measurement receipt').waitFor()
await page.waitForTimeout(1200)
await page.getByLabel('Sentiment').selectOption('positive')
await page.getByLabel('Evidence state').selectOption('corroborated')
await page.getByLabel('Public context summary').fill('Synthetic public release with exact attributable source values for local QA.')
await page.getByLabel('Review reason').fill('Synthetic local review only. No approval submitted.')
if (!await page.getByRole('button', { name: 'Approve official signal' }).isEnabled()) throw new Error('Qualifying receipt did not enable approval readiness')
await page.screenshot({ path: path.join(out, 'desktop-ready.png'), fullPage: true })
await page.waitForTimeout(1200)
await page.setViewportSize({ width: 390, height: 844 })
await page.getByRole('button', { name: 'Approve official signal' }).scrollIntoViewIfNeeded()
await page.screenshot({ path: path.join(out, 'mobile-ready.png'), fullPage: true })
await page.waitForTimeout(1200)
await page.close()
const video = await page.video().path()
await context.close()
await browser.close()
await rename(video, path.join(out, 'official-native-review.webm'))
console.log(`QA route: ${route}`)
console.log(`QA artifacts: ${out}`)
