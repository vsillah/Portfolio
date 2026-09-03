import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { config as loadEnv } from 'dotenv'

const execFileAsync = promisify(execFile)
const root = process.cwd()
loadEnv({ path: path.join(root, '.env.local'), quiet: true })

const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const qaDir = path.join(root, 'test-results', 'warm-planned-draft-actions-qa')
const sourceDir = path.join(qaDir, 'source')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const qaPath = '/admin/outreach?tab=leads&filter=warm&qa=warm-planning-backlog'
const qaUrl = new URL(qaPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-created-internal-actions-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-created-internal-actions-qa.json')

const screenshots = {
  mobile360: path.join(outputDir, 'warm-created-internal-actions-mobile-360.png'),
  mobile390: path.join(outputDir, 'warm-created-internal-actions-mobile-390.png'),
  mobile430: path.join(outputDir, 'warm-created-internal-actions-mobile-430.png'),
  desktop1440: path.join(outputDir, 'warm-created-internal-actions-desktop-1440.png'),
}

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })

const user = {
  id: 'warm-planned-draft-actions-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-planned-draft-actions-qa@example.test',
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
  return [
    ...new Set([
      'sb-127-auth-token',
      ...urls
        .map((value) => {
          try {
            return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
          } catch {
            return null
          }
        })
        .filter(Boolean),
    ]),
  ]
}

async function seedSession(page) {
  await page.addInitScript(({ keys, storedSession }) => {
    for (const key of keys) window.localStorage.setItem(key, JSON.stringify(storedSession))
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    })
  }, { keys: authStorageKeys(), storedSession: session })
}

const timestamp = '2026-09-02T12:00:00.000Z'
const leads = [
  {
    id: 101,
    name: 'Amina Batchready',
    email: 'amina.office@example.test',
    company: 'Planning Backlog Studio',
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
    quick_wins: 'Needs a lightweight planning backlog operations review.',
    message: 'Known through a warm referral.',
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
    recent_email_drafts: [
      {
        id: 'qa-outreach-queue-existing-101',
        subject: 'Warm follow-up: Amina Batchready',
        status: 'draft',
        created_at: timestamp,
        email_message_id: 'qa-email-message-101',
      },
    ],
    next_internal_action: {
      kind: 'gmail_draft_record',
      label: 'Review draft',
      status_label: 'Draft-only record',
      detail: 'Warm follow-up: Amina Batchready',
      record_table: 'outreach_queue',
      record_id: 'qa-outreach-queue-existing-101',
      created_at: timestamp,
      href: '/admin/outreach?tab=leads&filter=warm&id=101&contactId=101&draftReview=qa-outreach-queue-existing-101#warm-gmail-draft-review',
      email_message_id: null,
      enabled: true,
    },
  },
  {
    id: 102,
    name: 'Kofi Phoneparked',
    email: 'kofi.office@example.test',
    company: 'Phone Parked Co',
    company_domain: 'phone.example.test',
    job_title: 'Founder',
    industry: 'Consulting',
    phone_number: '555-0102',
    lead_source: 'warm_intro',
    lead_score: 86,
    outreach_status: 'not_contacted',
    qualification_status: 'qualified',
    created_at: timestamp,
    linkedin_url: null,
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: 'Wants help cleaning up repeatable follow-up.',
    message: 'Existing relationship from an introduction.',
    full_report: null,
    rep_pain_points: null,
    messages_count: 0,
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
    recent_email_drafts: [],
  },
  {
    id: 103,
    name: 'Nia Manualsocial',
    email: null,
    company: 'Manual Social Lab',
    company_domain: 'manual.example.test',
    job_title: 'Community Lead',
    industry: 'Community',
    phone_number: null,
    lead_source: 'warm_linkedin',
    lead_score: 82,
    outreach_status: 'not_contacted',
    qualification_status: 'qualified',
    created_at: timestamp,
    linkedin_url: 'https://linkedin.example/nia',
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: null,
    message: 'Known through a LinkedIn relationship thread.',
    full_report: null,
    rep_pain_points: null,
    messages_count: 0,
    messages_sent: 0,
    has_reply: false,
    has_sales_conversation: false,
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
    next_internal_action: {
      kind: 'manual_social_handoff_task',
      label: 'Record handoff evidence',
      status_label: 'Pending handoff',
      detail: 'Manual linkedin handoff: Nia Manualsocial',
      record_table: 'meeting_action_tasks',
      record_id: 'qa-meeting-action-task-existing-103',
      created_at: timestamp,
      href: '/admin/outreach?tab=leads&filter=warm&id=103&contactId=103#warm-manual-social-handoff',
      enabled: true,
    },
  },
  {
    id: 104,
    name: 'Mariam Review',
    email: 'mariam.office@example.test',
    company: 'Review Needed LLC',
    company_domain: 'review.example.test',
    job_title: 'Principal',
    industry: 'Services',
    phone_number: null,
    lead_source: 'warm_google_contacts',
    lead_score: 24,
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
    recent_email_drafts: [],
  },
  {
    id: 105,
    name: 'David Waiting',
    email: 'david.office@example.test',
    company: 'Waiting Response Inc',
    company_domain: 'waiting.example.test',
    job_title: 'Owner',
    industry: 'Services',
    phone_number: null,
    lead_source: 'warm_referral',
    lead_score: 79,
    outreach_status: 'sent',
    qualification_status: 'qualified',
    created_at: timestamp,
    linkedin_url: null,
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: 'Already has a sent warm note.',
    message: 'Follow-up context exists.',
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
      { id: 'queue-sent-105', subject: 'Warm follow-up', status: 'sent', created_at: timestamp },
    ],
  },
  {
    id: 106,
    name: 'Sade Suppressed',
    email: 'sade.office@example.test',
    company: 'Suppressed Contact Co',
    company_domain: 'suppressed.example.test',
    job_title: 'Advisor',
    industry: 'Services',
    phone_number: '555-0106',
    lead_source: 'warm_referral',
    lead_score: 88,
    outreach_status: 'opted_out',
    qualification_status: 'blocked',
    created_at: timestamp,
    linkedin_url: null,
    ai_readiness_score: null,
    competitive_pressure_score: null,
    quick_wins: 'Suppression fixture.',
    message: 'Suppression fixture.',
    full_report: null,
    rep_pain_points: null,
    messages_count: 0,
    messages_sent: 0,
    has_reply: false,
    has_sales_conversation: true,
    latest_session_id: null,
    session_count: 0,
    evidence_count: 1,
    last_vep_triggered_at: null,
    last_vep_status: null,
    last_n8n_outreach_triggered_at: null,
    last_n8n_outreach_status: null,
    last_n8n_outreach_template_key: null,
    has_extractable_text: true,
    do_not_contact: true,
    recent_email_drafts: [],
  },
]

function makeSendReadiness(contactId) {
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
              { key: 'provider_capability_smoke', status: 'future_gate' },
            ],
            gmailDraftHandoffPacket: {
              state: 'ready_for_internal_handoff',
              internalHandoffReady: true,
            },
            providerCapabilitySmoke: {
              status: 'waiting_read_only_smoke_authority',
              providerConfigured: false,
            },
            gmailDraftCreationGate: {
              status: 'draft_creation_authority_required',
            },
            duplicatePrevention: {
              duplicateDetected: false,
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

function batchReviewResponse(contactIds) {
  const selected = leads.filter((lead) => contactIds.includes(lead.id))
  const plannedKindFor = (lead) => {
    if (lead.do_not_contact || lead.outreach_status === 'opted_out') {
      return {
        kind: 'relationship_review_blocker',
        kindLabel: 'Blocked',
        recommendedChannel: 'review',
        recommendationLabel: 'Suppression review',
        state: 'blocked',
        reason: 'Do-not-contact or suppression status blocks this candidate.',
        detail: 'Resolve suppression status before any draft or handoff record can be created.',
        cta: {
          key: 'open_relationship_review',
          label: 'Review blocker',
          href: `/admin/outreach?tab=leads&filter=warm&id=${lead.id}&contactId=${lead.id}`,
          enabled: true,
        },
        recordKey: `warm-outreach:blocked:v1:qa-${lead.id}`,
        recordTable: null,
        recordState: 'blocked',
      }
    }
    if (lead.outreach_status === 'sent') {
      return {
        kind: 'response_follow_up',
        kindLabel: 'Response follow-up',
        recommendedChannel: 'review',
        recommendationLabel: 'Response follow-up',
        state: 'follow_up',
        reason: 'Existing outreach is waiting on response evidence.',
        detail: 'Review the existing response lifecycle before creating a new draft or handoff record.',
        cta: {
          key: 'open_response_state',
          label: 'Review response',
          href: `/admin/outreach?tab=leads&filter=warm&id=${lead.id}&contactId=${lead.id}#warm-response-lifecycle`,
          enabled: true,
        },
        recordKey: `warm-outreach:response-follow-up:v1:qa-${lead.id}`,
        recordTable: null,
        recordState: 'blocked',
      }
    }
    if (lead.lead_score < 40 || lead.evidence_count < 1) {
      return {
        kind: 'relationship_review_blocker',
        kindLabel: 'Relationship review',
        recommendedChannel: 'review',
        recommendationLabel: 'Relationship review',
        state: 'blocked',
        reason: 'Weak relationship basis needs review before draft execution.',
        detail: 'Open the relationship packet and add a stronger basis before creating records.',
        cta: {
          key: 'open_relationship_review',
          label: 'Review basis',
          href: `/admin/outreach?tab=leads&filter=warm&id=${lead.id}&contactId=${lead.id}`,
          enabled: true,
        },
        recordKey: `warm-outreach:relationship-review:v1:qa-${lead.id}`,
        recordTable: null,
        recordState: 'blocked',
      }
    }
    return lead.linkedin_url && !lead.email
      ? {
        kind: 'manual_social_handoff',
        kindLabel: 'Manual-social handoff',
        recommendedChannel: 'linkedin',
        recommendationLabel: 'Manual-social handoff',
        state: 'manual',
        reason: 'Manual LinkedIn review only.',
        detail: 'Open the existing relationship packet workroom and use the manual handoff controls.',
        cta: {
          key: 'open_manual_handoff',
          label: 'Open manual handoff',
          href: `/admin/outreach?tab=leads&filter=warm&id=${lead.id}&contactId=${lead.id}#warm-manual-social-handoff`,
          enabled: true,
        },
        recordKey: `warm-outreach:manual-handoff-task:v1:qa-linkedin-${lead.id}`,
        recordTable: 'meeting_action_tasks',
        recordState: 'ready_to_create',
      }
      : {
        kind: 'gmail_draft_plan',
        kindLabel: 'Gmail draft plan',
        recommendedChannel: 'gmail',
        recommendationLabel: 'Gmail draft plan',
        state: 'ready',
        reason: 'Open draft gate',
        detail: 'Prepare the review-only Gmail draft action packet. Gmail draft creation remains a separate explicit gate.',
        cta: {
          key: 'open_draft_gate',
          label: 'Open draft gate',
          href: '#gmail-batch-draft-plan',
          enabled: true,
        },
        recordKey: `warm-outreach:gmail-draft-record:v1:qa-${lead.id}`,
        recordTable: 'outreach_queue',
        recordState: 'ready_to_create',
      }
  }
  const recipients = selected.map((lead) => ({
    contactId: lead.id,
    contactName: lead.name,
    company: lead.company,
    relationshipBasis: 'Synthetic planning backlog warm relationship context is available for review.',
    relationshipSignalCount: lead.evidence_count,
    selectedChannel: 'email',
    selectedTemplate: 'follow_up',
    promptTemplateKey: 'email_follow_up',
    suppressionStatus: 'clear',
    suppressionReasons: [],
    weakBasis: false,
    blockers: [],
    warnings: ['Private context must be summarized, not quoted.'],
    status: 'ready_for_review',
    draftIdempotencyKey: `warm-outreach:batch-draft:v1:qa-${lead.id}`,
    existingQueueId: null,
    individualizedDraftPreview: `Hi ${lead.name.split(/\s+/)[0]}, following up from our warm context.`,
    responseMonitoring: {
      status: 'not_started',
      mode: 'not_started',
      proposedFollowUp: { label: 'Review warm follow-up' },
    },
    sendReadiness: makeSendReadiness(lead.id),
    packet: {},
    readiness: {},
    contextSummary: {},
  }))
  const rows = selected.map((lead) => ({
    contactId: lead.id,
    contactName: lead.name,
    company: lead.company,
    status: 'ready_for_local_planning',
    statusLabel: 'Plan ready',
    relationshipBasis: 'Synthetic planning backlog warm relationship context is available for review.',
    relationshipSignalCount: lead.evidence_count,
    readiness: [{ key: 'provider_not_connected', label: 'Provider not connected', state: 'needs_review' }],
    blockers: [],
    nextAction: 'local_draft_planning',
    nextActionLabel: 'Review draft plan',
    existingQueueId: null,
    draftCreation: {
      status: 'provider_not_connected',
      statusLabel: 'Provider not connected',
      actionEnabled: true,
      blocker: 'Connect and verify Gmail before creating provider drafts. Local records remain draft-only.',
      draftOnly: true,
      draftRecordKey: `warm-outreach:gmail-draft-record:v1:qa-${lead.id}`,
      localDraftRecordId: null,
      providerDraftId: null,
      createdAt: null,
      externalRequests: [],
    },
    draftIntent: {
      channel: 'gmail',
      templateFamily: 'follow_up',
      promptTemplateKey: 'email_follow_up',
      queueIntent: 'draft_only_planned',
      createsOutreachQueueRow: false,
      createsGmailDraft: false,
      callsProvider: false,
      externalSend: false,
    },
  }))
  const plannedRows = selected.map((lead) => ({
    contactId: lead.id,
    contactName: lead.name,
    company: lead.company,
    ...plannedKindFor(lead),
    blockers: lead.phone_number ? ['SMS parked until Telnyx readiness clears'] : [],
    localRecordId: null,
    draftActionPacket: {
      version: 'warm-planned-draft-action-packet/v1',
      reviewOnly: true,
      createsGmailDraft: false,
      createsOutreachQueueRow: false,
      callsProvider: false,
      externalSend: false,
      slackDispatch: false,
      smsDelivery: false,
      n8nDispatch: false,
      productionDataMutation: false,
      externalRequests: [],
    },
  }))

  return {
    mode: 'warm_1_to_many',
    batchIdempotencyKey: 'warm-outreach:batch-review:v1:qa-planning-backlog',
    cohort: {
      label: `${selected.length} planning backlog review batch candidates`,
      recipientCount: selected.length,
      source: 'selected_outreach_leads',
      provenance: `Selected ${selected.length} synthetic /admin/outreach warm leads.`,
    },
    summary: {
      readyCount: selected.length,
      existingDraftCount: 0,
      blockedCount: 0,
      weakBasisCount: 0,
      suppressionBlockedCount: 0,
    },
    samplePreview: recipients[0] ?? null,
    recipients: recipients.map((recipient) => ({
      ...recipient,
      plannedDraftAction: plannedRows.find((row) => row.contactId === recipient.contactId) ?? null,
    })),
    gmailDraftPlan: {
      version: 'warm-outreach-gmail-batch-draft-plan/v1',
      status: 'draft_creation_ready',
      currentCta: {
        key: 'review_approval_requests',
        label: 'Review batch plan',
        enabled: true,
        blocker: null,
      },
      summary: {
        selectedCount: selected.length,
        readyForLocalPlanningCount: selected.length,
        approvalRequiredCount: 0,
        blockedReviewCount: 0,
        excludedSubmittedCount: 0,
        providerNotConnectedCount: selected.length,
        smsUnavailableCount: 0,
        draftCreationEligibleCount: selected.length,
        draftAlreadyExistsCount: 0,
        draftCreatedCount: 0,
      },
      rows,
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
    plannedDraftActions: {
      version: 'warm-planned-draft-actions/v1',
      status: 'ready',
      currentCta: {
        key: 'open_draft_gate',
        label: 'Open draft gate',
        enabled: true,
        href: '#gmail-batch-draft-plan',
        reason: 'Open the existing Gmail draft gate for this planned batch.',
      },
      summary: {
        selectedCount: selected.length,
        gmailDraftPlanCount: plannedRows.filter((row) => row.kind === 'gmail_draft_plan').length,
        manualSocialHandoffCount: plannedRows.filter((row) => row.kind === 'manual_social_handoff').length,
        relationshipReviewBlockerCount: 0,
        responseFollowUpCount: 0,
        parkedSmsCount: selected.filter((lead) => Boolean(lead.phone_number)).length,
      },
      rows: plannedRows,
      executionBoundary: {
        localPortfolioPlanOnly: true,
        preRecordNoWrite: true,
        reviewOnlyDraftActionPackets: true,
        internalPortfolioRecordsCreated: false,
        createsOutreachQueueRows: false,
        createsMeetingActionTaskRows: false,
        createsGmailDrafts: false,
        gmailProviderCalls: false,
        socialProviderCalls: false,
        gmailSend: false,
        slackDispatch: false,
        smsDelivery: false,
        n8nDispatch: false,
        productionDataMutation: false,
        externalRequests: [],
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
}

function executedBatchReviewResponse(contactIds) {
  const review = batchReviewResponse(contactIds)
  const createdAt = new Date().toISOString()
  const createdRows = review.plannedDraftActions.rows.filter((row) => row.recordState === 'ready_to_create')
  const rows = review.plannedDraftActions.rows.map((row) => {
    const createdIndex = createdRows.findIndex((candidate) => candidate.recordKey === row.recordKey)
    return createdIndex >= 0
      ? {
          ...row,
          recordState: 'record_created',
          localRecordId: row.recordTable === 'meeting_action_tasks'
            ? `qa-meeting-action-task-${createdIndex + 1}`
            : `qa-outreach-queue-${createdIndex + 1}`,
        }
      : row
  })
  const gmailCreatedKeys = new Set(rows
    .filter((row) => row.kind === 'gmail_draft_plan')
    .map((row) => row.recordKey))

  return {
    ...review,
    gmailDraftPlan: {
      ...review.gmailDraftPlan,
      status: 'draft_records_created',
      currentCta: {
        key: 'draft_records_created',
        label: 'Gmail draft records created',
        enabled: false,
        blocker: null,
      },
      summary: {
        ...review.gmailDraftPlan.summary,
        draftCreationEligibleCount: Math.max(0, review.gmailDraftPlan.summary.draftCreationEligibleCount - gmailCreatedKeys.size),
        draftCreatedCount: gmailCreatedKeys.size,
      },
      rows: review.gmailDraftPlan.rows.map((row) => gmailCreatedKeys.has(row.draftCreation.draftRecordKey)
        ? {
            ...row,
            nextActionLabel: 'Draft record created',
            draftCreation: {
              ...row.draftCreation,
              status: 'draft_created',
              statusLabel: 'Draft created',
              actionEnabled: false,
              localDraftRecordId: row.draftCreation.draftRecordKey,
              createdAt,
              externalRequests: [],
            },
          }
        : row),
      executionReceipt: {
        action: 'create_gmail_draft_records',
        createdAt,
        createdCount: gmailCreatedKeys.size,
        externalRequests: [],
      },
      executionBoundary: {
        ...review.gmailDraftPlan.executionBoundary,
        localPortfolioPlanOnly: false,
        createsOutreachQueueRows: gmailCreatedKeys.size > 0,
      },
    },
    plannedDraftActions: {
      ...review.plannedDraftActions,
      currentCta: {
        key: 'records_created',
        label: 'Records created',
        enabled: false,
        href: null,
        reason: 'Internal draft and handoff records were created.',
      },
      rows,
      executionReceipt: {
        action: 'create_planned_draft_handoff_records',
        createdAt,
        createdCount: createdRows.length,
        existingCount: 0,
        gmailDraftRecordCount: rows.filter((row) => row.kind === 'gmail_draft_plan').length,
        manualSocialHandoffTaskCount: rows.filter((row) => row.kind === 'manual_social_handoff').length,
        externalRequests: [],
      },
      executionBoundary: {
        ...review.plannedDraftActions.executionBoundary,
        localPortfolioPlanOnly: false,
        preRecordNoWrite: false,
        reviewOnlyDraftActionPackets: false,
        internalPortfolioRecordsCreated: createdRows.length > 0,
        createsOutreachQueueRows: rows.some((row) => row.kind === 'gmail_draft_plan' && row.recordState === 'record_created'),
        createsMeetingActionTaskRows: rows.some((row) => row.kind === 'manual_social_handoff' && row.recordState === 'record_created'),
      },
    },
  }
}

function manualSocialPacket(contactId) {
  const lead = leads.find((candidate) => candidate.id === contactId) ?? leads[2]
  return {
    packet: {
      version: 'warm-outreach-relationship/v1',
      contactId,
      contactName: lead.name,
      objective: 'Prepare warm outreach context.',
      relationshipBasis: 'Synthetic LinkedIn relationship context is ready for operator review.',
      sourceRefs: [],
      relationshipSignals: ['Existing relationship context is available'],
      commonalities: ['Community operations'],
      riskFlags: [],
      sourceInventory: {
        sourceStatus: [{ sourceType: 'contact_submissions', status: 'present' }],
        safeToMention: ['Community operations context'],
        summarizeOnly: ['Synthetic QA notes'],
        doNotMention: ['Raw private messages'],
      },
      openingPitchGuidance: {
        safeCommonalities: ['Community operations'],
        openingAngle: 'Reconnect around practical operating support.',
        channelNotes: { linkedin: 'Manual LinkedIn copy only.' },
      },
      suggestedNextStep: 'Prepare a manual LinkedIn note for review.',
      avoidContext: ['Do not quote private notes.'],
      responseMonitoringPlan: {
        enabled: false,
        plan: 'Reply monitoring requires provider approval.',
        externalActivationRequired: true,
      },
      confidence: 'medium',
      suppression: {
        doNotContact: false,
        unsubscribed: false,
        removedAt: null,
      },
      channelCapabilities: {
        email: {
          available: Boolean(lead.email),
          providerConfigured: false,
          supportsExternalSend: false,
          manualOnly: false,
          reason: 'Gmail provider actions are off.',
        },
        linkedin: {
          available: true,
          providerConfigured: false,
          supportsExternalSend: false,
          manualOnly: true,
          reason: 'Manual LinkedIn review only.',
        },
        facebook: {
          available: false,
          providerConfigured: false,
          supportsExternalSend: false,
          manualOnly: false,
        },
        phone_contact: {
          available: false,
          providerConfigured: false,
          supportsExternalSend: false,
          manualOnly: false,
        },
      },
      preferredChannel: 'linkedin',
    },
    readiness: {
      status: 'needs_review',
      humanReviewRequired: true,
      selectedChannel: 'linkedin',
      recommendedTemplate: 'follow_up',
      blockers: [],
      warnings: ['Private source context must be summarized, not quoted.'],
      approvalBoundary: 'manual_only_no_external_send',
    },
    contextSummary: { readiness_status: 'needs_review' },
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
    manualSocialHandoff: {
      version: 'warm-outreach-manual-social-handoff/v1',
      contactId: String(contactId),
      contactName: lead.name,
      state: 'ready',
      label: 'Manual social handoff ready',
      currentCta: {
        key: 'copy_manual_text',
        label: 'Copy LinkedIn text',
        enabled: true,
        channel: 'linkedin',
      },
      channels: [
        {
          channel: 'linkedin',
          label: 'LinkedIn',
          state: 'ready_for_manual_copy',
          blocker: null,
          preview: 'Hi Nia, following up from our warm community operations context. I would value a short manual conversation if useful.',
          maxRecommendedCharacters: 300,
          checklist: [
            { key: 'relationship_basis', label: 'Warm basis reviewed', status: 'ready' },
            { key: 'suppression', label: 'Suppression checked', status: 'ready' },
            { key: 'copy_manually', label: 'Copy into the channel manually', status: 'manual_required' },
            { key: 'record_minimal_evidence', label: 'Record timestamp, channel, and note only', status: 'manual_required' },
            { key: 'no_provider_automation', label: 'Provider automation stays off', status: 'manual_required' },
          ],
          idempotency: {
            messageVersionKey: `warm-outreach:manual-message-version:v1:qa-linkedin-${contactId}`,
            manualHandoffKey: `warm-outreach:manual-handoff:v1:qa-linkedin-${contactId}`,
            manualEvidenceKey: `warm-outreach:manual-evidence:v1:qa-linkedin-${contactId}`,
            duplicateScope: 'contact_channel_message_version',
          },
          durableEvidence: null,
          evidenceLock: { locked: false, reason: null },
          executionBoundary: {
            manualOnly: true,
            providerCallsEnabled: false,
            externalSendEnabled: false,
            linkedinApiEnabled: false,
            facebookApiEnabled: false,
            phoneAccessEnabled: false,
            smsDeliveryEnabled: false,
            gmailDraftCreationEnabled: false,
            slackDispatchEnabled: false,
            n8nDispatchEnabled: false,
            productionDataMutation: false,
            externalRequests: [],
          },
          evidencePolicy: {
            requiredFields: ['timestamp', 'channel', 'operator_note'],
            storesRawMessageBody: false,
            storesRawContactDetails: false,
            requiresScreenshot: false,
            detail: 'Record only timestamp, channel, note, and evidence key after a manual action.',
          },
        },
      ],
      auditState: {
        recordsManualEvidenceOnly: true,
        durableDocsExcludeRawSecretsAndContactDetails: true,
        providerAutomationBlocked: true,
        detail: 'Manual handoff is copy-only and records only minimal evidence after operator action.',
      },
      executionBoundary: {
        manualCopyOnly: true,
        providerCallsEnabled: false,
        externalSendEnabled: false,
        gmailDraftCreationEnabled: false,
        slackDispatchEnabled: false,
        smsDeliveryEnabled: false,
        n8nDispatchEnabled: false,
        productionDataMutation: false,
        externalRequests: [],
      },
    },
  }
}

async function installSafeRoutes(page, externalRequests, localRequests) {
  const localOrigin = new URL(baseUrl).origin
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const localProviderPath =
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send|gmail-draft-canary)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/gmail-response-import\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/leads\/[^/]+\/(?:manual-social-handoff|sms-candidate|sms-telnyx-no-send-canary|sms-telnyx-live-send)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/[^/]+\/(?:sms|text|provider-send|manual-send)\b/i.test(url.pathname)
    const providerHost =
      /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|linkedin\.com|facebook\.com|n8n/i.test(url.hostname)

    if (providerHost || localProviderPath) {
      externalRequests.push({ method: request.method(), url: request.url() })
      await route.abort('blockedbyclient')
      return
    }

    if (url.hostname === 'va.vercel-scripts.com') {
      await route.abort('blockedbyclient')
      return
    }

    if (/\/api\/user\/profile\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: { ...user, role: 'admin', updated_at: user.created_at } }),
      })
      return
    }

    if (/\/auth\/v1\/user\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
      return
    }

    if (/\/api\/admin\/outreach\/leads\/(\d+)\/relationship-packet\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      const contactId = Number(url.pathname.match(/\/leads\/(\d+)\/relationship-packet/i)?.[1])
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manualSocialPacket(contactId)),
      })
      return
    }

    if (/\/api\/admin\/outreach\/batch-review\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      const body = request.postDataJSON()
      const responseBody = body.action === 'create_planned_draft_handoff_records'
        ? executedBatchReviewResponse(body.contact_ids ?? [])
        : batchReviewResponse(body.contact_ids ?? [])
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseBody),
      })
      return
    }

    if (/\/api\/admin\/outreach\/drafts\/[^/]+\/inputs\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      const queueId = decodeURIComponent(url.pathname.match(/\/drafts\/([^/]+)\/inputs/i)?.[1] ?? '')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: queueId,
          contactSubmissionId: 101,
          channel: 'email',
          status: 'draft',
          sequenceStep: 1,
          subject: 'Warm follow-up: Amina Batchready',
          body:
            'Hi Amina,\n\nFollowing up from the warm referral and planning backlog context. I can share a lightweight way to turn repeat follow-up into a reviewable operating path.',
          createdAt: timestamp,
          generationModel: 'portfolio-local-planner',
          generationPromptSummary: 'planned_warm_gmail_draft_intent:no_provider',
          generationInputs: {
            version: 'warm-planned-draft-execution/v1',
            queue_intent: 'draft_only_planned',
            approval_boundary: 'draft_only_no_external_send',
            external_requests: [],
          },
        }),
      })
      return
    }

    if (/\/api\/admin\/outreach\/leads\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ leads, total: leads.length, page: 1 }),
      })
      return
    }

    if (/\/api\/admin\/value-evidence\/workflow-status\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ runs: [] }) })
      return
    }

    if (/\/api\/admin\/chat-escalations\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ escalations: [], total: 0 }) })
      return
    }

    if (/\/api\/admin\/sales\/contact-meetings\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meetings: [] }) })
      return
    }

    if (/\/api\/meeting-action-tasks\b/i.test(url.pathname)) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [] }) })
      return
    }

    if (url.origin === localOrigin && url.pathname.startsWith('/api/')) {
      localRequests.push({ method: request.method(), pathname: url.pathname })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
      return
    }

    if (url.origin === localOrigin) {
      await route.continue()
      return
    }

    externalRequests.push({ method: request.method(), url: request.url() })
    await route.abort('blockedbyclient')
  })
}

async function openQaPage(browser, viewport, recordVideo = false) {
  const externalRequests = []
  const localRequests = []
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ...(recordVideo ? { recordVideo: { dir: sourceDir, size: viewport } } : {}),
  })
  const page = await context.newPage()
  await seedSession(page)
  await installSafeRoutes(page, externalRequests, localRequests)
  const response = await page.goto(qaUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${qaUrl}`)
  }
  const overlay = await page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay').count()
  if (overlay > 0) throw new Error('Framework error overlay is visible on the QA route.')
  await page.getByLabel('Warm outreach planning backlog').waitFor({ timeout: 15_000 })
  return { context, page, externalRequests, localRequests }
}

async function assertPlanningBacklog(page) {
  const checks = await page.evaluate(() => {
    const text = document.body.innerText
    const planningBacklog = document.querySelector('[aria-label="Warm outreach planning backlog"]')
    const filterGroup = document.querySelector('[aria-label="Warm planning state filters"]')
    const filterButtons = filterGroup ? [...filterGroup.querySelectorAll('button')] : []
    const currentCta = [...document.querySelectorAll('button')]
      .find((button) => /Plan review batch/.test(button.textContent || ''))
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    const overlappingFilterControls = []
    for (let i = 0; i < filterButtons.length; i += 1) {
      const first = filterButtons[i].getBoundingClientRect()
      for (let j = i + 1; j < filterButtons.length; j += 1) {
        const second = filterButtons[j].getBoundingClientRect()
        const overlaps = !(
          first.right <= second.left ||
          second.right <= first.left ||
          first.bottom <= second.top ||
          second.bottom <= first.top
        )
        if (overlaps) overlappingFilterControls.push(`${i}:${j}`)
      }
    }
    const filterTextOverflow = filterButtons
      .filter((button) => button instanceof HTMLElement)
      .some((button) => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1)
    const filterLabelCountOverlap = filterButtons.some((button) => {
      const label = button.querySelector('[data-planning-filter-label]')
      const count = button.querySelector('[data-planning-filter-count]')
      if (!(label instanceof HTMLElement) || !(count instanceof HTMLElement)) return false
      const labelRect = label.getBoundingClientRect()
      const countRect = count.getBoundingClientRect()
      return !(
        labelRect.right <= countRect.left ||
        countRect.right <= labelRect.left ||
        labelRect.bottom <= countRect.top ||
        countRect.bottom <= labelRect.top
      )
    })
    return {
      hasPlanningBacklog: visible(planningBacklog),
      hasCompactFilterControls:
        visible(filterGroup) &&
        filterButtons.length === 7 &&
        /All/i.test(filterGroup?.textContent || '') &&
        /Ready Gmail/i.test(filterGroup?.textContent || '') &&
        /Manual/i.test(filterGroup?.textContent || '') &&
        /Relationship/i.test(filterGroup?.textContent || '') &&
        /Responses/i.test(filterGroup?.textContent || '') &&
        /Blocked/i.test(filterGroup?.textContent || '') &&
        /SMS parked/i.test(filterGroup?.textContent || ''),
      overlappingFilterControls,
      filterTextOverflow,
      filterLabelCountOverlap,
      hasSafeCta: visible(currentCta) && /Plan review batch/.test(currentCta?.textContent || ''),
      hasBoundary:
        /Gmail drafts: off/i.test(text) &&
        /Sends\/Slack\/social\/SMS: off/i.test(text) &&
        /external requests 0/i.test(text),
      viewport: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
    }
  })
  return {
    ...checks,
    horizontalOverflow: checks.viewport.scrollWidth > checks.viewport.clientWidth,
  }
}

async function assertCreatedInternalActions(page) {
  const checks = await page.evaluate(() => {
    const text = document.body.innerText
    const actions = [...document.querySelectorAll('[aria-label^="Internal action for "]')]
    const workroomAction = document.querySelector('[aria-label="Created internal action for Nia Manualsocial"]')
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    return {
      actionCount: actions.length,
      hasGmailAction:
        /Draft-only record/i.test(text) &&
        /Warm follow-up: Amina Batchready/i.test(text) &&
        /Review draft/i.test(text),
      hasManualAction:
        /Pending handoff/i.test(text) &&
        /Manual linkedin handoff: Nia Manualsocial/i.test(text) &&
        /Record evidence/i.test(text),
      hasWorkroomAction: visible(workroomAction),
      viewport: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
    }
  })
  return {
    ...checks,
    horizontalOverflow: checks.viewport.scrollWidth > checks.viewport.clientWidth,
  }
}

async function assertGmailDraftReview(page) {
  const checks = await page.evaluate(() => {
    const panel = document.querySelector('[aria-label="Gmail draft review for Amina Batchready"]')
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    const text = panel?.textContent ?? ''
    const buttons = panel ? [...panel.querySelectorAll('button')] : []
    const primaryCtas = buttons.filter((button) => /Copy draft|Request send approval|View gate keys|Review decision/.test(button.textContent || ''))
    return {
      visible: visible(panel),
      hasDraftOnlyState: /Draft-only/i.test(text),
      hasSavedBody: /Following up from the warm referral and planning backlog context/i.test(text),
      hasRecipientContext: /amina\.office@example\.test/i.test(text) && /qa-outreach-queue-existing-101/i.test(text),
      hasRelationshipBasis: /Synthetic LinkedIn relationship context is ready for operator review/i.test(text),
      hasMissingMessageRecovery: /Message link missing/i.test(text) && /Review uses the saved queue body/i.test(text),
      hasBoundary: /external send off/i.test(text) && /Draft creation, approval, Slack dispatch, and live send stay separate/i.test(text),
      primaryCtaCount: primaryCtas.length,
      viewport: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
    }
  })
  return {
    ...checks,
    horizontalOverflow: checks.viewport.scrollWidth > checks.viewport.clientWidth,
  }
}

async function assertWarmActionClusterPolish(page) {
  const checks = await page.evaluate(() => {
    const chip = document.querySelector('[aria-label="Readiness: Needs human review"]')
    const cta = [...document.querySelectorAll('a, button')]
      .find((element) => (element.textContent || '').replace(/\s+/g, ' ').trim() === 'Go to action')
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const chipRect = chip instanceof HTMLElement ? chip.getBoundingClientRect() : null
    const ctaRect = cta instanceof HTMLElement ? cta.getBoundingClientRect() : null
    return {
      chipVisible: visible(chip),
      chipText: chip?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      chipTitle: chip?.getAttribute('title') ?? null,
      chipWidth: chipRect ? Math.round(chipRect.width * 10) / 10 : null,
      chipHeight: chipRect ? Math.round(chipRect.height * 10) / 10 : null,
      chipCentered:
        chip instanceof HTMLElement &&
        window.getComputedStyle(chip).justifyContent === 'center' &&
        window.getComputedStyle(chip).textAlign === 'center',
      ctaVisible: visible(cta),
      ctaWidth: ctaRect ? Math.round(ctaRect.width * 10) / 10 : null,
      ctaHeight: ctaRect ? Math.round(ctaRect.height * 10) / 10 : null,
      viewport: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
    }
  })
  return {
    ...checks,
    humanReviewChipSingleLine: typeof checks.chipHeight === 'number' && checks.chipHeight <= 34,
    horizontalOverflow: checks.viewport.scrollWidth > checks.viewport.clientWidth,
  }
}

async function assertNoCollapsedActionText(page) {
  return page.evaluate(() => {
    const interestingText =
      /(Draft-only record|Pending handoff|Warm follow-up|Manual linkedin handoff|Review draft|Record evidence|Open Outreach|Workroom open|messages? \(|sent\)|Evidence:|No evidence|Extracting|Push failed|Stalled|Score:|Referral|LinkedIn|Google Contacts|Phone Parked)/i
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      )
    }
    const candidates = [...document.querySelectorAll('span, p, a, button, [aria-label^="Internal action for "], [aria-label^="Created internal action for "]')]
      .filter((element) => visible(element))
      .map((element) => {
        const text = (element.textContent || '').replace(/\s+/g, ' ').trim()
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          label: element.getAttribute('aria-label') || '',
          text,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        }
      })
      .filter((item) => item.text.length >= 7 && interestingText.test(`${item.label} ${item.text}`))

    const collapsed = candidates.filter((item) => {
      const tallStrip = item.width < 64 && item.height > 38 && item.height / Math.max(item.width, 1) > 0.9
      const unreadableControl = /(Review draft|Record evidence|Open Outreach|Workroom open)/i.test(`${item.label} ${item.text}`) && item.width < 96
      return tallStrip || unreadableControl
    })

    return {
      collapsed,
      checkedCount: candidates.length,
      viewport: {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
    }
  })
}

async function assertPlannedDraftActions(page) {
  const checks = await page.evaluate(() => {
    const text = document.body.innerText
    const tray = document.querySelector('[aria-label="Warm planned draft actions"]')
    const gmailPlan = document.querySelector('[aria-label="Gmail batch draft plan"]')
    const primaryCta = [...document.querySelectorAll('button, a')]
      .find((control) => /^(Create records|Records created|Open draft gate)/.test(control.textContent?.trim() || ''))
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    const trayRect = tray instanceof HTMLElement ? tray.getBoundingClientRect() : null
    const gmailRect = gmailPlan instanceof HTMLElement ? gmailPlan.getBoundingClientRect() : null

    return {
      hasActionTray: visible(tray),
      hasCompactRecommendations:
        /Planned draft actions/i.test(text) &&
        /Gmail draft plan/i.test(text) &&
        /(Create records|Records created|Open draft gate)/i.test(text) &&
        /SMS parked/i.test(text),
      hasMixedChannels:
        /Gmail draft plan/i.test(text) &&
        /manual handoff/i.test(text),
      hasExecutionReceipt:
        /Created \d+ internal records?; reused 0/i.test(text) &&
        /Gmail provider drafts, sends, Slack, social posting, SMS, and n8n stayed off/i.test(text),
      hasInternalRecordBoundary:
        /internal records only/i.test(text) &&
        /outreach_queue records: created/i.test(text) &&
        /handoff task records: created/i.test(text) &&
        /outreach_queue writes: created/i.test(text) &&
        !/review-only packets/i.test(text),
      primaryCtaAboveGmailPlan:
        Boolean(trayRect && gmailRect && trayRect.top <= gmailRect.top),
      hasNoEgressBoundary:
        /Gmail drafts: off/i.test(text) &&
        /Gmail provider: off/i.test(text) &&
        /Social providers: off/i.test(text) &&
        /SMS: off/i.test(text) &&
        /n8n: off/i.test(text) &&
        /external requests 0/i.test(text),
      primaryControlText: primaryCta?.textContent?.trim() ?? null,
      viewport: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
    }
  })
  return {
    ...checks,
    horizontalOverflow: checks.viewport.scrollWidth > checks.viewport.clientWidth,
  }
}

async function viewportEvidence(browser, name, viewport, screenshotPath) {
  const qa = await openQaPage(browser, viewport)
  const planningBacklog = qa.page.getByLabel('Warm outreach planning backlog')
  await planningBacklog.scrollIntoViewIfNeeded()
  const checks = await assertPlanningBacklog(qa.page)
  const internalActionChecks = await assertCreatedInternalActions(qa.page)
  const collapsedTextChecks = await assertNoCollapsedActionText(qa.page)
  await activateButton(qa.page.getByRole('link', { name: /Review draft-only internal Gmail record for Amina Batchready/ }).first())
  await qa.page.getByLabel('Gmail draft review for Amina Batchready').waitFor({ timeout: 15_000 })
  await qa.page.getByText(/Following up from the warm referral and planning backlog context/).waitFor({ timeout: 15_000 })
  await qa.page.getByText('Message link missing').waitFor({ timeout: 15_000 })
  const warmActionClusterPolish = await assertWarmActionClusterPolish(qa.page)
  const gmailDraftReviewChecks = await assertGmailDraftReview(qa.page)
  await qa.page.getByLabel('Select all on this page').check()
  await activateButton(qa.page.getByRole('button', { name: 'Plan draft work' }))
  await qa.page.getByLabel('Warm planned draft actions').waitFor({ timeout: 15_000 })
  await activateButton(qa.page.getByRole('button', { name: 'Create records (3)' }))
  await qa.page.getByText(/Created 3 internal records; reused 0/).waitFor({ timeout: 15_000 })
  const actionChecks = await assertPlannedDraftActions(qa.page)
  await qa.page.screenshot({ path: screenshotPath, fullPage: true })
  await qa.context.close()
  return {
    name,
    viewport,
    screenshotPath,
    checks,
    internalActionChecks,
    collapsedTextChecks,
    warmActionClusterPolish,
    gmailDraftReviewChecks,
    actionChecks,
    externalRequests: qa.externalRequests,
  }
}

async function addSideText(page) {
  await page.addStyleTag({
    content: `
      body { padding-right: 360px !important; }
      #qa-side-text {
        position: fixed;
        inset: 0 0 0 auto;
        z-index: 2147483647;
        width: 336px;
        box-sizing: border-box;
        padding: 22px 20px;
        background: #07111f;
        color: #e5eef9;
        border-left: 1px solid rgba(148, 163, 184, .35);
        font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #qa-side-text h2 { margin: 0 0 12px; font-size: 18px; line-height: 1.2; }
      #qa-side-text h3 { margin: 16px 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #f7d56b; }
      #qa-side-text p { margin: 0; color: #cbd5e1; }
      #qa-side-text ul { margin: 6px 0 0; padding-left: 18px; color: #cbd5e1; }
      #qa-side-text li { margin: 5px 0; }
    `,
  })
  await page.evaluate(() => {
    const panel = document.createElement('aside')
    panel.id = 'qa-side-text'
    panel.innerHTML = `
      <h2>warm-planned-draft-actions QA</h2>
      <h3>Scenario</h3>
      <p>Vambah opens the warm outreach list and sees created internal draft and handoff records as actionable items in the existing workroom.</p>
      <h3>Expected</h3>
      <ul>
        <li>Created Gmail draft records show a compact Review draft CTA.</li>
        <li>Review draft opens the existing workroom with body, recipient, relationship basis, and one primary Copy draft CTA.</li>
        <li>If the email-message link is missing, the saved queue body is reviewed in context.</li>
        <li>Created manual-social handoff tasks show a compact Record evidence CTA.</li>
        <li>Seven planning states are visible as compact count filters.</li>
        <li>The primary CTA opens a review batch above long context.</li>
        <li>The selected batch creates only internal Portfolio records.</li>
        <li>The planned action tray shows created Gmail draft records and manual-social handoff tasks.</li>
        <li>The manual social workroom still renders for the selected contact.</li>
      </ul>
      <h3>Decision Gate</h3>
      <p>This stops at internal draft and handoff records. Gmail provider drafts, sending messages, recording manual evidence, or enabling SMS remains separately approved.</p>
      <h3>External Boundary</h3>
      <p>No Gmail, Slack, LinkedIn, Facebook, Telnyx/SMS, n8n, scheduling, publishing, or production-data mutation.</p>
    `
    document.body.appendChild(panel)
  })
}

async function activateButton(locator) {
  await locator.scrollIntoViewIfNeeded()
  await locator.focus()
  await locator.press('Enter')
}

const browser = await chromium.launch()
const viewportRuns = []
for (const [name, viewport, screenshotPath] of [
  ['mobile360', { width: 360, height: 844 }, screenshots.mobile360],
  ['mobile390', { width: 390, height: 844 }, screenshots.mobile390],
  ['mobile430', { width: 430, height: 844 }, screenshots.mobile430],
  ['desktop1440', { width: 1440, height: 900 }, screenshots.desktop1440],
]) {
  viewportRuns.push(await viewportEvidence(browser, name, viewport, screenshotPath))
}

const desktop = await openQaPage(browser, { width: 1280, height: 720 }, true)
await addSideText(desktop.page)
const desktopPlanningBacklog = desktop.page.getByLabel('Warm outreach planning backlog')
await desktopPlanningBacklog.evaluate((element) => element.scrollIntoView({ block: 'center' }))
await desktop.page.waitForTimeout(700)
await activateButton(desktop.page.getByRole('button', { name: /Show SMS parked candidates/ }))
await desktopPlanningBacklog.getByText('Kofi Phoneparked').waitFor({ timeout: 10_000 })
await desktop.page.waitForTimeout(700)
await desktopPlanningBacklog.evaluate((element) => element.scrollIntoView({ block: 'center' }))
await activateButton(desktopPlanningBacklog.getByRole('button', { name: /Show Ready for Gmail draft candidates/ }))
await activateButton(desktop.page.getByRole('link', { name: /Review draft-only internal Gmail record for Amina Batchready/ }).first())
await desktop.page.getByLabel('Gmail draft review for Amina Batchready').waitFor({ timeout: 15_000 })
await desktop.page.getByText(/Following up from the warm referral and planning backlog context/).waitFor({ timeout: 15_000 })
await desktop.page.getByText('Message link missing').waitFor({ timeout: 15_000 })
const desktopGmailDraftReviewChecks = await assertGmailDraftReview(desktop.page)
if (
  !desktopGmailDraftReviewChecks.visible ||
  !desktopGmailDraftReviewChecks.hasDraftOnlyState ||
  !desktopGmailDraftReviewChecks.hasSavedBody ||
  !desktopGmailDraftReviewChecks.hasRecipientContext ||
  !desktopGmailDraftReviewChecks.hasRelationshipBasis ||
  !desktopGmailDraftReviewChecks.hasMissingMessageRecovery ||
  !desktopGmailDraftReviewChecks.hasBoundary ||
  desktopGmailDraftReviewChecks.primaryCtaCount !== 1 ||
  desktopGmailDraftReviewChecks.horizontalOverflow
) {
  throw new Error(`Desktop Gmail draft review QA failed: ${JSON.stringify(desktopGmailDraftReviewChecks, null, 2)}`)
}
await desktop.page.waitForTimeout(1000)
await desktop.page.getByLabel('Select all on this page').check()
await activateButton(desktop.page.getByRole('button', { name: 'Plan draft work' }))
await desktop.page.getByLabel('Warm batch review').waitFor({ timeout: 15_000 })
await desktop.page.getByLabel('Warm planned draft actions').waitFor({ timeout: 15_000 })
await activateButton(desktop.page.getByRole('button', { name: 'Create records (3)' }))
await desktop.page.getByText(/Created 3 internal records; reused 0/).waitFor({ timeout: 15_000 })
const desktopActionChecks = await assertPlannedDraftActions(desktop.page)
if (
  !desktopActionChecks.hasActionTray ||
  !desktopActionChecks.hasCompactRecommendations ||
  !desktopActionChecks.hasMixedChannels ||
  !desktopActionChecks.hasExecutionReceipt ||
  !desktopActionChecks.hasInternalRecordBoundary ||
  !desktopActionChecks.primaryCtaAboveGmailPlan ||
  !desktopActionChecks.hasNoEgressBoundary ||
  desktopActionChecks.horizontalOverflow
) {
  throw new Error(`Desktop planned draft action QA failed: ${JSON.stringify(desktopActionChecks, null, 2)}`)
}
await desktop.page.getByText('Gmail batch draft plan').waitFor({ timeout: 10_000 })
await desktop.page.waitForTimeout(800)
await desktopPlanningBacklog.evaluate((element) => element.scrollIntoView({ block: 'center' }))
await activateButton(desktop.page.getByRole('button', { name: /Show Ready for manual social candidates/ }))
await activateButton(desktop.page.getByRole('button', { name: /Record manual handoff evidence for Nia Manualsocial/ }))
const desktopWorkroom = desktop.page.getByRole('region', { name: 'Outreach workroom for Nia Manualsocial' })
await desktopWorkroom.waitFor({ timeout: 15_000 })
await desktopWorkroom.getByTestId('warm-manual-social-handoff').first().waitFor({ timeout: 15_000 })
const desktopInternalActionChecks = await assertCreatedInternalActions(desktop.page)
const desktopCollapsedTextChecks = await assertNoCollapsedActionText(desktop.page)
const desktopWarmActionClusterPolish = await assertWarmActionClusterPolish(desktop.page)
if (
  !desktopInternalActionChecks.hasGmailAction ||
  !desktopInternalActionChecks.hasManualAction ||
  !desktopInternalActionChecks.hasWorkroomAction ||
  desktopInternalActionChecks.horizontalOverflow ||
  desktopCollapsedTextChecks.collapsed.length > 0 ||
  !desktopWarmActionClusterPolish.chipVisible ||
  !desktopWarmActionClusterPolish.chipCentered ||
  !desktopWarmActionClusterPolish.humanReviewChipSingleLine ||
  !desktopWarmActionClusterPolish.ctaVisible ||
  desktopWarmActionClusterPolish.horizontalOverflow
) {
  throw new Error(`Desktop internal action QA failed: ${JSON.stringify({ desktopInternalActionChecks, desktopCollapsedTextChecks, desktopWarmActionClusterPolish }, null, 2)}`)
}
await desktop.page.waitForTimeout(1200)
const video = desktop.page.video()
await desktop.context.close()
await browser.close()

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

const externalRequests = [
  ...viewportRuns.flatMap((run) => run.externalRequests),
  ...desktop.externalRequests,
]
if (externalRequests.length > 0) {
  throw new Error(`Unexpected external/provider request(s): ${JSON.stringify(externalRequests, null, 2)}`)
}

const failedViewport = viewportRuns.find((run) =>
  !run.checks.hasPlanningBacklog ||
  !run.checks.hasCompactFilterControls ||
  run.checks.overlappingFilterControls.length > 0 ||
  run.checks.filterTextOverflow ||
  run.checks.filterLabelCountOverlap ||
  !run.checks.hasSafeCta ||
  !run.checks.hasBoundary ||
  !run.internalActionChecks.hasGmailAction ||
  !run.internalActionChecks.hasManualAction ||
  run.internalActionChecks.horizontalOverflow ||
  !run.warmActionClusterPolish.chipVisible ||
  !run.warmActionClusterPolish.chipCentered ||
  !run.warmActionClusterPolish.humanReviewChipSingleLine ||
  !run.warmActionClusterPolish.ctaVisible ||
  run.warmActionClusterPolish.horizontalOverflow ||
  !run.gmailDraftReviewChecks.visible ||
  !run.gmailDraftReviewChecks.hasDraftOnlyState ||
  !run.gmailDraftReviewChecks.hasSavedBody ||
  !run.gmailDraftReviewChecks.hasRecipientContext ||
  !run.gmailDraftReviewChecks.hasRelationshipBasis ||
  !run.gmailDraftReviewChecks.hasMissingMessageRecovery ||
  !run.gmailDraftReviewChecks.hasBoundary ||
  run.gmailDraftReviewChecks.primaryCtaCount !== 1 ||
  run.gmailDraftReviewChecks.horizontalOverflow ||
  run.collapsedTextChecks.collapsed.length > 0 ||
  !run.actionChecks.hasActionTray ||
  !run.actionChecks.hasCompactRecommendations ||
  !run.actionChecks.hasMixedChannels ||
  !run.actionChecks.hasExecutionReceipt ||
  !run.actionChecks.hasInternalRecordBoundary ||
  !run.actionChecks.primaryCtaAboveGmailPlan ||
  !run.actionChecks.hasNoEgressBoundary ||
  run.actionChecks.horizontalOverflow ||
  run.checks.horizontalOverflow
)
if (failedViewport) {
  throw new Error(`Viewport QA failed: ${failedViewport.name} ${JSON.stringify(failedViewport.checks, null, 2)}`)
}

const receipt = {
  version: 'warm-created-internal-actions-qa/v1',
  createdAt: new Date().toISOString(),
  qaUrl,
  scenario: 'Warm outreach operator sees created internal Gmail draft records and manual-social handoff tasks in the existing list/workroom, then verifies planned-record creation still stays internal.',
  expectedBehavior: [
    'Planning backlog shows All, Ready Gmail, Manual, Relationship, Responses, Blocked, and SMS parked as compact count filters without standalone number tiles.',
    'Clicking filter chips visibly drills into the matching candidate set.',
    'Created Gmail draft records surface as compact Review draft actions in the warm lead list.',
    'Warm action status pills keep the human-review state centered and single-line next to a usable Go to action CTA at 360, 390, 430, and 1440 widths.',
    'Review draft opens the existing outreach workroom, shows the saved queue body, recipient context, relationship basis, and one primary Copy draft CTA.',
    'Missing linked email-message state stays recoverable in context by reviewing the saved queue body instead of routing to Email Center.',
    'Created manual-social handoff tasks surface as compact Record evidence actions in the warm lead list and selected workroom.',
    'Compact filter labels and counts do not overlap at mobile widths 360, 390, and 430.',
    'The primary CTA prepares a review-only batch and the planned draft action tray appears above the long review context.',
    'The selected batch can create internal Portfolio Gmail draft and manual-social handoff records from the existing workroom.',
    'The action tray shows record-created state and keeps no-provider/no-send boundary text visible.',
    'The internal record path stays inside existing Portfolio surfaces; no standalone queue, calendar, or dashboard is created.',
    'The selected-contact workroom still renders the manual social handoff panel.',
    'Mobile widths 360, 390, and 430 show the planning CTA and planned action tray with no horizontal overflow.',
  ],
  decisionGate: 'Internal Portfolio records only. Gmail provider draft creation, Slack dispatch, external sends, SMS/Telnyx, provider activation, and manual-evidence recording remain separate gates.',
  externalActionBoundary: 'Synthetic/local QA only; no Gmail, Slack, LinkedIn, Facebook, Telnyx/SMS, n8n, scheduling, publishing, provider calls, or production-data mutation.',
  screenshots,
  viewportRuns,
  desktopGmailDraftReviewChecks,
  desktopInternalActionChecks,
  desktopCollapsedTextChecks,
  desktopWarmActionClusterPolish,
  mp4Path,
  rawVideoPath,
  externalRequests,
  localRequests: desktop.localRequests,
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ receiptPath, mp4Path, externalRequests }, null, 2))
