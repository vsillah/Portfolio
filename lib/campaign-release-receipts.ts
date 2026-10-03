import { freezeOwned, releaseHash, type CampaignReleaseAction } from './campaign-release-manifest'
import type { ActionReceipt } from './campaign-release-coordinator'

export type ReceiptTrust = 'synthetic' | 'locally_verified' | 'provider_accepted' | 'provider_confirmed' | 'rejected' | 'uncertain'
export type ReceiptContext = {
  releaseId: string; manifestHash: string; actionId: string; actionKey: string; contentHash: string
  provider: CampaignReleaseAction['provider']; accountId: string; receiptType: CampaignReleaseAction['expectedReceipt']
  attemptId: string; tryCount: number; predecessors: Record<string, string>
}
export type SandboxCallback = ReceiptContext & {
  callbackId: string; evidenceId: string; trust: ReceiptTrust; providerId: string; receivedAt: string; spentCents: number
}
export type VerifiedCampaignReceipt = Readonly<SandboxCallback & { verifierId: 'sandbox-fixture/v1'; mode: 'sandbox'; contextHash: string }>
const verified = new WeakSet<object>()
/** Verifiers own callback identity and transport authentication. Only this deterministic,
 * precommitted fixture double exists; it cannot authenticate a live provider callback. */
export interface CampaignReceiptVerifier {
  readonly mode: 'sandbox'
  verify(callback: unknown, context: ReceiptContext): VerifiedCampaignReceipt
}
export function sandboxReceiptVerifier(events: readonly SandboxCallback[]): CampaignReceiptVerifier {
  const fixtures = new Map<string, string>()
  for (const event of events) {
    if (fixtures.has(event.callbackId)) throw new Error('Duplicate fixture callback identity.')
    fixtures.set(event.callbackId, releaseHash(event))
  }
  return Object.freeze({ mode: 'sandbox' as const, verify(callback: unknown, context: ReceiptContext) {
    const event = structuredClone(callback) as SandboxCallback
    if (!event || fixtures.get(event.callbackId) !== releaseHash(event)) throw new Error('Untrusted callback identity.')
    for (const key of Object.keys(context) as Array<keyof ReceiptContext>) {
      if (releaseHash(event[key]) !== releaseHash(context[key])) throw new Error(`Callback ${key} mismatch.`)
    }
    if (!['synthetic', 'locally_verified', 'provider_accepted', 'provider_confirmed', 'rejected', 'uncertain'].includes(event.trust) || !event.callbackId.trim() || !event.evidenceId.trim() || !event.providerId.startsWith('sandbox:') || !Number.isFinite(Date.parse(event.receivedAt)) || !Number.isSafeInteger(event.spentCents) || event.spentCents < 0) throw new Error('Invalid sandbox evidence.')
    if (!['synthetic', 'provider_confirmed'].includes(event.trust) && event.spentCents !== 0) throw new Error('Unconfirmed evidence retains reservation.')
    const proof = freezeOwned({ ...event, verifierId: 'sandbox-fixture/v1' as const, mode: 'sandbox' as const, contextHash: releaseHash(context) })
    verified.add(proof)
    return proof
  } })
}
export function assertVerifiedCampaignReceipt(proof: VerifiedCampaignReceipt, context: ReceiptContext) {
  if (!verified.has(proof) || proof.contextHash !== releaseHash(context)) throw new Error('Verifier-owned exact-context proof required.')
}
/** No operation contract currently permits acceptance to mean completion. */
export function receiptCompletesSandboxStep(trust: ReceiptTrust): boolean {
  return trust === 'synthetic' || trust === 'provider_confirmed'
}
export function receiptDeliveryEligible(_trust: ReceiptTrust): false { return false }
export function qualifiedSyntheticReceipt(receipt: ActionReceipt): boolean {
  return receipt.trust === 'synthetic' && receipt.providerId.startsWith('synthetic:')
}
