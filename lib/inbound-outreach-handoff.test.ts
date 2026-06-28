import { describe, expect, it } from 'vitest'
import {
  INBOUND_OUTREACH_APPROVAL_BOUNDARY,
  INBOUND_OUTREACH_HANDOFF_VERSION,
  buildClientEmailContextHandoff,
  buildMeetingFollowUpHandoff,
} from './inbound-outreach-handoff'

describe('inbound outreach handoff contract', () => {
  it('builds a lead reply handoff without granting send or approval authority', () => {
    const handoff = buildClientEmailContextHandoff({
      sourceType: 'lead',
      project: {
        id: null,
        lead_id: 42,
        client_name: 'Lead Person',
        client_email: 'lead@example.com',
        client_company: 'Lead Co',
        service_interest: 'AI ops',
        initial_message: 'Need help with follow-up.',
      },
      lastMeeting: {
        meeting_type: 'discovery',
        meeting_date: '2026-06-03T14:00:00.000Z',
        summary: 'Lead wants faster reply drafting.',
      },
      actionItems: {
        pending: [{ title: 'Send recap', owner: 'Vambah', due_date: '2026-06-05' }],
        recently_completed: [],
      },
    })

    expect(handoff).toMatchObject({
      version: INBOUND_OUTREACH_HANDOFF_VERSION,
      intent: 'lead_reply_context',
      next_action: 'review_lead_reply_for_outreach',
      approval_boundary: INBOUND_OUTREACH_APPROVAL_BOUNDARY,
      human_review_required: true,
      source_refs: {
        source_type: 'lead',
        lead_id: 42,
      },
      target_surface: '/admin/outreach?tab=leads&id=42',
    })
    expect(handoff.context_signals).toContain('Interest: AI ops')
    expect(handoff.handoff_notes.join(' ')).toContain('Do not send')
  })

  it('keeps client email context separate from cold outreach', () => {
    const handoff = buildClientEmailContextHandoff({
      sourceType: 'client_project',
      project: {
        id: 'project-1',
        client_name: 'Client Person',
        client_email: 'client@example.com',
        client_company: 'Client Co',
        project_name: 'Client AI Ops',
        project_status: 'active',
        current_phase: 'implementation',
      },
      lastMeeting: null,
      actionItems: null,
    })

    expect(handoff).toMatchObject({
      intent: 'client_reply_context',
      next_action: 'draft_client_reply',
      target_surface: '/admin/email-center',
      source_refs: {
        source_type: 'client_project',
        client_project_id: 'project-1',
        lead_id: null,
      },
    })
    expect(handoff.handoff_notes.join(' ')).toContain('not cold outreach')
  })

  it('builds meeting follow-up handoffs as context-only scheduling inputs', () => {
    const handoff = buildMeetingFollowUpHandoff({
      meeting: {
        id: 'meeting-1',
        meeting_type: 'discovery',
        meeting_date: '2026-06-03T14:00:00.000Z',
        next_meeting_type: 'implementation review',
        next_meeting_agenda: 'Confirm next workflow lane.',
        calendly_event_uri: null,
      },
      project: {
        id: 'project-1',
        client_name: 'Client Person',
        client_email: 'client@example.com',
        client_company: 'Client Co',
        project_name: 'Client AI Ops',
        project_status: 'active',
      },
      taskSummary: { pending: 2, in_progress: 1, complete: 3, total: 6 },
    })

    expect(handoff).toMatchObject({
      version: INBOUND_OUTREACH_HANDOFF_VERSION,
      intent: 'meeting_follow_up_context',
      next_action: 'schedule_follow_up',
      approval_boundary: INBOUND_OUTREACH_APPROVAL_BOUNDARY,
      human_review_required: true,
      target_surface: '/admin/meetings/meeting-1',
      source_refs: {
        source_type: 'meeting',
        client_project_id: 'project-1',
        meeting_record_id: 'meeting-1',
      },
    })
    expect(handoff.context_signals).toContain('Action items: 3 open of 6')
    expect(handoff.handoff_notes.join(' ')).toContain('Do not send a follow-up')
  })
})
