import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WarmGmailDraftReviewPanel from './WarmGmailDraftReviewPanel'
import type { RelationshipPacketApiResponse } from './RelationshipPacketPanel'
import { buildWarmGmailOperatingLoop } from '@/lib/warm-outreach-gmail-operating-loop'

const draftData = {
  id: 'queue-1',
  contactSubmissionId: 42,
  channel: 'email',
  status: 'draft',
  sequenceStep: 1,
  subject: 'Warm follow-up: Ada Operator',
  body: 'Hi Ada,\n\nFollowing up from our prior conversation.',
  createdAt: '2026-09-02T12:00:00.000Z',
  generationModel: 'portfolio-local-planner',
  generationPromptSummary: 'planned_warm_gmail_draft_intent:no_provider',
  generationInputs: {
    version: 'warm-planned-draft-execution/v1',
    queue_intent: 'draft_only_planned',
    external_requests: [],
  },
}

function relationship(stage: 'draft_only' | 'request_approval' | 'approved' | 'live_send'): RelationshipPacketApiResponse {
  if (stage === 'draft_only') {
    return {
      packet: {
        relationshipBasis: 'Prior Portfolio conversation and meeting follow-up context exist.',
        sourceInventory: { safeToMention: ['Company context'] },
      },
    } as RelationshipPacketApiResponse
  }

  const loop = buildWarmGmailOperatingLoop({
    contactId: 42,
    queueId: 'queue-1',
    recipientLabel: 'Ada Operator',
    recipientEmail: 'ada@example.com',
    gmailDraftId: 'gmail-draft-1',
    gmailThreadId: 'gmail-thread-1',
    approvalDecisionKey: stage === 'request_approval' ? null : 'warm-approval-1',
    messageVersionKey: 'warm-message-version-1',
    sendQueueIdempotencyKey: 'warm-send-key-1',
    submittedEvidenceKey: 'warm-submitted-key-1',
    internalDraftReady: true,
    draftTracked: true,
    providerConfigured: true,
    senderMatched: true,
    approvalRequestStatus: 'not_sent',
    authorizationStatus: stage === 'request_approval' ? 'missing' : 'approved',
    executionState:
      stage === 'request_approval'
        ? 'approval_needed'
        : stage === 'live_send'
          ? 'eligible_for_execution'
          : 'approved_for_send',
    submittedEvidenceRecorded: false,
    secondaryLogRepairRequired: false,
    responseMonitoringAttached: false,
    hardBlockers: [],
  })

  return {
    packet: {
      relationshipBasis: 'Prior Portfolio conversation and meeting follow-up context exist.',
      sourceInventory: { safeToMention: ['Company context'] },
    },
    responseMonitoring: {
      sendReadiness: {
        modes: {
          warm_1_to_1: [
            {
              channel: 'email',
              emailSendLifecycle: {
                gmailOperatingLoop: loop,
              },
            },
          ],
        },
      },
    },
  } as unknown as RelationshipPacketApiResponse
}

function renderPanel(args?: {
  packet?: RelationshipPacketApiResponse
  linkedEmailMessageId?: string | null
  onRequestApproval?: (queueId: string) => void
}) {
  const linkedEmailMessageId =
    args && 'linkedEmailMessageId' in args ? args.linkedEmailMessageId : 'email-message-1'
  return render(
    <WarmGmailDraftReviewPanel
      leadName="Ada Operator"
      leadEmail="ada@example.com"
      queueId="queue-1"
      linkedEmailMessageId={linkedEmailMessageId}
      data={draftData}
      loading={false}
      error={null}
      relationshipPacketData={args?.packet ?? relationship('draft_only')}
      onCopyDraft={vi.fn()}
      onRequestApproval={args?.onRequestApproval}
    />,
  )
}

describe('WarmGmailDraftReviewPanel', () => {
  it('shows draft-only review with the saved body and missing-message recovery', () => {
    renderPanel({ linkedEmailMessageId: null })

    const review = screen.getByLabelText('Gmail draft review for Ada Operator')
    expect(within(review).getAllByText('Draft-only')).toHaveLength(2)
    expect(within(review).getByText('Message link missing')).toBeInTheDocument()
    expect(within(review).getByText(/Following up from our prior conversation/)).toBeInTheDocument()
    expect(within(review).getByRole('button', { name: /Copy draft/i })).toBeEnabled()
  })

  it('distinguishes approval request, approved, and live-send gate states', () => {
    const requestApproval = vi.fn()
    const { rerender } = render(
      <WarmGmailDraftReviewPanel
        leadName="Ada Operator"
        leadEmail="ada@example.com"
        queueId="queue-1"
        linkedEmailMessageId="email-message-1"
        data={draftData}
        loading={false}
        error={null}
        relationshipPacketData={relationship('request_approval')}
        onCopyDraft={vi.fn()}
        onRequestApproval={requestApproval}
      />,
    )

    expect(screen.getByText('Request approval')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Request send approval/i }))
    expect(requestApproval).toHaveBeenCalledWith('queue-1')

    rerender(
      <WarmGmailDraftReviewPanel
        leadName="Ada Operator"
        leadEmail="ada@example.com"
        queueId="queue-1"
        linkedEmailMessageId="email-message-1"
        data={draftData}
        loading={false}
        error={null}
        relationshipPacketData={relationship('approved')}
        onCopyDraft={vi.fn()}
        onRequestApproval={requestApproval}
      />,
    )
    expect(screen.getAllByText('Approved')).toHaveLength(2)
    expect(screen.getByText('Live execution disabled')).toBeInTheDocument()

    rerender(
      <WarmGmailDraftReviewPanel
        leadName="Ada Operator"
        leadEmail="ada@example.com"
        queueId="queue-1"
        linkedEmailMessageId="email-message-1"
        data={draftData}
        loading={false}
        error={null}
        relationshipPacketData={relationship('live_send')}
        onCopyDraft={vi.fn()}
        onRequestApproval={requestApproval}
      />,
    )
    expect(screen.getByText('Live send gate')).toBeInTheDocument()
    expect(screen.getByText('Live execution eligible')).toBeInTheDocument()
  })
})
