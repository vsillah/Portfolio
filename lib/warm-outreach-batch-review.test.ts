import { describe, expect, it } from 'vitest'

import {
  buildWarmBatchReview,
  hasSuppressedWarmBatchStatus,
  parseWarmBatchContactIds,
} from './warm-outreach-batch-review'

const baseContact = {
  id: 42,
  name: 'Amina Example',
  email: 'amina@example.com',
  company: 'Example Ops',
  industry: 'Services',
  lead_source: 'warm_referral',
  do_not_contact: false,
  removed_at: null,
}

const meetingRows = [
  {
    id: 'meeting-1',
    contact_submission_id: 42,
    meeting_type: 'discovery',
    meeting_date: '2026-08-20T00:00:00Z',
    structured_notes: { summary: 'Discussed operations bottlenecks.' },
    created_at: '2026-08-20T00:00:00Z',
  },
]

function reviewFor(overrides: Partial<Parameters<typeof buildWarmBatchReview>[0]> = {}) {
  return buildWarmBatchReview({
    objective: 'Reconnect around the Agentified pilot.',
    cohortLabel: 'August warm follow-up',
    contacts: [
      {
        contact: baseContact,
        rows: {
          contactSubmission: baseContact,
          meetingSummaries: meetingRows,
          contactCommunications: [],
          outreachQueue: [],
          emailMessages: [],
          actionTasks: [],
        },
      },
    ],
    ...overrides,
  })
}

describe('warm outreach batch review', () => {
  it('builds individualized ready rows without enabling external side effects', () => {
    const review = reviewFor()

    expect(review).toMatchObject({
      mode: 'warm_1_to_many',
      cohort: {
        label: 'August warm follow-up',
        recipientCount: 1,
        source: 'selected_outreach_leads',
      },
      summary: {
        readyCount: 1,
        existingDraftCount: 0,
        blockedCount: 0,
      },
      executionBoundary: {
        readOnly: true,
        providerCalls: false,
        createsDraft: false,
        externalSend: false,
        gmailDraft: false,
        linkedinAction: false,
        facebookAction: false,
        phoneAction: false,
        n8nDispatch: false,
        slackAction: false,
        responseMonitoring: false,
      },
    })
    expect(review.batchIdempotencyKey).toMatch(/^warm-outreach:batch-review:v1:/)
    expect(review.samplePreview?.individualizedDraftPreview).toContain('Amina')
    expect(review.recipients[0]).toMatchObject({
      contactId: 42,
      contactName: 'Amina Example',
      relationshipSignalCount: 1,
      selectedChannel: 'email',
      selectedTemplate: 'follow_up',
      promptTemplateKey: 'email_follow_up',
      suppressionStatus: 'clear',
      weakBasis: false,
      status: 'ready_for_review',
      responseMonitoring: {
        status: 'awaiting_response',
        mode: 'pending',
        executionBoundary: {
          externalSendEnabled: false,
          providerPollingEnabled: false,
        },
      },
      sendReadiness: {
        version: 'warm-outreach-send-readiness/v1',
        executionBoundary: {
          providerExecution: false,
          externalMonitoring: false,
          gmailDraftCreation: false,
          outcomeTracking: false,
        },
      },
    })
    expect(review.recipients[0].sendReadiness.modes.warm_1_to_1).toHaveLength(4)
    expect(review.recipients[0].sendReadiness.modes.warm_1_to_many).toHaveLength(4)
    expect(
      review.recipients[0].sendReadiness.modes.warm_1_to_1.find((item) => item.channel === 'email')?.sendAuthority,
    ).toMatchObject({
      version: 'warm-outreach-send-authority/v1',
      state: 'eligible_for_future_activation',
      futureActivationEligible: true,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      schedulingEnabled: false,
      outcomeTrackingEnabled: false,
    })
    expect(
      review.recipients[0].sendReadiness.modes.warm_1_to_1.find((item) => item.channel === 'phone_contact')?.sendAuthority,
    ).toMatchObject({
      state: 'blocked',
      futureActivationEligible: false,
      providerExecutionEnabled: false,
    })
    expect(review.recipients[0].draftIdempotencyKey).toMatch(/^warm-outreach:batch-draft:v1:/)
    expect(review.recipients[0].sendReadiness.perRecipientIdempotencyKey).toMatch(
      /^warm-outreach:recipient:v1:/,
    )
  })

  it('blocks suppressed recipients before draft generation authority', () => {
    const review = reviewFor({
      contacts: [
        {
          contact: {
            ...baseContact,
            do_not_contact: true,
            suppression_reason: 'Manual DNC review is active.',
          },
          rows: {
            contactSubmission: {
              ...baseContact,
              do_not_contact: true,
              suppression_reason: 'Manual DNC review is active.',
            },
            meetingSummaries: meetingRows,
          },
        },
      ],
    })

    expect(review.summary).toMatchObject({
      blockedCount: 1,
      suppressionBlockedCount: 1,
    })
    expect(review.recipients[0]).toMatchObject({
      suppressionStatus: 'blocked',
      status: 'blocked',
    })
    expect(review.recipients[0].suppressionReasons).toContain('Manual DNC review is active.')
    expect(review.recipients[0].individualizedDraftPreview).toContain('Blocked')
  })

  it('blocks weak relationship basis rows in batch review', () => {
    const review = reviewFor({
      contacts: [
        {
          contact: baseContact,
          rows: {
            contactSubmission: baseContact,
            meetingSummaries: [],
            contactCommunications: [],
            outreachQueue: [],
            emailMessages: [],
            actionTasks: [],
          },
        },
      ],
    })

    expect(review.summary).toMatchObject({
      blockedCount: 1,
      weakBasisCount: 1,
    })
    expect(review.recipients[0]).toMatchObject({
      weakBasis: true,
      status: 'blocked',
    })
    expect(review.recipients[0].blockers).toContain(
      'Relationship basis is too weak for batch draft generation.',
    )
  })

  it('uses deterministic idempotency and returns existing draft rows', () => {
    const first = reviewFor({
      contacts: [
        {
          contact: baseContact,
          rows: {
            contactSubmission: baseContact,
            meetingSummaries: meetingRows,
            outreachQueue: [
              {
                id: 'queue-existing',
                contact_submission_id: 42,
                channel: 'email',
                status: 'draft',
                generation_inputs: { template_key: 'email_follow_up' },
              },
            ],
          },
        },
      ],
    })
    const second = reviewFor({
      contacts: first.recipients.map((recipient) => ({
        contact: baseContact,
        rows: {
          contactSubmission: baseContact,
          meetingSummaries: meetingRows,
          outreachQueue: [
            {
              id: 'queue-existing',
              contact_submission_id: recipient.contactId,
              channel: 'email',
              status: 'draft',
              generation_inputs: { template_key: 'email_follow_up' },
            },
          ],
        },
      })),
    })

    expect(first.batchIdempotencyKey).toBe(second.batchIdempotencyKey)
    expect(first.recipients[0].draftIdempotencyKey).toBe(second.recipients[0].draftIdempotencyKey)
    expect(first.recipients[0].sendReadiness.perRecipientIdempotencyKey).toBe(
      second.recipients[0].sendReadiness.perRecipientIdempotencyKey,
    )
    expect(first.recipients[0]).toMatchObject({
      status: 'existing_draft',
      existingQueueId: 'queue-existing',
    })
    expect(first.summary).toMatchObject({
      readyCount: 0,
      existingDraftCount: 1,
      blockedCount: 0,
    })
  })

  it('deduplicates batch contact ids and detects suppressed local statuses', () => {
    expect(parseWarmBatchContactIds(['42', 42, 'bad', -1, 7])).toEqual([7, 42])
    expect(hasSuppressedWarmBatchStatus({ status: 'unsubscribed' })).toBe(true)
    expect(hasSuppressedWarmBatchStatus({ metadata: { do_not_contact: true } })).toBe(true)
    expect(hasSuppressedWarmBatchStatus({ status: 'sent' })).toBe(false)
  })
})
