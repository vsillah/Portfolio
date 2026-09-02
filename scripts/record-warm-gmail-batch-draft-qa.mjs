import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const qaDir = path.join(root, 'test-results', 'warm-gmail-batch-draft-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3065').replace(/\/$/, '')
const outreachUrl = new URL('/admin/outreach?tab=leads&filter=warm&qa=warm-gmail-batch-draft', baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-gmail-batch-draft-plan.mp4')
const receiptPath = path.join(outputDir, 'warm-gmail-batch-draft-plan-qa.json')

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
await mkdir(compositeDir, { recursive: true })

const user = {
  id: 'warm-gmail-batch-draft-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-gmail-batch-draft-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-02T00:00:00.000Z',
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const now = Math.floor(Date.now() / 1000)
const session = {
  access_token: [
    base64Url({ alg: 'none', typ: 'JWT' }),
    base64Url({
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      sub: user.id,
      email: user.email,
      role: 'authenticated',
    }),
    'qa-signature',
  ].join('.'),
  refresh_token: 'qa-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now + 3600,
  user,
}

function authStorageKeys() {
  const urls = [process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://example.supabase.co'].filter(Boolean)
  return [...new Set(urls.map((value) => {
    try {
      return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
    } catch {
      return null
    }
  }).filter(Boolean))]
}

const timestamp = '2026-09-02T12:00:00.000Z'
const leads = [
  {
    id: 101,
    name: 'Amina Planready',
    email: 'amina.batch@example.test',
    company: 'Batch QA Studio',
    company_domain: 'batch.example.test',
    job_title: 'Operations Director',
    industry: 'Services',
    phone_number: null,
    lead_source: 'warm_referral',
    lead_score: 91,
    outreach_status: 'not_contacted',
    qualification_status: 'qualified',
    created_at: timestamp,
    linkedin_url: null,
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: 'Needs a lightweight operations review.',
    message: 'Met through a warm referral.',
    full_report: null,
    rep_pain_points: null,
    messages_count: 0,
    messages_sent: 0,
    has_reply: false,
    has_sales_conversation: true,
    latest_session_id: null,
    session_count: 1,
    evidence_count: 2,
    last_vep_triggered_at: null,
    last_vep_status: null,
    last_n8n_outreach_triggered_at: null,
    last_n8n_outreach_status: null,
    last_n8n_outreach_template_key: null,
    has_extractable_text: true,
    recent_email_drafts: [],
  },
  {
    id: 102,
    name: 'Kofi Existingdraft',
    email: 'kofi.batch@example.test',
    company: 'Existing Draft Co',
    company_domain: 'existing.example.test',
    job_title: 'Founder',
    industry: 'Consulting',
    phone_number: null,
    lead_source: 'warm_intro',
    lead_score: 84,
    outreach_status: 'draft',
    qualification_status: 'qualified',
    created_at: timestamp,
    linkedin_url: null,
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: null,
    message: 'Prior follow-up context is in Portfolio.',
    full_report: null,
    rep_pain_points: null,
    messages_count: 1,
    messages_sent: 0,
    has_reply: false,
    has_sales_conversation: true,
    latest_session_id: null,
    session_count: 1,
    evidence_count: 1,
    last_vep_triggered_at: null,
    last_vep_status: null,
    last_n8n_outreach_triggered_at: null,
    last_n8n_outreach_status: null,
    last_n8n_outreach_template_key: null,
    has_extractable_text: true,
    recent_email_drafts: [
      {
        id: 'queue-existing-102',
        subject: 'Warm follow-up',
        status: 'draft',
        created_at: timestamp,
      },
    ],
  },
  {
    id: 103,
    name: 'Mariam Blocked',
    email: null,
    company: 'Blocked Review LLC',
    company_domain: 'blocked.example.test',
    job_title: 'Principal',
    industry: 'Services',
    phone_number: '555-0103',
    lead_source: 'warm_google_contacts',
    lead_score: 30,
    outreach_status: 'not_contacted',
    qualification_status: 'needs_review',
    created_at: timestamp,
    linkedin_url: null,
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: null,
    message: null,
    full_report: null,
    rep_pain_points: null,
    messages_count: 0,
    messages_sent: 0,
    has_reply: false,
    has_sales_conversation: false,
    latest_session_id: null,
    session_count: 0,
    evidence_count: 0,
    last_vep_triggered_at: null,
    last_vep_status: null,
    last_n8n_outreach_triggered_at: null,
    last_n8n_outreach_status: null,
    last_n8n_outreach_template_key: null,
    has_extractable_text: false,
    do_not_contact: true,
    recent_email_drafts: [],
  },
  {
    id: 104,
    name: 'David Submitted',
    email: 'david.batch@example.test',
    company: 'Submitted Evidence Inc',
    company_domain: 'submitted.example.test',
    job_title: 'Owner',
    industry: 'Services',
    phone_number: null,
    lead_source: 'warm_referral',
    lead_score: 78,
    outreach_status: 'sent',
    qualification_status: 'qualified',
    created_at: timestamp,
    linkedin_url: null,
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: null,
    message: 'Prior email was already submitted.',
    full_report: null,
    rep_pain_points: null,
    messages_count: 1,
    messages_sent: 1,
    has_reply: false,
    has_sales_conversation: true,
    latest_session_id: null,
    session_count: 1,
    evidence_count: 1,
    last_vep_triggered_at: null,
    last_vep_status: null,
    last_n8n_outreach_triggered_at: null,
    last_n8n_outreach_status: null,
    last_n8n_outreach_template_key: null,
    has_extractable_text: true,
    recent_email_drafts: [
      {
        id: 'queue-sent-104',
        subject: 'Submitted warm note',
        status: 'sent',
        created_at: timestamp,
      },
    ],
  },
]

function sendReadiness(contactId) {
  return {
    version: 'warm-outreach-send-readiness/v1',
    contactId,
    perRecipientIdempotencyKey: `warm-outreach:recipient:v1:qa-${contactId}`,
    modes: {
      warm_1_to_1: [],
      warm_1_to_many: [
        {
          channel: 'email',
          sendAuthority: {
            channel: 'email',
            state: 'eligible_for_future_activation',
            futureActivationEligible: true,
          },
          emailSendLifecycle: {
            state: 'per_recipient_gate_required',
            stages: [
              { key: 'draft_packet', status: 'ready_for_review' },
              { key: 'provider_capability_smoke', status: 'blocked' },
            ],
            gmailDraftHandoffPacket: {
              state: 'ready_for_internal_handoff',
              internalHandoffReady: true,
            },
            providerCapabilitySmoke: {
              status: 'blocked',
              providerConfigured: false,
            },
            gmailDraftCreationGate: {
              status: 'blocked',
            },
            duplicatePrevention: {
              duplicateDetected: false,
            },
            externalSendReadiness: {
              draftEvidence: { gmailDraftExists: false },
              recipientApproval: { approved: false },
              senderIdentity: { state: 'not_verified' },
              externalSend: { blocked: true },
            },
          },
        },
      ],
    },
    executionBoundary: {
      providerExecution: false,
      externalMonitoring: false,
      gmailDraftCreation: false,
      outcomeTracking: false,
    },
  }
}

function recipient({
  contactId,
  contactName,
  company,
  status,
  statusLabel,
  readiness,
  blockers,
  nextAction,
  nextActionLabel,
  existingQueueId = null,
  relationshipBasis = 'Prior Portfolio relationship context is available.',
  draftCreated = false,
}) {
  const draftCreationStatus = draftCreated
    ? 'draft_created'
    : existingQueueId
      ? 'draft_already_exists'
      : status === 'approval_required'
        ? 'approval_required'
        : status === 'excluded_submitted'
          ? 'excluded'
          : status === 'blocked_review'
            ? 'blocked'
            : 'provider_not_connected'
  const draftCreationLabels = {
    eligible: 'Eligible',
    blocked: 'Blocked',
    excluded: 'Excluded',
    draft_already_exists: 'Draft already exists',
    provider_not_connected: 'Provider not connected',
    approval_required: 'Approval required',
    draft_created: 'Draft created',
  }
  const draftRecordKey = `warm-outreach:gmail-draft-record:v1:qa-${contactId}`
  return {
    contactId,
    contactName,
    company,
    relationshipBasis,
    relationshipSignalCount: status === 'blocked_review' ? 0 : 1,
    selectedChannel: status === 'blocked_review' ? null : 'email',
    selectedTemplate: 'follow_up',
    promptTemplateKey: status === 'blocked_review' ? null : 'email_follow_up',
    suppressionStatus: readiness.some((item) => item.key === 'suppression_risk' && item.state === 'blocked') ? 'blocked' : 'clear',
    suppressionReasons: [],
    weakBasis: readiness.some((item) => item.key === 'weak_relationship_basis' && item.state === 'blocked'),
    blockers,
    warnings: [],
    status: status === 'ready_for_local_planning' ? 'ready_for_review' : status === 'approval_required' ? 'existing_draft' : 'blocked',
    draftIdempotencyKey: `warm-outreach:batch-draft:v1:qa-${contactId}`,
    existingQueueId,
    individualizedDraftPreview: status === 'blocked_review' ? `Blocked for ${contactName}: ${blockers[0]}` : `Hi ${contactName.split(' ')[0]}, draft direction: follow up via email.`,
    responseMonitoring: {
      status: 'awaiting_response',
      mode: 'pending',
      proposedFollowUp: { label: 'Review warm follow-up' },
    },
    sendReadiness: sendReadiness(contactId),
    gmailDraftPlan: {
      contactId,
      contactName,
      company,
      status,
      statusLabel,
      relationshipBasis,
      relationshipSignalCount: status === 'blocked_review' ? 0 : 1,
      readiness,
      blockers,
      nextAction,
      nextActionLabel: draftCreated ? 'Draft record created' : nextActionLabel,
      existingQueueId,
      draftCreation: {
        status: draftCreationStatus,
        statusLabel: draftCreationLabels[draftCreationStatus],
        actionEnabled: draftCreationStatus === 'provider_not_connected',
        blocker: draftCreationStatus === 'provider_not_connected'
          ? 'Connect and verify Gmail before creating provider drafts. Local records remain draft-only.'
          : draftCreationStatus === 'draft_already_exists'
            ? 'A local email draft already exists for this recipient and template.'
            : blockers[0] ?? null,
        draftOnly: true,
        draftRecordKey,
        localDraftRecordId: draftCreated ? draftRecordKey : null,
        providerDraftId: null,
        createdAt: draftCreated ? timestamp : null,
        externalRequests: [],
      },
      draftIntent: {
        channel: 'gmail',
        templateFamily: 'follow_up',
        promptTemplateKey: status === 'blocked_review' ? null : 'email_follow_up',
        queueIntent: 'draft_only_planned',
        createsOutreachQueueRow: false,
        createsGmailDraft: false,
        callsProvider: false,
        externalSend: false,
      },
    },
    packet: { relationshipBasis, relationshipSignals: [], sourceRefs: [], suppression: {} },
    readiness: { status: 'needs_review', selectedChannel: 'email', recommendedTemplate: 'follow_up', blockers: [], warnings: [] },
    contextSummary: { readiness_status: 'needs_review' },
  }
}

const reviewRows = [
  recipient({
    contactId: 101,
    contactName: 'Amina Planready',
    company: 'Batch QA Studio',
    status: 'ready_for_local_planning',
    statusLabel: 'Plan ready',
    readiness: [
      { key: 'provider_not_connected', label: 'Provider not connected', state: 'needs_review' },
    ],
    blockers: [],
    nextAction: 'local_draft_planning',
    nextActionLabel: 'Create Gmail draft record',
  }),
  recipient({
    contactId: 102,
    contactName: 'Kofi Existingdraft',
    company: 'Existing Draft Co',
    status: 'approval_required',
    statusLabel: 'Approval review',
    readiness: [
      { key: 'approval_needed', label: 'Approval needed', state: 'needs_review' },
      { key: 'provider_not_connected', label: 'Provider not connected', state: 'needs_review' },
    ],
    blockers: [],
    nextAction: 'approval_request',
    nextActionLabel: 'Review approval request',
    existingQueueId: 'queue-existing-102',
  }),
  recipient({
    contactId: 103,
    contactName: 'Mariam Blocked',
    company: 'Blocked Review LLC',
    status: 'blocked_review',
    statusLabel: 'Blocked',
    readiness: [
      { key: 'missing_email', label: 'Missing email', state: 'blocked' },
      { key: 'weak_relationship_basis', label: 'Weak relationship basis', state: 'blocked' },
      { key: 'suppression_risk', label: 'Suppression risk', state: 'blocked' },
      { key: 'sms_unavailable', label: 'SMS unavailable', state: 'unavailable' },
    ],
    blockers: ['Missing email address for Gmail draft planning.'],
    nextAction: 'blocked_review',
    nextActionLabel: 'Resolve blocker',
    relationshipBasis: 'Warm source exists, but local relationship evidence is too thin.',
  }),
  recipient({
    contactId: 104,
    contactName: 'David Submitted',
    company: 'Submitted Evidence Inc',
    status: 'excluded_submitted',
    statusLabel: 'Submitted',
    readiness: [
      { key: 'submitted_evidence_exists', label: 'Submitted evidence exists', state: 'blocked' },
      { key: 'provider_not_connected', label: 'Provider not connected', state: 'needs_review' },
    ],
    blockers: ['Submitted email evidence already exists; exclude this recipient from batch drafting.'],
    nextAction: 'excluded_review',
    nextActionLabel: 'Review submitted evidence',
  }),
]

const batchReview = {
  mode: 'warm_1_to_many',
  batchIdempotencyKey: 'warm-outreach:batch-review:v1:qa-warm-gmail-batch-draft',
  cohort: {
    label: '4 selected Gmail draft candidates',
    recipientCount: 4,
    source: 'selected_outreach_leads',
    provenance: 'Selected 4 synthetic /admin/outreach warm leads from local Portfolio QA rows.',
  },
  summary: {
    readyCount: 1,
    existingDraftCount: 1,
    blockedCount: 2,
    weakBasisCount: 1,
    suppressionBlockedCount: 1,
  },
  samplePreview: reviewRows[0],
  recipients: reviewRows,
  gmailDraftPlan: {
    version: 'warm-outreach-gmail-batch-draft-plan/v1',
    status: 'draft_creation_ready',
    currentCta: {
      key: 'create_gmail_draft_records',
      label: 'Create Gmail draft records (1)',
      enabled: true,
      blocker: null,
    },
    summary: {
      selectedCount: 4,
      readyForLocalPlanningCount: 1,
      approvalRequiredCount: 1,
      blockedReviewCount: 1,
      excludedSubmittedCount: 1,
      providerNotConnectedCount: 3,
      smsUnavailableCount: 1,
      draftCreationEligibleCount: 1,
      draftAlreadyExistsCount: 1,
      draftCreatedCount: 0,
    },
    rows: reviewRows.map((row) => row.gmailDraftPlan),
    executionReceipt: null,
    executionBoundary: {
      localPortfolioPlanOnly: true,
      createsOutreachQueueRows: false,
      createsGmailDrafts: false,
      gmailProviderCalls: false,
      gmailSend: false,
      slackDispatch: false,
      smsDelivery: false,
      n8nDispatch: false,
      productionDataMutation: false,
      genericApprovalAuthorizesSend: false,
    },
  },
  executionBoundary: {
    source: 'local_portfolio_rows',
    readOnly: true,
    providerCalls: false,
    createsDraft: false,
    externalSend: false,
    scheduling: false,
    gmailDraft: false,
    linkedinAction: false,
    facebookAction: false,
    phoneAction: false,
    n8nDispatch: false,
    slackAction: false,
    responseMonitoring: false,
  },
}

const createdRows = reviewRows.map((row) => (
  row.contactId === 101
    ? recipient({
        contactId: 101,
        contactName: 'Amina Planready',
        company: 'Batch QA Studio',
        status: 'ready_for_local_planning',
        statusLabel: 'Plan ready',
        readiness: [
          { key: 'provider_not_connected', label: 'Provider not connected', state: 'needs_review' },
        ],
        blockers: [],
        nextAction: 'local_draft_planning',
        nextActionLabel: 'Create Gmail draft record',
        draftCreated: true,
      })
    : row
))

const batchReviewCreated = {
  ...batchReview,
  recipients: createdRows,
  gmailDraftPlan: {
    ...batchReview.gmailDraftPlan,
    status: 'draft_records_created',
    currentCta: {
      key: 'draft_records_created',
      label: 'Gmail draft records created',
      enabled: false,
      blocker: null,
    },
    summary: {
      ...batchReview.gmailDraftPlan.summary,
      draftCreationEligibleCount: 0,
      draftCreatedCount: 1,
    },
    rows: createdRows.map((row) => row.gmailDraftPlan),
    executionReceipt: {
      action: 'create_gmail_draft_records',
      createdAt: timestamp,
      createdCount: 1,
      externalRequests: [],
    },
  },
}

async function seedSession(page) {
  await page.addInitScript(({ keys, storedSession }) => {
    for (const key of keys) window.localStorage.setItem(key, JSON.stringify(storedSession))
  }, { keys: authStorageKeys(), storedSession: session })
}

async function installSafeRoutes(page) {
  await page.route('**/api/user/profile**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ profile: { ...user, role: 'admin', updated_at: user.created_at } }),
  }))
  await page.route(/https:\/\/[^/]+\.supabase\.co\/auth\/v1\/user.*/i, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(user),
  }))
  await page.route('**/api/admin/outreach/batch-review**', async (route, request) => {
    const body = request.postDataJSON?.() ?? {}
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body.action === 'create_gmail_draft_records' ? batchReviewCreated : batchReview),
    })
  })
  await page.route('**/api/admin/outreach/leads**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ leads, total: leads.length, page: 1 }),
  }))
  await page.route('**/api/admin/value-evidence/workflow-status**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ runs: [] }),
  }))
  await page.route('**/api/admin/chat-escalations**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ escalations: [], total: 0 }),
  }))
  await page.route('**/api/admin/sales/contact-meetings**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ meetings: [] }),
  }))
  await page.route('**/api/meeting-action-tasks**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tasks: [] }),
  }))
}

function collectUnexpectedRequests(page) {
  const requests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/leads\/[^/]+\/(?:sms-candidate|sms-telnyx|gmail-draft-canary)\b/i.test(url.pathname) ||
      /slack\.com|gmail\.com|googleapis\.com|n8n|telnyx/i.test(url.hostname)
    ) {
      requests.push(request.url())
    }
  })
  return requests
}

async function openQaPage(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await seedSession(page)
  await installSafeRoutes(page)
  const unexpectedRequests = collectUnexpectedRequests(page)
  const response = await page.goto(outreachUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${outreachUrl}`)
  }
  return { context, page, unexpectedRequests }
}

async function captureMainScenario(browser, name, viewport) {
  const qa = await openQaPage(browser, viewport)
  try {
    await qa.page.getByLabel('Daily warm outreach shortlist').getByText('Amina Planready').waitFor({ timeout: 15_000 })
  } catch (error) {
    const debugPath = path.join(sourceDir, `${name}-debug.png`)
    await qa.page.screenshot({ path: debugPath, fullPage: true })
    const bodyText = await qa.page.locator('body').innerText({ timeout: 1000 }).catch(() => '')
    throw new Error(`Warm Gmail batch QA lead did not render at ${qa.page.url()}. Debug screenshot: ${debugPath}. Body: ${bodyText.slice(0, 500)}`, { cause: error })
  }
  await qa.page.getByLabel('Select all on this page').click()
  const selectedPath = path.join(sourceDir, `${name}-01-selected.png`)
  await qa.page.screenshot({ path: selectedPath, fullPage: true })

  await qa.page.getByRole('button', { name: 'Plan Gmail drafts' }).click()
  const panel = qa.page.getByLabel('Gmail batch draft plan')
  await panel.waitFor({ timeout: 15_000 })
  await panel.scrollIntoViewIfNeeded()
  const planPath = path.join(sourceDir, `${name}-02-plan.png`)
  await qa.page.screenshot({ path: planPath, fullPage: true })

  await panel.getByRole('button', { name: 'Create Gmail draft records (1)' }).click()
  await panel.getByText(/Draft-only Gmail records created for 1 contact/).waitFor({ timeout: 10_000 })
  const noticePath = path.join(sourceDir, `${name}-03-notice.png`)
  await qa.page.screenshot({ path: noticePath, fullPage: true })

  const overflow = await qa.page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  await qa.context.close()
  return {
    name,
    viewport,
    screenshots: { selectedPath, planPath, noticePath },
    overflow,
    horizontalOverflow: overflow.scrollWidth > overflow.clientWidth,
    unexpectedRequests: qa.unexpectedRequests,
  }
}

const browser = await chromium.launch()
const mobile = await captureMainScenario(browser, 'mobile-390', { width: 390, height: 844 })
const desktop = await captureMainScenario(browser, 'desktop-1440', { width: 1440, height: 1000 })
await browser.close()

const frames = [
  {
    source: mobile.screenshots.selectedPath,
    title: 'Select warm contacts',
    scenario: 'The operator starts on the existing warm outreach shortlist and selects a small batch.',
    expected: 'The page exposes a Gmail planning CTA from the current /admin/outreach leads workroom.',
    changed: 'Warm shortlist selection, batch planning affordance, and selected-contact state.',
    boundary: 'No provider calls. The selection step only changes local UI state.',
  },
  {
    source: mobile.screenshots.planPath,
    title: 'Review draft readiness',
    scenario: 'The batch preview shows one plan-ready row, one approval review row, one blocked row, and one submitted row.',
    expected: 'Each row shows basis, template intent, blocker chips, and Gmail draft-record state.',
    changed: 'Batch preview, per-row readiness chips, current CTA, and collapsed Email gates details.',
    boundary: 'The CTA creates draft-only local records; it does not create provider Gmail drafts or sends.',
  },
  {
    source: desktop.screenshots.noticePath,
    title: 'Create draft records',
    scenario: 'The operator clicks the one current batch CTA after reviewing the rows.',
    expected: 'A local confirmation appears and states exactly which external actions did not happen.',
    changed: 'Draft-record receipt, repeat-action disabled state, and desktop review state.',
    boundary: 'Gmail send, provider drafts, Slack, SMS, n8n, provider requests, and production writes remain off.',
  },
]

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function frameHtml(frame) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 1280px; height: 720px; overflow: hidden; background: #020617; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { display: grid; grid-template-columns: 430px 1fr; width: 1280px; height: 720px; }
    aside { display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 34px; background: #0b1220; border-right: 1px solid rgba(148, 163, 184, .25); }
    .eyebrow, .label { color: #93c5fd; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 35px; line-height: 1.08; }
    p { margin: 4px 0 0; color: #dbeafe; font-size: 18px; line-height: 1.34; }
    .gate { border: 1px solid rgba(251, 191, 36, .45); background: rgba(146, 64, 14, .24); border-radius: 8px; padding: 13px; color: #fde68a; font-size: 18px; line-height: 1.34; }
    .flags { display: flex; flex-wrap: wrap; gap: 7px; }
    .flag { border: 1px solid rgba(16, 185, 129, .35); background: rgba(6, 78, 59, .42); color: #d1fae5; border-radius: 999px; padding: 6px 9px; font-size: 13px; font-weight: 750; }
    .screen { display: flex; align-items: center; justify-content: center; height: 720px; padding: 18px 24px; background: #020617; }
    img { max-width: 790px; max-height: 680px; object-fit: contain; border: 1px solid rgba(148, 163, 184, .32); border-radius: 8px; box-shadow: 0 24px 80px rgba(0, 0, 0, .55); }
  </style>
</head>
<body>
  <main>
    <aside>
      <div class="eyebrow">Warm Gmail Batch Draft QA</div>
      <h1>${escapeHtml(frame.title)}</h1>
      <div><div class="label">Scenario</div><p>${escapeHtml(frame.scenario)}</p></div>
      <div><div class="label">Expected behavior</div><p>${escapeHtml(frame.expected)}</p></div>
      <div><div class="label">Changed areas</div><p>${escapeHtml(frame.changed)}</p></div>
      <div class="gate">${escapeHtml(frame.boundary)}</div>
      <div class="flags"><span class="flag">Synthetic contacts</span><span class="flag">Gmail off</span><span class="flag">Slack off</span><span class="flag">SMS off</span></div>
    </aside>
    <div class="screen"><img src="${pathToFileURL(frame.source).href}" alt="Portfolio warm Gmail batch draft planning" /></div>
  </main>
</body>
</html>`
}

const concatPath = path.join(qaDir, 'frames.txt')
const concatLines = []
for (const [index, frame] of frames.entries()) {
  const htmlPath = path.join(compositeDir, `${index + 1}.html`)
  const imagePath = path.join(compositeDir, `${index + 1}.png`)
  await writeFile(htmlPath, frameHtml(frame), 'utf8')
  const renderBrowser = await chromium.launch()
  const page = await renderBrowser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(pathToFileURL(htmlPath).href)
  await page.screenshot({ path: imagePath })
  await renderBrowser.close()
  concatLines.push(`file '${imagePath.replaceAll("'", "'\\''")}'`, 'duration 4')
}
concatLines.push(`file '${path.join(compositeDir, `${frames.length}.png`).replaceAll("'", "'\\''")}'`)
await writeFile(concatPath, `${concatLines.join('\n')}\n`, 'utf8')

await execFileAsync('ffmpeg', [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatPath,
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
  '-r', '30',
  '-c:v', 'libx264',
  '-movflags', '+faststart',
  mp4Path,
])

const receipt = {
  scenario: 'warm-gmail-batch-draft',
  route: outreachUrl,
  mp4Path,
  timestamp: new Date().toISOString(),
  viewports: [
    {
      name: mobile.name,
      viewport: mobile.viewport,
      horizontalOverflow: mobile.horizontalOverflow,
      overflow: mobile.overflow,
      screenshots: mobile.screenshots,
    },
    {
      name: desktop.name,
      viewport: desktop.viewport,
      horizontalOverflow: desktop.horizontalOverflow,
      overflow: desktop.overflow,
      screenshots: desktop.screenshots,
    },
  ],
  externalRequests: [...mobile.unexpectedRequests, ...desktop.unexpectedRequests],
  expectedBehavior: [
    'Existing /admin/outreach warm leads route exposes draft-only Gmail batch planning.',
    'Batch preview shows selected contacts, readiness, relationship basis, template intent, and blocked/excluded rows.',
    'Creating draft records changes local UI receipt state, prevents repeat action, and does not create provider drafts or queue rows.',
  ],
  changedAreas: [
    'Warm outreach shortlist selection and Plan Gmail drafts affordance.',
    'Gmail batch draft plan preview with compact status chips and per-row blockers.',
    'Collapsed Email gates disclosure replacing the legacy amber explanatory block.',
    'Draft-only record confirmation and no-provider/no-egress boundary receipt.',
  ],
  executionBoundary: batchReviewCreated.gmailDraftPlan.executionBoundary,
  draftCreationReceipt: batchReviewCreated.gmailDraftPlan.executionReceipt,
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(receipt, null, 2))
