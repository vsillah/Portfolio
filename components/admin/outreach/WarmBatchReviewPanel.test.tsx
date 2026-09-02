import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildWarmBatchReview } from '@/lib/warm-outreach-batch-review'
import WarmBatchReviewPanel from './WarmBatchReviewPanel'

const contact = {
  id: 42,
  name: 'Amina Example',
  email: 'amina@example.com',
  company: 'Example Ops',
  industry: 'Services',
  lead_source: 'warm_referral',
  do_not_contact: false,
  removed_at: null,
}

function review() {
  return buildWarmBatchReview({
    objective: 'Reconnect around the Agentified pilot.',
    cohortLabel: 'August warm follow-up',
    contacts: [
      {
        contact,
        rows: {
          contactSubmission: contact,
          meetingSummaries: [
            {
              id: 'meeting-1',
              contact_submission_id: 42,
              meeting_type: 'discovery',
              meeting_date: '2026-08-20T00:00:00Z',
              structured_notes: { summary: 'Discussed operations bottlenecks.' },
              created_at: '2026-08-20T00:00:00Z',
            },
          ],
          outreachQueue: [
            {
              id: 'queue-1',
              contact_submission_id: 42,
              channel: 'email',
              status: 'sent',
              subject: 'Warm note',
              sent_at: '2026-08-20T00:00:00Z',
            },
          ],
        },
      },
    ],
  })
}

function draftReadyReview() {
  return buildWarmBatchReview({
    objective: 'Reconnect around the Agentified pilot.',
    cohortLabel: 'August warm follow-up',
    contacts: [
      {
        contact,
        rows: {
          contactSubmission: contact,
          meetingSummaries: [
            {
              id: 'meeting-1',
              contact_submission_id: 42,
              meeting_type: 'discovery',
              meeting_date: '2026-08-20T00:00:00Z',
              structured_notes: { summary: 'Discussed operations bottlenecks.' },
              created_at: '2026-08-20T00:00:00Z',
            },
          ],
          outreachQueue: [],
        },
      },
    ],
  })
}

describe('WarmBatchReviewPanel', () => {
  it('renders per-recipient response monitoring and send-disabled boundaries', () => {
    const textContent = (expected: string) => (_content: string, element: Element | null) =>
      element?.textContent === expected

    render(
      <WarmBatchReviewPanel
        data={review()}
        loading={false}
        error={null}
        draftActionLoading={false}
        draftActionError={null}
        selectedCount={1}
        onReview={vi.fn()}
        onCreateGmailDraftRecords={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Warm batch review')).toBeInTheDocument()
    const recipientSummary = screen.getByText('Full recipient list (1)').closest('summary')
    expect(recipientSummary).not.toBeNull()
    fireEvent.click(recipientSummary!)
    expect(screen.getByText((_content, element) =>
      element?.tagName.toLowerCase() === 'p' &&
      element.textContent === 'Monitoring: stale no response',
    )).toBeInTheDocument()
    expect(screen.getByText((_content, element) =>
      element?.tagName.toLowerCase() === 'p' &&
      element.textContent === 'Next: Review stale no-response follow-up',
    )).toBeInTheDocument()
    expect(screen.getByText((_content, element) =>
      element?.tagName.toLowerCase() === 'p' &&
      Boolean(element.textContent?.startsWith('Recipient key: warm-outreach:recipient:v1:')),
    )).toBeInTheDocument()
    expect(screen.getByText('External monitoring: off')).toBeInTheDocument()
    expect(screen.getByText('Local response evidence: visible')).toBeInTheDocument()
    expect(screen.getByText('External send: off')).toBeInTheDocument()
    expect(screen.queryByText('Email first candidate')).not.toBeInTheDocument()
    expect(screen.getByText('Email gates')).toBeInTheDocument()
    expect(screen.getByText('1 modeled / provider-send off')).toBeInTheDocument()
    expect(screen.getByText('Duplicate blocked: 0')).toBeInTheDocument()
    expect(screen.getByText('Internal handoffs ready: 1')).toBeInTheDocument()
    expect(screen.getByText('Provider not activated: 1')).toBeInTheDocument()
    expect(screen.getByText('Provider smoke ready/passed: 0')).toBeInTheDocument()
    expect(screen.getByText('Draft creation ready but disabled: 0')).toBeInTheDocument()
    expect(screen.getByText('Tracked Gmail drafts: 0')).toBeInTheDocument()
    expect(screen.getByText('Recipient approvals required: 1')).toBeInTheDocument()
    expect(screen.getByText('Sender not verified: 1')).toBeInTheDocument()
    expect(screen.getByText('External send blocked: 1')).toBeInTheDocument()
    expect(screen.getByText('No-send canaries stay on the individual relationship packet.')).toBeInTheDocument()
    expect(screen.getByLabelText('Gmail batch draft plan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve blocked rows' })).toBeDisabled()
    expect(screen.getByText('1 submitted')).toBeInTheDocument()
    expect(screen.getAllByText('Submitted email evidence already exists; exclude this recipient from batch drafting.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Provider draft: off').length).toBeGreaterThan(0)
    expect(screen.getByText('outreach_queue writes: off')).toBeInTheDocument()
    expect(screen.getByText('Provider Gmail drafts: off')).toBeInTheDocument()
    expect(screen.getByText(textContent('Email path: per-recipient gate required'))).toBeInTheDocument()
    expect(screen.getByText(textContent('Draft: ready for review / Provider: blocked'))).toBeInTheDocument()
    expect(screen.getByText(textContent('Handoff: per-recipient handoff / Smoke: blocked'))).toBeInTheDocument()
    expect(screen.getByText(textContent('Draft creation: blocked'))).toBeInTheDocument()
    expect(screen.getByText(textContent('External send: blocked'))).toBeInTheDocument()
    expect(screen.getByText(textContent('Sender: not verified / Recipient approval: required'))).toBeInTheDocument()
    expect(screen.getByText(textContent('Draft evidence: missing'))).toBeInTheDocument()
    expect(screen.getByText('Future eligible gates')).toBeInTheDocument()
    expect(screen.getByText('Manual channel gates')).toBeInTheDocument()
    expect(screen.getByText('Blocked gates')).toBeInTheDocument()
    expect(screen.getByText('Send authority: blocked')).toBeInTheDocument()
    expect(screen.getByText('Future eligible: 0 / Manual: 0 / Blocked: 4')).toBeInTheDocument()
  })

  it('exposes one draft-only Gmail record CTA and calls the creation action', () => {
    const createRecords = vi.fn()

    render(
      <WarmBatchReviewPanel
        data={draftReadyReview()}
        loading={false}
        error={null}
        draftActionLoading={false}
        draftActionError={null}
        selectedCount={1}
        onReview={vi.fn()}
        onCreateGmailDraftRecords={createRecords}
      />,
    )

    expect(screen.getByLabelText('Gmail batch draft plan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Gmail draft records (1)' })).toBeEnabled()
    expect(screen.getByText('1 provider not connected')).toBeInTheDocument()
    expect(screen.getByText('Record: Provider not connected')).toBeInTheDocument()
    expect(screen.getByText('Provider draft: off')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Gmail draft records (1)' }))

    expect(createRecords).toHaveBeenCalledTimes(1)
  })

  it('shows a disabled success state after draft-only records are created', () => {
    render(
      <WarmBatchReviewPanel
        data={buildWarmBatchReview({
          objective: 'Reconnect around the Agentified pilot.',
          cohortLabel: 'August warm follow-up',
          draftCreationReceiptAt: '2026-09-02T12:00:00.000Z',
          contacts: [
            {
              contact,
              rows: {
                contactSubmission: contact,
                meetingSummaries: [
                  {
                    id: 'meeting-1',
                    contact_submission_id: 42,
                    meeting_type: 'discovery',
                    meeting_date: '2026-08-20T00:00:00Z',
                    structured_notes: { summary: 'Discussed operations bottlenecks.' },
                    created_at: '2026-08-20T00:00:00Z',
                  },
                ],
                outreachQueue: [],
              },
            },
          ],
        })}
        loading={false}
        error={null}
        draftActionLoading={false}
        draftActionError={null}
        selectedCount={1}
        onReview={vi.fn()}
        onCreateGmailDraftRecords={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Gmail draft records created' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Draft-only Gmail records created for 1 contact(s).')
    expect(screen.getByText('Record: Draft created')).toBeInTheDocument()
    expect(screen.getByText(/^warm-outreach:gmail-draft-record:v1:/)).toBeInTheDocument()
  })
})
