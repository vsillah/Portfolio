import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildWarmOutreachShortlist, type WarmOutreachShortlistLead } from '@/lib/warm-outreach-shortlist'
import WarmPlanningBacklogPanel from './WarmPlanningBacklogPanel'

const lead: WarmOutreachShortlistLead = {
  id: 42,
  name: 'Sade Parked',
  email: 'sade@example.test',
  company: 'Parked Co',
  lead_source: 'warm_referral',
  lead_score: 88,
  outreach_status: 'not_contacted',
  created_at: '2026-09-02T12:00:00.000Z',
  linkedin_url: null,
  phone_number: '555-0142',
  messages_count: 0,
  messages_sent: 0,
  has_reply: false,
  has_sales_conversation: true,
  evidence_count: 1,
  has_extractable_text: true,
  message: 'Known through a prior operator relationship.',
  quick_wins: null,
  full_report: null,
  rep_pain_points: null,
  do_not_contact: false,
  removed_at: null,
  recent_email_drafts: [],
  next_internal_action: null,
}

function smsParkedBacklog() {
  const backlog = buildWarmOutreachShortlist([lead], { limit: 15 }).planningBacklog
  const candidate = backlog.candidates[0]

  return {
    ...backlog,
    counts: {
      ready_gmail_draft: 0,
      ready_manual_social: 0,
      needs_relationship_review: 0,
      waiting_on_response: 0,
      suppressed_blocked: 0,
      sms_parked: 1,
    },
    candidates: [
      {
        ...candidate,
        recommendedChannel: 'sms' as const,
        draftReadiness: 'sms_parked' as const,
        approvalState: 'blocked' as const,
        responseStatus: 'no_response' as const,
        states: ['sms_parked' as const],
        blockers: ['SMS/Telnyx remains parked.'],
        batchEligible: false,
        nextActionLabel: 'SMS parked',
        reviewLoopAction: {
          key: 'parked_sms' as const,
          label: 'SMS parked',
          statusLabel: 'Parked',
          detail: 'SMS stays visible for planning but cannot execute from this surface.',
          afterClick: 'Wait for Telnyx/10DLC readiness and a separate SMS approval gate.',
          href: candidate.ctaHref,
          enabled: false,
          blockerReason: 'SMS/Telnyx remains parked.',
        },
        campaignAlignment: {
          ...candidate.campaignAlignment,
          safeNextAction: 'Park until the separate approval gate clears',
        },
      },
    ],
  }
}

describe('WarmPlanningBacklogPanel', () => {
  it('opens an SMS parked drawer with a disabled primary action', () => {
    const openCandidate = vi.fn()

    render(
      <WarmPlanningBacklogPanel
        backlog={smsParkedBacklog()}
        activeState="all"
        loading={false}
        error={null}
        onStateChange={vi.fn()}
        onPrepareBatch={vi.fn()}
        onPrepareCandidateReview={vi.fn()}
        onOpenCandidate={openCandidate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open action drawer: SMS parked for Sade Parked' }))

    const drawer = screen.getByLabelText('Warm planning action drawer for Sade Parked')
    expect(within(drawer).getAllByText('SMS parked').length).toBeGreaterThan(0)
    expect(within(drawer).getByText('Current safest action')).toBeInTheDocument()
    expect(within(drawer).getByText('Park until the separate approval gate clears')).toBeInTheDocument()
    expect(within(drawer).getAllByText('SMS/Telnyx remains parked.').length).toBeGreaterThan(0)
    expect(within(drawer).getByRole('button', { name: 'SMS parked for Sade Parked' })).toBeDisabled()
    expect(openCandidate).not.toHaveBeenCalled()
  })
})
