import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { assertCurrentCampaignSources } from './campaign-release-store'
import { campaignSourceFingerprint, releaseHash } from './campaign-release-manifest'
import { fixture } from './campaign-release-test-fixture'
describe('stored release planning evidence', () => {
  beforeEach(() => vi.clearAllMocks())
  it('checks both action and campaign planning fingerprints', async () => {
    const manifest = fixture(), source = { id: manifest.actions[0].source.id, post_text: 'Exact copy' }, campaign = { id: manifest.campaignId, name: 'Canonical campaign' }
    manifest.actions[0].source.fingerprint = campaignSourceFingerprint(source)
    manifest.planningSources = [{ table: 'attraction_campaigns', id: campaign.id, fingerprint: campaignSourceFingerprint(campaign) }]
    mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === 'attraction_campaigns' ? campaign : source, error: null }) }) }) }))
    await expect(assertCurrentCampaignSources(manifest)).resolves.toBeUndefined()
    expect(mocks.from).toHaveBeenCalledWith('attraction_campaigns')
    campaign.name = 'Changed planning'
    await expect(assertCurrentCampaignSources(manifest)).rejects.toThrow('Source changed')
  })
  it('keeps legacy packet hashes stable when planning sources are absent', () => {
    const manifest = fixture(), original = releaseHash(manifest)
    const roundtrip = JSON.parse(JSON.stringify(manifest))
    expect(releaseHash(roundtrip)).toBe(original)
    roundtrip.planningSources = [{ table: 'attraction_campaigns', id: manifest.campaignId, fingerprint: 'b'.repeat(64) }]
    expect(releaseHash(roundtrip)).not.toBe(original)
  })
})
