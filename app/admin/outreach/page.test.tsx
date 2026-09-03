import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OutreachAdminPage from './page'
import {
  WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID,
  warmSlackSendApprovalQaLead,
} from '@/components/admin/outreach/warmSlackSendApprovalQaFixture'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/outreach/ReviewEnrichModal', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/TechStackModal', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/SocialIntelModal', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/EvidenceDrawer', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/AddLeadModal', () => ({ default: () => null }))
vi.mock('@/components/admin/OutreachEmailGenerateRow', () => ({
  OutreachEmailGenerateRow: ({ lead, presentation }: { lead: { name: string }; presentation?: string }) => (
    <div data-testid="outreach-generator" data-presentation={presentation ?? 'menu'}>
      Outreach generator for {lead.name}
    </div>
  ),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

vi.mock('@/lib/hooks/useRealtimeOutreach', () => ({
  useRealtimeOutreach: () => undefined,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn((url: string) => window.history.replaceState({}, '', url)),
  }),
}))

const lead = {
  id: 42,
  name: 'Ada Operator',
  email: 'ada@example.com',
  company: 'Ops Lab',
  company_domain: 'opslab.test',
  job_title: 'Founder',
  industry: 'Services',
  phone_number: null,
  lead_source: 'warm_referral',
  lead_score: 82,
  outreach_status: 'draft',
  qualification_status: 'qualified',
  created_at: '2026-08-01T12:00:00.000Z',
  linkedin_url: null,
  ai_readiness_score: null,
  competitive_pressure_score: null,
  quick_wins: null,
  messages_count: 1,
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
}

const relationshipPacketResponse = {
  packet: {
    version: 'warm-outreach-relationship/v1',
    contactId: 42,
    contactName: 'Ada Operator',
    objective: 'Prepare warm outreach context.',
    relationshipBasis: 'Prior Portfolio conversation and meeting follow-up context exist.',
    sourceRefs: [
      {
        sourceType: 'meeting_record',
        sourceId: 'meeting-1',
        summary: 'Meeting summary is available for operator review.',
        privateSource: true,
        visibility: 'portfolio_internal',
        mentionSafety: 'summarize_only',
        sourceStatus: 'present',
      },
    ],
    relationshipSignals: ['Meeting follow-up is pending'],
    commonalities: ['Operations improvement'],
    riskFlags: [],
    sourceInventory: {
      sourceStatus: [{ sourceType: 'meeting_records', status: 'present' }],
      safeToMention: ['Company context'],
      summarizeOnly: ['Meeting summary'],
      doNotMention: ['Raw transcript'],
    },
    openingPitchGuidance: {
      safeCommonalities: ['Operations improvement'],
      openingAngle: 'Reconnect around the follow-up.',
      channelNotes: {
        email: 'Email draft only.',
      },
    },
    suggestedNextStep: 'Review the internal draft context.',
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
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'Email draft only.',
      },
      linkedin: {
        available: false,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
      },
      facebook: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Manual Facebook review only.',
      },
      phone_contact: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Manual phone review only.',
      },
    },
    preferredChannel: 'email',
  },
  readiness: {
    status: 'needs_review',
    humanReviewRequired: true,
    selectedChannel: 'email',
    recommendedTemplate: 'follow_up',
    blockers: [],
    warnings: ['Private source context must be summarized, not quoted.'],
    approvalBoundary: 'draft_only_no_external_send',
  },
  contextSummary: {
    readiness_status: 'needs_review',
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

const warmBatchEmailLifecycle = {
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
}

const warmBatchSendReadiness = {
  version: 'warm-outreach-send-readiness/v1',
  contactId: 42,
  perRecipientIdempotencyKey: 'warm-outreach:recipient:v1:test-recipient',
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
        emailSendLifecycle: warmBatchEmailLifecycle,
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

const warmBatchResponseMonitoring = {
  status: 'awaiting_response',
  mode: 'pending',
  proposedFollowUp: {
    label: 'Review warm follow-up',
  },
}

const warmBatchReviewResponse = {
  mode: 'warm_1_to_many',
  batchIdempotencyKey: 'warm-outreach:batch-review:v1:test-batch',
  cohort: {
    label: '1 selected outreach lead',
    recipientCount: 1,
    source: 'selected_outreach_leads',
    provenance: 'Selected 1 existing /admin/outreach lead from local Portfolio rows.',
  },
  summary: {
    readyCount: 1,
    existingDraftCount: 0,
    blockedCount: 0,
    weakBasisCount: 0,
    suppressionBlockedCount: 0,
  },
  samplePreview: {
    contactId: 42,
    contactName: 'Ada Operator',
    company: 'Ops Lab',
    relationshipBasis: 'Portfolio shows prior meeting context for this contact.',
    relationshipSignalCount: 1,
    selectedChannel: 'email',
    selectedTemplate: 'follow_up',
    promptTemplateKey: 'email_follow_up',
    suppressionStatus: 'clear',
    suppressionReasons: [],
    weakBasis: false,
    blockers: [],
    warnings: ['Private source context must be summarized, not quoted.'],
    status: 'ready_for_review',
    draftIdempotencyKey: 'warm-outreach:batch-draft:v1:test-recipient',
    existingQueueId: null,
    individualizedDraftPreview: 'Hi Ada, The warm basis is prior meeting context.',
    responseMonitoring: warmBatchResponseMonitoring,
    sendReadiness: warmBatchSendReadiness,
    packet: relationshipPacketResponse.packet,
    readiness: relationshipPacketResponse.readiness,
    contextSummary: relationshipPacketResponse.contextSummary,
  },
  recipients: [
    {
      contactId: 42,
      contactName: 'Ada Operator',
      company: 'Ops Lab',
      relationshipBasis: 'Portfolio shows prior meeting context for this contact.',
      relationshipSignalCount: 1,
      selectedChannel: 'email',
      selectedTemplate: 'follow_up',
      promptTemplateKey: 'email_follow_up',
      suppressionStatus: 'clear',
      suppressionReasons: [],
      weakBasis: false,
      blockers: [],
      warnings: ['Private source context must be summarized, not quoted.'],
      status: 'ready_for_review',
      draftIdempotencyKey: 'warm-outreach:batch-draft:v1:test-recipient',
      existingQueueId: null,
      individualizedDraftPreview: 'Hi Ada, The warm basis is prior meeting context.',
      responseMonitoring: warmBatchResponseMonitoring,
      sendReadiness: warmBatchSendReadiness,
      packet: relationshipPacketResponse.packet,
      readiness: relationshipPacketResponse.readiness,
      contextSummary: relationshipPacketResponse.contextSummary,
    },
  ],
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
      selectedCount: 1,
      readyForLocalPlanningCount: 1,
      approvalRequiredCount: 0,
      blockedReviewCount: 0,
      excludedSubmittedCount: 0,
      providerNotConnectedCount: 1,
      smsUnavailableCount: 0,
      draftCreationEligibleCount: 1,
      draftAlreadyExistsCount: 0,
      draftCreatedCount: 0,
    },
    rows: [
      {
        contactId: 42,
        contactName: 'Ada Operator',
        company: 'Ops Lab',
        status: 'ready_for_local_planning',
        statusLabel: 'Plan ready',
        relationshipBasis: 'Portfolio shows prior meeting context for this contact.',
        relationshipSignalCount: 1,
        readiness: [
          { key: 'provider_not_connected', label: 'Provider not connected', state: 'needs_review' },
        ],
        blockers: [],
        nextAction: 'local_draft_planning',
        nextActionLabel: 'Create Gmail draft record',
        existingQueueId: null,
        draftCreation: {
          status: 'provider_not_connected',
          statusLabel: 'Provider not connected',
          actionEnabled: true,
          blocker: 'Connect and verify Gmail before creating provider drafts. Local records remain draft-only.',
          draftOnly: true,
          draftRecordKey: 'warm-outreach:gmail-draft-record:v1:test-recipient',
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
      },
    ],
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
      selectedCount: 1,
      gmailDraftPlanCount: 1,
      manualSocialHandoffCount: 0,
      relationshipReviewBlockerCount: 0,
      responseFollowUpCount: 0,
      parkedSmsCount: 0,
    },
    rows: [
      {
        contactId: 42,
        contactName: 'Ada Operator',
        company: 'Ops Lab',
        kind: 'gmail_draft_plan',
        kindLabel: 'Gmail draft plan',
        recommendedChannel: 'gmail',
        recommendationLabel: 'Gmail draft plan',
        state: 'ready',
        reason: 'Open draft gate',
        detail: 'Prepare the review-only Gmail draft action packet. Gmail draft creation remains a separate explicit gate.',
        blockers: [],
        cta: {
          key: 'open_draft_gate',
          label: 'Open draft gate',
          href: '#gmail-batch-draft-plan',
          enabled: true,
        },
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
        recordState: 'ready_to_create',
        recordKey: 'warm-outreach:gmail-draft-record:v1:test-recipient',
        recordTable: 'outreach_queue',
        localRecordId: null,
      },
    ],
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

const warmBatchCreatedResponse = {
  ...warmBatchReviewResponse,
  gmailDraftPlan: {
    ...warmBatchReviewResponse.gmailDraftPlan,
    status: 'draft_records_created',
    currentCta: {
      key: 'draft_records_created',
      label: 'Gmail draft records created',
      enabled: false,
      blocker: null,
    },
    summary: {
      ...warmBatchReviewResponse.gmailDraftPlan.summary,
      draftCreationEligibleCount: 0,
      draftCreatedCount: 1,
    },
    rows: warmBatchReviewResponse.gmailDraftPlan.rows.map((row) => ({
      ...row,
      nextActionLabel: 'Draft record created',
      draftCreation: {
        ...row.draftCreation,
        status: 'draft_created',
        statusLabel: 'Draft created',
        actionEnabled: false,
        localDraftRecordId: row.draftCreation.draftRecordKey,
        createdAt: '2026-09-02T12:00:00.000Z',
        externalRequests: [],
      },
    })),
    executionReceipt: {
      action: 'create_gmail_draft_records',
      createdAt: '2026-09-02T12:00:00.000Z',
      createdCount: 1,
      externalRequests: [],
    },
    executionBoundary: {
      ...warmBatchReviewResponse.gmailDraftPlan.executionBoundary,
      localPortfolioPlanOnly: false,
      createsOutreachQueueRows: true,
    },
  },
  plannedDraftActions: {
    ...warmBatchReviewResponse.plannedDraftActions,
    currentCta: {
      key: 'records_created',
      label: 'Records created',
      enabled: false,
      reason: 'Internal draft and handoff records were created.',
    },
    rows: warmBatchReviewResponse.plannedDraftActions.rows.map((row) => ({
      ...row,
      recordState: 'record_created',
      recordKey: 'warm-outreach:gmail-draft-record:v1:test-recipient',
      recordTable: 'outreach_queue',
      localRecordId: 'queue-created-1',
    })),
    executionReceipt: {
      action: 'create_planned_draft_handoff_records',
      createdAt: '2026-09-02T12:00:00.000Z',
      createdCount: 1,
      gmailDraftRecordCount: 1,
      manualSocialHandoffTaskCount: 0,
      existingCount: 0,
      externalRequests: [],
    },
    executionBoundary: {
      ...warmBatchReviewResponse.plannedDraftActions.executionBoundary,
      localPortfolioPlanOnly: false,
      preRecordNoWrite: false,
      reviewOnlyDraftActionPackets: false,
      internalPortfolioRecordsCreated: true,
      createsOutreachQueueRows: true,
      createsMeetingActionTaskRows: false,
    },
  },
}

const warmBatchExistingDraftResponse = {
  ...warmBatchReviewResponse,
  summary: {
    ...warmBatchReviewResponse.summary,
    readyCount: 0,
    existingDraftCount: 1,
  },
  samplePreview: {
    ...warmBatchReviewResponse.samplePreview,
    status: 'existing_draft',
    existingQueueId: 'queue-existing',
  },
  recipients: warmBatchReviewResponse.recipients.map((recipient) => ({
    ...recipient,
    status: 'existing_draft',
    existingQueueId: 'queue-existing',
  })),
  gmailDraftPlan: {
    ...warmBatchReviewResponse.gmailDraftPlan,
    status: 'approval_review_needed',
    currentCta: {
      key: 'review_approval_requests',
      label: 'Review approval requests',
      enabled: true,
      blocker: null,
    },
    summary: {
      ...warmBatchReviewResponse.gmailDraftPlan.summary,
      readyForLocalPlanningCount: 0,
      approvalRequiredCount: 1,
      providerNotConnectedCount: 0,
      draftCreationEligibleCount: 0,
      draftAlreadyExistsCount: 1,
    },
    rows: warmBatchReviewResponse.gmailDraftPlan.rows.map((row) => ({
      ...row,
      status: 'approval_required',
      statusLabel: 'Approval review',
      readiness: [
        { key: 'approval_needed', label: 'Approval needed', state: 'needs_review' },
      ],
      nextAction: 'approval_request',
      nextActionLabel: 'Open existing draft',
      existingQueueId: 'queue-existing',
      draftCreation: {
        ...row.draftCreation,
        status: 'draft_already_exists',
        statusLabel: 'Draft already exists',
        actionEnabled: false,
        blocker: 'A local email draft already exists for this recipient and template.',
      },
    })),
  },
}

const providerDraftCanaryResponse = {
  message: 'No-send Gmail draft smoke passed. No Gmail draft was created and no email was sent.',
  noSendSmoke: true,
  queueId: 'queue-existing',
  to: 'ada@example.com',
  requiredSender: 'vambah@amadutown.com',
  connectedAs: 'vambah@amadutown.com',
  expectedAuthorization: {
    createGmailDraft: true,
    draftAuthorization: 'create_gmail_draft_for_recipient',
    contactSubmissionId: 42,
    recipientEmail: 'ada@example.com',
    channel: 'email',
    idempotencyKey: 'warm-outreach:gmail-draft:v1:queue-existing:42:email',
  },
  providerDraftCanaryReadiness: {
    version: 'warm-outreach-provider-gmail-draft-canary-readiness/v1',
    state: 'ready_for_explicit_provider_draft_approval',
    label: 'Provider draft canary ready',
    exactApprovalSentence:
      'Create one Gmail provider draft for outreach queue queue-existing and contact 42 using authorization create_gmail_draft_for_recipient. Do not send email.',
    executionBoundary: {
      providerCallsEnabled: false,
      gmailDraftCreated: false,
      trackingPersisted: false,
      externalSendEnabled: false,
      liveProviderCallRequiresSeparateApproval: true,
    },
  },
  externalSendBlocked: true,
}

describe('OutreachAdminPage deep links', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&id=42')
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/admin/outreach/leads/42/relationship-packet')) {
        return Response.json(relationshipPacketResponse)
      }
      if (url.startsWith('/api/admin/outreach/batch-review')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        return Response.json(body.action === 'create_planned_draft_handoff_records'
          ? warmBatchCreatedResponse
          : warmBatchReviewResponse)
      }
      if (url.startsWith('/api/admin/outreach/queue-existing/gmail-user-draft')) {
        return Response.json(providerDraftCanaryResponse)
      }
      if (url.startsWith('/api/admin/outreach/leads')) {
        return Response.json({ leads: [lead], total: 1, page: 1 })
      }
      if (url.startsWith('/api/admin/value-evidence/workflow-status')) {
        return Response.json({})
      }
      if (url.startsWith('/api/admin/chat-escalations')) {
        return Response.json({ escalations: [], total: 0 })
      }
      if (url.startsWith('/api/admin/sales/contact-meetings')) {
        return Response.json({ meetings: [] })
      }
      if (url.startsWith('/api/meeting-action-tasks')) {
        return Response.json({ tasks: [] })
      }
      return Response.json({})
    }))
  })

  it('hydrates the selected lead from the canonical id query parameter', async () => {
    render(<OutreachAdminPage />)

    const summary = await screen.findByLabelText('Lead: Ada Operator mobile workflow summary')
    expect(summary).toBeInTheDocument()
    expect(within(summary).getByText('Warm 1:1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open selected lead' })).toHaveAttribute('href', '/admin/outreach?tab=leads&id=42')
    await waitFor(() => {
      expect(screen.getByText('Ops Lab')).toBeInTheDocument()
    })
  })

  it('hydrates contacted dashboard drilldowns into the visible status dropdown', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&status=contacted')
    const fetchMock = vi.mocked(fetch)

    render(<OutreachAdminPage />)

    await screen.findByText('Ada Operator')
    const statusFilter = screen.getAllByRole('combobox')[1]
    expect(statusFilter).toHaveValue('sequence_active')
    expect(screen.getByRole('option', { name: 'Contacted' })).toHaveValue('sequence_active')
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('status=sequence_active'),
        expect.any(Object),
      )
    })
  })

  it('hydrates the selected workroom from the contactId query alias', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&contactId=42')

    render(<OutreachAdminPage />)

    const workroom = await screen.findByLabelText('Outreach workroom for Ada Operator')
    expect(within(workroom).getByText('Selected outreach workroom')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open selected lead' })).toHaveAttribute(
      'href',
      '/admin/outreach?tab=leads&id=42',
    )
  })

  it('fetches and displays the relationship packet for the selected lead', async () => {
    const fetchMock = vi.mocked(fetch)

    render(<OutreachAdminPage />)

    expect((await screen.findAllByText('Relationship packet')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Prior Portfolio conversation and meeting follow-up context exist.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Provider calls: off').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('External send: off').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Meeting summary').length).toBeGreaterThanOrEqual(1)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/outreach/leads/42/relationship-packet',
        expect.objectContaining({
          headers: { Authorization: 'Bearer admin-token' },
        }),
      )
    })
  })

  it('renders the inert warm Slack approval QA workroom with an enabled local request path', async () => {
    window.history.replaceState(
      {},
      '',
      '/admin/outreach?tab=leads&id=42&contactId=42&qa=warm-slack-send-approval',
    )
    const fetchMock = vi.mocked(fetch)

    render(<OutreachAdminPage />)

    const workroom = await screen.findByLabelText(`Outreach workroom for ${warmSlackSendApprovalQaLead.name}`)
    expect(within(workroom).getByText('Selected outreach workroom')).toBeInTheDocument()
    expect(await within(workroom).findByText('Ready for one-step send approval request')).toBeInTheDocument()
    expect(within(workroom).getByText('Gmail response import')).toBeInTheDocument()
    expect(within(workroom).getByText('Mock Gmail response import ready')).toBeInTheDocument()
    expect(within(workroom).getByText('Live import off')).toBeInTheDocument()
    expect(within(workroom).getByText(`Queue: ${WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID}`)).toBeInTheDocument()

    const button = within(workroom).getByRole('button', { name: 'Request send approval' })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    expect(await within(workroom).findByText(
      `QA local Slack approval request recorded for ${WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID}. Slack dispatch off. Gmail send off. Provider calls off.`,
    )).toBeInTheDocument()
    expect(within(workroom).getAllByText('Approval requested').length).toBeGreaterThan(0)
    expect(within(workroom).getByText('Record approval decision')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/slack-send-approval'))).toBe(false)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/admin/outreach/leads/42/relationship-packet'))).toBe(false)
  })

  it('runs the SMS Telnyx no-send canary from the existing selected workroom', async () => {
    window.history.replaceState(
      {},
      '',
      '/admin/outreach?tab=leads&id=42&contactId=42&qa=warm-slack-send-approval',
    )
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/outreach/leads/42/sms-telnyx-no-send-canary')) {
        return Response.json({
          version: 'warm-outreach-sms-telnyx-no-send-canary/v1',
          status: 'passed_no_send',
          message:
            'No-send Telnyx SMS canary passed. No Telnyx API call ran, no SMS was sent, and provider activation remains disabled.',
          contactId: '42',
          provider: {
            expectedProvider: 'telnyx_messaging',
            selectedProvider: {
              key: 'telnyx_messaging',
              label: 'Telnyx Messaging',
              configured: true,
              unavailable: false,
              rawValueReturned: false,
            },
            selectedProviderVerified: true,
            rawAdapterReturned: false,
          },
          noSendCanary: true,
          externalRequests: [],
          providerCallsEnabled: false,
          smsDeliveryEnabled: false,
          providerActivationEnabled: false,
          featureFlagEnabled: false,
          smsDeliveryEnabledReason:
            'No-send canary only; live SMS requires later activation and per-recipient approval.',
          readiness: {
            envSetupPresent: true,
            selectedProviderAdapter: 'passed',
            disabledExecutionFlag: 'passed',
            consentSuppressionPrerequisites: 'passed',
            messageVersion: 'passed',
            idempotencyNamespace: 'passed',
            auditKey: 'passed',
            credentialReference: 'passed',
            senderReference: 'passed',
            deliveryCallbackReference: 'passed',
            optOutCallbackReference: 'passed',
            deliveryConfirmationStore: 'passed',
            providerCapabilityEvidence: 'passed',
            liveSmsUnavailable: true,
            providerActivationStillDisabled: true,
            perRecipientSendStillSeparate: true,
          },
          redactedReferences: [
            {
              key: 'SMS_PROVIDER_CREDENTIAL_REFERENCE',
              label: 'Credential reference',
              status: 'present_redacted',
              rawValueReturned: false,
            },
            {
              key: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
              label: 'Execution feature flag',
              status: 'disabled_verified',
              rawValueReturned: false,
            },
          ],
          idempotency: {
            namespace: 'warm-sms-send:v1',
            messageVersionKey: 'qa-sms-message-v1',
            auditKey: 'warm-sms-audit:v1:qa',
            canaryIdempotencyKey: 'warm-sms-send:v1:canary:no-send:abc123',
            auditEvidenceKey: 'warm-sms-audit:v1:qa:no-send-canary:def456',
            duplicatePolicy: 'return_existing_no_send_evidence_without_provider_call',
            stableResult: true,
          },
          deliveryConfirmation: {
            storeMapped: true,
            status: 'placeholder_only',
            providerMessageId: null,
            deliveryStatus: null,
          },
          blockedReasons: [],
          executionBoundary: {
            localRowsOnly: true,
            noSendAuditOnly: true,
            providerCallsEnabled: false,
            smsDeliveryEnabled: false,
            providerActivationEnabled: false,
            featureFlagEnabled: false,
            telnyxApiCalled: false,
            rawCredentialsReturned: false,
            rawPhoneReturned: false,
            rawMessageBodyReturned: false,
            credentialsRead: false,
            secretManagerMutated: false,
            environmentVariablesChanged: false,
            databaseWritesEnabled: false,
            slackDispatchEnabled: false,
            gmailActionEnabled: false,
            n8nDispatchEnabled: false,
            externalRequests: [],
          },
        })
      }
      if (url.startsWith('/api/admin/outreach/leads')) {
        return Response.json({ leads: [warmSlackSendApprovalQaLead], total: 1, page: 1 })
      }
      if (url.startsWith('/api/admin/value-evidence/workflow-status')) {
        return Response.json({})
      }
      if (url.startsWith('/api/admin/chat-escalations')) {
        return Response.json({ escalations: [], total: 0 })
      }
      if (url.startsWith('/api/admin/sales/contact-meetings')) {
        return Response.json({ meetings: [] })
      }
      if (url.startsWith('/api/meeting-action-tasks')) {
        return Response.json({ tasks: [] })
      }
      return Response.json({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<OutreachAdminPage />)

    const workroom = await screen.findByLabelText(`Outreach workroom for ${warmSlackSendApprovalQaLead.name}`)
    fireEvent.click(within(workroom).getByRole('button', { name: 'Run SMS no-send canary' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/outreach/leads/42/sms-telnyx-no-send-canary',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      )
    })
    expect(await within(workroom).findByText(/No-send Telnyx SMS canary passed/)).toBeInTheDocument()
    expect(within(workroom).getByText('Env setup: present')).toBeInTheDocument()
    expect(within(workroom).getByText('Provider activation: disabled')).toBeInTheDocument()
    expect(within(workroom).getByText('Live SMS: unavailable')).toBeInTheDocument()
    expect(within(workroom).getAllByText('External requests: 0').length).toBeGreaterThan(0)
    expect(fetchMock.mock.calls.some(([url]) => /telnyx\.com|slack\.com|gmail\.com|googleapis\.com|n8n/i.test(String(url)))).toBe(false)
  })

  it('opens outreach in a dedicated selected workroom instead of rendering the generator inside each lead row', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads')

    render(<OutreachAdminPage />)

    await screen.findByText('Ada Operator')
    expect(screen.queryByText('Selected outreach workroom')).not.toBeInTheDocument()
    expect(screen.queryByTestId('outreach-generator')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Open Outreach/i }))

    const workroom = await screen.findByLabelText('Outreach workroom for Ada Operator')
    expect(within(workroom).getByText('Selected outreach workroom')).toBeInTheDocument()
    expect(within(workroom).getByTestId('outreach-generator')).toHaveAttribute(
      'data-presentation',
      'workroom',
    )
    expect(screen.getByRole('button', { name: /Workroom open/i })).toBeInTheDocument()
  })

  it('shows a compact daily warm shortlist on the warm outreach route', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&filter=warm')

    render(<OutreachAdminPage />)

    const planningBacklog = await screen.findByLabelText('Warm outreach planning backlog')
    expect(within(planningBacklog).getByText('Warm planning backlog')).toBeInTheDocument()
    expect(within(planningBacklog).getByText(/Warm outreach backlog for/)).toBeInTheDocument()
    const stateFilters = within(planningBacklog).getByRole('group', {
      name: 'Warm planning state filters',
    })
    expect(within(stateFilters).getByRole('button', { name: /Show all warm planning candidates/ })).toHaveTextContent('All')
    expect(within(stateFilters).getByRole('button', { name: /Show Ready for Gmail draft candidates/ })).toHaveTextContent('Ready Gmail')
    const manualFilter = within(stateFilters).getByRole('button', { name: /Show Ready for manual social candidates/ })
    expect(manualFilter).toHaveTextContent('Manual')
    expect(manualFilter).toHaveClass('min-w-fit', 'shrink-0', 'whitespace-nowrap')
    expect(within(stateFilters).getByRole('button', { name: /Show SMS parked candidates/ })).toHaveTextContent('SMS parked')
    expect(within(planningBacklog).getByRole('button', { name: 'Plan review batch (1)' })).toBeInTheDocument()
    expect(within(planningBacklog).getByText('Gmail drafts: off')).toBeInTheDocument()
    expect(within(planningBacklog).getByText('Sends/Slack/social/SMS: off')).toBeInTheDocument()
    expect(within(planningBacklog).getByText('external requests 0')).toHaveClass(
      'min-w-fit',
      'shrink-0',
      'whitespace-nowrap',
    )
    expect(within(planningBacklog).getAllByText('SMS parked').length).toBeGreaterThan(0)

    const digest = await screen.findByLabelText('Warm response digest')
    expect(within(digest).getByText('Warm response digest')).toBeInTheDocument()
    expect(within(digest).getByText('Drafted')).toBeInTheDocument()
    expect(within(digest).getByText('Approved')).toBeInTheDocument()
    expect(within(digest).getByText('Sent')).toBeInTheDocument()
    expect(within(digest).getByText('Replied')).toBeInTheDocument()
    expect(within(digest).getByText('Blocked')).toBeInTheDocument()
    expect(within(digest).getByText('Needs Vambah')).toBeInTheDocument()
    expect(within(digest).getByText('external requests 0')).toBeInTheDocument()
    expect(within(digest).getByText(/Provider monitoring, Gmail\/SMS sends, Slack dispatch/)).toBeInTheDocument()
    expect(within(digest).getByRole('button', { name: 'Warm digest current action: Generate draft for Ada Operator' })).toBeInTheDocument()

    const shortlist = await screen.findByLabelText('Daily warm outreach shortlist')
    expect(within(shortlist).getByText('Daily warm shortlist')).toBeInTheDocument()
    expect(within(shortlist).getByText('Referral')).toBeInTheDocument()
    expect(within(shortlist).getByText('Gmail gated')).toBeInTheDocument()
    expect(within(shortlist).getByText('Phone missing')).toBeInTheDocument()
    expect(within(shortlist).getByText('Prepare an approval-gated draft')).toBeInTheDocument()
    expect(within(shortlist).getByRole('button', { name: 'Generate draft for Ada Operator' })).toBeInTheDocument()
  })

  it('filters the warm planning backlog from summary counts and keeps SMS parked separate', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&filter=warm')
    const phoneLead = {
      ...lead,
      id: 43,
      name: 'Phone Operator',
      email: 'phone@example.com',
      phone_number: '555-0143',
      lead_score: 84,
      has_sales_conversation: true,
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/outreach/leads')) {
        return Response.json({ leads: [lead, phoneLead], total: 2, page: 1 })
      }
      if (url.startsWith('/api/admin/value-evidence/workflow-status')) {
        return Response.json({})
      }
      if (url.startsWith('/api/admin/chat-escalations')) {
        return Response.json({ escalations: [], total: 0 })
      }
      if (url.startsWith('/api/admin/sales/contact-meetings')) {
        return Response.json({ meetings: [] })
      }
      if (url.startsWith('/api/meeting-action-tasks')) {
        return Response.json({ tasks: [] })
      }
      return Response.json({})
    }))

    render(<OutreachAdminPage />)

    const planningBacklog = await screen.findByLabelText('Warm outreach planning backlog')
    expect(within(planningBacklog).getByText('Phone Operator')).toBeInTheDocument()
    fireEvent.click(within(planningBacklog).getByRole('button', { name: /Show SMS parked candidates/ }))

    expect(within(planningBacklog).queryByText('Ada Operator')).not.toBeInTheDocument()
    expect(within(planningBacklog).getByText('Phone Operator')).toBeInTheDocument()
    expect(within(planningBacklog).getAllByText('SMS parked').length).toBeGreaterThan(0)
  })

  it('prepares a review-only warm planning backlog batch without external requests or create actions', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&filter=warm')
    const fetchMock = vi.mocked(fetch)

    render(<OutreachAdminPage />)

    const planningBacklog = await screen.findByLabelText('Warm outreach planning backlog')
    fireEvent.click(within(planningBacklog).getByRole('button', { name: 'Plan review batch (1)' }))

    const batchReview = await screen.findByLabelText('Warm batch review')
    expect(within(batchReview).getByLabelText('Warm planned draft actions')).toBeInTheDocument()
    expect(within(batchReview).getAllByRole('link', { name: 'Open draft gate' })[0]).toHaveAttribute(
      'href',
      '#gmail-batch-draft-plan',
    )
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/outreach/batch-review',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('warm planning backlog candidate'),
        }),
      )
    })
    const batchCall = fetchMock.mock.calls.find(([url]) => url === '/api/admin/outreach/batch-review')
    const body = JSON.parse(String(batchCall?.[1]?.body ?? '{}'))
    expect(body).toMatchObject({
      contact_ids: [42],
      preferred_channel: 'email',
    })
    expect(body.action).toBeUndefined()
    expect(fetchMock.mock.calls.some(([url]) => /telnyx\.com|slack\.com|gmail\.com|googleapis\.com|n8n/i.test(String(url)))).toBe(false)
    expect(screen.getByText('1 lead(s) selected')).toBeInTheDocument()
  })

  it('routes shortlist CTAs into the existing workroom without provider calls', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&filter=warm')
    const fetchMock = vi.mocked(fetch)

    render(<OutreachAdminPage />)

    const digest = await screen.findByLabelText('Warm response digest')
    fireEvent.click(within(digest).getByRole('button', { name: 'Warm digest current action: Generate draft for Ada Operator' }))
    expect(await screen.findByLabelText('Outreach workroom for Ada Operator')).toBeInTheDocument()

    const shortlist = await screen.findByLabelText('Daily warm outreach shortlist')
    fireEvent.click(within(shortlist).getByRole('button', { name: 'Generate draft for Ada Operator' }))

    const workroom = await screen.findByLabelText('Outreach workroom for Ada Operator')
    expect(within(workroom).getByText('Selected outreach workroom')).toBeInTheDocument()
    expect(within(workroom).getByTestId('outreach-generator')).toHaveAttribute(
      'data-presentation',
      'workroom',
    )
    expect(fetchMock.mock.calls.some(([url]) => /telnyx\.com|slack\.com|gmail\.com|googleapis\.com|n8n/i.test(String(url)))).toBe(false)
  })

  it('shows explicit shortlist blockers and one resolve CTA for blocked warm contacts', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&filter=warm')
    const blockedLead = {
      ...lead,
      email: null,
      phone_number: '555-0100',
      lead_score: 20,
      has_sales_conversation: false,
      evidence_count: 0,
      has_extractable_text: false,
      message: null,
      do_not_contact: true,
      recent_email_drafts: [],
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/outreach/leads/42/relationship-packet')) {
        return Response.json(relationshipPacketResponse)
      }
      if (url.startsWith('/api/admin/outreach/leads')) {
        return Response.json({ leads: [blockedLead], total: 1, page: 1 })
      }
      if (url.startsWith('/api/admin/value-evidence/workflow-status')) {
        return Response.json({})
      }
      if (url.startsWith('/api/admin/chat-escalations')) {
        return Response.json({ escalations: [], total: 0 })
      }
      if (url.startsWith('/api/admin/sales/contact-meetings')) {
        return Response.json({ meetings: [] })
      }
      if (url.startsWith('/api/meeting-action-tasks')) {
        return Response.json({ tasks: [] })
      }
      return Response.json({})
    }))

    render(<OutreachAdminPage />)

    const shortlist = await screen.findByLabelText('Daily warm outreach shortlist')
    const blockers = within(shortlist).getByLabelText('Ada Operator shortlist blockers')
    expect(within(blockers).getByText('Suppression risk')).toBeInTheDocument()
    expect(within(blockers).getByText('Missing email')).toBeInTheDocument()
    expect(within(blockers).getByText('Weak relationship basis')).toBeInTheDocument()
    expect(within(blockers).getByText('SMS unavailable')).toBeInTheDocument()
    expect(within(shortlist).getByRole('button', { name: 'Resolve blocker for Ada Operator' })).toBeInTheDocument()
  })

  it('keeps the selected workroom read-only when a lead is do not contact', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&visibility=all')
    const blockedLead = { ...lead, do_not_contact: true }
    const blockedPacket = {
      ...relationshipPacketResponse,
      packet: {
        ...relationshipPacketResponse.packet,
        suppression: {
          ...relationshipPacketResponse.packet.suppression,
          doNotContact: true,
          suppressionReason: 'do_not_contact',
        },
      },
      readiness: {
        ...relationshipPacketResponse.readiness,
        status: 'blocked',
        blockers: ['Contact is marked do not contact.'],
      },
    }
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/outreach/leads/42/relationship-packet')) {
        return Response.json(blockedPacket)
      }
      if (url.startsWith('/api/admin/outreach/leads')) {
        return Response.json({ leads: [blockedLead], total: 1, page: 1 })
      }
      if (url.startsWith('/api/admin/value-evidence/workflow-status')) {
        return Response.json({})
      }
      if (url.startsWith('/api/admin/chat-escalations')) {
        return Response.json({ escalations: [], total: 0 })
      }
      if (url.startsWith('/api/admin/sales/contact-meetings')) {
        return Response.json({ meetings: [] })
      }
      if (url.startsWith('/api/meeting-action-tasks')) {
        return Response.json({ tasks: [] })
      }
      return Response.json({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<OutreachAdminPage />)

    await screen.findByText('Ada Operator')
    fireEvent.click(screen.getByRole('button', { name: /Open Outreach/i }))

    const workroom = await screen.findByLabelText('Outreach workroom for Ada Operator')
    expect(within(workroom).getByText('Draft generation blocked')).toBeInTheDocument()
    expect(within(workroom).getByText(/no local draft, provider call, Gmail draft, DM, or send/i)).toBeInTheDocument()
    expect(within(workroom).queryByTestId('outreach-generator')).not.toBeInTheDocument()
    expect(await within(workroom).findByText('Relationship packet')).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/outreach/leads/42/relationship-packet',
        expect.objectContaining({
          headers: { Authorization: 'Bearer admin-token' },
        }),
      )
    })
  })

  it('wraps the hero action group for selected-lead mobile widths', async () => {
    render(<OutreachAdminPage />)

    await screen.findByLabelText('Lead: Ada Operator mobile workflow summary')
    const actions = screen.getByLabelText('Outreach workroom actions')
    expect(actions).toHaveClass('flex-wrap')
    expect(within(actions).getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
  })

  it('reviews a selected warm batch in the existing outreach workroom', async () => {
    const fetchMock = vi.mocked(fetch)
    window.history.replaceState({}, '', '/admin/outreach?tab=leads')

    render(<OutreachAdminPage />)

    await screen.findByText('Ada Operator')
    fireEvent.click(screen.getByLabelText('Select all on this page'))
    fireEvent.click(screen.getByRole('button', { name: 'Plan draft work' }))

    const batchReview = await screen.findByLabelText('Warm batch review')
    expect(within(batchReview).getByLabelText('Warm planned draft actions')).toBeInTheDocument()
    expect(within(batchReview).getByText('1 Gmail draft plan')).toBeInTheDocument()
    expect(within(batchReview).getByText('0 manual handoff')).toHaveClass(
      'min-w-fit',
      'shrink-0',
      'whitespace-nowrap',
    )
    expect(within(batchReview).getByText('external requests 0')).toHaveClass(
      'min-w-fit',
      'shrink-0',
      'whitespace-nowrap',
    )
    expect(within(batchReview).getByText('Cohort provenance')).toBeInTheDocument()
    expect(within(batchReview).getByText('Sample individualized preview')).toBeInTheDocument()
    expect(within(batchReview).getByLabelText('Gmail batch draft plan')).toBeInTheDocument()
    expect(within(batchReview).getByRole('button', { name: 'Create Gmail draft records (1)' })).toBeEnabled()
    expect(within(batchReview).getByText('1 plan-ready')).toBeInTheDocument()
    expect(within(batchReview).getByText('Provider not connected')).toBeInTheDocument()
    expect(within(batchReview).getByText('pre-record/no-write')).toBeInTheDocument()
    expect(within(batchReview).getByText('outreach_queue records: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('handoff task records: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('outreach_queue writes: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('Provider Gmail drafts: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('Provider calls: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('External send: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('Full recipient list (1)')).toBeInTheDocument()
    expect(within(batchReview).getByText('Hi Ada, The warm basis is prior meeting context.')).toBeInTheDocument()
    fireEvent.click(within(batchReview).getByRole('button', { name: 'Create records (1)' }))
    expect(await within(batchReview).findByText(/Created 1 internal record; reused 0/)).toBeInTheDocument()
    expect(within(batchReview).getByRole('button', { name: 'Records created' })).toBeDisabled()
    expect(within(batchReview).getByText('internal records only')).toBeInTheDocument()
    expect(within(batchReview).getByText('outreach_queue records: created')).toBeInTheDocument()
    expect(within(batchReview).getByText('handoff task records: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('outreach_queue writes: created')).toBeInTheDocument()
    expect(within(batchReview).queryByText('review-only packets')).not.toBeInTheDocument()
    expect(within(batchReview).getByText('Record created')).toBeInTheDocument()
    expect(await within(batchReview).findByText(/Draft-only Gmail records created for 1 contact/)).toBeInTheDocument()
    expect(within(batchReview).getByRole('button', { name: 'Gmail draft records created' })).toBeDisabled()
    expect(within(batchReview).getByText('Record: Draft created')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/outreach/batch-review',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
        }),
      )
    })
    const batchCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/admin/outreach/batch-review')
    expect(batchCalls).toHaveLength(2)
    expect(JSON.parse(String(batchCalls[0]?.[1]?.body))).toMatchObject({
      contact_ids: [42],
      cohort_label: '1 selected warm draft/handoff candidate',
      preferred_channel: 'email',
    })
    expect(JSON.parse(String(batchCalls[1]?.[1]?.body))).toMatchObject({
      action: 'create_planned_draft_handoff_records',
      contact_ids: [42],
      cohort_label: '1 selected warm draft/handoff candidate',
      preferred_channel: 'email',
    })
  })

  it('prepares the provider Gmail draft canary without calling Gmail from the batch workroom', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads')
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/admin/outreach/batch-review')) {
        return Response.json(warmBatchExistingDraftResponse)
      }
      if (url.startsWith('/api/admin/outreach/queue-existing/gmail-user-draft')) {
        return Response.json(providerDraftCanaryResponse)
      }
      if (url.startsWith('/api/admin/outreach/leads/42/relationship-packet')) {
        return Response.json(relationshipPacketResponse)
      }
      if (url.startsWith('/api/admin/outreach/leads')) {
        return Response.json({ leads: [lead], total: 1, page: 1 })
      }
      if (url.startsWith('/api/admin/value-evidence/workflow-status')) {
        return Response.json({})
      }
      if (url.startsWith('/api/admin/chat-escalations')) {
        return Response.json({ escalations: [], total: 0 })
      }
      if (url.startsWith('/api/admin/sales/contact-meetings')) {
        return Response.json({ meetings: [] })
      }
      if (url.startsWith('/api/meeting-action-tasks')) {
        return Response.json({ tasks: [] })
      }
      return Response.json({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<OutreachAdminPage />)

    await screen.findByText('Ada Operator')
    fireEvent.click(screen.getByLabelText('Select all on this page'))
    fireEvent.click(screen.getByRole('button', { name: 'Plan draft work' }))

    const batchReview = await screen.findByLabelText('Warm batch review')
    expect(within(batchReview).getByLabelText('Provider Gmail draft canary readiness')).toBeInTheDocument()
    fireEvent.click(within(batchReview).getByRole('button', { name: 'Prepare provider canary' }))

    expect(await within(batchReview).findByText(/Live Gmail draft creation remains locked/)).toBeInTheDocument()
    expect(within(batchReview).getByRole('button', { name: 'Provider canary prepared' })).toBeDisabled()
    expect(within(batchReview).getByText(/Create one Gmail provider draft for outreach queue queue-existing/)).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/outreach/queue-existing/gmail-user-draft',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({ noSendSmoke: true }),
        }),
      )
    })
    expect(fetchMock.mock.calls.some(([url]) => /googleapis\.com|mail\.google\.com|gmail\.com/i.test(String(url)))).toBe(false)
  })
})
