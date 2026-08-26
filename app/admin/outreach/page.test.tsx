import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OutreachAdminPage from './page'

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
      packet: relationshipPacketResponse.packet,
      readiness: relationshipPacketResponse.readiness,
      contextSummary: relationshipPacketResponse.contextSummary,
    },
  ],
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
    fireEvent.click(screen.getByRole('button', { name: /Review 1 selected/i }))

    const batchReview = await screen.findByLabelText('Warm batch review')
    expect(within(batchReview).getByText('Cohort provenance')).toBeInTheDocument()
    expect(within(batchReview).getByText('Sample individualized preview')).toBeInTheDocument()
    expect(within(batchReview).getByText('Provider calls: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('External send: off')).toBeInTheDocument()
    expect(within(batchReview).getByText('Full recipient list (1)')).toBeInTheDocument()
    expect(within(batchReview).getByText('Hi Ada, The warm basis is prior meeting context.')).toBeInTheDocument()

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
  })
})
