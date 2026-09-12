import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3127'
const outputDir = path.join(process.cwd(), 'test-results', 'stat-tile-parity-sweep')
const videoDir = path.join(outputDir, 'raw')
const manifestPath = path.join(outputDir, 'manifest.json')

const user = {
  id: 'qa-admin-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-admin@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-01T12:00:00.000Z',
}

const session = {
  access_token: 'qa-admin-token',
  refresh_token: 'qa-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user,
}

const dashboardData = {
  funnel: { total: 10, enriched: 7, contacted: 4, replied: 2, booked: 1, reply_rate: 50, booking_rate: 25 },
  coldFunnel: { total: 4, enriched: 2, contacted: 1, replied: 0, booked: 0, reply_rate: 0, booking_rate: 0 },
  warmFunnel: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, reply_rate: 67, booking_rate: 33 },
  funnelBySource: {
    warm_referral: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, opted_out: 0, no_response: 1 },
    cold_apollo: { total: 4, enriched: 2, contacted: 1, replied: 0, booked: 0, opted_out: 0, no_response: 1 },
  },
  funnelByTemperature: {
    warm: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, reply_rate: 67, booking_rate: 33 },
    cold: { total: 4, enriched: 2, contacted: 1, replied: 0, booked: 0, reply_rate: 0, booking_rate: 0 },
  },
  warmSourceBreakdown: {
    warm_referral: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, opted_out: 0, no_response: 1 },
  },
  queueStats: { draft: 2 },
  channelStats: {
    email: { total: 4, sent: 4, replied: 2, reply_rate: 50 },
    linkedin: { total: 1, sent: 1, replied: 0, reply_rate: 0 },
  },
  stepStats: { '1': { sent: 4, replied: 2 } },
  recentActivity: [{
    id: 'activity-1',
    channel: 'email',
    subject: 'Warm follow-up',
    status: 'replied',
    sequence_step: 1,
    sent_at: '2026-09-01T12:00:00.000Z',
    replied_at: '2026-09-01T13:00:00.000Z',
    contact_submissions: {
      id: 42,
      name: 'Ada Operator',
      company: 'Ops Lab',
      lead_score: 82,
    },
  }],
  leadSources: [],
}

const comment = {
  id: 'comment-qa-1',
  socialContentId: 'social-qa-1',
  platform: 'linkedin',
  providerCommentId: 'urn:li:comment:qa-1',
  providerPermalink: 'https://linkedin.example.test/comment/qa-1',
  authorDisplayName: 'Synthetic Reviewer',
  body: 'Can this reply explain the approval boundary clearly?',
  status: 'lead',
  classification: {
    label: 'Lead',
    priority: 'high',
    reason: 'Synthetic service question for metric-filter QA.',
  },
  draftReply: 'A local draft reply stays gated until approval.',
  approvalState: 'drafted',
  providerCapability: {
    provider: 'linkedin_organization',
    automaticReply: false,
    verified: false,
    humanGateSatisfied: false,
    blocker: 'Provider reply adapter is not verified.',
    recoveryPath: 'Reply manually from the provider permalink after a separate provider gate.',
  },
  actionHistory: [],
  createdAt: '2026-09-01T11:50:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  campaignId: 'campaign-qa',
  campaignLabel: 'Synthetic Engagement QA',
  postLabel: 'Synthetic comment reply review',
  postExcerpt: 'Synthetic Portfolio QA post. No provider submission is represented.',
}

const commentSummary = {
  total: 1,
  new: 0,
  needs_qa: 0,
  auto_send_pending: 0,
  lead: 1,
  escalated: 0,
  responded: 0,
  ignored: 0,
}

const alertReliability = {
  state: 'disabled',
  label: 'Alerts disabled',
  summary: 'Synthetic QA keeps Slack/provider dispatch disabled; the inbox is the local review surface.',
  deliveryMode: 'disabled',
  activation: { enabled: false, reason: 'qa_fixture_no_external_dispatch' },
  counts: { itemCount: 1, sent: 0, deduped: 0, skipped: 1, errors: 0 },
  reasons: ['Synthetic fixture only.'],
  lastActionableNextStep: 'Review eligible comments in the Engagement Inbox.',
  nextStep: { label: 'Open inbox', href: '/admin/social-content/engagement-inbox' },
  lastRun: null,
}

function convertToMp4(webmPath, mp4Path) {
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    webmPath,
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    '-vf',
    'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    mp4Path,
  ], { stdio: 'pipe' })
}

async function seedSession(context, externalRequests, suppressedExternalScripts) {
  const baseOrigin = new URL(baseUrl).origin
  await context.addInitScript(({ origin, activeSession }) => {
    if (window.location.origin === origin) {
      window.localStorage.setItem('sb-example-auth-token', JSON.stringify(activeSession))
    }
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const parsedUrl = new URL(rawUrl, window.location.href)
      if (parsedUrl.pathname.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify({ user: activeSession.user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (parsedUrl.pathname.endsWith('/auth/v1/token')) {
        return new Response(JSON.stringify(activeSession), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return nativeFetch(input, init)
    }
  }, { origin: baseOrigin, activeSession: session })

  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === 'va.vercel-scripts.com') {
      suppressedExternalScripts.push(requestUrl.href)
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      return
    }

    if (requestUrl.origin !== baseOrigin && requestUrl.protocol !== 'data:') {
      externalRequests.push(requestUrl.href)
      await route.abort()
      return
    }

    if (requestUrl.pathname === '/api/user/profile') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: user.id,
            email: user.email,
            role: 'admin',
            created_at: '2026-09-01T12:00:00.000Z',
            updated_at: '2026-09-01T12:00:00.000Z',
          },
        }),
      })
      return
    }

    if (requestUrl.pathname === '/api/admin/outreach/dashboard') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboardData) })
      return
    }

    if (requestUrl.pathname === '/api/admin/outreach/trigger') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: [] }) })
      return
    }

    if (requestUrl.pathname === '/api/admin/social-content/engagement/comments') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [comment],
          summary: commentSummary,
          filteredSummary: commentSummary,
          alertReliability,
        }),
      })
      return
    }

    await route.continue()
  })
}

async function addAnnotation(page, scenario) {
  await page.addStyleTag({
    content: scenario.annotation === 'side'
      ? `
        .admin-console-page, body > div > .min-h-screen { max-width: calc(100vw - 350px); }
        #qa-annotation {
          position: fixed;
          z-index: 2147483647;
          top: 20px;
          right: 20px;
          width: 310px;
          max-height: calc(100vh - 40px);
          overflow: auto;
          border: 1px solid rgba(245, 208, 96, 0.38);
          border-radius: 8px;
          background: rgba(7, 17, 31, 0.94);
          color: #e5e7eb;
          padding: 14px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
        }
      `
      : `
        #qa-annotation {
          position: fixed;
          z-index: 2147483647;
          right: 10px;
          bottom: 10px;
          left: 10px;
          max-height: 155px;
          overflow: auto;
          border: 1px solid rgba(245, 208, 96, 0.38);
          border-radius: 8px;
          background: rgba(7, 17, 31, 0.94);
          color: #e5e7eb;
          padding: 10px;
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
        }
      `,
  })

  await page.evaluate(({ label, scenarioText, steps }) => {
    const aside = document.createElement('aside')
    aside.id = 'qa-annotation'
    aside.innerHTML = `
      <h2 style="margin:0 0 8px;color:#f5d060;font-size:15px;line-height:1.25">${label}</h2>
      <p style="margin:0 0 8px;color:#cbd5e1;font-size:12px;line-height:1.45"><strong style="color:white">Scenario:</strong> ${scenarioText}</p>
      <ul style="margin:0 0 8px;padding-left:16px;color:#cbd5e1;font-size:11px;line-height:1.45">${steps.map((step) => `<li>${step}</li>`).join('')}</ul>
      <p style="margin:0;color:#cbd5e1;font-size:11px;line-height:1.45"><strong style="color:white">Boundary:</strong> synthetic fixtures; no provider, publish, schedule, Gmail, Slack, SMS, n8n, or production-row action.</p>
    `
    document.body.appendChild(aside)
  }, { label: scenario.label, scenarioText: scenario.scenarioText, steps: scenario.steps })
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 2) throw new Error(`${label} has horizontal overflow: ${overflow}px`)
}

async function recordScenario(browser, scenario) {
  const externalRequests = []
  const suppressedExternalScripts = []
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    recordVideo: {
      dir: videoDir,
      size: { width: scenario.width, height: scenario.height },
    },
  })
  await seedSession(context, externalRequests, suppressedExternalScripts)
  const page = await context.newPage()
  await page.goto(`${baseUrl}${scenario.path}`)
  await page.waitForLoadState('networkidle')
  await addAnnotation(page, scenario)
  await scenario.verify(page)
  await assertNoHorizontalOverflow(page, scenario.slug)
  await page.waitForTimeout(700)
  const video = page.video()
  await page.close()
  await context.close()
  const webmPath = await video.path()
  const mp4Path = path.join(outputDir, `${scenario.slug}.mp4`)
  convertToMp4(webmPath, mp4Path)
  return { slug: scenario.slug, mp4Path, externalRequests, suppressedExternalScripts }
}

async function main() {
  fs.mkdirSync(videoDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  try {
    for (const viewport of [
      { suffix: 'desktop', width: 1500, height: 900, annotation: 'side' },
      { suffix: 'mobile', width: 390, height: 844, annotation: 'mobile' },
    ]) {
      results.push(await recordScenario(browser, {
        slug: `outreach-dashboard-funnel-parity-${viewport.suffix}`,
        label: `Outreach Dashboard ${viewport.suffix} QA`,
        scenarioText: 'funnel tiles only look interactive when they drill into a real lead filter.',
        steps: [
          'Confirm Sourced and Contacted are links into the Outreach workroom.',
          'Confirm Contacted uses status=sequence_active.',
          'Confirm Enriched is a quiet static metric with no link affordance.',
          'Switch to Warm Leads and confirm drilldowns preserve filter=warm.',
        ],
        path: '/admin/outreach/dashboard',
        ...viewport,
        verify: async (page) => {
          await page.getByRole('heading', { name: 'Lead Pipeline' }).waitFor()
          await expect(page.getByRole('link', { name: 'Open contacted leads' })).toHaveAttribute('href', '/admin/outreach?tab=leads&status=sequence_active')
          await expect(page.getByRole('link', { name: 'Open sourced leads' })).toHaveAttribute('href', '/admin/outreach?tab=leads')
          await expect(page.getByRole('link', { name: /enriched leads/i })).toHaveCount(0)
          await expect(page.getByLabel('Enriched leads metric')).toBeVisible()
          await page.getByRole('button', { name: /Warm Leads/i }).click()
          await expect(page.getByRole('link', { name: 'Open contacted leads' })).toHaveAttribute('href', '/admin/outreach?tab=leads&filter=warm&status=sequence_active')
        },
      }))

      results.push(await recordScenario(browser, {
        slug: `engagement-inbox-status-metric-parity-${viewport.suffix}`,
        label: `Engagement Inbox ${viewport.suffix} QA`,
        scenarioText: 'status metric tiles act as real filters and expose active/clear state.',
        steps: [
          'Start from status=lead and confirm the Lead metric is active.',
          'Click the active Lead metric and confirm it clears back to all statuses.',
          'Confirm the status dropdown stays synchronized.',
        ],
        path: '/admin/social-content/engagement-inbox?status=lead',
        ...viewport,
        verify: async (page) => {
          await page.getByRole('heading', { name: 'Engagement Inbox', exact: true }).waitFor()
          const activeMetric = page.getByRole('button', { name: 'Clear Lead comment filter (1)' })
          await expect(activeMetric).toHaveAttribute('aria-pressed', 'true')
          await expect(page.getByLabel('Status')).toHaveValue('lead')
          await activeMetric.click()
          await expect(page.getByLabel('Status')).toHaveValue('all')
          await expect(page.getByRole('button', { name: 'Filter comments to Lead (1)' })).toHaveAttribute('aria-pressed', 'false')
        },
      }))
    }
  } finally {
    await browser.close()
  }

  const manifest = {
    baseUrl,
    routes: ['/admin/outreach/dashboard', '/admin/social-content/engagement-inbox?status=lead'],
    generatedAt: new Date().toISOString(),
    data: 'synthetic Portfolio admin QA fixtures',
    externalRequests: [...new Set(results.flatMap((result) => result.externalRequests))],
    suppressedExternalScripts: [...new Set(results.flatMap((result) => result.suppressedExternalScripts))],
    videos: results.map((result) => result.mp4Path),
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify(manifest, null, 2))
  if (manifest.externalRequests.length > 0) {
    throw new Error('External requests were blocked during QA. See manifest for URLs.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
