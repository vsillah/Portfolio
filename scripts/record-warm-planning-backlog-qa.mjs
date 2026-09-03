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
const qaDir = path.join(root, 'test-results', 'warm-planning-backlog-qa')
const sourceDir = path.join(qaDir, 'source')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const qaPath = '/admin/outreach?tab=leads&filter=warm'
const qaUrl = new URL(qaPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-planning-backlog-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-planning-backlog-qa.json')

const screenshots = {
  mobile360: path.join(outputDir, 'warm-planning-backlog-mobile-360.png'),
  mobile390: path.join(outputDir, 'warm-planning-backlog-mobile-390.png'),
  mobile430: path.join(outputDir, 'warm-planning-backlog-mobile-430.png'),
  desktop1440: path.join(outputDir, 'warm-planning-backlog-desktop-1440.png'),
}

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })

const user = {
  id: 'warm-planning-backlog-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-planning-backlog-qa@example.test',
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
    recent_email_drafts: [],
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
    recipients,
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(batchReviewResponse(body.contact_ids ?? [])),
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
    const currentCta = [...document.querySelectorAll('button')]
      .find((button) => /Plan review batch/.test(button.textContent || ''))
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    return {
      hasPlanningBacklog: visible(planningBacklog),
      hasStates:
        /Ready for Gmail draft/i.test(text) &&
        /Ready for manual social/i.test(text) &&
        /Needs relationship review/i.test(text) &&
        /Waiting on response/i.test(text) &&
        /Suppressed\/blocked/i.test(text) &&
        /SMS parked/i.test(text),
      hasCampaignAlignment:
        /Today \/ This week/i.test(text) &&
        /Whisper-to-shout launch/i.test(text) &&
        /The backlog turns the current campaign phase/i.test(text) &&
        /Campaign source/i.test(text) &&
        /Why next:/i.test(text),
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

async function viewportEvidence(browser, name, viewport, screenshotPath) {
  const qa = await openQaPage(browser, viewport)
  const planningBacklog = qa.page.getByLabel('Warm outreach planning backlog')
  await planningBacklog.scrollIntoViewIfNeeded()
  const checks = await assertPlanningBacklog(qa.page)
  await qa.page.screenshot({ path: screenshotPath, fullPage: true })
  await qa.context.close()
  return {
    name,
    viewport,
    screenshotPath,
    checks,
    externalRequests: qa.externalRequests,
  }
}

async function addSideText(page) {
  await page.addStyleTag({
    content: `
      body { padding-right: 288px !important; }
      #qa-side-text {
        position: fixed;
        inset: 0 0 0 auto;
        z-index: 2147483647;
        width: 272px;
        box-sizing: border-box;
        padding: 18px 16px;
        background: #07111f;
        color: #e5eef9;
        border-left: 1px solid rgba(148, 163, 184, .35);
        font: 12px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #qa-side-text h2 { margin: 0 0 10px; font-size: 15px; line-height: 1.2; }
      #qa-side-text h3 { margin: 12px 0 5px; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #f7d56b; }
      #qa-side-text p { margin: 0; color: #cbd5e1; }
      #qa-side-text ul { margin: 5px 0 0; padding-left: 16px; color: #cbd5e1; }
      #qa-side-text li { margin: 4px 0; }
    `,
  })
  await page.evaluate(() => {
    const panel = document.createElement('aside')
    panel.id = 'qa-side-text'
    panel.innerHTML = `
      <h2>warm-outreach-planning-backlog QA</h2>
      <h3>Scenario</h3>
      <p>Vambah opens the warm leads tab and prepares a reviewable outreach batch from the existing planning backlog.</p>
      <h3>Expected</h3>
      <ul>
        <li>Today / This week shows the current campaign phase and calendar-template source.</li>
        <li>Six planning states are visible as compact count filters.</li>
        <li>The single current CTA prepares a review-only batch plan.</li>
        <li>Candidate rows explain why each outreach action maps to the campaign plan.</li>
        <li>Candidate rows show basis, channel, draft readiness, approval, response, and blockers.</li>
        <li>The manual social workroom still renders for the selected contact.</li>
      </ul>
      <h3>Decision Gate</h3>
      <p>This stops at review. Creating Gmail drafts, sending messages, recording manual evidence, or enabling SMS remains separately approved.</p>
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
await activateButton(desktop.page.getByRole('button', { name: 'Show SMS parked candidates' }))
await desktopPlanningBacklog.getByText('Kofi Phoneparked').waitFor({ timeout: 10_000 })
await desktop.page.waitForTimeout(700)
await desktopPlanningBacklog.evaluate((element) => element.scrollIntoView({ block: 'center' }))
await activateButton(desktopPlanningBacklog.getByRole('button', { name: 'Show Ready for Gmail draft candidates' }))
await activateButton(desktopPlanningBacklog.getByRole('button', { name: 'Plan review batch (2)' }))
await desktop.page.getByLabel('Warm batch review').waitFor({ timeout: 15_000 })
await desktop.page.getByText('Gmail batch draft plan').waitFor({ timeout: 10_000 })
await desktop.page.waitForTimeout(800)
await desktopPlanningBacklog.evaluate((element) => element.scrollIntoView({ block: 'center' }))
await activateButton(desktop.page.getByRole('button', { name: 'Show Ready for manual social candidates' }))
await activateButton(desktop.page.getByRole('button', { name: 'Plan review batch for Nia Manualsocial' }))
const desktopWorkroom = desktop.page.getByRole('region', { name: 'Outreach workroom for Nia Manualsocial' })
await desktopWorkroom.waitFor({ timeout: 15_000 })
await desktopWorkroom.getByTestId('warm-manual-social-handoff').first().waitFor({ timeout: 15_000 })
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
  !run.checks.hasStates ||
  !run.checks.hasCampaignAlignment ||
  !run.checks.hasSafeCta ||
  !run.checks.hasBoundary ||
  run.checks.horizontalOverflow
)
if (failedViewport) {
  throw new Error(`Viewport QA failed: ${failedViewport.name} ${JSON.stringify(failedViewport.checks, null, 2)}`)
}

const receipt = {
  version: 'warm-outreach-planning-backlog-qa/v1',
  createdAt: new Date().toISOString(),
  qaUrl,
  scenario: 'Planning backlog operator opens warm leads, filters planning states, prepares a review-only batch plan, and opens manual-social workroom state.',
  expectedBehavior: [
    'Planning backlog shows Today / This Week campaign alignment from the existing whisper_to_shout social content calendar template.',
    'Planning backlog shows Ready for Gmail draft, Ready for manual social, Needs relationship review, Waiting on response, Suppressed/blocked, and SMS parked counts.',
    'Clicking summary counts visibly drills into the matching candidate set.',
    'Candidate rows show why each outreach action is next for the current campaign phase without duplicating a calendar.',
    'The single current CTA prepares a review-only batch plan and does not imply external sending.',
    'The selected-contact workroom still renders the manual social handoff panel.',
    'Mobile widths 360, 390, and 430 show the core planning CTA with no horizontal overflow.',
  ],
  decisionGate: 'Operator review only. Gmail draft creation, Slack dispatch, external sends, SMS/Telnyx, provider activation, and manual-evidence recording remain separate gates.',
  externalActionBoundary: 'Synthetic/local QA only; no Gmail, Slack, LinkedIn, Facebook, Telnyx/SMS, n8n, scheduling, publishing, provider calls, or production-data mutation.',
  screenshots,
  viewportRuns,
  mp4Path,
  rawVideoPath,
  externalRequests,
  localRequests: desktop.localRequests,
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ receiptPath, mp4Path, externalRequests }, null, 2))
