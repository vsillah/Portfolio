import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { getInvitationDeliveryAdapter, ProviderDisabledDelivery, SyntheticInvitationDelivery } from './app-activation-delivery.server'
const fixture = { appKey: 'trumpet-trainer', adultEmail: 'adult@example.test', rawToken: 't'.repeat(43), expiresAt: new Date(Date.now() + 3600000).toISOString() }
describe('invitation delivery adapters', () => {
  it('defaults to disabled and requires two explicit switches for synthetic use', async () => {
    expect(getInvitationDeliveryAdapter({})).toBeInstanceOf(ProviderDisabledDelivery)
    expect(getInvitationDeliveryAdapter({ APP_ACTIVATION_DELIVERY_MODE: 'synthetic' })).toBeInstanceOf(ProviderDisabledDelivery)
    await expect(getInvitationDeliveryAdapter({}).deliver(fixture)).rejects.toThrow('disabled')
  })
  it('returns a synthetic receipt without token material and rejects real addresses', async () => {
    const adapter = getInvitationDeliveryAdapter({ NODE_ENV: 'development', APP_ACTIVATION_DELIVERY_MODE: 'synthetic', APP_ACTIVATION_SYNTHETIC_DELIVERY_ENABLED: 'true' })
    expect(adapter).toBeInstanceOf(SyntheticInvitationDelivery)
    const receipt = await adapter.deliver(fixture)
    expect(JSON.stringify(receipt)).not.toContain(fixture.rawToken)
    expect(JSON.stringify(receipt)).not.toContain(fixture.adultEmail)
    await expect(adapter.deliver({ ...fixture, adultEmail: 'adult@real.example' })).rejects.toThrow('fixture')
    expect(getInvitationDeliveryAdapter({ NODE_ENV: 'production', APP_ACTIVATION_DELIVERY_MODE: 'synthetic', APP_ACTIVATION_SYNTHETIC_DELIVERY_ENABLED: 'true' })).toBeInstanceOf(ProviderDisabledDelivery)
  })
})
