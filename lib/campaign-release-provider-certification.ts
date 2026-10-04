import { z } from 'zod'
import type { CampaignJournalRpc } from './campaign-release-durable-store'
import { campaignActionKeys, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import type { ExecutionAttempt } from './campaign-release-execution'
import { campaignCertificationContracts } from './campaign-release-certification'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
/** Reference identities are UUIDs, never credential values, paths, URLs or tokens.
 * Destination digest covers recipients, visibility and provider resource selection. */
export const certificationScopeSchema = z.object({
  provider: z.enum(['linkedin','instagram','facebook','x','tiktok','gmail','heygen','youtube','manual_social','sms']),
  operation: z.enum(['publish','send','render','manual_handoff','send_sms']),
  accountId: z.string().trim().min(1).max(2000), actionId: z.uuid(),
  releaseId: z.uuid(), manifestHash: digest, contentHash: digest,
  deliveryKey: z.string().regex(/^campaign-action:[a-f0-9]{64}$/),
  authorizationKey: z.string().regex(/^campaign-authorization:[a-f0-9]{64}$/),
  destinationDigest: digest, environment: z.enum(['local','staging','production']),
  credentialReferenceId: z.uuid(), credentialVersion: z.number().int().positive(),
  mode: z.enum(['no_delivery','controlled_delivery']),
  spendCapCents: z.number().int().nonnegative().max(1000000), currency: z.literal('USD'),
  receiptType: z.enum(['platform_post_id','gmail_message_id','heygen_video_id','manual_confirmation','sms_delivery_receipt']),
  verifierId: z.uuid(), verifierVersion: z.number().int().positive(),
}).strict().superRefine((scope, ctx) => {
  const contract = campaignCertificationContracts[scope.provider]
  if (scope.operation !== contract.operation || scope.receiptType !== contract.receipt)
    ctx.addIssue({ code: 'custom', message: 'Provider operation and receipt mismatch.' })
})
export type CertificationScope = z.infer<typeof certificationScopeSchema>
export type CertificationRuntime = Pick<CertificationScope, 'environment'|'credentialReferenceId'|'credentialVersion'|'mode'|'verifierId'|'verifierVersion'>
export function campaignCertificationScope(record: ReleaseRecord, actionId: string, runtime: CertificationRuntime): CertificationScope {
  const keys = campaignActionKeys(record.manifest, actionId)
  if (record.hash !== releaseHash(record.manifest)) throw new Error('Manifest identity mismatch.')
  const action = record.manifest.actions.find(a => a.id === actionId)!
  return certificationScopeSchema.parse({ ...runtime, ...keys, releaseId: record.manifest.releaseId,
    manifestHash: record.hash, actionId, provider: action.provider, operation: action.operation,
    accountId: action.accountId, destinationDigest: releaseHash({ recipients: action.recipients, metadata: action.copy.metadata }),
    spendCapCents: action.maxSpendCents, currency: 'USD', receiptType: action.expectedReceipt })
}
const inspectionSchema = z.object({
  protocol: z.literal('campaign-provider-certification/v1'), providerEnabled: z.literal(false),
  dispatched: z.literal(false), dispatchEligible: z.literal(false), certificationReady: z.boolean(),
  scopeDigest: digest, attemptId: z.uuid(), attemptVersion: z.number().int().positive(),
  checkedAt: z.iso.datetime({ offset: true }), blocker: z.string().min(1), nextAction: z.string().min(1),
  certificationId: z.uuid().nullable(), evidenceDigest: digest.nullable(),
}).strict()
export type CertificationInspection = z.infer<typeof inspectionSchema>
/** Fresh atomic inspection only. No receipt importer, credential lookup, provider
 * transport or issuer is exposed. A certificate is necessary, never a dispatch permit. */
export class CampaignProviderCertification {
  constructor(private readonly client: CampaignJournalRpc) {}
  async inspect(scope: CertificationScope, attempt: ExecutionAttempt): Promise<CertificationInspection> {
    const owned = certificationScopeSchema.parse(scope)
    if (attempt.releaseId !== owned.releaseId || attempt.actionId !== owned.actionId || attempt.manifestHash !== owned.manifestHash ||
      attempt.deliveryKey !== owned.deliveryKey || attempt.authorizationKey !== owned.authorizationKey || attempt.contentHash !== owned.contentHash ||
      !attempt.dispatchIntent?.atomicRequest) throw new Error('Exact atomic intent required.')
    let response
    try { response = await this.client.rpc('campaign_inspect_provider_certification', { request: {
      scope: owned, attemptId: attempt.id, intentId: attempt.dispatchIntent.id, owner: attempt.owner, expectedVersion: attempt.version,
    } }) } catch { throw new Error('Certification inspection unavailable. Providers remain disabled.') }
    if (response.error) throw new Error('Certification inspection refused. Providers remain disabled.')
    const result = inspectionSchema.safeParse(response.data)
    if (!result.success || result.data.scopeDigest !== releaseHash(owned) || result.data.attemptId !== attempt.id || result.data.attemptVersion !== attempt.version ||
      (result.data.certificationReady && (!result.data.certificationId || !result.data.evidenceDigest))) throw new Error('Ambiguous certification evidence. Providers remain disabled.')
    return result.data
  }
}
