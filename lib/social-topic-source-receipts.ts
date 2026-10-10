import { createHash } from 'crypto'

export const SOCIAL_TOPIC_LIFECYCLE_STAGES = [
  'insight',
  'in_development',
  'preview_deployed',
  'production_deployed',
  'publicly_cataloged',
] as const

export type SocialTopicLifecycleStage = (typeof SOCIAL_TOPIC_LIFECYCLE_STAGES)[number]
export type SocialTopicReceiptPrivacy = 'public_safe' | 'client_safe_summary'

export type SocialTopicSourceProjection = {
  receipt_id: string
  source_group: string
  source_kind: string
  source_id: string
  product_identity: string
  lifecycle_stage: SocialTopicLifecycleStage
  label: string
  approved_summary: string
  approval_status: 'approved'
  privacy_classification: SocialTopicReceiptPrivacy
  provenance: string
  evidence_url: string | null
  summary_sha256: string
  approved_at: string
  approved_by: string
  observed_at: string
  raw_content_included: false
  metadata: Record<string, unknown>
}

const PRODUCT_ALIASES: Array<[RegExp, string]> = [
  [/\bdark[\s_-]*castle[\s_-]*chess\b/i, 'dark_castle_chess'],
  [/\baccelerated\b/i, 'accelerated'],
  [/\bagentified\b/i, 'agentified'],
  [/\breversr\b/i, 'reversr'],
  [/\bmentorri\b|\bmentor[\s_-]*ri\b/i, 'mentorri'],
  [/\bwealthscape\b/i, 'wealthscape'],
  [/\bkinflo\b/i, 'kinflo'],
]

function compact(value: unknown, max = 700) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length <= max ? text : `${text.slice(0, max - 3).trim()}...`
}

export function sanitizeApprovedSourceSummary(value: unknown) {
  return compact(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone redacted]')
    .replace(/\b(?:sk|pk|rk|ghp|github_pat|xox[baprs])[_-]?[-_A-Za-z0-9]{12,}\b/g, '[secret redacted]')
}

export function stableProductIdentity(...values: unknown[]) {
  const text = values.map((value) => compact(value, 240)).filter(Boolean).join(' ')
  for (const [pattern, identity] of PRODUCT_ALIASES) {
    if (pattern.test(text)) return identity
  }
  return text.toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'unassigned_product'
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function buildApprovedSourceProjection(input: {
  sourceGroup: string
  sourceKind: string
  sourceId: string
  productIdentity?: string
  lifecycleStage: SocialTopicLifecycleStage
  label: string
  approvedSummary: string
  privacyClassification: SocialTopicReceiptPrivacy
  provenance: string
  approvedAt: string
  approvedBy: string
  observedAt?: string
  evidenceUrl?: string | null
  metadata?: Record<string, unknown>
}): SocialTopicSourceProjection {
  const summary = sanitizeApprovedSourceSummary(input.approvedSummary)
  const productIdentity = stableProductIdentity(input.productIdentity, input.label, summary)
  if (!summary || !input.provenance.trim() || !input.approvedBy.trim()) {
    throw new Error('Approved summary, provenance, and reviewer are required for a source receipt.')
  }
  if (!Number.isFinite(Date.parse(input.approvedAt))) {
    throw new Error('A valid approval timestamp is required for a source receipt.')
  }
  const summaryHash = sha256(summary)
  return {
    receipt_id: `coverage:${sha256([
      input.sourceKind,
      input.sourceId,
      productIdentity,
      input.lifecycleStage,
      summaryHash,
    ].join('|')).slice(0, 32)}`,
    source_group: input.sourceGroup,
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    product_identity: productIdentity,
    lifecycle_stage: input.lifecycleStage,
    label: compact(input.label, 160),
    approved_summary: summary,
    approval_status: 'approved',
    privacy_classification: input.privacyClassification,
    provenance: compact(input.provenance, 500),
    evidence_url: input.evidenceUrl ?? null,
    summary_sha256: summaryHash,
    approved_at: input.approvedAt,
    approved_by: compact(input.approvedBy, 160),
    observed_at: input.observedAt && Number.isFinite(Date.parse(input.observedAt))
      ? input.observedAt
      : input.approvedAt,
    raw_content_included: false,
    metadata: input.metadata ?? {},
  }
}

export async function persistApprovedSourceProjections(projections: SocialTopicSourceProjection[]) {
  if (projections.length === 0) return []
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { data, error } = await supabaseAdmin
    .from('social_topic_source_receipts')
    .upsert(projections, { onConflict: 'receipt_id' })
    .select('*')
  if (error) throw new Error(`source_receipt_projection_failed:${error.message}`)
  return data ?? []
}
