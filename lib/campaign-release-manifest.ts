/** Server-side contract only. No database writes, Slack calls, or provider dispatch. */
import { createHash } from 'node:crypto'
import { z } from 'zod'

const text = z.string().trim().min(1).max(2000)
const identity = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const instant = z.string().datetime({ offset: true })
const platform = z.enum(['linkedin', 'youtube', 'instagram', 'facebook', 'x', 'tiktok', 'gmail', 'manual_social', 'telnyx', 'heygen'])
const actionSchema = z.strictObject({
  id: identity,
  operation: z.enum(['publish', 'send', 'manual_handoff', 'render']),
  platform,
  accountRef: text,
  sourceRef: text,
  sourceVersion: text,
  audience: text,
  recipientRef: text.nullable(),
  // Exact provider input, including metadata; adapters must not add material defaults.
  payload: z.strictObject({
    subject: z.string().max(1000),
    body: z.string().max(100000),
    metadata: z.record(z.string(), z.string().max(10000)),
    assets: z.array(z.strictObject({ ref: text, sha256: hash })).max(50),
  }),
  scheduledAt: instant,
  maxSpendCents: z.number().int().nonnegative().safe(),
  consentEvidenceRef: text,
  suppressionEvidenceRef: text,
  evidenceExpiresAt: instant,
  expectedReceipt: z.enum(['publication_id', 'message_id', 'render_id', 'manual_attestation']),
})

export const campaignReleaseManifestSchema = z.strictObject({
  schemaVersion: z.literal('campaign-release-v1'),
  id: identity,
  revision: z.number().int().positive().safe(),
  class: z.enum(['broadcast_release', 'relationship_outreach_batch']),
  campaignRef: text,
  objective: text,
  createdAt: instant,
  expiresAt: instant,
  currency: z.literal('USD'),
  maxSpendCents: z.number().int().nonnegative().safe(),
  stopConditions: z.array(text).min(1).max(50),
  actions: z.array(actionSchema).min(1).max(100),
}).superRefine((manifest, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message })
  const start = Date.parse(manifest.createdAt)
  const end = Date.parse(manifest.expiresAt)
  if (end <= start) issue('Expiration must follow creation')
  if (new Set(manifest.actions.map(a => a.id)).size !== manifest.actions.length) issue('Duplicate action IDs')
  if (manifest.actions.reduce((sum, a) => sum + a.maxSpendCents, 0) > manifest.maxSpendCents) issue('Action spend exceeds release cap')
  const targets = new Set<string>()
  for (const action of manifest.actions) {
    const at = Date.parse(action.scheduledAt)
    if (at < start || at >= end || Date.parse(action.evidenceExpiresAt) <= at) issue('Schedule must be within release and evidence windows')
    const relationship = ['gmail', 'manual_social', 'telnyx'].includes(action.platform)
    if (relationship !== (manifest.class === 'relationship_outreach_batch')) issue('Action belongs to a different manifest class')
    if (relationship !== Boolean(action.recipientRef)) issue('Relationship actions require an exact recipient; broadcasts cannot carry one')
    const expected = action.platform === 'heygen' ? ['render', 'render_id']
      : action.platform === 'manual_social' ? ['manual_handoff', 'manual_attestation']
        : relationship ? ['send', 'message_id'] : ['publish', 'publication_id']
    if (action.operation !== expected[0] || action.expectedReceipt !== expected[1]) issue('Operation and receipt do not match platform')
    // One execution per source/account/recipient in this release; separate campaigns need a shared ledger too.
    const target = JSON.stringify([action.platform, action.accountRef, action.sourceRef, action.recipientRef])
    if (targets.has(target)) issue('Duplicate delivery target')
    targets.add(target)
  }
})

export type CampaignReleaseManifest = z.infer<typeof campaignReleaseManifestSchema>
export type CampaignReleaseAction = CampaignReleaseManifest['actions'][number]
type Frozen<T> = T extends object ? { readonly [K in keyof T]: Frozen<T[K]> } : T
export type SealedCampaignRelease = Frozen<{ manifest: CampaignReleaseManifest; digest: string }>

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
function sha(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex') }
function freeze<T>(value: T): Frozen<T> {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value as Frozen<T>
}

/** Parses into an owned snapshot so later caller mutations cannot alter approved bytes. */
export function sealCampaignRelease(input: unknown): SealedCampaignRelease {
  const manifest = campaignReleaseManifestSchema.parse(input)
  return freeze({ manifest, digest: sha(manifest) })
}

export function campaignActionKeys(release: SealedCampaignRelease, actionId: string) {
  const action = release.manifest.actions.find(a => a.id === actionId)
  if (!action) throw new Error('Unknown release action')
  return {
    contentHash: sha(action.payload),
    idempotencyKey: `campaign:v1:${sha([release.digest, action.id])}`,
    // Stable across manifest revisions: restoring old copy must not replay an uncertain/successful delivery.
    deliveryKey: `campaign-delivery:v1:${sha([release.manifest.campaignRef, action.platform, action.accountRef, action.sourceRef, action.recipientRef])}`,
  }
}

export type CampaignDecision = 'approve' | 'request_revision' | 'hold' | 'emergency_stop'
export type CampaignReviewState = {
  digest: string
  status: 'pending' | 'approved' | 'revision_requested' | 'held' | 'stopped'
  actorRef: string | null
}

/** Caller must verify Slack signature/actor/source and persist this with CAS plus audit atomically. */
export function decideCampaignRelease(release: SealedCampaignRelease, state: CampaignReviewState,
  input: { digest: string; decision: CampaignDecision; actorRef: string; now: string }): CampaignReviewState {
  if (!input.actorRef.trim() || !Number.isFinite(Date.parse(input.now))) throw new Error('Invalid decision context')
  if (state.digest !== release.digest || input.digest !== release.digest) throw new Error('Manifest changed; fresh review required')
  if (state.status === 'stopped') return state
  if (input.decision === 'emergency_stop') return { digest: release.digest, status: 'stopped', actorRef: input.actorRef }
  if (Date.parse(input.now) < Date.parse(release.manifest.createdAt) || Date.parse(input.now) >= Date.parse(release.manifest.expiresAt)) throw new Error('Release outside approval window')
  const status = ({ approve: 'approved', request_revision: 'revision_requested', hold: 'held' } as const)[input.decision]
  if (!status) throw new Error('Unknown decision')
  if (state.status === status) return state
  if (input.decision === 'approve' && state.status !== 'pending') throw new Error('Fresh manifest revision required after hold or revision request')
  return { digest: release.digest, status, actorRef: input.actorRef }
}

export type CampaignActionEvidence = {
  state: 'untouched' | 'claimed' | 'uncertain' | 'confirmed' | 'failed_before_dispatch'
  providerReceiptId?: string
}

/** Planning predicate only: never a substitute for atomic claim, provider gates or receipt persistence. */
export function campaignActionBlockers(release: SealedCampaignRelease, review: CampaignReviewState,
  actionId: string, context: {
    now: string
    emergencyStopped: boolean
    providerGateSatisfied: boolean
    consentAndSuppressionCurrent: boolean
    reservedSpendCents: number
    evidence: CampaignActionEvidence
  }): string[] {
  const action = release.manifest.actions.find(a => a.id === actionId)
  if (!action) return ['unknown_action']
  const blockers: string[] = []
  const now = Date.parse(context.now)
  if (review.digest !== release.digest || review.status !== 'approved') blockers.push('exact_approval_required')
  if (context.emergencyStopped || review.status === 'stopped') blockers.push('emergency_stop')
  if (!Number.isFinite(now) || now < Date.parse(action.scheduledAt) || now >= Date.parse(release.manifest.expiresAt)) blockers.push('outside_execution_window')
  if (!context.consentAndSuppressionCurrent || now >= Date.parse(action.evidenceExpiresAt)) blockers.push('consent_or_suppression_gate')
  if (!context.providerGateSatisfied) blockers.push('provider_gate')
  if (action.platform === 'telnyx') blockers.push('sms_parked')
  if (!Number.isSafeInteger(context.reservedSpendCents) || context.reservedSpendCents < 0 ||
    context.reservedSpendCents + action.maxSpendCents > release.manifest.maxSpendCents) blockers.push('spend_cap')
  if (!['untouched', 'failed_before_dispatch'].includes(context.evidence.state) || context.evidence.providerReceiptId) blockers.push('reconciliation_required')
  return blockers
}
