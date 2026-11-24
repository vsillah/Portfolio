import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
const baseUrl = 'http://localhost:3000'
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const route = `/admin/agents/content-intelligence?section=calendar&rev=${commit}`
const output = join(process.cwd(), 'docs/qa/release-calendar-automation')
const raw = join(output, '.raw')
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const now = new Date().toISOString()
const user = { id: 'qa-calendar-user', aud: 'authenticated', role: 'authenticated', email: 'qa-calendar@example.test', app_metadata: {}, user_metadata: {}, created_at: now }
const session = { access_token: 'qa-calendar-access', refresh_token: 'qa-calendar-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
const campaign = { id: 'qa-campaign', name: 'Campaign review', slug: 'qa-campaign', status: 'active' }
const releaseDate = '2026-11-29T15:00:00.000Z'

function release(id, title, overrides = {}) {
  return {
    id, campaign_id: campaign.id, agent_work_item_id: `work-${id}`, social_content_id: `social-${id}`,
    channel: 'linkedin', campaign_phase: 'teach', title, planned_angle: 'Review the current source and internal packet.',
    scheduled_for: releaseDate, due_status: 'planned', authorization_status: 'authorized',
    authorization_due_at: '2026-11-28T15:00:00.000Z', autonomy_eligible: false,
    metadata: { review_priority: 'high', jit_refresh_status: 'fresh', external_execution_enabled: false },
    attraction_campaigns: campaign, agent_work_items: { id: `work-${id}`, title: 'Internal review', status: 'in_progress', preparation_claim: null },
    social_content_queue: { id: `social-${id}`, status: 'draft' }, ...overrides,
  }
}

const persisted = [
  release('blocked', 'Source recovery required', { metadata: { review_priority: 'urgent', jit_refresh_status: 'stale', external_execution_enabled: false, publish_preparation: {
    status: 'blocked', blocker: 'Approved source evidence expired. Refresh the source receipt.', recovery_action: '/admin/social-content/social-blocked?step=copy', evidence_version: 'source-v2',
  } } }),
  release('eligible', 'Priority preparation due'),
  release('preparing', 'Claimed packet in progress', { agent_work_items: { id: 'work-preparing', title: 'Internal review', status: 'in_progress', preparation_claim: { status: 'preparing', claimed_at: now } } }),
  release('ready', 'Internal packet ready for review', { metadata: { review_priority: 'high', jit_refresh_status: 'fresh', external_execution_enabled: false, publish_preparation: {
    status: 'ready', content_version: 'content-v4', review_path: '/admin/social-content/social-ready?step=copy', prepared_at: now,
  } } }),
  release('planned', 'Upcoming authorized preparation', { scheduled_for: '2026-12-20T15:00:00.000Z', authorization_status: 'pending' }),
]
const drafts = Array.from({ length: 10 }, (_, index) => release(`agentified-draft:${index + 1}`, `Agentified workshop draft ${index + 1}`, {
  campaign_id: null, agent_work_item_id: null, social_content_id: null,
  scheduled_for: new Date(Date.UTC(2027, 0, index + 5, 15)).toISOString(), authorization_status: 'draft',
  metadata: { agentified_draft: true, agentified_asset_id: `AW-QA-${index + 1}`, external_execution_enabled: false, provider_blocked: true },
  agent_work_items: null, social_content_queue: null,
}))

function json(route, body) { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }) }

async function capture(browser, label, viewport, recordVideo) {
  const context = await browser.newContext({
    viewport, colorScheme: 'dark', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseUrl, localStorage: [{ name: `sb-${projectRef}-auth-token`, value: JSON.stringify(session) }] }] },
    ...(recordVideo ? { recordVideo: { dir: raw, size: viewport } } : {}),
  })
  const page = await context.newPage()
  const writes = []
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`)
      return route.abort()
    }
    if (url.pathname === '/auth/v1/user') return json(route, { user })
    if (url.origin !== baseUrl) return route.abort()
    if (url.pathname === '/api/user/profile') return json(route, { profile: { id: user.id, email: user.email, role: 'admin', created_at: now, updated_at: now } })
    if (url.pathname === '/api/admin/social-content/calendar') return json(route, { items: [...persisted, ...drafts], page: { offset: 0, limit: 100, total: persisted.length, next_offset: null }, side_effects: { provider_generation: false, upload: false, external_schedule: false, publish: false, external_post: false } })
    if (url.pathname === '/api/admin/campaigns') return json(route, { data: [campaign] })
    if (url.pathname.includes('/research-packets')) return json(route, { packets: [] })
    if (url.pathname === '/api/admin/agents/work-items') return json(route, { work_items: [] })
    if (url.pathname.includes('/daily-digest')) return json(route, { digest: null })
    if (url.pathname.includes('/autoresearch-backlog')) return json(route, { items: [], summary: { total: 0 }, opportunity_summary: { total: 0 }, opportunities: [], side_effects: {}, callable_external_actions: [] })
    if (url.pathname.startsWith('/api/')) return json(route, {})
    return route.continue()
  })
  await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Prepare-only automation' }).waitFor({ state: 'visible', timeout: 20000 })
  await page.getByText(/Showing 1-8 of 15 release rows/).waitFor({ state: 'visible', timeout: 20000 })
  const automation = page.getByRole('region', { name: 'Release preparation automation' })
  for (const state of ['blocked', 'eligible', 'preparing', 'ready for human review', 'planned']) {
    if (!(await automation.getByText(state, { exact: true }).count())) throw new Error(`${label}: ${state} state absent`)
  }
  if (!(await page.getByText('Showing 1-8 of 15 release rows.').count())) throw new Error(`${label}: complete calendar count absent`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 2) throw new Error(`${label}: ${overflow}px horizontal overflow`)
  await page.evaluate(() => {
    const panel = document.querySelector('[aria-label="Release preparation automation"]')
    panel?.scrollIntoView({ block: 'start' })
  })
  await page.waitForTimeout(900)
  await page.screenshot({ path: join(output, `${label}.png`) })
  if (viewport.width < 1000) {
    await automation.getByText('Internal packet ready for review').scrollIntoViewIfNeeded()
    await page.waitForTimeout(650)
    await automation.getByText('Upcoming authorized preparation').scrollIntoViewIfNeeded()
    await page.waitForTimeout(650)
  }
  await page.getByLabel('Content title').fill('Source recovery')
  await page.getByText('Showing 1-1 of 1 release row.').waitFor({ state: 'visible' })
  await page.waitForTimeout(700)
  await page.getByLabel('Content title').fill('')
  await page.getByText('Showing 1-8 of 15 release rows.').waitFor({ state: 'visible' })
  await page.getByRole('link', { name: 'Open recovery' }).first().focus()
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
  if (focused !== 'Open recovery') throw new Error(`${label}: recovery link did not take keyboard focus`)
  await page.waitForTimeout(700)
  if (writes.length) throw new Error(`${label}: unexpected write requests: ${writes.join(', ')}`)
  const video = page.video()
  await context.close()
  if (recordVideo && video) {
    const target = join(output, `${label}.mp4`)
    execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target], { stdio: 'ignore' })
  }
}

rmSync(raw, { recursive: true, force: true })
mkdirSync(raw, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  await capture(browser, 'desktop-1280x800', { width: 1280, height: 800 }, true)
  await capture(browser, 'mid-820x900', { width: 820, height: 900 }, false)
  await capture(browser, 'mobile-390x844', { width: 390, height: 844 }, true)
  writeFileSync(join(output, 'results.json'), JSON.stringify({ commit, route, fixture: 'synthetic read-only', persisted_rows: persisted.length, draft_rows: drafts.length, side_effects: { provider_generation: false, upload: false, schedule: false, publish: false, send: false }, viewports: ['1280x800', '820x900', '390x844'] }, null, 2) + '\n')
} finally {
  await browser.close()
  rmSync(raw, { recursive: true, force: true })
}
