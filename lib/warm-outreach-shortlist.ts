import { isWarmLeadSource } from './constants/lead-source'

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

export type WarmOutreachShortlist = {
  generatedFor: string
  items: WarmOutreachShortlistItem[]
  summary: {
    totalWarmLeads: number
    readyCount: number
    blockedCount: number
    submittedCount: number
  }
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

export function buildWarmOutreachShortlist(
  leads: WarmOutreachShortlistLead[],
  options: { limit?: number; today?: string } = {},
): WarmOutreachShortlist {
  const warmLeads = leads.filter((lead) => isWarmLeadSource(lead.lead_source))
  const items = warmLeads
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
    .slice(0, options.limit ?? 15)
    .map((item, index) => ({ ...item, priorityRank: index + 1 }))

  return {
    generatedFor: options.today ?? new Date().toISOString().slice(0, 10),
    items,
    summary: {
      totalWarmLeads: warmLeads.length,
      readyCount: items.filter((item) => item.status === 'ready').length,
      blockedCount: items.filter((item) => item.status === 'blocked').length,
      submittedCount: items.filter((item) => item.status === 'submitted').length,
    },
  }
}
