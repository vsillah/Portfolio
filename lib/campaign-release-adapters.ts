import type { CampaignReleaseAction } from './campaign-release-manifest'
import type { ActionReceipt } from './campaign-release-coordinator'

export type DeliveryFamily = 'social' | 'warm_outreach' | 'video_youtube' | 'gmail' | 'slack'
export interface DisabledCampaignAdapter {
  family: DeliveryFamily
  enabled: false
  preflight(): Promise<{ ready: false; reason: string }>
  execute(): Promise<never>
}
/** No activation flag, env override, transport, or credential import exists in this registry. */
export function campaignDeliveryAdapters(): Readonly<Record<DeliveryFamily, DisabledCampaignAdapter>> {
  return Object.freeze(Object.fromEntries((['social', 'warm_outreach', 'video_youtube', 'gmail', 'slack'] as const).map(family => [family, Object.freeze({
    family, enabled: false as const,
    preflight: async () => ({ ready: false as const, reason: 'Provider disabled. Captain certification required.' }),
    execute: async (): Promise<never> => { throw new Error('Provider disabled. No delivery attempted.') },
  })])) as Record<DeliveryFamily, DisabledCampaignAdapter>)
}
/** Pure receipt factory for local tests; never proof of provider delivery. */
export function syntheticCampaignReceipt(action: CampaignReleaseAction, identity: { deliveryKey: string; contentHash: string }, at: string): ActionReceipt {
  return { trust: 'synthetic', provider: action.provider, accountId: action.accountId, actionKey: identity.deliveryKey,
    contentHash: identity.contentHash, receiptType: action.expectedReceipt,
    providerId: `synthetic:${action.id}`, receivedAt: at }
}
