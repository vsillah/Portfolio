import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const rawVideoDir = path.join(root, 'test-results', 'warm-send-authority-qa')
const mobileScreenshotPath = path.join(outputDir, 'warm-send-authority-mobile.png')
const desktopContactScreenshotPath = path.join(outputDir, 'warm-send-authority-contact-desktop.png')
const desktopBatchScreenshotPath = path.join(outputDir, 'warm-send-authority-batch-desktop.png')
const mp4Path = path.join(outputDir, 'warm-send-authority-mobile.mp4')

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3011'
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE
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
  created_at: '2026-08-26T00:00:00.000Z',
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

const contact = {
  id: 42,
  name: 'Amina Example',
  email: 'amina@example.test',
  company: 'Example Ops',
  industry: 'Services',
  lead_source: 'warm_referral',
  lead_score: 91,
  outreach_status: 'not_contacted',
  created_at: '2026-08-20T00:00:00.000Z',
  employee_count: '25-50',
}

function authority(mode, channel, state, blocked = false) {
  const futureEligible = state === 'eligible_for_future_activation'
  const manual = state === 'manual_only'
  return {
    version: 'warm-outreach-send-authority/v1',
    mode,
    channel,
    label:
      state === 'blocked'
        ? `${channel} send authority blocked`
        : state === 'manual_only'
          ? `${channel} manual authority review`
          : `${channel} eligible for future send-authority review`,
    state,
    futureActivationEligible: futureEligible,
    externalSendApproved: false,
    externalSendEnabled: false,
    providerExecutionEnabled: false,
    gmailDraftCreationEnabled: false,
    schedulingEnabled: false,
    outcomeTrackingEnabled: false,
    humanApprovalRequired: true,
    idempotencyKey: `warm-outreach:send-readiness:v1:${mode}:${channel}`,
    gates: [
      ['target_source_provenance', blocked ? 'blocked' : 'satisfied'],
      ['relationship_basis', blocked ? 'blocked' : 'satisfied'],
      ['consent_suppression', 'satisfied'],
      ['personalization', blocked ? 'blocked' : 'satisfied'],
      ['human_approval', 'future_gate'],
      ['provider_capability', manual ? 'manual_required' : futureEligible ? 'future_gate' : 'blocked'],
      ['idempotency', 'satisfied'],
      ['send_scheduling', 'future_gate'],
      ['outcome_tracking', 'future_gate'],
      ['response_follow_up', 'future_gate'],
    ].map(([key, status]) => ({
      key,
      label: key.replace(/_/g, ' '),
      status,
      requiredForActivation: true,
      detail: `${key.replace(/_/g, ' ')} gate`,
      externalExecutionEnabled: false,
    })),
    blockers: blocked ? ['Relationship basis is too weak for send readiness.'] : [],
    manualSteps: manual
      ? [
          'Review the relationship packet in Portfolio.',
          'Complete manual contact outside provider automation if approved later.',
          'Record the outcome back into local Portfolio rows.',
        ]
      : [],
    nextReviewAction:
      state === 'blocked'
        ? 'Relationship basis is too weak for send readiness.'
        : state === 'manual_only'
          ? 'Manual-only channel: prepare an operator review packet; no provider action is available.'
          : 'Prepare send packet for a future approval request; external sends remain disabled.',
  }
}

function emailLifecycle(mode, blocked = false, batchGateOnly = false) {
  const state = batchGateOnly
    ? 'per_recipient_gate_required'
    : blocked
      ? 'blocked'
      : 'blocked_before_provider_activation'
  const messageVersionKey = `warm-outreach:email-message-version:v1:${mode}:qa42`
  const sendQueueIdempotencyKey = `warm-outreach:email-send-queue:v1:${mode}:qa42`

  return {
    version: 'warm-outreach-email-send-lifecycle/v1',
    contactId: 42,
    mode,
    channel: 'email',
    label:
      state === 'per_recipient_gate_required'
        ? 'Email is first candidate, per-recipient gate required'
        : state === 'blocked'
          ? 'Email send path blocked'
          : 'Email is first candidate, provider/send activation blocked',
    state,
    firstCandidateChannel: true,
    sendReady: false,
    providerExecutionEnabled: false,
    externalSendEnabled: false,
    gmailDraftCreationEnabled: false,
    schedulingEnabled: false,
    messageVersionKey,
    sendQueueIdempotencyKey,
    providerCapabilitySmokeKey: `warm-outreach:gmail-capability-smoke:v1:${mode}:qa42`,
    submittedEvidenceKey: `warm-outreach:email-submitted-evidence:v1:${mode}:qa42`,
    duplicatePrevention: {
      scope: 'contact_channel_message_version',
      duplicateDetected: false,
      existingEvidenceIds: [],
      requiredUniqueKeys: [
        messageVersionKey,
        sendQueueIdempotencyKey,
        `warm-outreach:gmail-capability-smoke:v1:${mode}:qa42`,
        `warm-outreach:email-submitted-evidence:v1:${mode}:qa42`,
      ],
      detail: 'Future send activation must reuse these keys to prevent duplicate contact/channel/message-version execution.',
    },
    suppressionCheck: {
      status: blocked ? 'blocked' : 'clear',
      reasons: blocked ? ['Relationship basis is too weak for send readiness.'] : [],
    },
    relationshipProvenance: {
      status: blocked ? 'missing' : 'present',
      sourceCount: blocked ? 0 : 2,
      signalCount: blocked ? 0 : 2,
      relationshipEventId: null,
      detail: blocked
        ? 'Relationship provenance must be added before send authority review.'
        : 'Portfolio-local relationship provenance is attached.',
    },
    personalizationProvenance: {
      status: blocked ? 'missing' : 'present',
      safeToMentionCount: blocked ? 0 : 1,
      summarizeOnlyCount: blocked ? 0 : 1,
      commonalityCount: blocked ? 0 : 1,
      detail: blocked
        ? 'Personalization context is missing; add safe-to-mention, summarize-only, or commonality evidence.'
        : 'Personalization context is available from local evidence.',
    },
    auditState: {
      status: 'scaffold_only',
      notes: [
        'Email is the first candidate channel for future activation review.',
        'No Gmail draft, Gmail send, provider smoke, schedule, or submitted evidence mutation is enabled.',
        'A later explicit provider/send approval gate is required before any external action.',
      ],
    },
    stages: [
      {
        key: 'draft_packet',
        label: 'Draft packet',
        status: blocked ? 'blocked' : 'ready_for_review',
        detail: blocked
          ? 'Resolve readiness blockers before draft packet review.'
          : 'Local relationship and personalization context can be reviewed as a draft packet.',
        externalExecutionEnabled: false,
      },
      {
        key: 'human_reply_or_draft_approval',
        label: 'Human draft approval',
        status: 'future_gate',
        detail: 'A human must approve the exact reply or draft packet before any send authority review.',
        externalExecutionEnabled: false,
      },
      {
        key: 'send_authority_review',
        label: 'Send authority review',
        status: 'future_gate',
        detail: 'Future explicit authority is required for this contact, channel, and message version.',
        externalExecutionEnabled: false,
      },
      {
        key: 'provider_capability_smoke',
        label: 'Provider capability smoke',
        status: 'blocked',
        detail: 'Gmail/provider capability smoke is intentionally blocked in this scaffold.',
        externalExecutionEnabled: false,
      },
      {
        key: 'scheduled_send_queue',
        label: 'Scheduled send queue',
        status: 'disabled',
        detail: 'Scheduling is modeled but disabled until provider/send activation.',
        externalExecutionEnabled: false,
      },
      {
        key: 'submitted_sent_evidence',
        label: 'Submitted/sent evidence',
        status: 'evidence_required',
        detail: 'Submitted or sent evidence must be recorded after a future approved provider action.',
        externalExecutionEnabled: false,
      },
    ],
  }
}

function readiness(mode, channel, state, authorityState, blocked = false, emailBatchGateOnly = false) {
  return {
    mode,
    channel,
    label:
      state === 'blocked'
        ? `${channel} blocked`
        : state === 'manual_review_only'
          ? `${channel} manual review only`
          : `${channel} provider gate required`,
    state,
    sendReady: false,
    externalSendEnabled: false,
    providerExecutionEnabled: false,
    humanApprovalRequired: true,
    idempotencyKey: `warm-outreach:send-readiness:v1:${mode}:${channel}`,
    blockers: blocked ? ['Relationship basis is too weak for send readiness.'] : [],
    gatesRemaining: [
      'target_source_provenance',
      'relationship_basis',
      'consent_suppression',
      'personalization',
      'human_reply_or_draft_approval',
      'external_send_authority',
      'provider_execution_gate',
      'send_scheduling',
      'outcome_tracking',
      'response_follow_up',
    ],
    auditNotes: ['Scaffold only. No external execution is enabled.'],
    sendAuthority: authority(mode, channel, authorityState, blocked),
    emailSendLifecycle: channel === 'email' ? emailLifecycle(mode, blocked, emailBatchGateOnly) : null,
  }
}

function readinessModes(blocked = false) {
  return {
    warm_1_to_1: [
      readiness('warm_1_to_1', 'email', blocked ? 'blocked' : 'provider_gate_required', blocked ? 'blocked' : 'eligible_for_future_activation', blocked),
      readiness('warm_1_to_1', 'linkedin', blocked ? 'blocked' : 'provider_gate_required', blocked ? 'blocked' : 'eligible_for_future_activation', blocked),
      readiness('warm_1_to_1', 'facebook', blocked ? 'blocked' : 'manual_review_only', blocked ? 'blocked' : 'manual_only', blocked),
      readiness('warm_1_to_1', 'phone_contact', blocked ? 'blocked' : 'manual_review_only', blocked ? 'blocked' : 'manual_only', blocked),
    ],
    warm_1_to_many: [
      readiness('warm_1_to_many', 'email', 'blocked', 'blocked', false, true),
      readiness('warm_1_to_many', 'linkedin', 'blocked', 'blocked', true),
      readiness('warm_1_to_many', 'facebook', 'blocked', 'blocked', true),
      readiness('warm_1_to_many', 'phone_contact', 'blocked', 'blocked', true),
    ],
  }
}

const sendReadiness = {
  version: 'warm-outreach-send-readiness/v1',
  contactId: 42,
  perRecipientIdempotencyKey: 'warm-outreach:recipient:v1:qa42',
  modes: readinessModes(),
  executionBoundary: {
    gmailEmailSend: false,
    linkedinAction: false,
    facebookAction: false,
    phoneAction: false,
    providerExecution: false,
    scheduling: false,
    externalMonitoring: false,
    gmailDraftCreation: false,
    outcomeTracking: false,
  },
}

const relationshipPacket = {
  packet: {
    version: 'warm-outreach-relationship/v1',
    contactId: 42,
    contactName: 'Amina Example',
    objective: 'Prepare governed warm send-authority review.',
    relationshipBasis: 'Prior meeting context and a local outreach history support a warm follow-up.',
    sourceRefs: [
      {
        sourceType: 'meeting_record',
        sourceId: 'meeting-qa-1',
        summary: 'Meeting summary is available as internal context.',
        privateSource: true,
        visibility: 'portfolio_internal',
        mentionSafety: 'summarize_only',
        sourceStatus: 'present',
      },
      {
        sourceType: 'prior_outreach',
        sourceId: 'queue-qa-1',
        summary: 'Prior local outreach row is available.',
        privateSource: false,
        visibility: 'portfolio_internal',
        mentionSafety: 'safe_to_mention',
        sourceStatus: 'present',
      },
    ],
    relationshipSignals: ['prior meeting context', 'local outreach history'],
    commonalities: ['operations follow-up'],
    riskFlags: [],
    sourceInventory: {
      sourceStatus: [
        { sourceType: 'meeting_records', status: 'present' },
        { sourceType: 'outreach_queue', status: 'present' },
      ],
      safeToMention: ['company context'],
      summarizeOnly: ['meeting notes'],
      doNotMention: [],
    },
    openingPitchGuidance: {
      safeCommonalities: ['operations follow-up'],
      openingAngle: 'Reconnect around the meeting follow-up.',
      channelNotes: { email: 'Use email for internal draft review.' },
    },
    suggestedNextStep: 'Prepare a reviewed send-authority packet.',
    avoidContext: ['Do not quote private notes.'],
    responseMonitoringPlan: {
      enabled: false,
      plan: 'Provider monitoring requires a later activation gate.',
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
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'Email remains draft/send-authority review only.',
      },
      linkedin: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'LinkedIn remains review only.',
      },
      facebook: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Facebook remains manual.',
      },
      phone_contact: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Phone remains manual.',
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
    warnings: [],
    approvalBoundary: 'draft_only_no_external_send',
  },
  contextSummary: {
    version: 'warm-outreach-relationship/v1',
    contact_id: '42',
    contact_name: 'Amina Example',
    objective: 'Prepare governed warm send-authority review.',
    relationship_basis: 'Prior meeting context and a local outreach history support a warm follow-up.',
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
    warnings: [],
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
  responseMonitoring: {
    version: 'warm-outreach-response-monitoring/v1',
    contactId: 42,
    status: 'awaiting_response',
    mode: 'pending',
    label: 'awaiting response',
    expectedReplyBy: '2026-09-02T12:00:00.000Z',
    latestOutboundAt: '2026-08-26T12:00:00.000Z',
    latestResponseAt: null,
    staleAfterDays: 7,
    perRecipientIdempotencyKey: 'warm-outreach:monitoring-recipient:v1:qa42',
    evidence: [
      {
        sourceType: 'outreach_queue',
        sourceId: 'queue-qa-1',
        status: 'draft',
        summary: 'Local outreach row is present.',
        evidenceType: 'expected_reply',
      },
    ],
    proposedFollowUp: {
      state: 'manual_import',
      label: 'Await manual or imported response evidence',
      description: 'No response is recorded yet. Manual import is available; provider polling remains disabled.',
      requiresHumanApproval: true,
      idempotencyKey: 'warm-outreach:monitoring-follow-up:v1:qa42',
    },
    blockedReasons: [],
    auditNotes: ['Monitoring is derived from local Portfolio rows only.'],
    sendReadiness,
    executionBoundary: {
      localRowsOnly: true,
      manualImportEnabled: true,
      providerResponseImportEnabled: false,
      providerPollingEnabled: false,
      externalMonitoringEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      linkedinActionEnabled: false,
      facebookActionEnabled: false,
      phoneActionEnabled: false,
      slackActionEnabled: false,
      n8nDispatchEnabled: false,
    },
  },
  sendReadiness,
}

const leads = [
  {
    id: 42,
    name: 'Amina Example',
    email: 'amina@example.test',
    company: 'Example Ops',
    company_domain: 'example.test',
    job_title: 'Operations Lead',
    industry: 'Services',
    phone_number: '+1 555 0100',
    lead_source: 'warm_referral',
    lead_score: 91,
    outreach_status: 'not_contacted',
    qualification_status: 'qualified',
    created_at: '2026-08-20T00:00:00.000Z',
    linkedin_url: 'https://linkedin.com/in/example',
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
    last_n8n_outreach_triggered_at: null,
    last_n8n_outreach_status: null,
    last_n8n_outreach_template_key: null,
    has_extractable_text: false,
    do_not_contact: false,
    removed_at: null,
    website_tech_stack: null,
    recent_email_drafts: [],
  },
  {
    id: 77,
    name: 'Kofi Blocked',
    email: 'kofi@example.test',
    company: 'Quiet Co',
    company_domain: null,
    job_title: null,
    industry: 'Services',
    phone_number: null,
    lead_source: 'warm_google_contacts',
    lead_score: 40,
    outreach_status: 'not_contacted',
    qualification_status: null,
    created_at: '2026-08-20T00:00:00.000Z',
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
    removed_at: null,
    website_tech_stack: null,
    recent_email_drafts: [],
  },
]

function batchRecipient(lead, blocked = false) {
  return {
    contactId: lead.id,
    contactName: lead.name,
    company: lead.company,
    relationshipBasis: blocked
      ? 'Limited local relationship evidence is available.'
      : 'Prior meeting context and local outreach history support a warm follow-up.',
    relationshipSignalCount: blocked ? 0 : 2,
    selectedChannel: blocked ? null : 'email',
    selectedTemplate: 'follow_up',
    promptTemplateKey: blocked ? null : 'email_follow_up',
    suppressionStatus: blocked ? 'blocked' : 'clear',
    suppressionReasons: blocked ? ['Contact is marked do not contact.'] : [],
    weakBasis: blocked,
    blockers: blocked ? ['Relationship basis is too weak for batch draft generation.'] : [],
    warnings: [],
    status: blocked ? 'blocked' : 'ready_for_review',
    draftIdempotencyKey: `warm-outreach:batch-draft:v1:${lead.id}`,
    existingQueueId: null,
    individualizedDraftPreview: blocked
      ? `Blocked for ${lead.name}: relationship review must resolve blockers first.`
      : `Hi ${lead.name.split(' ')[0]}, I was reviewing the ${lead.company} context in Portfolio. Draft direction: follow up via email.`,
    responseMonitoring: {
      ...relationshipPacket.responseMonitoring,
      contactId: lead.id,
      sendReadiness: {
        ...sendReadiness,
        contactId: lead.id,
        perRecipientIdempotencyKey: `warm-outreach:recipient:v1:${lead.id}`,
        modes: readinessModes(true),
      },
    },
    sendReadiness: {
      ...sendReadiness,
      contactId: lead.id,
      perRecipientIdempotencyKey: `warm-outreach:recipient:v1:${lead.id}`,
      modes: readinessModes(true),
    },
    packet: relationshipPacket.packet,
    readiness: relationshipPacket.readiness,
    contextSummary: relationshipPacket.contextSummary,
  }
}

const batchReview = {
  mode: 'warm_1_to_many',
  batchIdempotencyKey: 'warm-outreach:batch-review:v1:qa',
  cohort: {
    label: '2 selected outreach leads',
    recipientCount: 2,
    source: 'selected_outreach_leads',
    provenance: 'Selected 2 existing /admin/outreach leads from local Portfolio rows.',
  },
  summary: {
    readyCount: 1,
    existingDraftCount: 0,
    blockedCount: 1,
    weakBasisCount: 1,
    suppressionBlockedCount: 1,
  },
  samplePreview: batchRecipient(leads[0]),
  recipients: [batchRecipient(leads[0]), batchRecipient(leads[1], true)],
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

async function installRoutes(page) {
  await page.route('**/auth/v1/user**', (route) => route.fulfill({ json: user }))
  await page.route('**/api/user/profile**', (route) =>
    route.fulfill({
      json: {
        profile: {
          id: user.id,
          email: user.email,
          role: 'admin',
          created_at: '2026-08-26T00:00:00.000Z',
          updated_at: '2026-08-26T00:00:00.000Z',
        },
      },
    }),
  )
  await page.route('**/api/admin/contacts/42', (route) =>
    route.fulfill({
      json: {
        contact,
        gammaReports: [],
        videos: [],
        valueReports: [],
        audits: [],
        outreach: [
          {
            id: 'queue-qa-1',
            channel: 'email',
            subject: 'Warm follow-up',
            status: 'draft',
            created_at: '2026-08-26T12:00:00.000Z',
          },
        ],
        deliveries: [],
        communications: [],
        dashboardAccess: null,
        salesSessions: [],
        timeline: [],
        suggestedTemplate: 'email_follow_up',
      },
    }),
  )
  await page.route('**/api/admin/outreach/leads/42/relationship-packet**', (route) =>
    route.fulfill({ json: relationshipPacket }),
  )
  await page.route('**/api/admin/outreach/leads/42/responses**', (route) =>
    route.fulfill({ json: { responses: [] } }),
  )
  await page.route('**/api/admin/outreach/batch-review**', (route) =>
    route.fulfill({ json: batchReview }),
  )
  await page.route('**/api/admin/outreach/leads**', (route) => {
    if (route.request().url().includes('/relationship-packet')) {
      return route.fallback()
    }
    return route.fulfill({
      json: {
        leads,
        total: leads.length,
        page: 1,
      },
    })
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

async function seedSession(page) {
  await page.addInitScript(({ storageKey, storedSession }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession))
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession))
  }, { storageKey: supabaseAuthStorageKey, storedSession: session })
}

async function assertNoExternalRequests(page) {
  const blockedHosts = []
  page.on('request', (request) => {
    const url = request.url()
    if (/supabase\.co\/auth\/v1\/user/i.test(url)) {
      return
    }
    if (/gmail|linkedin|facebook|slack|n8n|supabase\.co/i.test(url)) {
      blockedHosts.push(url)
    }
  })
  return () => blockedHosts
}

const browser = await chromium.launch()
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: rawVideoDir, size: { width: 390, height: 844 } },
  ...(authStatePath && existsSync(authStatePath) ? { storageState: authStatePath } : {}),
})
const mobilePage = await mobile.newPage()
if (!authStatePath) {
  await seedSession(mobilePage)
}
await installRoutes(mobilePage)
const mobileBlockedRequests = await assertNoExternalRequests(mobilePage)

await mobilePage.goto(`${baseUrl}/admin/contacts/42`)
await mobilePage.getByText('Email first candidate').waitFor({ timeout: 15_000 })
await mobilePage.getByText('Provider capability smoke: blocked').scrollIntoViewIfNeeded()
await mobilePage.waitForTimeout(600)
await mobilePage.goto(`${baseUrl}/admin/outreach?id=42&filter=warm`)
await mobilePage.getByText('Selected outreach workroom').waitFor({ timeout: 15_000 })
await mobilePage.locator('input[type="checkbox"]').nth(1).check()
await mobilePage.locator('input[type="checkbox"]').nth(2).check()
await mobilePage.getByRole('button', { name: 'Warm batch review' }).click()
await mobilePage.getByText('Future eligible gates').waitFor({ timeout: 15_000 })
await mobilePage.getByLabel('Warm batch review').getByText('Email first candidate').scrollIntoViewIfNeeded()
await mobilePage.waitForTimeout(900)
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

const desktop = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  ...(authStatePath && existsSync(authStatePath) ? { storageState: authStatePath } : {}),
})
const desktopPage = await desktop.newPage()
if (!authStatePath) {
  await seedSession(desktopPage)
}
await installRoutes(desktopPage)
const desktopBlockedRequests = await assertNoExternalRequests(desktopPage)

await desktopPage.goto(`${baseUrl}/admin/contacts/42`)
await desktopPage.getByText('Email first candidate').waitFor({ timeout: 15_000 })
await desktopPage.screenshot({ path: desktopContactScreenshotPath, fullPage: true })
await desktopPage.goto(`${baseUrl}/admin/outreach?id=42&filter=warm`)
await desktopPage.getByText('Selected outreach workroom').waitFor({ timeout: 15_000 })
await desktopPage.locator('input[type="checkbox"]').nth(1).check()
await desktopPage.locator('input[type="checkbox"]').nth(2).check()
await desktopPage.getByRole('button', { name: 'Warm batch review' }).click()
await desktopPage.getByText('Future eligible gates').waitFor({ timeout: 15_000 })
await desktopPage.getByLabel('Warm batch review').getByText('Email first candidate').waitFor({ timeout: 15_000 })
await desktopPage.screenshot({ path: desktopBatchScreenshotPath, fullPage: true })
await desktop.close()
await browser.close()

const externalRequests = [...mobileBlockedRequests(), ...desktopBlockedRequests()]
if (externalRequests.length > 0) {
  throw new Error(`Unexpected external request(s): ${externalRequests.join(', ')}`)
}

console.log(JSON.stringify({
  baseUrl,
  mobileScreenshotPath,
  desktopContactScreenshotPath,
  desktopBatchScreenshotPath,
  rawVideoPath,
  videoPath: rawVideoPath ? mp4Path : null,
  externalRequests,
}, null, 2))
