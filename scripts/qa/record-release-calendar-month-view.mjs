import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3219'
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const route = `/admin/agents/content-intelligence?section=calendar&view=list&month=2026-11&rev=${commit}`
const output = join(process.cwd(), process.env.QA_OUTPUT || 'docs/qa/release-calendar-month-view')
const raw = join(output, '.raw')
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const now = new Date().toISOString()
const user = { id: 'qa-calendar-user', aud: 'authenticated', role: 'authenticated', email: 'qa-calendar@example.test', app_metadata: {}, user_metadata: {}, created_at: now }
const session = { access_token: 'qa-calendar-access', refresh_token: 'qa-calendar-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
const campaign = { id: 'qa-campaign', name: 'Accelerated Workshop Whisper-to-Shout launch campaign', slug: 'qa-campaign', status: 'active' }
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
  release('blocked', 'Whisper-to-Shout Launch: approved source evidence expired', { metadata: { review_priority: 'urgent', jit_refresh_status: 'stale', external_execution_enabled: false, publish_preparation: {
    status: 'blocked', blocker: 'Approved source evidence expired. Refresh the source receipt.', recovery_action: '/admin/social-content/social-blocked?step=copy', evidence_version: 'source-v2',
  } } }),
  release('eligible', 'Accelerated Workshop Teach: The operating loop behind smarter product work'),
  release('preparing', 'Claimed packet in progress', { agent_work_items: { id: 'work-preparing', title: 'Internal review', status: 'in_progress', preparation_claim: { status: 'preparing', claimed_at: now } } }),
  release('ready', 'Internal packet ready for review', { metadata: { review_priority: 'high', jit_refresh_status: 'fresh', external_execution_enabled: false, publish_preparation: {
    status: 'ready', social_content_id: 'social-ready', content_version: 'content-v4', review_path: '/admin/social-content/social-ready?step=copy', prepared_at: now,
    source_lineage: 'source-v4', evidence_version: 'source-v4', source_expires_at: '2027-01-01T00:00:00.000Z', source_freshness_status: 'fresh',
    scheduled_for: releaseDate, trigger_at: '2026-11-23T15:00:00.000Z',
  } } }),
  release('planned', 'Upcoming authorized preparation', { scheduled_for: '2026-12-20T15:00:00.000Z', authorization_status: 'pending' }),
]
persisted.push(...Array.from({ length: 85 }, (_, index) => release(`additional-${index + 1}`, index === 0 ? 'Historical completed release'
  : index === 1 ? 'Historical cancelled release'
  : index === 2 ? 'Historical published release'
  : index === 3 ? 'Historical superseded release'
  : `Additional long-form campaign preparation row ${index + 1}`, {
  scheduled_for: new Date(Date.UTC(2028, 0, index + 1, 15)).toISOString(),
  ...(index === 0 ? { due_status: 'completed' }
    : index === 1 ? { due_status: 'cancelled' }
    : index === 2 ? { social_content_queue: { id: 'social-additional-3', status: 'published' } }
    : index === 3 ? { metadata: { superseded_at: '2026-08-05T13:04:19.286Z', superseded_by_agentified_packet: true, external_execution_enabled: false } }
    : {}),
})))
const drafts = Array.from({ length: 10 }, (_, index) => release(`agentified-draft:${index + 1}`, `Agentified workshop draft ${index + 1}`, {
  campaign_id: null, agent_work_item_id: null, social_content_id: null,
  scheduled_for: new Date(Date.UTC(2027, 0, index + 5, 15)).toISOString(), authorization_status: 'draft',
  metadata: { agentified_draft: true, agentified_asset_id: `AW-QA-${index + 1}`, external_execution_enabled: false, provider_blocked: true },
  agent_work_items: null, social_content_queue: null,
}))

function json(route, body) { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }) }


async function capture(browser, label, viewport, colorScheme, recordVideo) {
  const context = await browser.newContext({
    viewport, colorScheme, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseUrl, localStorage: [{ name: `sb-${projectRef}-auth-token`, value: JSON.stringify(session) }] }] },
    ...(recordVideo ? { recordVideo: { dir: raw, size: viewport } } : {}),
  })
  const page = await context.newPage()
  const writes = []
  await page.route('**/*', async requestRoute => {
    const request = requestRoute.request()
    const url = new URL(request.url())
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`)
      return requestRoute.abort()
    }
    if (url.pathname === '/auth/v1/user') return json(requestRoute, { user })
    if (url.origin !== baseUrl) return requestRoute.abort()
    if (url.pathname === '/api/user/profile') return json(requestRoute, { profile: { id: user.id, email: user.email, role: 'admin', created_at: now, updated_at: now } })
    if (url.pathname === '/api/admin/social-content/calendar') return json(requestRoute, { items: [...persisted, ...drafts], page: { offset: 0, limit: 100, total: persisted.length, next_offset: null }, side_effects: { provider_generation: false, upload: false, external_schedule: false, publish: false, external_post: false } })
    if (url.pathname === '/api/admin/campaigns') return json(requestRoute, { data: [campaign] })
    if (url.pathname.includes('/research-packets')) return json(requestRoute, { packets: [] })
    if (url.pathname === '/api/admin/agents/work-items') return json(requestRoute, { work_items: [] })
    if (url.pathname.includes('/daily-digest')) return json(requestRoute, { digest: null })
    if (url.pathname.includes('/autoresearch-backlog')) return json(requestRoute, { items: [], summary: { total: 0 }, opportunity_summary: { total: 0 }, opportunities: [], side_effects: {}, callable_external_actions: [] })
    if (url.pathname.startsWith('/api/')) return json(requestRoute, {})
    return requestRoute.continue()
  })
  try {
    await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded' })
    await page.getByText(/Showing 1-8 of 100 release rows/).waitFor({ state: 'visible', timeout: 30000 })
    await page.waitForTimeout(900)
    await page.screenshot({ path: join(output, `${label}-list.png`) })
    await page.getByRole('button', { name: 'Calendar', exact: true }).click()
    await page.getByRole('heading', { name: 'November 2026' }).waitFor({ state: 'visible' })
    if (!page.url().includes('view=calendar')) throw new Error(`${label}: calendar URL missing`)
    const hiddenClass = viewport.width < 640 ? 'monthGrid' : 'monthMobile'
    const visibility = await page.evaluate(hidden => {
      const element = [...document.querySelectorAll('[class]')].find(node => [...node.classList].some(name => name.includes(hidden)))
      return element ? getComputedStyle(element).display : 'missing'
    }, hiddenClass)
    if (visibility !== 'none') throw new Error(`${label}: inactive responsive event layout was ${visibility}`)
    const visibleEvents = await page.getByRole('button', { name: /Open details:/ }).count()
    if (viewport.width < 640 && visibleEvents !== 4) throw new Error(`${label}: mobile agenda exposed ${visibleEvents} events; expected 4`)
    if (viewport.width >= 640 && visibleEvents !== 2) throw new Error(`${label}: desktop grid exposed ${visibleEvents} events before disclosure; expected 2`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 2) throw new Error(`${label}: ${overflow}px horizontal overflow`)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: join(output, `${label}-calendar.png`) })
    if (viewport.width < 640) {
      await page.getByLabel('Day in November 2026').selectOption('2026-11-29')
      await page.getByRole('button', { name: /Open details:.*Internal packet ready for review/ }).click()
    } else {
      await page.getByRole('button', { name: 'Show 2 more releases on 2026-11-29' }).click()
      await page.getByRole('button', { name: /Open details:.*Internal packet ready for review/ }).click()
    }
    await page.getByRole('heading', { name: 'Release details' }).waitFor({ state: 'visible' })
    await page.getByLabel('Focused calendar row Internal packet ready for review').waitFor({ state: 'visible' })
    await page.waitForTimeout(1100)
    await page.screenshot({ path: join(output, `${label}-details.png`) })
    await page.getByRole('button', { name: 'Close details' }).click()
    await page.getByRole('button', { name: 'Next month' }).click()
    await page.getByRole('heading', { name: 'December 2026' }).waitFor({ state: 'visible' })
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Previous month' }).click()
    await page.getByRole('heading', { name: 'November 2026' }).waitFor({ state: 'visible' })
    await page.getByLabel('Channel').last().selectOption('youtube')
    await page.getByText('No releases match this month and the current filters.').waitFor({ state: 'visible' })
    await page.waitForTimeout(900)
    await page.screenshot({ path: join(output, `${label}-empty.png`) })
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.getByRole('button', { name: /Open details:/ }).first().waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Gantt', exact: true }).click()
    await page.getByRole('heading', { name: 'Campaign timeline · Nov 2026' }).waitFor({ state: 'visible' })
    if (!page.url().includes('view=gantt')) throw new Error(`${label}: Gantt URL missing`)
    const ganttHidden = await page.evaluate(hidden => {
      const element = [...document.querySelectorAll('[class]')].find(node => [...node.classList].some(name => name.includes(hidden)))
      return element ? getComputedStyle(element).display : 'missing'
    }, viewport.width < 640 ? 'ganttDesktop' : 'ganttMobile')
    if (ganttHidden !== 'none') throw new Error(`${label}: inactive Gantt layout was ${ganttHidden}`)
    const ganttMilestones = await page.getByRole('button', { name: /Open details:/ }).count()
    if (ganttMilestones !== 4) throw new Error(`${label}: Gantt exposed ${ganttMilestones} milestones; expected 4`)
    const ganttOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (ganttOverflow > 2) throw new Error(`${label}: Gantt has ${ganttOverflow}px horizontal overflow`)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: join(output, `${label}-gantt.png`) })
    await page.getByRole('button', { name: /Open details:.*Internal packet ready for review/ }).focus()
    await page.getByRole('button', { name: /Open details:.*Internal packet ready for review/ }).press('Enter')
    await page.getByRole('heading', { name: 'Release details' }).waitFor({ state: 'visible' })
    await page.getByLabel('Focused calendar row Internal packet ready for review').waitFor({ state: 'visible' })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: join(output, `${label}-gantt-details.png`) })
    await page.getByRole('button', { name: 'Close details' }).click()
    await page.getByRole('button', { name: 'Next window' }).click()
    await page.getByRole('heading', { name: 'Campaign timeline · Dec 2026' }).waitFor({ state: 'visible' })
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Previous window' }).click()
    await page.getByRole('heading', { name: 'Campaign timeline · Nov 2026' }).waitFor({ state: 'visible' })
    await page.getByLabel('Channel').last().selectOption('youtube')
    await page.getByText('No releases match this window and the current filters.').waitFor({ state: 'visible' })
    await page.waitForTimeout(700)
    await page.screenshot({ path: join(output, `${label}-gantt-empty.png`) })
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.getByText(/Showing 1-8 of 100 release rows/).waitFor({ state: 'visible' })
    if (writes.length) throw new Error(`${label}: unexpected write requests: ${writes.join(', ')}`)
    const video = page.video()
    await context.close()
    if (recordVideo && video) {
      const target = join(output, `${label}.mp4`)
      execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target], { stdio: 'ignore' })
      return target
    }
    return null
  } catch (error) {
    await context.close()
    throw error
  }
}

rmSync(raw, { recursive: true, force: true })
mkdirSync(raw, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const videos = []
  for (const [label, viewport, scheme] of [
    ['desktop-1280x800', { width: 1280, height: 800 }, 'dark'],
    ['mid-820x900', { width: 820, height: 900 }, 'light'],
    ['mobile-390x844', { width: 390, height: 844 }, 'dark'],
    ['system-1280x800', { width: 1280, height: 800 }, 'no-preference'],
  ]) {
    const video = await capture(browser, label, viewport, scheme, scheme !== 'no-preference')
    if (video) videos.push(video)
  }
  writeFileSync(join(output, 'results.json'), JSON.stringify({ commit, route, fixture: 'synthetic read-only', persisted_rows: persisted.length, draft_rows: drafts.length, viewports: ['1280x800', '820x900', '390x844'], themes: ['dark', 'light', 'system'], videos, side_effects: { provider_generation: false, upload: false, schedule: false, publish: false, send: false } }, null, 2) + '\n')
} finally {
  await browser.close()
  rmSync(raw, { recursive: true, force: true })
}
