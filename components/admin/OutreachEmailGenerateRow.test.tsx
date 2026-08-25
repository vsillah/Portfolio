import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutreachEmailGenerateRow, type OutreachEmailGenerateRowProps } from './OutreachEmailGenerateRow'
import type { RelationshipPacketApiResponse } from './outreach/RelationshipPacketPanel'

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

vi.mock('@/lib/hooks/useOutreachGeneration', () => ({
  useOutreachGeneration: () => ({
    state: 'idle',
    elapsedMs: 0,
    phaseLabel: 'Idle',
    lastTemplateKey: null,
    lastChannel: 'email',
    start: mocks.start,
    cancel: vi.fn(),
    retry: vi.fn(),
    dismissResult: vi.fn(),
  }),
}))

const lead: OutreachEmailGenerateRowProps['lead'] = {
  id: 13697,
  name: 'ATAS Production Google Smoke Lead',
  email: 'smoke@example.com',
  company: 'Portfolio QA',
  job_title: 'Synthetic Contact',
  industry: 'Testing',
  phone_number: null,
  lead_source: 'warm_google_contacts',
  linkedin_url: null,
  quick_wins: null,
  message: null,
  rep_pain_points: null,
  messages_count: 1,
  messages_sent: 0,
  do_not_contact: false,
  removed_at: null,
  last_n8n_outreach_status: 'success',
  last_n8n_outreach_triggered_at: '2026-08-23T13:19:33.595Z',
  last_n8n_outreach_template_key: null,
  recent_email_drafts: [],
}

const relationshipPacketData: RelationshipPacketApiResponse = {
  packet: {
    version: 'warm-outreach-relationship/v1',
    contactId: 13697,
    contactName: 'ATAS Production Google Smoke Lead',
    objective: 'Prepare a warm email draft.',
    relationshipBasis: 'Portfolio shows prior meeting context.',
    sourceRefs: [
      {
        sourceType: 'meeting_record',
        sourceId: 'meeting-1',
        summary: 'Meeting summary is available as private context.',
        privateSource: true,
        visibility: 'private_sensitive',
        mentionSafety: 'summarize_only',
        sourceStatus: 'present',
      },
      {
        sourceType: 'portfolio_contact',
        sourceId: '13697',
        summary: 'Company context is available.',
        privateSource: false,
        visibility: 'portfolio_internal',
        mentionSafety: 'safe_to_mention',
        sourceStatus: 'present',
      },
    ],
    relationshipSignals: ['prior meeting context'],
    commonalities: ['operations workflow'],
    riskFlags: [],
    sourceInventory: {
      sourceStatus: [{ sourceType: 'meeting_records', status: 'present' }],
      safeToMention: ['Company context'],
      summarizeOnly: ['Private meeting summary'],
      doNotMention: ['Raw transcript'],
    },
    openingPitchGuidance: {
      safeCommonalities: ['Company context'],
      openingAngle: 'Open around the prior meeting follow-up.',
      channelNotes: {},
    },
    suggestedNextStep: 'Prepare a human-reviewed draft.',
    avoidContext: ['Do not quote private notes.'],
    responseMonitoringPlan: {
      enabled: false,
      plan: 'Reply monitoring is not active.',
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
        reason: 'No LinkedIn profile recorded.',
      },
      facebook: {
        available: false,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
      },
      phone_contact: {
        available: false,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
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
    version: 'warm-outreach-relationship/v1',
    contact_id: '13697',
    contact_name: 'ATAS Production Google Smoke Lead',
    objective: 'Prepare a warm email draft.',
    relationship_basis: 'Portfolio shows prior meeting context.',
    selected_channel: 'email',
    recommended_template: 'follow_up',
    confidence: 'medium',
    source_summaries: [],
    relationship_signals: ['prior meeting context'],
    commonalities: ['operations workflow'],
    risk_flags: [],
    source_inventory: {
      sourceStatus: [{ sourceType: 'meeting_records', status: 'present' }],
      safeToMention: ['Company context'],
      summarizeOnly: ['Private meeting summary'],
      doNotMention: ['Raw transcript'],
    },
    opening_pitch_guidance: null,
    suggested_next_step: 'Prepare a human-reviewed draft.',
    avoid_context: ['Do not quote private notes.'],
    response_monitoring_plan: null,
    readiness_status: 'needs_review',
    blockers: [],
    warnings: ['Private source context must be summarized, not quoted.'],
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

describe('OutreachEmailGenerateRow status language', () => {
  beforeEach(() => {
    mocks.start.mockReset()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ meetings: [] })))
  })

  it('labels lead-level success as draft generation without implying send completion', async () => {
    render(<OutreachEmailGenerateRow lead={lead} />)

    const draftButton = screen.getByRole('button', {
      name: /Draft generated for ATAS Production Google Smoke Lead, not sent/i,
    })
    expect(draftButton).toBeInTheDocument()
    expect(draftButton).toHaveAttribute(
      'title',
      'Draft generated in the outreach queue. This is not a send confirmation.',
    )
    expect(screen.queryByText('Draft ready')).not.toBeInTheDocument()

    fireEvent.click(draftButton)

    expect(
      await screen.findByText(/this contact's draft queue and send history/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Draft generated does not mean sent/i)).toBeInTheDocument()
  })

  it('uses the server relationship packet when generating a warm email draft', async () => {
    render(
      <OutreachEmailGenerateRow
        lead={{ ...lead, last_n8n_outreach_status: null }}
        relationshipPacketData={relationshipPacketData}
      />,
    )

    const outreachButton = screen.getByRole('button', { name: /Outreach\./i })
    expect(outreachButton.closest('.basis-full')).not.toBeNull()

    fireEvent.click(outreachButton)
    const outreachPanel = screen.getByRole('dialog', { name: /Outreach options/i })
    expect(outreachPanel).toHaveClass('relative')
    expect(outreachPanel).toHaveClass('w-full')
    expect(outreachPanel).toHaveClass('max-w-full')
    expect(outreachPanel).toHaveClass('overflow-x-hidden')
    expect(outreachPanel).toHaveClass('sm:absolute')
    expect(screen.getByText(/Needs human review/i)).toBeInTheDocument()
    expect(screen.getByText(/summarize-only 1/i)).toBeInTheDocument()
    expect(screen.getByText(/excluded 1/i)).toBeInTheDocument()
    const emailDraft = screen.getByRole('button', { name: /Email draft/i })
    const meetingContext = screen.getByLabelText(/Meeting context/i)
    expect(
      emailDraft.compareDocumentPosition(meetingContext) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const sourceDisclosure = screen.getByText('Review source boundaries').closest('details')
    expect(sourceDisclosure).not.toBeNull()
    expect(sourceDisclosure).not.toHaveAttribute('open')

    fireEvent.click(emailDraft)

    await waitFor(() => {
      expect(mocks.start).toHaveBeenCalledWith(
        undefined,
        'email',
        undefined,
        {
          warm_relationship: relationshipPacketData.packet,
        },
      )
    })
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/relationship-packet'),
      expect.anything(),
    )
  })
})
