import { isWarmLeadSource } from './constants/lead-source'
import {
  CAMPAIGN_PHASE_LABELS,
  SOCIAL_CONTENT_CALENDAR_TEMPLATES,
  type SocialContentCalendarChannel,
  type SocialContentCampaignPhase,
} from './social-content-calendar'

export type WarmOutreachShortlistBlockerKey =
  | 'missing_email'
  | 'weak_relationship_basis'
  | 'suppression_risk'
  | 'provider_not_connected'
  | 'sms_unavailable'
  | 'approval_needed'
  | 'submitted_evidence_exists'

export type WarmOutreachShortlistCtaKey =
  | 'review_relationship_packet'
  | 'generate_draft'
  | 'request_approval'
  | 'send_approved_gmail_draft'
  | 'handle_response'
  | 'resolve_blocker'

export type WarmOutreachShortlistLead = {
  id: number
  name: string
  email: string | null
  company: string | null
  lead_source: string | null
  lead_score: number | null
  outreach_status: string | null
  created_at: string
  linkedin_url: string | null
  phone_number: string | null
  messages_count: number
  messages_sent: number
  has_reply: boolean
  has_sales_conversation: boolean
  evidence_count: number
  has_extractable_text: boolean
  message?: string | null
  quick_wins?: string | null
  full_report?: string | null
  rep_pain_points?: string | null
  do_not_contact?: boolean | null
  removed_at?: string | null
  recent_email_drafts?: Array<{
    id: string
    subject: string | null
    status: string
    created_at: string
    email_message_id?: string | null
  }>
}

export type WarmOutreachShortlistItem = {
  contactId: number
  contactName: string
  company: string | null
  priorityRank: number
  priorityScore: number
  status: 'ready' | 'needs_review' | 'blocked' | 'submitted'
  relationshipBasis: string
  lastTouch: {
    label: string
    iso: string | null
  }
  channelReadiness: Array<{
    channel: 'gmail' | 'linkedin' | 'facebook' | 'phone' | 'sms'
    label: string
    state: 'ready' | 'manual' | 'gated' | 'unavailable'
  }>
  recommendedNextAction: string
  blockers: Array<{
    key: WarmOutreachShortlistBlockerKey
    label: string
  }>
  cta: {
    key: WarmOutreachShortlistCtaKey
    label: string
    href: string
  }
}

export type WarmOutreachOfficeDigest = {
  version: 'warm-response-digest/v1'
  operatingWindowLabel: string
  counts: {
    drafted: number
    approved: number
    sent: number
    replied: number
    blocked: number
    needsVambah: number
  }
  currentCta: {
    key: WarmOutreachShortlistCtaKey | 'none'
    label: string
    contactId: number | null
    contactName: string | null
    enabled: boolean
    reason: string
    href: string | null
  }
  responseStates: Array<{
    contactId: number
    contactName: string
    status: WarmOutreachShortlistItem['status']
    classification: 'no_response' | 'reply_detected' | 'sent_waiting' | 'blocked' | 'draft_ready'
    nextBestAction: string
    followUpDraftReadiness: 'not_started' | 'draft_ready' | 'approval_needed' | 'approved' | 'blocked'
    suppressionProposalVisible: boolean
  }>
  executionBoundary: {
    localRowsOnly: true
    providerMonitoringEnabled: false
    providerCallsEnabled: false
    externalSendEnabled: false
    gmailDraftCreationEnabled: false
    slackDispatchEnabled: false
    externalRequests: []
  }
}

export type WarmOutreachPlanningBacklogState =
  | 'ready_gmail_draft'
  | 'ready_manual_social'
  | 'needs_relationship_review'
  | 'waiting_on_response'
  | 'suppressed_blocked'
  | 'sms_parked'

export type WarmOutreachPlanningBacklogCandidate = {
  contactId: number
  contactName: string
  company: string | null
  relationshipBasis: string
  recommendedChannel: 'gmail' | 'linkedin' | 'facebook' | 'phone_contact' | 'sms'
  draftReadiness:
    | 'ready_for_review_batch'
    | 'existing_draft'
    | 'approval_needed'
    | 'response_waiting'
    | 'relationship_review_needed'
    | 'blocked'
    | 'sms_parked'
  approvalState:
    | 'not_requested'
    | 'needs_approval'
    | 'approved'
    | 'submitted_evidence_recorded'
    | 'blocked'
  responseStatus: 'no_response' | 'waiting' | 'reply_detected' | 'blocked'
  states: WarmOutreachPlanningBacklogState[]
  blockers: string[]
  batchEligible: boolean
  nextActionLabel: string
  ctaHref: string
  campaignAlignment: {
    phase: SocialContentCampaignPhase
    theme: string
    plannedWindowLabel: string
    whyNext: string
  }
  executionPath: {
    source: 'social_content_calendar_template'
    templateKey: 'whisper_to_shout'
    milestoneKey: string
    campaignChannel: SocialContentCalendarChannel
    approvalGates: string[]
    safeOutcome: string
  }
}

export type WarmOutreachPlanningBacklog = {
  version: 'warm-outreach-planning-backlog/v1'
  planningWindowLabel: string
  operatingWindow: {
    todayLabel: string
    weekLabel: string
  }
  campaignAlignment: {
    source: 'social_content_calendar_template'
    templateKey: 'whisper_to_shout'
    campaignTheme: string
    currentPhase: SocialContentCampaignPhase
    currentPhaseLabel: string
    plannedWindowLabel: string
    currentMilestoneKey: string
    currentMilestoneChannel: SocialContentCalendarChannel
    currentMilestoneTitle: string
    nextMilestoneTitle: string | null
    approvalGates: string[]
    whyThisBacklogIsNext: string
    drillIn: string
  }
  executionFocus: {
    state: WarmOutreachPlanningBacklogState
    contactId: number
    contactName: string
    recommendedChannel: WarmOutreachPlanningBacklogCandidate['recommendedChannel']
    label: string
    actionLabel: string
    reason: string
    safeOutcome: string
    href: string
    enabled: boolean
    batchContactIds: number[]
    source: {
      templateKey: 'whisper_to_shout'
      milestoneKey: string
      campaignPhase: SocialContentCampaignPhase
      campaignChannel: SocialContentCalendarChannel
      plannedWindowLabel: string
      approvalGates: string[]
    }
  } | null
  filterLabels: Record<WarmOutreachPlanningBacklogState, string>
  counts: Record<WarmOutreachPlanningBacklogState, number>
  currentCta: {
    key: 'prepare_planning_review_batch' | 'review_relationship_blockers' | 'review_waiting_responses' | 'none'
    label: string
    enabled: boolean
    reason: string
    contactIds: number[]
    state: WarmOutreachPlanningBacklogState | null
  }
  candidates: WarmOutreachPlanningBacklogCandidate[]
  executionBoundary: {
    localPortfolioPlanOnly: true
    providerCallsEnabled: false
    createsGmailDrafts: false
    externalSendEnabled: false
    slackDispatchEnabled: false
    smsDeliveryEnabled: false
    n8nDispatchEnabled: false
    productionDataMutation: false
    externalRequests: []
  }
}

export type WarmOutreachShortlist = {
  generatedFor: string
  items: WarmOutreachShortlistItem[]
  summary: {
    totalWarmLeads: number
    readyCount: number
    blockedCount: number
    submittedCount: number
  }
  officeDigest: WarmOutreachOfficeDigest
  planningBacklog: WarmOutreachPlanningBacklog
}

const BLOCKER_LABELS: Record<WarmOutreachShortlistBlockerKey, string> = {
  missing_email: 'Missing email',
  weak_relationship_basis: 'Weak relationship basis',
  suppression_risk: 'Suppression risk',
  provider_not_connected: 'Provider not connected',
  sms_unavailable: 'SMS unavailable',
  approval_needed: 'Approval needed',
  submitted_evidence_exists: 'Submitted evidence exists',
}

const SUBMITTED_STATUSES = new Set(['sent', 'submitted', 'delivered'])
const APPROVED_STATUSES = new Set(['approved', 'send_authorized', 'authorized'])
const APPROVAL_PENDING_STATUSES = new Set(['approval_requested', 'pending_approval'])
const DRAFT_STATUSES = new Set(['draft', 'queued'])

const PLANNING_BACKLOG_FILTER_LABELS: Record<WarmOutreachPlanningBacklogState, string> = {
  ready_gmail_draft: 'Ready for Gmail draft',
  ready_manual_social: 'Ready for manual social',
  needs_relationship_review: 'Needs relationship review',
  waiting_on_response: 'Waiting on response',
  suppressed_blocked: 'Suppressed/blocked',
  sms_parked: 'SMS parked',
}

const WARM_OUTREACH_CAMPAIGN_TEMPLATE_KEY = 'whisper_to_shout' as const
const WARM_OUTREACH_CAMPAIGN_TEMPLATE =
  SOCIAL_CONTENT_CALENDAR_TEMPLATES[WARM_OUTREACH_CAMPAIGN_TEMPLATE_KEY]

function displayDateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function addDaysLabel(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function campaignMilestoneFor(generatedFor: string) {
  const day = Number(generatedFor.slice(-2))
  const campaignDay = Number.isFinite(day) ? ((day - 1) % 14) + 1 : 1
  const milestones = WARM_OUTREACH_CAMPAIGN_TEMPLATE.milestones
  const current =
    milestones
      .filter((milestone) => milestone.fallback_day_offset + 1 <= campaignDay)
      .at(-1) ?? milestones[0]
  const next =
    milestones.find((milestone) => milestone.fallback_day_offset + 1 > campaignDay) ?? null

  return {
    current,
    next,
    campaignDay,
  }
}

function buildCampaignAlignment(generatedFor: string): WarmOutreachPlanningBacklog['campaignAlignment'] {
  const { current, next } = campaignMilestoneFor(generatedFor)
  const weekEnd = addDaysLabel(generatedFor, 6)

  return {
    source: 'social_content_calendar_template',
    templateKey: WARM_OUTREACH_CAMPAIGN_TEMPLATE_KEY,
    campaignTheme: WARM_OUTREACH_CAMPAIGN_TEMPLATE.label,
    currentPhase: current.campaign_phase,
    currentPhaseLabel: CAMPAIGN_PHASE_LABELS[current.campaign_phase],
    plannedWindowLabel: `${displayDateLabel(generatedFor)}-${displayDateLabel(weekEnd)}`,
    currentMilestoneKey: current.key,
    currentMilestoneChannel: current.channel,
    currentMilestoneTitle: current.planned_angle,
    nextMilestoneTitle: next?.planned_angle ?? null,
    approvalGates: current.approval_gates,
    whyThisBacklogIsNext:
      'The backlog turns the current campaign phase into relationship-specific Gmail draft candidates and manual social handoffs.',
    drillIn:
      `${WARM_OUTREACH_CAMPAIGN_TEMPLATE.description} Source: existing social content calendar template; outreach actions stay local and review-gated.`,
  }
}

function safeOutcomeFor(state: WarmOutreachPlanningBacklogState): string {
  if (state === 'ready_gmail_draft') {
    return 'Opens a review-only Gmail planning batch. Later draft-record creation is local and still cannot send Gmail.'
  }
  if (state === 'ready_manual_social') {
    return 'Opens manual handoff review in the existing workroom. No LinkedIn, Facebook, phone, or provider action runs.'
  }
  if (state === 'waiting_on_response') {
    return 'Keeps the contact in response review before any new outreach touchpoint is planned.'
  }
  if (state === 'sms_parked') {
    return 'Keeps SMS visible as parked until Telnyx/10DLC clears and a separate per-recipient gate exists.'
  }
  if (state === 'suppressed_blocked') {
    return 'Keeps the contact blocked until suppression or contact status is resolved.'
  }
  return 'Keeps the contact in relationship review before a draft or manual handoff is prepared.'
}

function executionFocusLabelFor(state: WarmOutreachPlanningBacklogState): string {
  if (state === 'ready_gmail_draft') return 'Gmail draft review is next'
  if (state === 'ready_manual_social') return 'Manual social handoff is next'
  if (state === 'waiting_on_response') return 'Response review is next'
  if (state === 'sms_parked') return 'SMS remains parked'
  if (state === 'suppressed_blocked') return 'Suppression review is next'
  return 'Relationship review is next'
}

function actionLabelFor(state: WarmOutreachPlanningBacklogState, enabled: boolean): string {
  if (!enabled) {
    if (state === 'waiting_on_response') return 'Review response state'
    if (state === 'sms_parked') return 'SMS parked'
    return 'Review blockers'
  }
  if (state === 'ready_manual_social') return 'Prepare manual handoff review'
  return 'Prepare Gmail review plan'
}

function whyThisCandidateIsNext(
  candidateState: WarmOutreachPlanningBacklogState,
  phaseLabel: string,
): string {
  if (candidateState === 'ready_gmail_draft') {
    return `${phaseLabel} campaign phase maps to a reviewed Gmail draft candidate.`
  }
  if (candidateState === 'ready_manual_social') {
    return `${phaseLabel} campaign angle is ready for a manual social handoff.`
  }
  if (candidateState === 'waiting_on_response') {
    return 'Prior outreach is waiting, so response review comes before new touchpoints.'
  }
  if (candidateState === 'sms_parked') {
    return 'SMS stays visible but parked until Telnyx approval and a separate send gate.'
  }
  if (candidateState === 'suppressed_blocked') {
    return 'Suppression or missing contact state must be resolved before outreach.'
  }
  return 'Relationship context needs review before this campaign angle becomes actionable.'
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function hasRelationshipText(lead: WarmOutreachShortlistLead): boolean {
  return Boolean(
    text(lead.message) ||
      text(lead.quick_wins) ||
      text(lead.full_report) ||
      text(lead.rep_pain_points),
  )
}

function latestDraft(lead: WarmOutreachShortlistLead) {
  return (lead.recent_email_drafts ?? [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
}

function sourceLabel(leadSource: string | null): string {
  return (leadSource ?? 'warm relationship')
    .replace(/^warm_/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function relationshipBasisFor(lead: WarmOutreachShortlistLead): string {
  if (lead.has_sales_conversation) return 'Sales or meeting context'
  if (lead.evidence_count > 0) return `${lead.evidence_count} evidence signal${lead.evidence_count === 1 ? '' : 's'}`
  if (hasRelationshipText(lead)) return 'Portfolio notes available'
  return sourceLabel(lead.lead_source)
}

function lastTouchFor(lead: WarmOutreachShortlistLead): WarmOutreachShortlistItem['lastTouch'] {
  const draft = latestDraft(lead)
  if (draft) {
    return {
      label: `Email ${draft.status.replace(/_/g, ' ')}`,
      iso: draft.created_at,
    }
  }
  if (lead.messages_count > 0) {
    return {
      label: `${lead.messages_count} outreach row${lead.messages_count === 1 ? '' : 's'}`,
      iso: null,
    }
  }
  return {
    label: 'No recorded touch',
    iso: lead.created_at,
  }
}

function buildBlockers(lead: WarmOutreachShortlistLead): Set<WarmOutreachShortlistBlockerKey> {
  const blockers = new Set<WarmOutreachShortlistBlockerKey>()
  const status = text(lead.outreach_status)?.toLowerCase()
  const draftStatus = text(latestDraft(lead)?.status)?.toLowerCase()
  const weakBasis =
    !lead.has_sales_conversation &&
    lead.evidence_count === 0 &&
    !hasRelationshipText(lead) &&
    (lead.lead_score ?? 0) < 70

  if (lead.do_not_contact || lead.removed_at || status === 'opted_out') blockers.add('suppression_risk')
  if (!text(lead.email)) blockers.add('missing_email')
  if (weakBasis) blockers.add('weak_relationship_basis')
  if (text(lead.email) && !draftStatus) blockers.add('provider_not_connected')
  if (lead.phone_number) blockers.add('sms_unavailable')
  if (draftStatus && (DRAFT_STATUSES.has(draftStatus) || APPROVAL_PENDING_STATUSES.has(draftStatus))) {
    blockers.add('approval_needed')
  }
  if (
    (draftStatus && SUBMITTED_STATUSES.has(draftStatus)) ||
    lead.messages_sent > 0
  ) {
    blockers.add('submitted_evidence_exists')
  }

  return blockers
}

function channelReadinessFor(lead: WarmOutreachShortlistLead): WarmOutreachShortlistItem['channelReadiness'] {
  const draft = latestDraft(lead)
  const draftStatus = text(draft?.status)?.toLowerCase()
  const gmailState: WarmOutreachShortlistItem['channelReadiness'][number]['state'] =
    !text(lead.email)
      ? 'unavailable'
      : draftStatus
        ? 'gated'
        : 'gated'

  return [
    {
      channel: 'gmail',
      label: text(lead.email) ? (draft ? `Gmail ${draft.status.replace(/_/g, ' ')}` : 'Gmail gated') : 'No email',
      state: gmailState,
    },
    {
      channel: 'linkedin',
      label: lead.linkedin_url ? 'LinkedIn manual' : 'LinkedIn missing',
      state: lead.linkedin_url ? 'manual' : 'unavailable',
    },
    {
      channel: 'facebook',
      label: lead.lead_source?.includes('facebook') ? 'Facebook manual' : 'Facebook not ready',
      state: lead.lead_source?.includes('facebook') ? 'manual' : 'unavailable',
    },
    {
      channel: 'phone',
      label: lead.phone_number ? 'Phone manual' : 'Phone missing',
      state: lead.phone_number ? 'manual' : 'unavailable',
    },
    {
      channel: 'sms',
      label: lead.phone_number ? 'SMS unavailable' : 'SMS not ready',
      state: 'unavailable',
    },
  ]
}

function ctaFor(
  lead: WarmOutreachShortlistLead,
  blockers: Set<WarmOutreachShortlistBlockerKey>,
): WarmOutreachShortlistItem['cta'] {
  const workroomHref = `/admin/outreach?tab=leads&filter=warm&id=${lead.id}&contactId=${lead.id}`
  const draft = latestDraft(lead)
  const draftStatus = text(draft?.status)?.toLowerCase()

  if (lead.has_reply) {
    return { key: 'handle_response', label: 'Handle response', href: `${workroomHref}#warm-response-lifecycle` }
  }
  if (blockers.has('suppression_risk') || blockers.has('missing_email') || blockers.has('weak_relationship_basis')) {
    return { key: 'resolve_blocker', label: 'Resolve blocker', href: workroomHref }
  }
  if (draftStatus && SUBMITTED_STATUSES.has(draftStatus)) {
    return { key: 'handle_response', label: 'Handle response', href: `${workroomHref}#warm-response-lifecycle` }
  }
  if (draftStatus && APPROVED_STATUSES.has(draftStatus)) {
    return { key: 'send_approved_gmail_draft', label: 'Open send gate', href: workroomHref }
  }
  if (draftStatus && (DRAFT_STATUSES.has(draftStatus) || APPROVAL_PENDING_STATUSES.has(draftStatus))) {
    return { key: 'request_approval', label: 'Request approval', href: workroomHref }
  }
  if (text(lead.email)) {
    return { key: 'generate_draft', label: 'Generate draft', href: workroomHref }
  }
  return { key: 'review_relationship_packet', label: 'Review packet', href: workroomHref }
}

function statusFor(
  lead: WarmOutreachShortlistLead,
  blockers: Set<WarmOutreachShortlistBlockerKey>,
): WarmOutreachShortlistItem['status'] {
  if (blockers.has('submitted_evidence_exists')) return 'submitted'
  if (blockers.has('suppression_risk') || blockers.has('missing_email') || blockers.has('weak_relationship_basis')) {
    return 'blocked'
  }
  if (blockers.size > 0) return 'needs_review'
  return lead.has_reply ? 'needs_review' : 'ready'
}

function priorityScoreFor(
  lead: WarmOutreachShortlistLead,
  blockers: Set<WarmOutreachShortlistBlockerKey>,
): number {
  let score = lead.lead_score ?? 45
  if (lead.has_reply) score += 45
  if (lead.has_sales_conversation) score += 25
  score += Math.min(lead.evidence_count, 5) * 6
  if (hasRelationshipText(lead)) score += 8
  if (text(lead.email)) score += 8
  if (latestDraft(lead)) score += 10
  if (blockers.has('approval_needed')) score += 12
  if (blockers.has('submitted_evidence_exists')) score -= 15
  if (blockers.has('missing_email')) score -= 20
  if (blockers.has('weak_relationship_basis')) score -= 25
  if (blockers.has('suppression_risk')) score -= 60
  return score
}

function recommendedNextAction(
  cta: WarmOutreachShortlistItem['cta'],
  blockers: Set<WarmOutreachShortlistBlockerKey>,
): string {
  if (cta.key === 'resolve_blocker') {
    return Array.from(blockers)
      .filter((key) => key !== 'sms_unavailable')
      .map((key) => BLOCKER_LABELS[key])[0] ?? 'Resolve blocker'
  }
  if (cta.key === 'request_approval') return 'Review draft and request approval'
  if (cta.key === 'send_approved_gmail_draft') return 'Open exact Gmail send gate'
  if (cta.key === 'handle_response') return 'Review response and follow-up state'
  if (cta.key === 'generate_draft') return 'Prepare an approval-gated draft'
  return 'Review relationship packet'
}

function responseStateFor(
  lead: WarmOutreachShortlistLead,
  item: Omit<WarmOutreachShortlistItem, 'priorityRank'>,
): WarmOutreachOfficeDigest['responseStates'][number] {
  const draftStatus = text(latestDraft(lead)?.status)?.toLowerCase()
  const hasSuppressionProposal =
    item.blockers.some((blocker) => blocker.key === 'suppression_risk') ||
    lead.outreach_status?.toLowerCase() === 'opted_out'
  const classification: WarmOutreachOfficeDigest['responseStates'][number]['classification'] =
    item.status === 'blocked'
      ? 'blocked'
      : lead.has_reply
        ? 'reply_detected'
        : (draftStatus && SUBMITTED_STATUSES.has(draftStatus)) || lead.messages_sent > 0
          ? 'sent_waiting'
          : draftStatus
            ? 'draft_ready'
            : 'no_response'
  const followUpDraftReadiness: WarmOutreachOfficeDigest['responseStates'][number]['followUpDraftReadiness'] =
    item.status === 'blocked'
      ? 'blocked'
      : lead.has_reply
        ? 'draft_ready'
        : draftStatus && APPROVED_STATUSES.has(draftStatus)
          ? 'approved'
          : draftStatus
            ? 'approval_needed'
            : 'not_started'

  return {
    contactId: item.contactId,
    contactName: item.contactName,
    status: item.status,
    classification,
    nextBestAction: item.recommendedNextAction,
    followUpDraftReadiness,
    suppressionProposalVisible: hasSuppressionProposal,
  }
}

function buildOfficeDigest(args: {
  generatedFor: string
  warmLeads: WarmOutreachShortlistLead[]
  items: Array<Omit<WarmOutreachShortlistItem, 'priorityRank'>>
}): WarmOutreachOfficeDigest {
  const rows = args.items.map((item) => {
    const lead = args.warmLeads.find((candidate) => candidate.id === item.contactId)
    return lead ? responseStateFor(lead, item) : null
  }).filter(Boolean) as WarmOutreachOfficeDigest['responseStates']
  const ctaItem =
    args.items.find((item) => item.cta.key === 'handle_response') ??
    args.items.find((item) => item.cta.key === 'request_approval') ??
    args.items.find((item) => item.cta.key === 'resolve_blocker') ??
    args.items.find((item) => item.cta.key === 'send_approved_gmail_draft') ??
    args.items.find((item) => item.cta.key === 'generate_draft') ??
    args.items[0] ??
    null

  return {
    version: 'warm-response-digest/v1',
    operatingWindowLabel: `Warm outreach planning window for ${args.generatedFor}`,
    counts: {
      drafted: args.warmLeads.filter((lead) => {
        const draftStatus = text(latestDraft(lead)?.status)?.toLowerCase()
        return Boolean(draftStatus && (DRAFT_STATUSES.has(draftStatus) || APPROVAL_PENDING_STATUSES.has(draftStatus)))
      }).length,
      approved: args.warmLeads.filter((lead) => {
        const draftStatus = text(latestDraft(lead)?.status)?.toLowerCase()
        return Boolean(draftStatus && APPROVED_STATUSES.has(draftStatus))
      }).length,
      sent: args.warmLeads.filter((lead) => {
        const draftStatus = text(latestDraft(lead)?.status)?.toLowerCase()
        return lead.messages_sent > 0 || Boolean(draftStatus && SUBMITTED_STATUSES.has(draftStatus))
      }).length,
      replied: args.warmLeads.filter((lead) => lead.has_reply).length,
      blocked: rows.filter((row) => row.status === 'blocked').length,
      needsVambah: rows.filter((row) => (
        row.status === 'blocked' ||
        row.status === 'needs_review' ||
        row.classification === 'reply_detected' ||
        row.followUpDraftReadiness === 'draft_ready' ||
        row.followUpDraftReadiness === 'approval_needed'
      )).length,
    },
    currentCta: ctaItem
      ? {
          key: ctaItem.cta.key,
          label: ctaItem.cta.label,
          contactId: ctaItem.contactId,
          contactName: ctaItem.contactName,
          enabled: true,
          reason: ctaItem.recommendedNextAction,
          href: ctaItem.cta.href,
        }
      : {
          key: 'none',
          label: 'No warm outreach action',
          contactId: null,
          contactName: null,
          enabled: false,
          reason: 'No warm contacts are visible in the current operating window.',
          href: null,
        },
    responseStates: rows,
    executionBoundary: {
      localRowsOnly: true,
      providerMonitoringEnabled: false,
      providerCallsEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      slackDispatchEnabled: false,
      externalRequests: [],
    },
  }
}

function planningBacklogCandidateFor(
  lead: WarmOutreachShortlistLead,
  item: Omit<WarmOutreachShortlistItem, 'priorityRank'>,
  campaignAlignment: WarmOutreachPlanningBacklog['campaignAlignment'],
): WarmOutreachPlanningBacklogCandidate {
  const status = text(lead.outreach_status)?.toLowerCase()
  const draftStatus = text(latestDraft(lead)?.status)?.toLowerCase()
  const suppressed =
    lead.do_not_contact ||
    Boolean(lead.removed_at) ||
    status === 'opted_out' ||
    status === 'unsubscribed'
  const missingEmail = !text(lead.email)
  const weakBasis = item.blockers.some((blocker) => blocker.key === 'weak_relationship_basis')
  const submitted =
    lead.messages_sent > 0 ||
    Boolean(draftStatus && SUBMITTED_STATUSES.has(draftStatus)) ||
    item.blockers.some((blocker) => blocker.key === 'submitted_evidence_exists')
  const replyDetected = lead.has_reply || status === 'replied'
  const existingDraft = Boolean(draftStatus && DRAFT_STATUSES.has(draftStatus))
  const approvalNeeded = Boolean(draftStatus && APPROVAL_PENDING_STATUSES.has(draftStatus))
  const approved = Boolean(draftStatus && APPROVED_STATUSES.has(draftStatus))
  const gmailReady =
    Boolean(text(lead.email)) &&
    !suppressed &&
    !weakBasis &&
    !submitted &&
    !replyDetected &&
    !existingDraft &&
    !approvalNeeded &&
    !approved
  const manualSocialReady =
    !gmailReady &&
    !suppressed &&
    !weakBasis &&
    !submitted &&
    !replyDetected &&
    Boolean(lead.linkedin_url || lead.lead_source?.includes('facebook') || lead.phone_number)
  const smsParked = Boolean(lead.phone_number)
  const states = new Set<WarmOutreachPlanningBacklogState>()

  if (suppressed || missingEmail && !manualSocialReady) states.add('suppressed_blocked')
  if (replyDetected || submitted) states.add('waiting_on_response')
  if (weakBasis) states.add('needs_relationship_review')
  if (gmailReady) states.add('ready_gmail_draft')
  if (manualSocialReady) states.add('ready_manual_social')
  if (smsParked) states.add('sms_parked')
  if (states.size === 0) states.add('needs_relationship_review')
  const primaryState = states.has('ready_gmail_draft')
    ? 'ready_gmail_draft'
    : states.has('ready_manual_social')
      ? 'ready_manual_social'
      : states.has('waiting_on_response')
        ? 'waiting_on_response'
        : states.has('needs_relationship_review')
          ? 'needs_relationship_review'
          : states.has('suppressed_blocked')
            ? 'suppressed_blocked'
            : 'sms_parked'

  const recommendedChannel: WarmOutreachPlanningBacklogCandidate['recommendedChannel'] =
    gmailReady || text(lead.email)
      ? 'gmail'
      : lead.linkedin_url
        ? 'linkedin'
        : lead.lead_source?.includes('facebook')
          ? 'facebook'
          : lead.phone_number
            ? 'phone_contact'
            : 'sms'
  const draftReadiness: WarmOutreachPlanningBacklogCandidate['draftReadiness'] =
    suppressed
      ? 'blocked'
      : replyDetected || submitted
        ? 'response_waiting'
        : weakBasis || missingEmail && !manualSocialReady
          ? 'relationship_review_needed'
          : approvalNeeded || approved
            ? 'approval_needed'
            : existingDraft
              ? 'existing_draft'
              : smsParked && !gmailReady && !manualSocialReady
                ? 'sms_parked'
                : 'ready_for_review_batch'
  const approvalState: WarmOutreachPlanningBacklogCandidate['approvalState'] =
    suppressed || weakBasis
      ? 'blocked'
      : submitted
        ? 'submitted_evidence_recorded'
        : approved
          ? 'approved'
          : approvalNeeded || existingDraft
            ? 'needs_approval'
            : 'not_requested'
  const responseStatus: WarmOutreachPlanningBacklogCandidate['responseStatus'] =
    suppressed
      ? 'blocked'
      : replyDetected
        ? 'reply_detected'
        : submitted
          ? 'waiting'
          : 'no_response'
  const blockers = [
    ...item.blockers
      .filter((blocker) => blocker.key !== 'provider_not_connected')
      .map((blocker) => blocker.label),
    ...(text(lead.email) ? [] : ['No Gmail address']),
    ...(smsParked ? ['SMS parked until Telnyx readiness clears'] : []),
  ]
  const batchEligible = gmailReady || manualSocialReady

  return {
    contactId: item.contactId,
    contactName: item.contactName,
    company: item.company,
    relationshipBasis: item.relationshipBasis,
    recommendedChannel,
    draftReadiness,
    approvalState,
    responseStatus,
    states: Array.from(states),
    blockers,
    batchEligible,
    nextActionLabel: batchEligible
      ? primaryState === 'ready_manual_social'
        ? 'Open manual handoff'
        : 'Open Gmail review path'
      : states.has('suppressed_blocked')
        ? 'Review suppression state'
        : responseStatus !== 'no_response'
        ? 'Review response state'
        : draftReadiness === 'relationship_review_needed'
          ? 'Review relationship basis'
          : 'Open contact review',
    ctaHref: item.cta.href,
    campaignAlignment: {
      phase: campaignAlignment.currentPhase,
      theme: campaignAlignment.currentMilestoneTitle,
      plannedWindowLabel: campaignAlignment.plannedWindowLabel,
      whyNext: whyThisCandidateIsNext(primaryState, campaignAlignment.currentPhaseLabel),
    },
    executionPath: {
      source: 'social_content_calendar_template',
      templateKey: WARM_OUTREACH_CAMPAIGN_TEMPLATE_KEY,
      milestoneKey: campaignAlignment.currentMilestoneKey,
      campaignChannel: campaignAlignment.currentMilestoneChannel,
      approvalGates: campaignAlignment.approvalGates,
      safeOutcome: safeOutcomeFor(primaryState),
    },
  }
}

function buildExecutionFocus(args: {
  selected: { state: WarmOutreachPlanningBacklogState; rows: WarmOutreachPlanningBacklogCandidate[] } | null
  batchContactIds: number[]
  campaignAlignment: WarmOutreachPlanningBacklog['campaignAlignment']
}): WarmOutreachPlanningBacklog['executionFocus'] {
  const focus = args.selected?.rows[0] ?? null
  if (!args.selected || !focus) return null

  const enabled = args.batchContactIds.length > 0
  return {
    state: args.selected.state,
    contactId: focus.contactId,
    contactName: focus.contactName,
    recommendedChannel: focus.recommendedChannel,
    label: executionFocusLabelFor(args.selected.state),
    actionLabel: actionLabelFor(args.selected.state, enabled),
    reason: focus.campaignAlignment.whyNext,
    safeOutcome: safeOutcomeFor(args.selected.state),
    href: focus.ctaHref,
    enabled,
    batchContactIds: args.batchContactIds,
    source: {
      templateKey: WARM_OUTREACH_CAMPAIGN_TEMPLATE_KEY,
      milestoneKey: args.campaignAlignment.currentMilestoneKey,
      campaignPhase: args.campaignAlignment.currentPhase,
      campaignChannel: args.campaignAlignment.currentMilestoneChannel,
      plannedWindowLabel: args.campaignAlignment.plannedWindowLabel,
      approvalGates: args.campaignAlignment.approvalGates,
    },
  }
}

function buildPlanningBacklog(args: {
  generatedFor: string
  items: Array<Omit<WarmOutreachShortlistItem, 'priorityRank'>>
  warmLeads: WarmOutreachShortlistLead[]
}): WarmOutreachPlanningBacklog {
  const campaignAlignment = buildCampaignAlignment(args.generatedFor)
  const candidates = args.items.map((item) => {
    const lead = args.warmLeads.find((candidate) => candidate.id === item.contactId)
    return lead ? planningBacklogCandidateFor(lead, item, campaignAlignment) : null
  }).filter(Boolean) as WarmOutreachPlanningBacklogCandidate[]
  const counts = Object.keys(PLANNING_BACKLOG_FILTER_LABELS).reduce((acc, key) => {
    const state = key as WarmOutreachPlanningBacklogState
    acc[state] = candidates.filter((candidate) => candidate.states.includes(state)).length
    return acc
  }, {} as Record<WarmOutreachPlanningBacklogState, number>)
  const readyGmail = candidates.filter((candidate) => candidate.states.includes('ready_gmail_draft') && candidate.batchEligible)
  const readyManual = candidates.filter((candidate) => candidate.states.includes('ready_manual_social') && candidate.batchEligible)
  const waiting = candidates.filter((candidate) => candidate.states.includes('waiting_on_response'))
  const blockers = candidates.filter((candidate) => candidate.states.includes('needs_relationship_review') || candidate.states.includes('suppressed_blocked'))
  const selected =
    readyGmail.length > 0
      ? { state: 'ready_gmail_draft' as const, rows: readyGmail }
      : readyManual.length > 0
        ? { state: 'ready_manual_social' as const, rows: readyManual }
        : waiting.length > 0
          ? { state: 'waiting_on_response' as const, rows: waiting }
          : blockers.length > 0
            ? { state: 'needs_relationship_review' as const, rows: blockers }
            : null
  const batchContactIds = selected?.rows
    .filter((candidate) => candidate.batchEligible)
    .slice(0, 8)
    .map((candidate) => candidate.contactId) ?? []
  const executionFocus = buildExecutionFocus({
    selected,
    batchContactIds,
    campaignAlignment,
  })

  return {
    version: 'warm-outreach-planning-backlog/v1',
    planningWindowLabel: `Warm outreach backlog for ${args.generatedFor}`,
    operatingWindow: {
      todayLabel: displayDateLabel(args.generatedFor),
      weekLabel: `${displayDateLabel(args.generatedFor)}-${displayDateLabel(addDaysLabel(args.generatedFor, 6))}`,
    },
    campaignAlignment,
    executionFocus,
    filterLabels: PLANNING_BACKLOG_FILTER_LABELS,
    counts,
    currentCta: selected && batchContactIds.length > 0
      ? {
          key: 'prepare_planning_review_batch',
          label: executionFocus?.actionLabel ?? `Plan review batch (${batchContactIds.length})`,
          enabled: true,
          reason: `${batchContactIds.length} ${PLANNING_BACKLOG_FILTER_LABELS[selected.state].toLowerCase()} contact${batchContactIds.length === 1 ? '' : 's'} ready. ${safeOutcomeFor(selected.state)}`,
          contactIds: batchContactIds,
          state: selected.state,
        }
      : selected?.state === 'waiting_on_response'
        ? {
            key: 'review_waiting_responses',
            label: 'Review waiting responses',
            enabled: false,
            reason: 'Responses need per-contact review before another batch is planned.',
            contactIds: [],
            state: selected.state,
          }
        : selected
          ? {
              key: 'review_relationship_blockers',
              label: 'Review relationship blockers',
              enabled: false,
              reason: 'No visible contact is ready for an internal review batch plan.',
              contactIds: [],
              state: selected.state,
            }
          : {
              key: 'none',
              label: 'No batch action',
              enabled: false,
              reason: 'No warm contacts are visible in the current filter.',
              contactIds: [],
              state: null,
            },
    candidates,
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
  }
}

export function buildWarmOutreachShortlist(
  leads: WarmOutreachShortlistLead[],
  options: { limit?: number; today?: string } = {},
): WarmOutreachShortlist {
  const warmLeads = leads.filter((lead) => isWarmLeadSource(lead.lead_source))
  const generatedFor = options.today ?? new Date().toISOString().slice(0, 10)
  const allItems = warmLeads
    .map((lead) => {
      const blockers = buildBlockers(lead)
      const cta = ctaFor(lead, blockers)
      return {
        contactId: lead.id,
        contactName: lead.name,
        company: lead.company,
        priorityScore: priorityScoreFor(lead, blockers),
        status: statusFor(lead, blockers),
        relationshipBasis: relationshipBasisFor(lead),
        lastTouch: lastTouchFor(lead),
        channelReadiness: channelReadinessFor(lead),
        recommendedNextAction: recommendedNextAction(cta, blockers),
        blockers: Array.from(blockers).map((key) => ({
          key,
          label: BLOCKER_LABELS[key],
        })),
        cta,
      } satisfies Omit<WarmOutreachShortlistItem, 'priorityRank'>
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.contactName.localeCompare(b.contactName))
  const items = allItems
    .slice(0, options.limit ?? 15)
    .map((item, index) => ({ ...item, priorityRank: index + 1 }))
  const planningBacklog = buildPlanningBacklog({
    generatedFor,
    warmLeads,
    items: allItems,
  })

  return {
    generatedFor,
    items,
    summary: {
      totalWarmLeads: warmLeads.length,
      readyCount: allItems.filter((item) => item.status === 'ready').length,
      blockedCount: allItems.filter((item) => item.status === 'blocked').length,
      submittedCount: allItems.filter((item) => item.status === 'submitted').length,
    },
    officeDigest: buildOfficeDigest({ generatedFor, warmLeads, items: allItems }),
    planningBacklog,
  }
}
