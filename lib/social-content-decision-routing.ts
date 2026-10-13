export const SOCIAL_CONTENT_INTERNAL_REVIEW_APPROVAL_TYPE = 'social_content_internal_review'

export const SOCIAL_CONTENT_CANONICAL_GATES = [
  'copy',
  'copy_review',
  'visual_review',
  'visual_assets',
  'asset_packet',
  'privacy',
  'platform_submission',
  'submit',
] as const

export type SocialContentCanonicalGate = (typeof SOCIAL_CONTENT_CANONICAL_GATES)[number]

type RecordValue = Record<string, unknown>

function recordValue(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isSocialContentCanonicalGate(value: unknown): value is SocialContentCanonicalGate {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CANONICAL_GATES.includes(value as SocialContentCanonicalGate)
}

export function socialContentGateStep(gate: string): 'copy' | 'visuals' | 'submit' {
  if (gate === 'copy' || gate === 'copy_review') return 'copy'
  if (gate === 'platform_submission' || gate === 'submit') return 'submit'
  return 'visuals'
}

export function socialContentGateAnchor(gate: string): string {
  if (gate === 'copy' || gate === 'copy_review') return 'social-copy-gate'
  if (gate === 'visual_review' || gate === 'visual_assets') return 'social-visual-assets-gate'
  if (gate === 'asset_packet' || gate === 'privacy') return 'social-asset-packet-gate'
  return 'social-platform-submission-gate'
}

export function socialContentCanonicalCommand(gate: string, decision: string): string | null {
  if (!isSocialContentCanonicalGate(gate)) return null
  if (!['approve', 'request_revision', 'hold'].includes(decision)) return null
  if (decision === 'hold') return `hold_${gate}`
  if (gate === 'copy' || gate === 'copy_review') {
    return decision === 'approve' ? 'approve_copy' : 'request_copy_revision'
  }
  if (gate === 'platform_submission' || gate === 'submit') {
    return decision === 'approve' ? 'approve_platform_submission' : 'request_platform_submission_revision'
  }
  return `${decision === 'approve' ? 'approve' : 'reject'}_${gate}`
}

export function socialContentDecisionHref(input: {
  contentId: string
  workItemId: string
  gate: string
}): string {
  const step = socialContentGateStep(input.gate)
  const anchor = socialContentGateAnchor(input.gate)
  const params = new URLSearchParams({
    step,
    review: 'mobile',
    proposal: input.workItemId,
  })
  return `/admin/social-content/${encodeURIComponent(input.contentId)}?${params.toString()}#${anchor}`
}

export function socialContentDecisionHrefFromApproval(input: {
  approvalType: unknown
  metadata: unknown
}): string | null {
  if (input.approvalType !== SOCIAL_CONTENT_INTERNAL_REVIEW_APPROVAL_TYPE) return null
  const metadata = recordValue(input.metadata)
  const packet = recordValue(metadata?.review_packet)
  const contentId = stringValue(packet?.content_id)
  const workItemId = stringValue(packet?.work_item_id)
  const gate = stringValue(packet?.current_gate)
  if (!contentId || !workItemId || !isSocialContentCanonicalGate(gate)) return null
  return socialContentDecisionHref({ contentId, workItemId, gate })
}

export function socialContentDecisionHrefFromWorkItem(input: {
  source_type: string | null
  source_id: string | null
  id: string
  metadata: Record<string, unknown>
}): string | null {
  if (input.source_type !== SOCIAL_CONTENT_INTERNAL_REVIEW_APPROVAL_TYPE || !input.source_id) return null
  const packet = recordValue(input.metadata.review_packet)
    ?? recordValue(input.metadata.mobile_decision_review)
  const gate = stringValue(packet?.current_gate) || stringValue(input.metadata.current_gate)
  if (!isSocialContentCanonicalGate(gate)) return null
  return socialContentDecisionHref({
    contentId: input.source_id,
    workItemId: input.id,
    gate,
  })
}

export function isBoundSocialContentDecisionRoute(input: {
  review: string | null
  proposal: string | null
  workItemId: string | null | undefined
}): boolean {
  return input.review === 'mobile'
    && Boolean(input.workItemId)
    && input.proposal === input.workItemId
}
