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

function meetingRowsFor(contactId: number) {
  return meetingRows.map((row) => ({
    ...row,
    contact_submission_id: contactId,
  }))
}

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
      review.recipients[0].sendReadiness.modes.warm_1_to_1.find((item) => item.channel === 'email')?.emailSendLifecycle,
    ).toMatchObject({
      state: 'blocked_before_provider_activation',
      firstCandidateChannel: true,
      sendReady: false,
      duplicatePrevention: {
        duplicateDetected: false,
      },
    })
    expect(
      review.recipients[0].sendReadiness.modes.warm_1_to_many.find((item) => item.channel === 'email')?.emailSendLifecycle,
    ).toMatchObject({
      state: 'per_recipient_gate_required',
      firstCandidateChannel: true,
      sendReady: false,
      stages: expect.arrayContaining([
        expect.objectContaining({
          key: 'provider_capability_smoke',
          status: 'blocked',
          externalExecutionEnabled: false,
        }),
      ]),
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
    expect(review.recipients[0].gmailDraftPlan).toMatchObject({
      contactId: 42,
      status: 'ready_for_local_planning',
      nextAction: 'local_draft_planning',
      nextActionLabel: 'Create Gmail draft record',
      draftCreation: {
        status: 'provider_not_connected',
        statusLabel: 'Provider not connected',
        actionEnabled: true,
        localDraftRecordId: null,
        providerDraftId: null,
        createdAt: null,
        externalRequests: [],
      },
      draftIntent: {
        channel: 'gmail',
        promptTemplateKey: 'email_follow_up',
        queueIntent: 'draft_only_planned',
        createsOutreachQueueRow: false,
        createsGmailDraft: false,
        callsProvider: false,
        externalSend: false,
      },
    })
    expect(review.recipients[0].gmailDraftPlan.readiness).toContainEqual({
      key: 'provider_not_connected',
      label: 'Provider not connected',
      state: 'needs_review',
    })
  })

  it('blocks suppressed and missing-email recipients before draft planning authority', () => {
    const review = reviewFor({
      contacts: [
        {
          contact: {
            ...baseContact,
            email: null,
            do_not_contact: true,
            suppression_reason: 'Manual DNC review is active.',
          },
          rows: {
            contactSubmission: {
              ...baseContact,
              email: null,
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
    expect(review.gmailDraftPlan).toMatchObject({
      status: 'blocked_review',
      currentCta: {
        key: 'resolve_blocked_rows',
        enabled: false,
        blocker: 'Missing email address for Gmail draft planning.',
      },
      summary: {
        blockedReviewCount: 1,
      },
    })
    expect(review.recipients[0].gmailDraftPlan).toMatchObject({
      status: 'blocked_review',
      nextAction: 'blocked_review',
    })
    expect(review.recipients[0].gmailDraftPlan.blockers).toContain(
      'Missing email address for Gmail draft planning.',
    )
    expect(review.recipients[0].gmailDraftPlan.blockers).toContain('Manual DNC review is active.')
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
    expect(review.recipients[0].gmailDraftPlan).toMatchObject({
      status: 'blocked_review',
      nextActionLabel: 'Resolve blocker',
    })
  })

  it('uses deterministic idempotency and returns existing draft rows for approval review', () => {
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
    expect(first.gmailDraftPlan).toMatchObject({
      status: 'approval_review_needed',
      currentCta: {
        key: 'review_approval_requests',
        label: 'Review approval requests',
        enabled: true,
      },
      summary: {
        readyForLocalPlanningCount: 0,
        approvalRequiredCount: 1,
        draftAlreadyExistsCount: 1,
      },
    })
    expect(first.recipients[0].gmailDraftPlan).toMatchObject({
      status: 'approval_required',
      nextAction: 'approval_request',
      nextActionLabel: 'Open existing draft',
      existingQueueId: 'queue-existing',
      draftCreation: {
        status: 'draft_already_exists',
        actionEnabled: false,
        blocker: 'A local email draft already exists for this recipient and template.',
      },
    })
  })

  it('records explicit draft-only Gmail draft creation receipts without egress', () => {
    const review = reviewFor({
      draftCreationReceiptAt: '2026-09-02T12:00:00.000Z',
    })

    expect(review.gmailDraftPlan).toMatchObject({
      status: 'draft_records_created',
      currentCta: {
        key: 'draft_records_created',
        label: 'Gmail draft records created',
        enabled: false,
      },
      summary: {
        draftCreationEligibleCount: 0,
        draftCreatedCount: 1,
      },
      executionReceipt: {
        action: 'create_gmail_draft_records',
        createdAt: '2026-09-02T12:00:00.000Z',
        createdCount: 1,
        externalRequests: [],
      },
    })
    expect(review.recipients[0].gmailDraftPlan.draftCreation).toMatchObject({
      status: 'draft_created',
      statusLabel: 'Draft created',
      actionEnabled: false,
      providerDraftId: null,
      createdAt: '2026-09-02T12:00:00.000Z',
      externalRequests: [],
    })
    expect(review.recipients[0].gmailDraftPlan.draftCreation.localDraftRecordId).toMatch(
      /^warm-outreach:gmail-draft-record:v1:/,
    )
  })

  it('excludes recipients with submitted email evidence from batch drafting', () => {
    const review = reviewFor({
      contacts: [
        {
          contact: baseContact,
          rows: {
            contactSubmission: baseContact,
            meetingSummaries: meetingRows,
            outreachQueue: [
              {
                id: 'queue-sent',
                contact_submission_id: 42,
                channel: 'email',
                status: 'sent',
                sent_at: '2026-08-22T00:00:00Z',
              },
            ],
          },
        },
      ],
    })

    expect(review.gmailDraftPlan).toMatchObject({
      status: 'blocked_review',
      summary: {
        excludedSubmittedCount: 1,
        readyForLocalPlanningCount: 0,
      },
    })
    expect(review.recipients[0].gmailDraftPlan).toMatchObject({
      status: 'excluded_submitted',
      nextAction: 'excluded_review',
      blockers: ['Submitted email evidence already exists; exclude this recipient from batch drafting.'],
    })
  })

  it('builds planned draft action packets for Gmail, manual social, response follow-up, and parked SMS', () => {
    const gmailContact = { ...baseContact, id: 50, name: 'Gmail Ready', email: 'gmail@example.com' }
    const manualSocialContact = {
      ...baseContact,
      id: 51,
      name: 'LinkedIn Ready',
      email: null,
      linkedin_url: 'https://linkedin.example/ready',
    }
    const responseContact = { ...baseContact, id: 52, name: 'Response Waiting', email: 'response@example.com' }
    const smsContact = {
      ...baseContact,
      id: 53,
      name: 'Phone Parked',
      email: null,
      phone_number: '555-0153',
      linkedin_url: null,
    }

    const review = buildWarmBatchReview({
      objective: 'Plan the next warm draft actions.',
      cohortLabel: 'Warm planned actions',
      preferredChannel: 'linkedin',
      contacts: [
        {
          contact: gmailContact,
          rows: { contactSubmission: gmailContact, meetingSummaries: meetingRowsFor(50) },
        },
        {
          contact: manualSocialContact,
          rows: { contactSubmission: manualSocialContact, meetingSummaries: meetingRowsFor(51) },
        },
        {
          contact: responseContact,
          rows: {
            contactSubmission: responseContact,
            meetingSummaries: meetingRowsFor(52),
            outreachQueue: [
              {
                id: 'queue-sent-52',
                contact_submission_id: 52,
                channel: 'email',
                status: 'sent',
                sent_at: '2026-08-22T00:00:00Z',
              },
            ],
          },
        },
        {
          contact: smsContact,
          rows: { contactSubmission: smsContact, meetingSummaries: meetingRowsFor(53) },
        },
      ],
    })

    expect(review.plannedDraftActions).toMatchObject({
      version: 'warm-planned-draft-actions/v1',
      currentCta: {
        key: 'open_response_follow_up',
        label: 'Open response follow-up',
        enabled: true,
      },
      summary: {
        selectedCount: 4,
        gmailDraftPlanCount: 1,
        manualSocialHandoffCount: 1,
        relationshipReviewBlockerCount: 0,
        responseFollowUpCount: 1,
        parkedSmsCount: 1,
      },
      executionBoundary: {
        localPortfolioPlanOnly: true,
        reviewOnlyDraftActionPackets: true,
        createsOutreachQueueRows: false,
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
    })
    expect(review.plannedDraftActions.rows.map((row) => row.kind)).toEqual([
      'gmail_draft_plan',
      'manual_social_handoff',
      'response_follow_up',
      'parked_sms',
    ])
    expect(review.plannedDraftActions.rows[1]).toMatchObject({
      recommendedChannel: 'linkedin',
      cta: {
        key: 'open_manual_handoff',
        label: 'Open manual handoff',
        href: '/admin/outreach?tab=leads&filter=warm&id=51&contactId=51#warm-manual-social-handoff',
      },
      draftActionPacket: {
        reviewOnly: true,
        createsGmailDraft: false,
        callsProvider: false,
        smsDelivery: false,
        externalRequests: [],
      },
    })
    expect(review.plannedDraftActions.rows[3]).toMatchObject({
      recommendedChannel: 'sms',
      cta: {
        key: 'parked_sms',
        label: 'SMS parked',
        enabled: false,
      },
    })
  })

  it('deduplicates batch contact ids and detects suppressed local statuses', () => {
    expect(parseWarmBatchContactIds(['42', 42, 'bad', -1, 7])).toEqual([7, 42])
    expect(hasSuppressedWarmBatchStatus({ status: 'unsubscribed' })).toBe(true)
    expect(hasSuppressedWarmBatchStatus({ metadata: { do_not_contact: true } })).toBe(true)
    expect(hasSuppressedWarmBatchStatus({ status: 'sent' })).toBe(false)
  })
})
