import { createHash } from 'node:crypto'
import { z } from 'zod'

const text = z.string().min(1).max(2000).refine(value => value.trim().length > 0, 'Nonblank text required')
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const instant = z.iso.datetime({ offset: true })
const actionSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(['linkedin', 'youtube', 'instagram', 'facebook', 'x', 'tiktok', 'gmail', 'heygen', 'manual_social']),
  operation: z.enum(['publish', 'send', 'render', 'manual_handoff']),
  accountId: text,
  source: z.object({ table: z.enum(['social_content_queue', 'outreach_queue', 'video_generation_jobs']), id: z.string().uuid(), fingerprint: hash }).strict(),
  copy: z.object({ title: z.string().max(500), body: z.string().max(50000), metadata: z.record(z.string(), z.string().max(10000)) }).strict(),
  assets: z.array(z.object({ ref: text, sha256: hash, privacyReviewId: text }).strict()).max(30),
  recipients: z.array(z.object({ address: text, consentEvidenceId: text, suppressionEvidenceId: text }).strict()).max(100),
  audience: text,
  scheduledFor: instant,
  evidenceExpiresAt: instant,
  maxSpendCents: z.number().int().nonnegative().max(1000000),
  expectedReceipt: z.enum(['platform_post_id', 'gmail_message_id', 'heygen_video_id', 'manual_confirmation']),
  dependsOn: z.array(z.string().uuid()).max(100),
}).strict()

export const campaignReleaseManifestSchema = z.object({
  schemaVersion: z.literal('campaign-release/v1'),
  releaseId: z.string().uuid(), campaignId: z.string().uuid(), revision: z.number().int().positive(),
  class: z.enum(['broadcast_release', 'relationship_outreach_batch']),
  objective: text, createdAt: instant, expiresAt: instant,
  currency: z.literal('USD'), spendCapCents: z.number().int().nonnegative().max(1000000),
  stopConditions: z.array(z.enum(['operator_stop', 'source_changed', 'consent_revoked', 'suppression_changed', 'provider_uncertain', 'budget_exceeded'])).min(6).max(6),
  actions: z.array(actionSchema).min(1).max(100),
}).strict().superRefine((manifest, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (Date.parse(manifest.expiresAt) <= Date.parse(manifest.createdAt)) fail('Expiration must follow creation.')
  if (new Set(manifest.stopConditions).size !== 6) fail('Every mandatory stop condition is required.')
  const ids = new Set(manifest.actions.map(action => action.id))
  if (ids.size !== manifest.actions.length) fail('Duplicate action ID.')
  const targets = new Set<string>()
  let spend = 0
  for (const action of manifest.actions) {
    const target = JSON.stringify([action.provider, action.accountId, action.source.table, action.source.id])
    if (targets.has(target)) fail('Duplicate source/account/provider action.')
    targets.add(target)
    spend += action.maxSpendCents
    if (Date.parse(action.scheduledFor) < Date.parse(manifest.createdAt) || Date.parse(action.scheduledFor) >= Date.parse(manifest.expiresAt)) fail('Schedule must fall inside the authorization window.')
    if (Date.parse(action.evidenceExpiresAt) <= Date.parse(action.scheduledFor)) fail('Evidence must remain current through the scheduled action.')
    const relationship = ['gmail', 'manual_social'].includes(action.provider)
    if ((manifest.class === 'relationship_outreach_batch') !== relationship) fail('Provider does not belong to this manifest class.')
    if (relationship && action.recipients.length !== 1) fail('Each relationship action must bind exactly one recipient.')
    if (!relationship && action.recipients.length) fail('Broadcast actions cannot contain outreach recipients.')
    const expected = action.provider === 'gmail' ? ['send', 'outreach_queue', 'gmail_message_id'] : action.provider === 'manual_social' ? ['manual_handoff', 'outreach_queue', 'manual_confirmation'] : action.provider === 'heygen' ? ['render', 'video_generation_jobs', 'heygen_video_id'] : ['publish', 'social_content_queue', 'platform_post_id']
    if (action.operation !== expected[0] || action.source.table !== expected[1] || action.expectedReceipt !== expected[2]) fail('Provider, operation, source, and receipt must agree.')
    if (action.dependsOn.some(id => !ids.has(id) || id === action.id) || new Set(action.dependsOn).size !== action.dependsOn.length) fail('Invalid action dependency.')
  }
  if (spend > manifest.spendCapCents) fail('Action spending exceeds the release cap.')
  const visited = new Set<string>(), visiting = new Set<string>()
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false
    if (visited.has(id)) return true
    visiting.add(id)
    for (const dep of manifest.actions.find(action => action.id === id)?.dependsOn ?? []) if (!visit(dep)) return false
    visiting.delete(id); visited.add(id); return true
  }
  if (manifest.actions.some(action => !visit(action.id))) fail('Action dependencies contain a cycle.')
})

export type CampaignReleaseManifest = z.infer<typeof campaignReleaseManifestSchema>
export type CampaignReleaseAction = CampaignReleaseManifest['actions'][number]
export function canonicalReleaseValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalReleaseValue).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, val]) => `${JSON.stringify(key)}:${canonicalReleaseValue(val)}`).join(',')}}`
  return JSON.stringify(value)
}
export function releaseHash(value: unknown): string { return createHash('sha256').update(canonicalReleaseValue(value)).digest('hex') }
export function campaignSourceFingerprint(row: Record<string, unknown>): string {
  const { updated_at: _updated, ...source } = row
  return releaseHash(source)
}
function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeOwned)
    Object.freeze(value)
  }
  return value
}
/** Zod owns the parsed copy; freezing every nested value prevents adapter/caller mutation. */
export function parseCampaignManifest(value: unknown): CampaignReleaseManifest {
  return freezeOwned(campaignReleaseManifestSchema.parse(value))
}
export function campaignActionKeys(manifest: CampaignReleaseManifest, actionId: string) {
  const snapshot = parseCampaignManifest(manifest)
  const action = snapshot.actions.find(candidate => candidate.id === actionId)
  if (!action) throw new Error('Unknown release action.')
  return {
    contentHash: releaseHash({ copy: action.copy, assets: action.assets }),
    authorizationKey: `campaign-authorization:${releaseHash([releaseHash(snapshot), action.id])}`,
    deliveryKey: actionIdempotencyKey(action),
  }
}
export function actionIdempotencyKey(action: CampaignReleaseAction): string {
  // Legacy name: this is the stable delivery key, NOT revision-bound authorization.
  // Independent of release ID: repackaging an already submitted action cannot send it twice.
  return `campaign-action:${releaseHash({ provider: action.provider, accountId: action.accountId,
    source: { table: action.source.table, id: action.source.id }, operation: action.operation,
    recipients: action.recipients.map(recipient => recipient.address.trim().toLowerCase()).sort() })}`
}

export type ReleaseDecision = 'approve' | 'revise' | 'hold' | 'stop'
export type ReleaseState = 'pending' | 'approved' | 'revision_requested' | 'held' | 'stopped'
export type ReleaseRecord = { manifest: CampaignReleaseManifest; hash: string; state: ReleaseState; version: number; audit: Array<{ decision: ReleaseDecision; actor: string; at: string; hash: string }> }
export function decideCampaignRelease(record: ReleaseRecord, expectedHash: string, decision: ReleaseDecision, actor: string, now = new Date()): ReleaseRecord {
  const manifest = parseCampaignManifest(record.manifest)
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid decision time.')
  if (!['approve', 'revise', 'hold', 'stop'].includes(decision)) throw new Error('Unknown release decision.')
  if (!actor.trim()) throw new Error('An authenticated actor is required.')
  if (expectedHash !== record.hash || releaseHash(manifest) !== record.hash) throw new Error('Manifest changed. Review a new release.')
  if (record.state === 'stopped') {
    if (decision === 'stop') return record
    throw new Error('Stopped releases cannot resume. Prepare a new release.')
  }
  if (decision === 'approve' && (Date.parse(manifest.expiresAt) <= now.getTime() || Date.parse(manifest.createdAt) > now.getTime())) throw new Error('Manifest is outside its authorization window.')
  if (decision === 'approve' && manifest.actions.some(action => Date.parse(action.evidenceExpiresAt) <= now.getTime())) throw new Error('Evidence expired. Prepare a new release.')
  const state = ({ approve: 'approved', revise: 'revision_requested', hold: 'held', stop: 'stopped' } as const)[decision]
  if (record.state === state) return record
  if (decision === 'approve' && record.state !== 'pending') throw new Error('Prepare a fresh release after hold or revision.')
  return { ...record, manifest, state, version: record.version + 1, audit: [...record.audit, { decision, actor, at: now.toISOString(), hash: record.hash }] }
}
