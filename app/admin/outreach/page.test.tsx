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
    status: 'ready_for_local_planning',
    currentCta: {
      key: 'prepare_local_draft_plan',
      label: 'Prepare local draft plan',
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
        nextActionLabel: 'Prepare local draft plan',
        existingQueueId: null,
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

describe('OutreachAdminPage deep links', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&id=42')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/outreach/leads/42/relationship-packet')) {
        return Response.json(relationshipPacketResponse)
      }
      if (url.startsWith('/api/admin/outreach/batch-review')) {
        return Response.json(warmBatchReviewResponse)
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

    const shortlist = await screen.findByLabelText('Daily warm outreach shortlist')
    expect(within(shortlist).getByText('Daily warm shortlist')).toBeInTheDocument()
    expect(within(shortlist).getByText('Referral')).toBeInTheDocument()
    expect(within(shortlist).getByText('Gmail gated')).toBeInTheDocument()
    expect(within(shortlist).getByText('Phone missing')).toBeInTheDocument()
    expect(within(shortlist).getByText('Prepare an approval-gated draft')).toBeInTheDocument()
    expect(within(shortlist).getByRole('button', { name: 'Generate draft for Ada Operator' })).toBeInTheDocument()
  })

  it('routes shortlist CTAs into the existing workroom without provider calls', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&filter=warm')
    const fetchMock = vi.mocked(fetch)

    render(<OutreachAdminPage />)

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
    fireEvent.click(screen.getByRole('button', { name: 'Plan Gmail drafts' }))

    const batchReview = await screen.findByLabelText('Warm batch review')
    expect(within(batchReview).getByText('Cohort provenance')).toBeInTheDocument()
    expect(within(batchReview).getByText('Sample individualized preview')).toBeInTheDocument()
    expect(within(batchReview).getByLabelText('Gmail batch draft plan')).toBeInTheDocument()
    expect(within(batchReview).getByRole('button', { name: 'Prepare local draft plan' })).toBeEnabled()
    expect(within(batchReview).getByText('1 plan-ready')).toBeInTheDocument()
    expect(within(batchReview).getByText('Provider not connected')).toBeInTheDocument()
    expect(within(batchReview).getByText('outreach_queue writes: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('Gmail drafts: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('Provider calls: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('External send: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('Full recipient list (1)')).toBeInTheDocument()
    expect(within(batchReview).getByText('Hi Ada, The warm basis is prior meeting context.')).toBeInTheDocument()
    fireEvent.click(within(batchReview).getByRole('button', { name: 'Prepare local draft plan' }))
    expect(await within(batchReview).findByText(/No outreach_queue row, Gmail draft, Slack message, SMS, n8n run, or provider request was created/)).toBeInTheDocument()

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
    const batchCall = fetchMock.mock.calls.find(([url]) => url === '/api/admin/outreach/batch-review')
    expect(JSON.parse(String(batchCall?.[1]?.body))).toMatchObject({
      contact_ids: [42],
      cohort_label: '1 selected Gmail draft candidate',
      preferred_channel: 'email',
    })
  })
})
