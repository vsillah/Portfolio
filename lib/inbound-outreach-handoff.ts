export const INBOUND_OUTREACH_HANDOFF_VERSION = 'inbound-outreach-handoff/v1'
export const INBOUND_OUTREACH_APPROVAL_BOUNDARY =
  'context_handoff_only_no_send_no_auto_approval'

export type InboundOutreachHandoffIntent =
  | 'client_reply_context'
  | 'lead_reply_context'
  | 'meeting_follow_up_context'

export type InboundOutreachNextAction =
  | 'draft_client_reply'
  | 'review_lead_reply_for_outreach'
  | 'schedule_follow_up'

export type InboundOutreachHandoff = {
  version: typeof INBOUND_OUTREACH_HANDOFF_VERSION
  intent: InboundOutreachHandoffIntent
  next_action: InboundOutreachNextAction
  approval_boundary: typeof INBOUND_OUTREACH_APPROVAL_BOUNDARY
  human_review_required: true
  contact: {
    name: string | null
    email: string | null
    company: string | null
  }
  source_refs: {
    source_type: 'client_project' | 'lead' | 'meeting'
    client_project_id?: string | null
    lead_id?: number | null
    meeting_record_id?: string | null
  }
  context_signals: string[]
  handoff_notes: string[]
  target_surface: string
}

type ClientEmailProject = {
  id: string | null
  client_name: string | null
  client_email: string | null
  client_company: string | null
  project_name?: string | null
  project_status?: string | null
  current_phase?: string | null
  lead_id?: number | null
  service_interest?: string | null
  initial_message?: string | null
}

type LastMeeting = {
  meeting_type?: string | null
  meeting_date?: string | null
  summary?: string | null
} | null

type ActionItems = {
  pending?: Array<{ title: string; owner?: string | null; due_date?: string | null }>
  recently_completed?: Array<{ title: string; completed_at?: string | null }>
} | null

type TaskSummary = {
  pending: number
  in_progress: number
  complete: number
  total: number
} | null

export function buildClientEmailContextHandoff(args: {
  sourceType: 'client_project' | 'lead'
  project: ClientEmailProject
  lastMeeting: LastMeeting
  actionItems: ActionItems
}): InboundOutreachHandoff {
  const isLead = args.sourceType === 'lead'
  const leadId = typeof args.project.lead_id === 'number' ? args.project.lead_id : null
  const signals = compact([
    args.project.project_name ? `Project: ${args.project.project_name}` : null,
    args.project.project_status ? `Status: ${args.project.project_status}` : null,
    args.project.current_phase ? `Phase: ${args.project.current_phase}` : null,
    args.project.service_interest ? `Interest: ${args.project.service_interest}` : null,
    args.lastMeeting?.summary ? `Last meeting: ${args.lastMeeting.summary}` : null,
    args.actionItems?.pending?.length
      ? `Pending action items: ${args.actionItems.pending.length}`
      : null,
    args.actionItems?.recently_completed?.length
      ? `Recently completed action items: ${args.actionItems.recently_completed.length}`
      : null,
  ])

  return {
    version: INBOUND_OUTREACH_HANDOFF_VERSION,
    intent: isLead ? 'lead_reply_context' : 'client_reply_context',
    next_action: isLead ? 'review_lead_reply_for_outreach' : 'draft_client_reply',
    approval_boundary: INBOUND_OUTREACH_APPROVAL_BOUNDARY,
    human_review_required: true,
    contact: {
      name: args.project.client_name,
      email: args.project.client_email,
      company: args.project.client_company,
    },
    source_refs: {
      source_type: args.sourceType,
      client_project_id: isLead ? null : args.project.id,
      lead_id: isLead ? leadId : null,
    },
    context_signals: signals,
    handoff_notes: [
      'Use this packet to ground a reply or outreach review.',
      'Do not send, approve, or mark a draft ready from this context response alone.',
      isLead
        ? 'If outreach is appropriate, route through the admin outreach review queue.'
        : 'Treat this as client-service reply context, not cold outreach.',
    ],
    target_surface: isLead && leadId
      ? `/admin/outreach?tab=leads&id=${leadId}`
      : '/admin/email-center',
  }
}

export function buildMeetingFollowUpHandoff(args: {
  meeting: {
    id: string
    meeting_type: string | null
    meeting_date: string | null
    next_meeting_type: string | null
    next_meeting_agenda: string | null
    calendly_event_uri: string | null
  }
  project: {
    id: string
    client_name: string | null
    client_email: string | null
    client_company: string | null
    project_name: string | null
    project_status: string | null
  } | null
  taskSummary: TaskSummary
}): InboundOutreachHandoff {
  const signals = compact([
    args.meeting.meeting_type ? `Meeting type: ${args.meeting.meeting_type}` : null,
    args.meeting.meeting_date ? `Meeting date: ${args.meeting.meeting_date}` : null,
    args.meeting.next_meeting_type
      ? `Next meeting type: ${args.meeting.next_meeting_type}`
      : null,
    args.meeting.next_meeting_agenda
      ? `Next agenda: ${args.meeting.next_meeting_agenda}`
      : null,
    args.meeting.calendly_event_uri ? 'Calendly event already linked' : null,
    args.taskSummary ? `Action items: ${args.taskSummary.pending + args.taskSummary.in_progress} open of ${args.taskSummary.total}` : null,
  ])

  return {
    version: INBOUND_OUTREACH_HANDOFF_VERSION,
    intent: 'meeting_follow_up_context',
    next_action: 'schedule_follow_up',
    approval_boundary: INBOUND_OUTREACH_APPROVAL_BOUNDARY,
    human_review_required: true,
    contact: {
      name: args.project?.client_name ?? null,
      email: args.project?.client_email ?? null,
      company: args.project?.client_company ?? null,
    },
    source_refs: {
      source_type: 'meeting',
      client_project_id: args.project?.id ?? null,
      meeting_record_id: args.meeting.id,
    },
    context_signals: signals,
    handoff_notes: [
      'Use this packet to prepare follow-up context or scheduling copy.',
      'Do not send a follow-up, create a calendar event, or approve a draft from this response alone.',
      'Route any outbound message through the existing outreach or email review gate.',
    ],
    target_surface: args.project?.id
      ? `/admin/meetings/${args.meeting.id}`
      : '/admin/meetings',
  }
}

function compact(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
}
