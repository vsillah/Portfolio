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

function relationship(
  stage: 'draft_only' | 'request_approval' | 'approval_pending' | 'approved' | 'live_send' | 'submitted' | 'blocked',
): RelationshipPacketApiResponse {
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
    approvalDecisionKey: stage === 'request_approval' || stage === 'approval_pending' ? null : 'warm-approval-1',
    messageVersionKey: 'warm-message-version-1',
    sendQueueIdempotencyKey: 'warm-send-key-1',
    submittedEvidenceKey: 'warm-submitted-key-1',
    internalDraftReady: true,
    draftTracked: true,
    providerConfigured: true,
    senderMatched: true,
    approvalRequestStatus: stage === 'approval_pending' ? 'pending' : 'not_sent',
    authorizationStatus:
      stage === 'request_approval' || stage === 'approval_pending' || stage === 'blocked'
        ? 'missing'
        : 'approved',
    executionState:
      stage === 'approval_pending'
        ? 'approval_requested'
        : stage === 'request_approval'
        ? 'approval_needed'
        : stage === 'submitted'
          ? 'sent'
          : stage === 'blocked'
            ? 'blocked'
        : stage === 'live_send'
          ? 'eligible_for_execution'
          : 'approved_for_send',
    submittedEvidenceRecorded: stage === 'submitted',
    secondaryLogRepairRequired: false,
    responseMonitoringAttached: stage === 'submitted',
    hardBlockers: stage === 'blocked' ? ['The tracked draft message version does not match this queue row.'] : [],
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
    expect(within(review).getAllByText('Draft-only').length).toBeGreaterThanOrEqual(2)
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
    expect(screen.getAllByText('Live execution disabled').length).toBeGreaterThan(0)

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
    expect(screen.getAllByText('Live execution eligible').length).toBeGreaterThan(0)
  })

  it('promotes a successful local request receipt into the pending decision state', () => {
    render(
      <WarmGmailDraftReviewPanel
        leadName="Ada Operator"
        leadEmail="ada@example.com"
        queueId="queue-1"
        linkedEmailMessageId="email-message-1"
        data={draftData}
        loading={false}
        error={null}
        relationshipPacketData={relationship('request_approval')}
        requestApprovalMessage="Approval request recorded in Portfolio. Slack dispatch off. Gmail send off."
        onCopyDraft={vi.fn()}
        onRequestApproval={vi.fn()}
      />,
    )

    const review = screen.getByLabelText('Gmail draft review for Ada Operator')
    expect(within(review).getByText('Decision pending')).toBeInTheDocument()
    expect(within(review).getByRole('link', { name: /Review decision/i })).toHaveAttribute(
      'href',
      '#warm-gmail-operating-loop',
    )
    expect(within(review).getAllByText('Review decision').length).toBeGreaterThan(1)
    expect(within(review).getAllByText('Authorization decision required').length).toBeGreaterThan(0)
    expect(within(review).queryByText('Request send approval')).not.toBeInTheDocument()
    expect(
      within(review).getAllByText('Approval request recorded in Portfolio. Slack dispatch off. Gmail send off.').length,
    ).toBeGreaterThan(0)
  })

  it('shows submitted evidence as review-only and keeps details collapsed', () => {
    renderPanel({ packet: relationship('submitted') })

    const review = screen.getByLabelText('Gmail draft review for Ada Operator')
    expect(within(review).getByText('Sent evidence')).toBeInTheDocument()
    expect(within(review).getAllByText('Response monitoring active').length).toBeGreaterThan(0)
    expect(within(review).getByRole('link', { name: /Review sent evidence/i })).toHaveAttribute(
      'href',
      '#warm-gmail-operating-loop',
    )
    expect(within(review).getByText('Review details')).toBeInTheDocument()
  })

  it('surfaces blockers without offering copy or approval as the primary action', () => {
    renderPanel({ packet: relationship('blocked') })

    const review = screen.getByLabelText('Gmail draft review for Ada Operator')
    expect(within(review).getByText('Blocked')).toBeInTheDocument()
    expect(within(review).getByRole('status')).toHaveTextContent('Resolve workflow blocker')
    expect(within(review).queryByRole('button', { name: /Copy draft/i })).not.toBeInTheDocument()
    expect(within(review).queryByRole('button', { name: /Request send approval/i })).not.toBeInTheDocument()
  })
})
