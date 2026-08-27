import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const rawVideoDir = path.join(root, 'test-results', 'warm-gmail-draft-gate-qa')
const mobileScreenshotPath = path.join(outputDir, 'warm-gmail-draft-gate-mobile.png')
const desktopScreenshotPath = path.join(outputDir, 'warm-gmail-draft-gate-desktop.png')
const mp4Path = path.join(outputDir, 'warm-gmail-draft-gate-mobile.mp4')
const reportPath = path.join(outputDir, 'warm-gmail-draft-gate-qa.json')

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3011'
const supabaseProjectRef = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
).hostname.split('.')[0]
const supabaseAuthStorageKey = `sb-${supabaseProjectRef}-auth-token`

await mkdir(outputDir, { recursive: true })
await mkdir(rawVideoDir, { recursive: true })

const user = {
  id: 'qa-admin-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-admin@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-27T00:00:00.000Z',
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

const lead = {
  id: 42,
  name: 'Amina Example',
  email: 'amina@example.test',
  company: 'Example Ops',
  company_domain: 'example.test',
  job_title: 'Operations Lead',
  industry: 'Services',
  phone_number: null,
  lead_source: 'warm_referral',
  lead_score: 91,
  outreach_status: 'not_contacted',
  qualification_status: 'qualified',
  created_at: '2026-08-27T00:00:00.000Z',
  linkedin_url: null,
  ai_readiness_score: 85,
  competitive_pressure_score: 72,
  quick_wins: null,
  message: null,
  full_report: null,
  rep_pain_points: null,
  messages_count: 1,
  messages_sent: 0,
  has_reply: false,
  has_sales_conversation: false,
  latest_session_id: null,
  session_count: 0,
  evidence_count: 2,
  last_vep_triggered_at: null,
  last_vep_status: null,
  last_n8n_outreach_triggered_at: '2026-08-27T12:00:00.000Z',
  last_n8n_outreach_status: 'success',
  last_n8n_outreach_template_key: null,
  has_extractable_text: false,
  do_not_contact: false,
  removed_at: null,
  website_tech_stack: null,
  recent_email_drafts: [
    {
      id: 'queue-gmail-draft-1',
      subject: 'Warm follow-up draft',
      status: 'draft',
      created_at: '2026-08-27T12:00:00.000Z',
      email_message_id: 'email-message-1',
    },
  ],
}

const relationshipPacket = {
  packet: {
    version: 'warm-outreach-relationship/v1',
    contactId: 42,
    contactName: 'Amina Example',
    objective: 'Prepare a gated Gmail draft for warm outreach review.',
    relationshipBasis: 'Prior local Portfolio context supports a warm follow-up.',
    sourceRefs: [
      {
        sourceType: 'prior_outreach',
        sourceId: 'queue-gmail-draft-1',
        summary: 'Prior local outreach row is available.',
        privateSource: false,
        visibility: 'portfolio_internal',
        mentionSafety: 'safe_to_mention',
        sourceStatus: 'present',
      },
      {
        sourceType: 'meeting_record',
        sourceId: 'meeting-qa-1',
        summary: 'Meeting summary is available as internal context.',
        privateSource: true,
        visibility: 'portfolio_internal',
        mentionSafety: 'summarize_only',
        sourceStatus: 'present',
      },
    ],
    relationshipSignals: ['local outreach history', 'prior meeting context'],
    commonalities: ['operations follow-up'],
    riskFlags: [],
    sourceInventory: {
      sourceStatus: [{ sourceType: 'outreach_queue', status: 'present' }],
      safeToMention: ['company context'],
      summarizeOnly: ['meeting notes'],
      doNotMention: [],
    },
    openingPitchGuidance: {
      safeCommonalities: ['operations follow-up'],
      openingAngle: 'Reconnect around the local follow-up.',
      channelNotes: { email: 'Use email for draft review only.' },
    },
    suggestedNextStep: 'Create a Gmail draft only after the per-recipient gate.',
    avoidContext: ['Do not quote private notes.'],
    responseMonitoringPlan: {
      enabled: false,
      plan: 'Provider monitoring remains disabled.',
      externalActivationRequired: true,
    },
    confidence: 'high',
    suppression: {
      doNotContact: false,
      unsubscribed: false,
      removedAt: null,
    },
    channelCapabilities: {
      email: {
        available: true,
        providerConfigured: true,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'Gmail draft creation is per-recipient gated; sends remain blocked.',
      },
    },
    preferredChannel: 'email',
  },
  readiness: {
    status: 'draft_ready',
    humanReviewRequired: true,
    selectedChannel: 'email',
    recommendedTemplate: 'follow_up',
    blockers: [],
    warnings: ['Gmail draft creation is not send authority.'],
    approvalBoundary: 'draft_only_no_external_send',
  },
  contextSummary: {
    version: 'warm-outreach-relationship/v1',
    contact_id: '42',
    contact_name: 'Amina Example',
    objective: 'Prepare a gated Gmail draft for warm outreach review.',
    relationship_basis: 'Prior local Portfolio context supports a warm follow-up.',
    selected_channel: 'email',
    recommended_template: 'follow_up',
    confidence: 'high',
    source_summaries: [],
    relationship_signals: [],
    commonalities: [],
    risk_flags: [],
    source_inventory: null,
    opening_pitch_guidance: null,
    suggested_next_step: null,
    avoid_context: [],
    response_monitoring_plan: null,
    readiness_status: 'draft_ready',
    blockers: [],
    warnings: ['Gmail draft creation is not send authority.'],
    human_review_required: true,
    approval_boundary: 'draft_only_no_external_send',
  },
  executionBoundary: {
    source: 'local_portfolio_rows',
    readOnly: true,
    providerCalls: false,
    createsDraft: false,
    externalSend: false,
    n8nDispatch: false,
    slackAction: false,
    responseMonitoring: false,
  },
}

function expectedPayload() {
  return {
    createGmailDraft: true,
    draftAuthorization: 'create_gmail_draft_for_recipient',
    idempotencyKey: 'warm-outreach:gmail-draft:v1:queue-gmail-draft-1:42:email',
    contactSubmissionId: 42,
    recipientEmail: 'amina@example.test',
    channel: 'email',
  }
}

async function seedSession(page) {
  await page.addInitScript(({ storageKey, storedSession }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession))
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession))
  }, { storageKey: supabaseAuthStorageKey, storedSession: session })
}

async function installRoutes(page, capturedRequests) {
  await page.route('**/auth/v1/user**', (route) => route.fulfill({ json: user }))
  await page.route('**/api/user/profile**', (route) =>
    route.fulfill({
      json: {
        profile: {
          id: user.id,
          email: user.email,
          role: 'admin',
          created_at: '2026-08-27T00:00:00.000Z',
          updated_at: '2026-08-27T00:00:00.000Z',
        },
      },
    }),
  )
  await page.route('**/api/admin/outreach/leads/42/relationship-packet**', (route) =>
    route.fulfill({ json: relationshipPacket }),
  )
  await page.route('**/api/admin/outreach/queue-gmail-draft-1/gmail-user-draft', async (route) => {
    capturedRequests.push({
      url: route.request().url(),
      method: route.request().method(),
      body: route.request().postDataJSON(),
    })
    return route.fulfill({
      json: {
        message: 'Draft saved in Gmail for review. No email was sent; sending remains blocked.',
        draftId: 'gmail-draft-qa-1',
        threadId: 'gmail-thread-qa-1',
        idempotencyKey: expectedPayload().idempotencyKey,
        externalSendBlocked: true,
      },
    })
  })
  await page.route('**/api/admin/outreach/leads**', (route) => {
    if (route.request().url().includes('/relationship-packet')) return route.fallback()
    return route.fulfill({ json: { leads: [lead], total: 1, page: 1 } })
  })
  await page.route('**/api/admin/outreach/last-run**', (route) =>
    route.fulfill({ json: { lastRun: null } }),
  )
  await page.route('**/api/admin/meetings**', (route) =>
    route.fulfill({ json: { meetings: [], total: 0, limit: 50, offset: 0 } }),
  )
  await page.route('**/api/admin/sales/contact-meetings**', (route) =>
    route.fulfill({ json: { meetings: [] } }),
  )
  await page.route('**/api/admin/chat-escalations**', (route) =>
    route.fulfill({ json: { escalations: [], total: 0 } }),
  )
  await page.route('**/api/meeting-action-tasks**', (route) =>
    route.fulfill({ json: { tasks: [] } }),
  )
  await page.route('**/api/admin/value-evidence/workflow-status**', (route) =>
    route.fulfill({ json: { configured: false, status: 'disabled' } }),
  )
}

function collectUnexpectedExternalRequests(page) {
  const externalRequests = []
  page.on('request', (request) => {
    const url = request.url()
    const parsed = new URL(url)
    if (
      !['localhost', '127.0.0.1'].includes(parsed.hostname) &&
      /gmail|googleapis|slack|n8n|linkedin|facebook/i.test(url)
    ) {
      externalRequests.push(url)
    }
  })
  return externalRequests
}

async function exercisePage(page) {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(`${baseUrl}/admin/outreach?id=42&filter=warm`)
  await page.getByText('Selected outreach workroom').waitFor({ timeout: 15_000 })
  await page.getByText('Warm follow-up draft').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Create per-recipient Gmail draft for Warm follow-up draft' }).click()
  await page.getByText('Draft saved in Gmail for review. No email was sent; sending remains blocked.').waitFor({ timeout: 15_000 })
}

const browser = await chromium.launch()
const capturedRequests = []

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: rawVideoDir, size: { width: 390, height: 844 } },
})
const mobilePage = await mobile.newPage()
await seedSession(mobilePage)
await installRoutes(mobilePage, capturedRequests)
const mobileExternalRequests = collectUnexpectedExternalRequests(mobilePage)
await exercisePage(mobilePage)
await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: true })
const video = mobilePage.video()
await mobile.close()
const rawVideoPath = video ? await video.path() : null
if (rawVideoPath) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    rawVideoPath,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    mp4Path,
  ])
}

const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const desktopPage = await desktop.newPage()
await seedSession(desktopPage)
await installRoutes(desktopPage, capturedRequests)
const desktopExternalRequests = collectUnexpectedExternalRequests(desktopPage)
await exercisePage(desktopPage)
await desktopPage.screenshot({ path: desktopScreenshotPath, fullPage: true })
await desktop.close()
await browser.close()

const externalRequests = [...mobileExternalRequests, ...desktopExternalRequests]
const expected = expectedPayload()
const posted = capturedRequests.map((request) => request.body)
if (externalRequests.length > 0) {
  throw new Error(`Unexpected external request(s): ${externalRequests.join(', ')}`)
}
if (posted.length !== 2) {
  throw new Error(`Expected two local Gmail draft API requests, saw ${posted.length}`)
}
for (const body of posted) {
  if (JSON.stringify(body) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected Gmail draft payload: ${JSON.stringify(body)}`)
  }
}

const report = {
  baseUrl,
  viewportChecks: [
    { width: 390, height: 844, screenshot: mobileScreenshotPath },
    { width: 1280, height: 900, screenshot: desktopScreenshotPath },
  ],
  videoPath: rawVideoPath ? mp4Path : null,
  rawVideoPath,
  capturedLocalGmailDraftRequests: capturedRequests,
  expectedPayload: expected,
  externalRequests,
}
await writeFile(reportPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
