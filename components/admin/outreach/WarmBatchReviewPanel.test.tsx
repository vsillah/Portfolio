import { render, screen } from '@testing-library/react'
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

describe('WarmBatchReviewPanel', () => {
  it('renders per-recipient response monitoring and send-disabled boundaries', () => {
    render(
      <WarmBatchReviewPanel
        data={review()}
        loading={false}
        error={null}
        selectedCount={1}
        onReview={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Warm batch review')).toBeInTheDocument()
    expect(screen.getByText('Monitoring: awaiting response')).toBeInTheDocument()
    expect(screen.getByText('Next: Await manual or imported response evidence')).toBeInTheDocument()
    expect(screen.getByText(/^Recipient key: warm-outreach:recipient:v1:/)).toBeInTheDocument()
    expect(screen.getByText('Response monitoring: off')).toBeInTheDocument()
    expect(screen.getByText('External send: off')).toBeInTheDocument()
  })
})
