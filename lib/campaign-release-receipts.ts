import type { ActionReceipt } from './campaign-release-coordinator'

export type ReceiptTrust = 'synthetic' | 'locally_verified' | 'provider_accepted' | 'provider_confirmed' | 'rejected' | 'uncertain'
export type QualifiedCampaignReceipt = ActionReceipt & { trust: ReceiptTrust }
/** Classification is evidence, never permission. Accepted only acknowledges a request;
 * locally verified only establishes local consistency. Neither proves delivery.
 * Phase 3 registers only a synthetic verifier. Provider labels cannot promote themselves. */
export function syntheticReceiptQualified(receipt: ActionReceipt): boolean {
  return receipt.trust === 'synthetic' && receipt.providerId.startsWith('synthetic:')
}
export function receiptDeliveryEligible(trust: ReceiptTrust): false {
  void trust
  return false // No certified provider verifier/adapter is registered.
}
