import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactDetailPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/Pagination', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const contactResponse = {
  contact: {
    id: 42,
    name: 'Neil Rhein',
    email: 'neil@example.com',
    company: 'Keep Massachusetts Beautiful',
    industry: 'Nonprofit',
    lead_source: 'warm_referral',
    lead_score: 86,
    outreach_status: 'draft',
    created_at: '2026-08-01T12:00:00.000Z',
    employee_count: null,
  },
  gammaReports: [],
  videos: [],
  valueReports: [],
  audits: [],
  outreach: [],
  deliveries: [],
  communications: [],
  dashboardAccess: null,
  salesSessions: [],
  timeline: [],
  suggestedTemplate: 'email_follow_up',
}

const relationshipPacketResponse = {
  packet: {
    version: 'warm-outreach-relationship/v1',
    contactId: 42,
    contactName: 'Neil Rhein',
    objective: 'Prepare warm outreach context.',
    relationshipBasis: 'Neil has an existing Portfolio relationship and prior KMB delivery context.',
    sourceRefs: [
      {
        sourceType: 'portfolio_contact',
        sourceId: '42',
        summary: 'Contact record ties Neil to Keep Massachusetts Beautiful.',
        privateSource: false,
        visibility: 'portfolio_internal',
        mentionSafety: 'safe_to_mention',
        sourceStatus: 'present',
      },
      {
        sourceType: 'meeting_record',
        sourceId: 'meeting-1',
        summary: 'Meeting notes are available as operator-only context.',
        privateSource: true,
        visibility: 'private_sensitive',
        mentionSafety: 'summarize_only',
        sourceStatus: 'present',
      },
    ],
    relationshipSignals: ['Prior delivery context exists'],
    commonalities: ['Community operations', 'Website migration'],
    riskFlags: ['Private meeting notes must remain summarized'],
    sourceInventory: {
      sourceStatus: [
        { sourceType: 'contact_submissions', status: 'present' },
        { sourceType: 'meeting_records', status: 'present' },
      ],
      safeToMention: ['Keep Massachusetts Beautiful public context'],
      summarizeOnly: ['Meeting notes'],
      doNotMention: ['Raw transcript'],
    },
    openingPitchGuidance: {
      safeCommonalities: ['Community operations'],
      openingAngle: 'Reconnect around the KMB delivery path.',
      channelNotes: {
        email: 'Use email for internal draft review.',
      },
    },
    suggestedNextStep: 'Review the draft context before generation.',
    avoidContext: ['Do not quote private notes.'],
    responseMonitoringPlan: {
      enabled: false,
      plan: 'Reply monitoring requires explicit provider approval.',
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
        reason: 'Email can prepare an internal draft only.',
      },
      linkedin: {
        available: false,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
      },
      facebook: {
        available: false,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
      },
      phone_contact: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Phone remains manual review only.',
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

describe('ContactDetailPage relationship packet', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/contacts/42')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/contacts/42') {
        return Response.json(contactResponse)
      }
      if (url === '/api/admin/outreach/leads/42/relationship-packet') {
        return Response.json(relationshipPacketResponse)
      }
      if (url === '/api/admin/outreach/leads/42/responses') {
        if (init?.method === 'POST') {
          return Response.json({
            outcome: 'created',
            responseCommunicationId: 'comm-response-created',
            replyDraftCommunicationId: 'comm-draft-created',
            replyDraftOutcome: 'created',
            followUpTask: { outcome: 'created', id: 'task-created' },
            suppressionProposal: null,
            decision: {
              responseClass: 'interested',
              interpretation: {
                classificationLabel: 'interested',
                recommendedNextAction: {
                  label: 'Review short next-step reply',
                  requiresNextTouchDecision: true,
                },
              },
              approvalGate: {
                label: 'Pending: human reply approval',
                recoveryPath: 'Approve the local draft in the contact workroom.',
              },
            },
          }, { status: 201 })
        }
        return Response.json({
          responses: [
            {
              id: 'comm-response-1',
              channel: 'email',
              direction: 'inbound',
              message_type: 'reply',
              subject: 'Warm outreach response: interested',
              body: 'Interested in talking next week.',
              source_id: 'warm-outreach:reply:manual:abc',
              status: 'replied',
              sent_at: '2026-08-26T12:00:00.000Z',
              metadata: {
                lifecycle: 'warm_outreach_response',
                response_class: 'interested',
                response_class_label: 'interested',
                recommended_next_action: {
                  label: 'Review short next-step reply',
                  description: 'Prepare a concise next-step reply.',
                  priority: 'high',
                  requiresNextTouchDecision: true,
                },
                next_touch_decision_required: true,
                approval_gate: {
                  state: 'pending_human_reply_review',
                  label: 'Pending: human reply approval',
                  recoveryPath: 'Approve the local draft in the contact workroom.',
                },
                local_draft_recommendation: {
                  subject: 'Draft reply: interested',
                },
                human_qa_required: true,
                manual_message_key: 'thread-42-message-7',
              },
              created_at: '2026-08-26T12:00:00.000Z',
            },
          ],
        })
      }
      return Response.json({ error: 'not found' }, { status: 404 })
    }))
  })

  it('displays the relationship packet in the canonical contact workroom path', async () => {
    render(<ContactDetailPage />)

    expect(await screen.findByRole('heading', { name: /Neil Rhein/i })).toBeInTheDocument()
    expect(await screen.findByText('Relationship packet')).toBeInTheDocument()
    expect(screen.getByText('Neil has an existing Portfolio relationship and prior KMB delivery context.')).toBeInTheDocument()
    expect(screen.getByText('Keep Massachusetts Beautiful public context')).toBeInTheDocument()
    expect(screen.getByText('Provider calls: off')).toBeInTheDocument()
    expect(screen.getByText('External send: off')).toBeInTheDocument()
    expect(screen.getByText('Draft creation: off')).toBeInTheDocument()
    expect(screen.getByText('Warm response lifecycle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Capture response/i })).toBeDisabled()
    expect(await screen.findByText('Recent response sequences')).toBeInTheDocument()
    expect(screen.getByText('Review short next-step reply')).toBeInTheDocument()
    expect(screen.getByText('Draft reply: interested')).toBeInTheDocument()
    expect(screen.getByText('Pending: human reply approval')).toBeInTheDocument()
    expect(screen.getByText('Human QA')).toBeInTheDocument()
    expect(screen.getByText('Next touch')).toBeInTheDocument()
    expect(screen.getByText('Manual message key: thread-42-message-7')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/outreach/leads/42/relationship-packet', {
        headers: { Authorization: 'Bearer admin-token' },
      })
    })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/outreach/leads/42/responses', {
        headers: { Authorization: 'Bearer admin-token' },
      })
    })
  })

  it('captures a manual warm response in the existing contact workroom without external provider calls', async () => {
    render(<ContactDetailPage />)

    expect(await screen.findByRole('heading', { name: /Neil Rhein/i })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/Optional stable source key/i), {
      target: { value: 'thread-42-message-7' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Paste or summarize the response/i), {
      target: { value: 'Interested. Can we schedule a short call next week?' },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Capture response/i })).toBeEnabled()
    })
    fireEvent.click(screen.getByRole('button', { name: /Capture response/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/outreach/leads/42/responses', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          channel: 'email',
          responseText: 'Interested. Can we schedule a short call next week?',
          outreachQueueId: undefined,
          messageKey: 'thread-42-message-7',
        }),
      }))
    })
    await waitFor(() => {
      expect(screen.getAllByText((_content, element) => (
        element?.textContent?.includes('Response captured as interested.') ?? false
      )).length).toBeGreaterThan(0)
    })
    expect(screen.getByText(/Local reply draft created/i)).toBeInTheDocument()
    expect(screen.getByText(/Next-touch decision requires human QA/i)).toBeInTheDocument()

    const calledUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input))
    expect(calledUrls.some(url => /gmail|slack|n8n|provider/i.test(url))).toBe(false)
  })
})
