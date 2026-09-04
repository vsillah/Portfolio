import { describe, expect, it } from 'vitest'

import {
  buildWarmOutreachShortlist,
  type WarmOutreachShortlistLead,
} from './warm-outreach-shortlist'

const baseLead: WarmOutreachShortlistLead = {
  id: 42,
  name: 'Amina Example',
  email: 'amina@example.com',
  company: 'Example Ops',
  lead_source: 'warm_referral',
  lead_score: 75,
  outreach_status: 'draft',
  created_at: '2026-09-01T12:00:00.000Z',
  linkedin_url: 'https://linkedin.example/amina',
  phone_number: '555-0100',
  messages_count: 0,
  messages_sent: 0,
  has_reply: false,
  has_sales_conversation: true,
  evidence_count: 2,
  has_extractable_text: true,
  message: 'Met through a warm referral and discussed operations follow-up.',
  quick_wins: null,
  full_report: null,
  rep_pain_points: null,
  do_not_contact: false,
  removed_at: null,
  recent_email_drafts: [],
}

function lead(overrides: Partial<WarmOutreachShortlistLead>): WarmOutreachShortlistLead {
  return { ...baseLead, ...overrides }
}

describe('warm outreach shortlist', () => {
  it('prioritizes warm contacts with active response and relationship signals', () => {
    const shortlist = buildWarmOutreachShortlist(
      [
        lead({ id: 1, name: 'Ready Draft', lead_score: 82, has_sales_conversation: true }),
        lead({
          id: 2,
          name: 'Reply Waiting',
          lead_score: 72,
          has_reply: true,
          recent_email_drafts: [
            {
              id: 'queue-reply',
              subject: 'Warm follow-up',
              status: 'sent',
              created_at: '2026-09-02T09:00:00.000Z',
            },
          ],
        }),
        lead({ id: 3, name: 'Cold Lead', lead_source: 'cold_apollo', lead_score: 99 }),
      ],
      { today: '2026-09-02' },
    )

    expect(shortlist.summary.totalWarmLeads).toBe(2)
    expect(shortlist.officeDigest).toMatchObject({
      version: 'warm-response-digest/v1',
      counts: {
        drafted: 0,
        approved: 0,
        sent: 1,
        replied: 1,
        blocked: 0,
        needsVambah: 2,
      },
      currentCta: {
        key: 'handle_response',
        contactId: 2,
        label: 'Handle response',
      },
      executionBoundary: {
        localRowsOnly: true,
        providerMonitoringEnabled: false,
        providerCallsEnabled: false,
        externalSendEnabled: false,
        gmailDraftCreationEnabled: false,
        slackDispatchEnabled: false,
        externalRequests: [],
      },
    })
    expect(shortlist.items.map((item) => item.contactName)).toEqual([
      'Reply Waiting',
      'Ready Draft',
    ])
    expect(shortlist.items[0]).toMatchObject({
      priorityRank: 1,
      status: 'submitted',
      cta: { key: 'handle_response', label: 'Handle response' },
      relationshipBasis: 'Sales or meeting context',
    })
  })

  it('maps compact blockers for missing email, weak basis, suppression, SMS, and approval', () => {
    const shortlist = buildWarmOutreachShortlist([
      lead({
        id: 5,
        name: 'Blocked Contact',
        email: null,
        phone_number: '555-0111',
        lead_score: 25,
        has_sales_conversation: false,
        evidence_count: 0,
        has_extractable_text: false,
        message: null,
        do_not_contact: true,
        recent_email_drafts: [
          {
            id: 'queue-draft',
            subject: 'Warm draft',
            status: 'draft',
            created_at: '2026-09-01T12:00:00.000Z',
          },
        ],
      }),
    ])

    const item = shortlist.items[0]
    expect(item.status).toBe('blocked')
    expect(item.blockers.map((blocker) => blocker.key)).toEqual([
      'suppression_risk',
      'missing_email',
      'weak_relationship_basis',
      'sms_unavailable',
      'approval_needed',
    ])
    expect(item.cta).toMatchObject({ key: 'resolve_blocker', label: 'Resolve blocker' })
    expect(shortlist.officeDigest.responseStates[0]).toMatchObject({
      classification: 'blocked',
      followUpDraftReadiness: 'blocked',
      suppressionProposalVisible: true,
    })
  })

  it('selects a single current CTA from draft state without enabling live SMS or external sends', () => {
    const approved = buildWarmOutreachShortlist([
      lead({
        recent_email_drafts: [
          {
            id: 'queue-approved',
            subject: 'Approved warm draft',
            status: 'approved',
            created_at: '2026-09-02T10:00:00.000Z',
          },
        ],
      }),
    ]).items[0]
    const noDraft = buildWarmOutreachShortlist([lead({ recent_email_drafts: [] })]).items[0]

    expect(approved.cta).toMatchObject({
      key: 'send_approved_gmail_draft',
      label: 'Open send gate',
    })
    expect(approved.channelReadiness.find((channel) => channel.channel === 'sms')).toMatchObject({
      label: 'SMS unavailable',
      state: 'unavailable',
    })
    expect(noDraft.cta).toMatchObject({ key: 'generate_draft', label: 'Generate draft' })
    expect(noDraft.blockers.map((blocker) => blocker.key)).toContain('provider_not_connected')
  })

  it('summarizes drafted, approved, sent, blocked, and needs-Vambah counts for the planning window', () => {
    const shortlist = buildWarmOutreachShortlist(
      [
        lead({
          id: 1,
          name: 'Draft Waiting',
          recent_email_drafts: [
            {
              id: 'queue-draft',
              subject: 'Warm draft',
              status: 'draft',
              created_at: '2026-09-02T08:00:00.000Z',
            },
          ],
        }),
        lead({
          id: 2,
          name: 'Approved Waiting',
          recent_email_drafts: [
            {
              id: 'queue-approved',
              subject: 'Warm draft',
              status: 'approved',
              created_at: '2026-09-02T09:00:00.000Z',
            },
          ],
        }),
        lead({
          id: 3,
          name: 'Sent Waiting',
          messages_sent: 1,
          recent_email_drafts: [
            {
              id: 'queue-sent',
              subject: 'Warm draft',
              status: 'sent',
              created_at: '2026-09-02T10:00:00.000Z',
            },
          ],
        }),
        lead({
          id: 4,
          name: 'Suppressed Waiting',
          do_not_contact: true,
        }),
      ],
      { today: '2026-09-02' },
    )

    expect(shortlist.officeDigest.counts).toEqual({
      drafted: 1,
      approved: 1,
      sent: 1,
      replied: 0,
      blocked: 1,
      needsVambah: 4,
    })
    expect(shortlist.officeDigest.currentCta).toMatchObject({
      key: 'handle_response',
      label: 'Handle response',
      contactName: 'Sent Waiting',
      enabled: true,
    })
    expect(shortlist.officeDigest.responseStates.map((row) => row.followUpDraftReadiness)).toEqual(
      expect.arrayContaining(['approval_needed', 'approved', 'blocked']),
    )
  })

  it('builds a warm planning backlog with Gmail, manual-social, review, response, blocked, and SMS parked buckets', () => {
    const shortlist = buildWarmOutreachShortlist(
      [
        lead({
          id: 10,
          name: 'Gmail Ready',
          email: 'gmail-ready@example.com',
          phone_number: null,
          has_sales_conversation: true,
          recent_email_drafts: [],
        }),
        lead({
          id: 11,
          name: 'Manual Social Ready',
          email: null,
          linkedin_url: 'https://linkedin.example/manual',
          phone_number: null,
          evidence_count: 1,
          has_sales_conversation: false,
          message: 'Known through a Portfolio referral.',
          recent_email_drafts: [],
        }),
        lead({
          id: 12,
          name: 'Relationship Review',
          email: 'review@example.com',
          phone_number: null,
          lead_score: 20,
          has_sales_conversation: false,
          evidence_count: 0,
          message: null,
          quick_wins: null,
          full_report: null,
          rep_pain_points: null,
          recent_email_drafts: [],
        }),
        lead({
          id: 13,
          name: 'Waiting Response',
          email: 'waiting@example.com',
          phone_number: null,
          messages_sent: 1,
          recent_email_drafts: [
            {
              id: 'queue-sent',
              subject: 'Warm draft',
              status: 'sent',
              created_at: '2026-09-02T10:00:00.000Z',
            },
          ],
        }),
        lead({
          id: 14,
          name: 'Suppressed Contact',
          email: 'suppressed@example.com',
          phone_number: null,
          do_not_contact: true,
        }),
        lead({
          id: 15,
          name: 'Phone Parked',
          email: 'phone@example.com',
          phone_number: '555-0199',
          has_sales_conversation: true,
          recent_email_drafts: [],
        }),
      ],
      { today: '2026-09-02' },
    )

    expect(shortlist.planningBacklog).toMatchObject({
      version: 'warm-outreach-planning-backlog/v1',
      planningWindowLabel: 'Warm outreach backlog for 2026-09-02',
      operatingWindow: {
        todayLabel: 'Sep 2',
        weekLabel: 'Sep 2-Sep 8',
      },
      campaignAlignment: {
        source: 'social_content_calendar_template',
        templateKey: 'whisper_to_shout',
        campaignTheme: 'Whisper-to-shout launch',
        currentPhase: 'tease',
        currentPhaseLabel: 'Tease',
        plannedWindowLabel: 'Sep 2-Sep 8',
        currentMilestoneKey: 'small_tension',
        currentMilestoneChannel: 'linkedin',
        currentMilestoneTitle:
          'Open with a small tension, observation, or question that makes the campaign problem visible.',
        nextMilestoneTitle:
          'Give the audience a useful framework or operating lesson connected to the campaign promise.',
        approvalGates: ['copy_review'],
      },
      executionFocus: {
        state: 'ready_gmail_draft',
        contactId: 10,
        contactName: 'Gmail Ready',
        recommendedChannel: 'gmail',
        label: 'Gmail draft review is next',
        actionLabel: 'Prepare Gmail review plan',
        safeOutcome:
          'Opens a review-only Gmail planning batch. Later draft-record creation is local and still cannot send Gmail.',
        enabled: true,
        batchContactIds: [10, 15],
        source: {
          templateKey: 'whisper_to_shout',
          milestoneKey: 'small_tension',
          campaignPhase: 'tease',
          campaignChannel: 'linkedin',
          plannedWindowLabel: 'Sep 2-Sep 8',
          approvalGates: ['copy_review'],
        },
      },
      counts: {
        ready_gmail_draft: 2,
        ready_manual_social: 1,
        needs_relationship_review: 1,
        waiting_on_response: 1,
        suppressed_blocked: 1,
        sms_parked: 1,
      },
      currentCta: {
        key: 'prepare_planning_review_batch',
        label: 'Prepare Gmail review plan',
        contactIds: [10, 15],
        state: 'ready_gmail_draft',
      },
      executionBoundary: {
        localPortfolioPlanOnly: true,
        providerCallsEnabled: false,
        createsGmailDrafts: false,
        externalSendEnabled: false,
        slackDispatchEnabled: false,
        smsDeliveryEnabled: false,
        n8nDispatchEnabled: false,
        productionDataMutation: false,
        externalRequests: [],
      },
    })
    expect(shortlist.planningBacklog.candidates.find((candidate) => candidate.contactId === 11)).toMatchObject({
      recommendedChannel: 'linkedin',
      draftReadiness: 'ready_for_review_batch',
      states: ['ready_manual_social'],
      batchEligible: true,
      campaignAlignment: {
        phase: 'tease',
        theme: 'Open with a small tension, observation, or question that makes the campaign problem visible.',
        plannedWindowLabel: 'Sep 2-Sep 8',
        whyNext: 'Tease campaign angle is ready for a manual social handoff.',
      },
      executionPath: {
        source: 'social_content_calendar_template',
        templateKey: 'whisper_to_shout',
        milestoneKey: 'small_tension',
        campaignChannel: 'linkedin',
        approvalGates: ['copy_review'],
        safeOutcome:
          'Opens manual handoff review in the existing workroom. No LinkedIn, Facebook, phone, or provider action runs.',
      },
    })
    expect(shortlist.planningBacklog.candidates.find((candidate) => candidate.contactId === 15)?.states).toContain('sms_parked')
  })
})
