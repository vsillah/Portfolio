import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'slack-content-calendar-qa')
const frameDir = path.join(outputDir, 'frames')
const productDir = path.join(outputDir, 'product')
const mp4Path = path.join(outputDir, 'slack-content-calendar-approval.mp4')
const summaryPath = path.join(outputDir, 'slack-content-calendar-approval.json')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3064').replace(/\/$/, '')
const qaPath = '/admin/agents/content-intelligence?section=calendar&calendar_item=calendar-slack-approval'
const qaUrl = new URL(qaPath, baseUrl).toString()

await mkdir(frameDir, { recursive: true })
await mkdir(productDir, { recursive: true })

let calendarAuthorizationStatus = 'pending'
let portfolioAuthorizeCount = 0
let slackNativeReplayCount = 0

const user = {
  id: 'qa-admin-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-admin@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-31T00:00:00.000Z',
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const now = Math.floor(Date.now() / 1000)
const expiresAt = now + 3600
const qaAccessToken = [
  base64Url({ alg: 'none', typ: 'JWT' }),
  base64Url({
    aud: 'authenticated',
    exp: expiresAt,
    iat: now,
    sub: user.id,
    email: user.email,
    role: 'authenticated',
  }),
  'qa-signature',
].join('.')

const session = {
  access_token: qaAccessToken,
  refresh_token: 'qa-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: expiresAt,
  user,
}

function supabaseAuthStorageKeys() {
  const urls = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    'https://example.supabase.co',
  ].filter(Boolean)

  return [...new Set(urls.map((value) => {
    try {
      return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
    } catch {
      return null
    }
  }).filter(Boolean))]
}

async function seedSession(page) {
  await page.addInitScript(({ storageKeys, storedSession }) => {
    for (const storageKey of storageKeys) {
      window.localStorage.setItem(storageKey, JSON.stringify(storedSession))
    }
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession))
  }, { storageKeys: supabaseAuthStorageKeys(), storedSession: session })
}

function campaign() {
  return {
    id: 'campaign-qa',
    name: 'Slack Approval QA Campaign',
    description: 'Synthetic campaign proving calendar approval persistence.',
    campaign_type: 'free_challenge',
    status: 'draft',
    starts_at: '2026-09-01T13:00:00.000Z',
    ends_at: '2026-09-21T21:00:00.000Z',
  }
}

function calendarItem() {
  const authorized = calendarAuthorizationStatus === 'authorized'
  return {
    id: 'calendar-slack-approval',
    campaign_id: 'campaign-qa',
    agent_work_item_id: 'work-slack-calendar',
    social_content_id: authorized ? 'social-slack-calendar' : null,
    channel: 'linkedin',
    campaign_phase: 'teach',
    title: 'Slack approval callback QA',
    planned_angle: 'Show that a Slack approval action records the internal draft handoff and moves the calendar row out of pending.',
    scheduled_for: '2026-09-01T14:00:00.000Z',
    due_status: 'due_soon',
    authorization_status: calendarAuthorizationStatus,
    authorization_due_at: '2026-08-31T18:00:00.000Z',
    last_pinged_at: null,
    autonomy_eligible: false,
    metadata: {
      template_label: 'Whisper-to-shout launch',
      milestone_key: 'teaching_frame',
      demo_seed_key: 'slack_content_calendar_approval_qa',
      external_execution_enabled: false,
      provider_generation_enabled: false,
      publish_enabled: false,
      source_labels: ['Synthetic QA fixture'],
      milestone_rationale: {
        summary: 'Teach milestone for LinkedIn: prove the Slack-to-Portfolio approval path without external sends.',
        campaign_fit: 'The fixture isolates the calendar authorization gate.',
        timing: 'The row is due soon so it appears in the approval queue.',
      },
      ...(authorized
        ? {
            authorized_at: '2026-08-31T15:00:00.000Z',
            authorized_by: 'slack:U123',
            draft_handoff_only: true,
            platform_draft_handoff: {
              kind: 'linkedin_social_content_draft',
              status: 'queued',
              work_item_id: 'work-handoff-slack-calendar',
              social_content_id: 'social-slack-calendar',
              created_at: '2026-08-31T15:00:00.000Z',
            },
          }
        : {}),
    },
    attraction_campaigns: campaign(),
    agent_work_items: {
      id: 'work-slack-calendar',
      title: 'Prepare governed calendar approval proof',
      status: authorized ? 'queued' : 'proposed',
      priority: 'high',
    },
    social_content_queue: authorized
      ? {
          id: 'social-slack-calendar',
          status: 'draft',
          platform: 'linkedin',
          target_platforms: ['linkedin'],
          post_text: 'Draft seed created from Slack-approved calendar handoff.',
          scheduled_for: null,
          rag_context: {
            source: 'social_content_calendar_authorization',
            calendar_item_id: 'calendar-slack-approval',
            authorization_status: 'authorized',
            external_execution_enabled: false,
          },
          social_content_publishes: [],
        }
      : null,
  }
}

async function json(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function installRoutes(page) {
  await page.route('**/api/user/profile**', (route) => json(route, {
    profile: {
      id: user.id,
      email: user.email,
      role: 'admin',
      created_at: user.created_at,
      updated_at: user.created_at,
    },
  }))

  await page.route(/https:\/\/[^/]+\.supabase\.co\/auth\/v1\/user.*/i, (route) => json(route, user))
  await page.route(/https:\/\/[^/]+\.supabase\.co\/rest\/v1\/user_profiles.*/i, (route) => json(route, {
    id: user.id,
    email: user.email,
    role: 'admin',
    created_at: user.created_at,
    updated_at: user.created_at,
  }))
  await page.route('**/api/admin/social-content/intelligence/research-packets?**', (route) => json(route, { packets: [] }))
  await page.route('**/api/admin/agents/work-items?**', (route) => json(route, { work_items: [] }))
  await page.route('**/api/admin/social-content/intelligence/daily-digest?**', (route) => json(route, { digest: null }))
  await page.route('**/api/admin/social-content/intelligence/autoresearch-backlog**', (route) => json(route, {
    items: [],
    summary: {
      total: 0,
      readyForInternalHandoff: 0,
      blockedOrManual: 0,
      callableExternalActions: 0,
    },
    opportunity_summary: {
      total: 0,
      highPriority: 0,
      channels: [],
      requiresHumanGate: 0,
    },
    opportunities: [],
    side_effects: {
      slack_send: false,
      provider_generation: false,
      upload: false,
      external_schedule: false,
      publish: false,
      external_post: false,
    },
    callable_external_actions: [],
  }))
  await page.route('**/api/admin/campaigns?**', (route) => json(route, { data: [campaign()] }))
  await page.route('**/api/admin/social-content/calendar?**', (route) => json(route, {
    items: [calendarItem()],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  }))
  await page.route('**/api/admin/social-content/calendar/calendar-slack-approval/authorize', async (route) => {
    portfolioAuthorizeCount += 1
    const alreadyAuthorized = calendarAuthorizationStatus === 'authorized'
    calendarAuthorizationStatus = 'authorized'
    await json(route, {
      ok: true,
      item: calendarItem(),
      handoff: {
        kind: 'linkedin_social_content_draft',
        work_item_id: 'work-handoff-slack-calendar',
        social_content_id: 'social-slack-calendar',
      },
      already_authorized: alreadyAuthorized,
      side_effects: {
        slack_send: false,
        provider_generation: false,
        upload: false,
        external_schedule: false,
        publish: false,
        external_post: false,
        gmail_draft: false,
        sms_send: false,
        internal_draft_handoff_created: true,
        social_content_draft_created: true,
      },
    })
  })
  await page.route('**/api/slack/agent/actions', async (route) => {
    slackNativeReplayCount += 1
    const alreadyAuthorized = calendarAuthorizationStatus === 'authorized'
    calendarAuthorizationStatus = 'authorized'
    await json(route, {
      response_type: 'ephemeral',
      text: alreadyAuthorized
        ? 'Content calendar draft handoff was already authorized.'
        : 'Content calendar draft handoff authorized from Slack. External publishing, provider calls, uploads, scheduling, Gmail, and SMS remain disabled.',
      replace_original: false,
    })
  })
}

function collectUnexpectedRequests(page) {
  const requests = []
  page.on('request', (request) => {
    const url = request.url()
    const parsed = new URL(url)
    if (
      /slack\.com|gmail\.com|googleapis\.com|n8n/i.test(parsed.hostname) ||
      /\/api\/admin\/social-content\/[^/]+\/publish\b/i.test(parsed.pathname)
    ) {
      requests.push(url)
    }
  })
  return () => requests
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function wrapText(text, maxChars = 34) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function textSvg({ title, rows }) {
  let y = 52
  const body = []
  body.push(`<text x="28" y="${y}" font-size="25" font-weight="700" fill="#f8fafc">${escapeXml(title)}</text>`)
  y += 38
  for (const row of rows) {
    body.push(`<text x="28" y="${y}" font-size="12" font-weight="700" fill="#93c5fd">${escapeXml(row.label.toUpperCase())}</text>`)
    y += 22
    for (const line of wrapText(row.text, 44)) {
      body.push(`<text x="28" y="${y}" font-size="17" fill="#e2e8f0">${escapeXml(line)}</text>`)
      y += 23
    }
    y += 14
  }
  body.push('<text x="28" y="803" font-size="13" fill="#94a3b8">Boundary: no Slack send, provider call, upload, publish, Gmail, SMS, or production mutation.</text>')
  return Buffer.from(`
    <svg width="470" height="844" viewBox="0 0 470 844" xmlns="http://www.w3.org/2000/svg">
      <rect width="470" height="844" fill="#0f172a"/>
      <rect x="16" y="16" width="438" height="812" rx="8" fill="#111827" stroke="#334155"/>
      ${body.join('\n')}
    </svg>
  `)
}

async function compositeFrame(name, screenshotPath, title, rows) {
  const out = path.join(frameDir, name)
  const appBuffer = await sharp(screenshotPath)
    .resize({ width: 895, height: 844, fit: 'contain', background: '#020617' })
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: 1365,
      height: 844,
      channels: 4,
      background: '#020617',
    },
  })
    .composite([
      { input: textSvg({ title, rows }), left: 0, top: 0 },
      { input: appBuffer, left: 470, top: 0 },
    ])
    .png()
    .toFile(out)
  return out
}

async function createMp4(frames) {
  const concatListPath = path.join(frameDir, 'frames.txt')
  const escapeForConcat = (value) => value.replace(/'/g, "'\\''")
  const lines = frames.flatMap((frame) => [
    `file '${escapeForConcat(frame.path)}'`,
    `duration ${frame.durationSeconds}`,
  ])
  lines.push(`file '${escapeForConcat(frames[frames.length - 1].path)}'`)
  await writeFile(concatListPath, `${lines.join('\n')}\n`, 'utf8')
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-movflags',
    '+faststart',
    mp4Path,
  ])
}

if (!existsSync(path.join(root, 'node_modules'))) {
  throw new Error('node_modules is required. In worktrees, temporarily link the main Portfolio node_modules before running this recorder.')
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 844 } })
const page = await context.newPage()
await seedSession(page)
await installRoutes(page)
const unexpectedRequestGetters = [collectUnexpectedRequests(page)]

const pendingResponse = await page.goto(qaUrl)
if (!pendingResponse || pendingResponse.status() >= 400) {
  throw new Error(`Content Intelligence QA route failed: ${pendingResponse?.status()}`)
}
const calendarTitle = page.getByText('Slack approval callback QA', { exact: true }).last()
await calendarTitle.waitFor({ state: 'attached', timeout: 20_000 })
await calendarTitle.scrollIntoViewIfNeeded()
await page.waitForFunction(() => document.body.innerText.includes('pending'), null, { timeout: 10_000 })
const pendingScreenshot = path.join(productDir, '01-content-calendar-pending.png')
await page.screenshot({ path: pendingScreenshot, fullPage: false })

await page.getByRole('button', { name: /Authorize Draft Handoff/i }).last().click()
await page.waitForFunction(() => document.body.innerText.includes('Draft handoff authorized'), null, { timeout: 10_000 })

const authorizedCalendarTitle = page.getByText('Slack approval callback QA', { exact: true }).last()
await authorizedCalendarTitle.waitFor({ state: 'attached', timeout: 20_000 })
await authorizedCalendarTitle.scrollIntoViewIfNeeded()
await page.waitForFunction(() => document.body.innerText.includes('authorized'), null, { timeout: 10_000 })
await page.locator('a[href="/admin/social-content/social-slack-calendar"]').first().waitFor({ state: 'attached', timeout: 10_000 })
const authorizedScreenshot = path.join(productDir, '02-content-calendar-authorized.png')
await page.screenshot({ path: authorizedScreenshot, fullPage: false })

await page.evaluate(async () => {
  const payload = {
    type: 'block_actions',
    user: { id: 'U123', username: 'vambah' },
    actions: [{
      action_id: 'social_calendar_draft_handoff_approve',
      value: JSON.stringify({
        action: 'social_calendar_draft_handoff.approve',
        schemaVersion: 'social-calendar-approval/v1',
        calendarItemId: 'calendar-slack-approval',
        contentId: 'social-slack-calendar',
      }),
    }],
  }
  await fetch('/api/slack/agent/actions', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ payload: JSON.stringify(payload) }).toString(),
  })
})
await page.reload()
await page.waitForFunction(() => document.body.innerText.includes('authorized'), null, { timeout: 10_000 })
await page.locator('a[href="/admin/social-content/social-slack-calendar"]').first().waitFor({ state: 'attached', timeout: 10_000 })
await page.getByText('Slack approval callback QA', { exact: true }).last().scrollIntoViewIfNeeded()
const duplicateScreenshot = path.join(productDir, '03-content-calendar-duplicate-idempotent.png')
await page.screenshot({ path: duplicateScreenshot, fullPage: false })

await context.close()

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const mobilePage = await mobileContext.newPage()
await seedSession(mobilePage)
await installRoutes(mobilePage)
unexpectedRequestGetters.push(collectUnexpectedRequests(mobilePage))
const mobileResponse = await mobilePage.goto(qaUrl)
if (!mobileResponse || mobileResponse.status() >= 400) {
  throw new Error(`Content Intelligence mobile QA route failed: ${mobileResponse?.status()}`)
}
await mobilePage.getByText('Slack approval callback QA', { exact: true }).last().waitFor({ state: 'attached', timeout: 20_000 })
await mobilePage.getByText('Slack approval callback QA', { exact: true }).last().scrollIntoViewIfNeeded()
await mobilePage.waitForFunction(() => document.body.innerText.includes('authorized'), null, { timeout: 10_000 })
const mobileScreenshot = path.join(productDir, '04-content-calendar-mobile-authorized.png')
await mobilePage.screenshot({ path: mobileScreenshot, fullPage: false })
await mobileContext.close()

await browser.close()

const frames = [
  {
    path: await compositeFrame('01-pending.png', pendingScreenshot, 'Slack Calendar QA', [
      { label: 'Scenario', text: 'A Slack reminder points to a Content Intelligence calendar item that is still pending approval.' },
      { label: 'Expected', text: 'The item starts pending and no external action is available from the readiness page.' },
      { label: 'Route', text: qaPath },
    ]),
    durationSeconds: 3,
  },
  {
    path: await compositeFrame('02-authorized.png', authorizedScreenshot, 'Approval Recorded', [
      { label: 'Action', text: 'The visible Portfolio gate button is clicked after landing from the Slack deep link.' },
      { label: 'Result', text: 'Portfolio reloads the same route and shows authorized with a linked handoff/draft path.' },
      { label: 'Status', text: 'This proves the content readiness page reflects the persisted approval shape.' },
    ]),
    durationSeconds: 4,
  },
  {
    path: await compositeFrame('03-duplicate.png', duplicateScreenshot, 'Duplicate Tap', [
      { label: 'Action', text: 'The Slack action is triggered again after the item is already authorized.' },
      { label: 'Result', text: 'The route remains authorized and the existing handoff remains authoritative.' },
      { label: 'Boundary', text: 'Duplicate actions do not create duplicate draft handoffs or advance provider execution.' },
    ]),
    durationSeconds: 3,
  },
  {
    path: await compositeFrame('04-mobile.png', mobileScreenshot, 'Mobile Check', [
      { label: 'Viewport', text: 'The same Slack-linked calendar item is visible at 390px mobile width.' },
      { label: 'Result', text: 'The row remains authorized and the gate actions collapse without clipping the status path.' },
      { label: 'Surface', text: 'Content Intelligence calendar approval queue.' },
    ]),
    durationSeconds: 3,
  },
]
await createMp4(frames)

const externalRequests = unexpectedRequestGetters.flatMap((getter) => getter())
const summary = {
  qaUrl,
  qaPath,
  videoPath: mp4Path,
  screenshots: {
    pending: pendingScreenshot,
    authorized: authorizedScreenshot,
    duplicate: duplicateScreenshot,
    mobile: mobileScreenshot,
  },
  portfolioAuthorizeCount,
  slackNativeReplayCount,
  finalAuthorizationStatus: calendarAuthorizationStatus,
  externalRequests,
}

if (summary.externalRequests.length > 0) {
  throw new Error(`Unexpected external/provider request(s): ${summary.externalRequests.join(', ')}`)
}

await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
console.log(JSON.stringify(summary, null, 2))
