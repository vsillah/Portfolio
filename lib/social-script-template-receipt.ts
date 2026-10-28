import { LONG_FORM_FRAMEWORK_LIBRARY, LONG_FORM_FRAMEWORK_LIBRARY_VERSION } from '@/lib/long-form-script-intelligence'

export const SOCIAL_SCRIPT_TEMPLATE_RECEIPT_VERSION = 'social-script-template-receipt/v1' as const
export const SOCIAL_SCRIPT_TEMPLATE = {
  id: 'amadutown-long-form-product-proof-v1',
  name: 'Product proof walkthrough',
  libraryVersion: LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
  beatIds: ['campaign-hook', 'campaign-open-loop', 'campaign-frame', 'campaign-proof', 'campaign-teaching-one', 'campaign-rehook-one', 'campaign-teaching-two', 'campaign-teaching-three', 'campaign-rehook-two', 'campaign-payoff', 'campaign-conclusion', 'campaign-cta'],
  ruleIds: LONG_FORM_FRAMEWORK_LIBRARY.rules.map((rule) => rule.id),
} as const

export type SocialScriptTemplateReceipt = {
  version: typeof SOCIAL_SCRIPT_TEMPLATE_RECEIPT_VERSION
  receipt_id: string
  status: 'passed' | 'blocked' | 'unscored'
  template_id: string
  template_name: string
  library_version: string
  content_id: string
  candidate_id: string
  content_version: string
  applied_beat_ids: string[]
  applied_rule_ids: string[]
  source_receipt_ids: string[]
  source_boundary: string
  originality_boundary: string
  evaluation: { status: 'passed' | 'blocked' | 'unscored'; approval_ready: boolean; receipt_id: string }
  observed_at: string
  fresh_until: string
}

export function inspectSocialScriptTemplateReceipt(input: {
  receipt: SocialScriptTemplateReceipt | null | undefined
  contentId: string
  candidateId: string
  contentVersion: string
  sourceReceiptId?: string
  now?: Date
}) {
  const receipt = input.receipt
  if (!receipt) return { ready: false, blockers: ['No script template recorded'] }
  const blockers: string[] = []
  if (!receipt.evaluation || !Array.isArray(receipt.applied_beat_ids) || !Array.isArray(receipt.applied_rule_ids) || !Array.isArray(receipt.source_receipt_ids) || typeof receipt.source_boundary !== 'string' || typeof receipt.originality_boundary !== 'string') return { ready: false, blockers: ['Script template receipt is incomplete.'] }
  if (receipt.version !== SOCIAL_SCRIPT_TEMPLATE_RECEIPT_VERSION || !receipt.receipt_id) blockers.push('Script template receipt version or ID is missing.')
  if (receipt.status !== 'passed' || receipt.evaluation.status !== 'passed' || !receipt.evaluation.approval_ready || !receipt.evaluation.receipt_id) blockers.push('Script template evaluation is not approval-ready.')
  if (receipt.template_id !== SOCIAL_SCRIPT_TEMPLATE.id || receipt.template_name !== SOCIAL_SCRIPT_TEMPLATE.name || receipt.library_version !== SOCIAL_SCRIPT_TEMPLATE.libraryVersion) blockers.push('Script template is missing, ambiguous, or does not match the canonical library version.')
  if (receipt.content_id !== input.contentId || receipt.candidate_id !== input.candidateId || receipt.content_version !== input.contentVersion) blockers.push('Script template is bound to another content, candidate, or version.')
  if (!receipt.observed_at || !Number.isFinite(Date.parse(receipt.observed_at)) || !receipt.fresh_until || !Number.isFinite(Date.parse(receipt.fresh_until)) || Date.parse(receipt.fresh_until) <= (input.now ?? new Date()).getTime()) blockers.push('Script template receipt is stale or has no valid freshness window.')
  if (!receipt.applied_beat_ids.length || new Set(receipt.applied_beat_ids).size !== receipt.applied_beat_ids.length) blockers.push('Script template beat mapping is incomplete or ambiguous.')
  if (SOCIAL_SCRIPT_TEMPLATE.ruleIds.some((id) => !receipt.applied_rule_ids.includes(id)) || receipt.applied_rule_ids.some((id) => !SOCIAL_SCRIPT_TEMPLATE.ruleIds.includes(id))) blockers.push('Script template rule mapping is incomplete or ambiguous.')
  if (!receipt.source_receipt_ids.length || !receipt.source_boundary.trim() || !receipt.originality_boundary.trim()) blockers.push('Script template source and originality boundaries are incomplete.')
  if (input.sourceReceiptId && !receipt.source_receipt_ids.includes(input.sourceReceiptId)) blockers.push('Script template does not cite the current framework source receipt.')
  return { ready: blockers.length === 0, blockers }
}
