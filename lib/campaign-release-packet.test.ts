import { describe, it, expect } from 'vitest'
import { assembleCampaignPacket, campaignPacketReaderFromSnapshot, type CampaignPacketPlan } from './campaign-release-packet'
import { fixture } from './campaign-release-test-fixture'
import { campaignSourceFingerprint, releaseHash } from './campaign-release-manifest'
function setup() {
  const { actions, objective: _objective, ...manifest } = fixture(), action = actions[0]
  const row = { id: action.source.id, campaign_id: manifest.campaignId, post_text: action.copy.body }
  const plan: CampaignPacketPlan = { ...action, review: { sourceFingerprint: campaignSourceFingerprint(row), contentHash: releaseHash({ copy: { ...action.copy, metadata: {} }, assets: action.assets }), accountId: action.accountId, recipientHash: releaseHash(action.recipients), expiresAt: action.evidenceExpiresAt } }
  const reader = { campaign: async () => ({ id: manifest.campaignId, name: 'Canonical campaign' }), source: async () => row }
  return { manifest, plans: [plan], reader, row }
}
describe('canonical immutable packet assembly', () => {
  it('owns and freezes source copy and review assets', async () => {
    const s = setup(), packet = await assembleCampaignPacket(s)
    s.row.post_text = 'Later edit'; s.plans[0].assets.push({ ref: 'later', sha256: 'b'.repeat(64), privacyReviewId: 'later' })
    expect(packet.actions[0].copy.body).toBe('Reviewed exact copy.')
    expect(packet.actions[0].assets).toHaveLength(0)
    expect(Object.isFrozen(packet.actions[0].copy)).toBe(true)
    expect(packet.objective).toBe('Canonical campaign')
  })
  it.each(['source', 'copy', 'account', 'recipients', 'evidence', 'campaign'])('rejects changed %s bindings', async field => {
    const s = setup()
    if (field === 'source') s.row.post_text = 'Changed'
    if (field === 'copy') s.plans[0].review.contentHash = '0'.repeat(64)
    if (field === 'account') s.plans[0].accountId = 'another'
    if (field === 'recipients') s.plans[0].review.recipientHash = '0'.repeat(64)
    if (field === 'evidence') s.plans[0].evidenceExpiresAt = '2026-10-03T23:00:00Z'
    if (field === 'campaign') s.row.campaign_id = 'another'
    await expect(assembleCampaignPacket(s)).rejects.toThrow()
  })
  it('rejects missing dependencies and unrendered YouTube assets', async () => {
    const s = setup(); s.plans[0].dependsOn = ['missing']
    await expect(assembleCampaignPacket(s)).rejects.toThrow('dependency')
    s.plans[0].dependsOn = []; s.plans[0].provider = 'youtube'
    await expect(assembleCampaignPacket(s)).rejects.toThrow('youtube_title')
  })
})

describe('existing canonical planning exports', () => {
  it('resolves social, warm calendar-source and video production links without changing source fingerprints', async () => {
    const social = { id: 'social', post_text: 'Final', rag_context: { social_video_production: { version: 'social_video_production_v1', video_generation_job_id: 'video' } } }
    const outreach = { id: 'warm', body: 'Reviewed', generation_inputs: { calendar_source: { id: 'calendar' } } }
    const reader = campaignPacketReaderFromSnapshot({ campaigns: [{ id: 'campaign', name: 'Workshop' }], calendar: [{ id: 'calendar', campaign_id: 'campaign', social_content_id: 'social', scheduled_for: '2026-10-03T12:00:00Z' }], social: [social], outreach: [outreach], video: [{ id: 'video', script_text: 'Reviewed script' }] })
    for (const [table, id] of [['social_content_queue', 'social'], ['outreach_queue', 'warm'], ['video_generation_jobs', 'video']] as const) {
      expect(await reader.planning!(table, id)).toEqual({ campaignId: 'campaign', scheduledFor: '2026-10-03T12:00:00Z' })
    }
    expect(campaignSourceFingerprint(await reader.source('social_content_queue', 'social'))).toBe(campaignSourceFingerprint(social))
    social.post_text = 'Later mutation'
    expect((await reader.source('social_content_queue', 'social')).post_text).toBe('Final')
  })
  it('refuses a missing canonical link instead of guessing campaign membership', async () => {
    const reader = campaignPacketReaderFromSnapshot({ campaigns: [], calendar: [], social: [], outreach: [{ id: 'warm' }], video: [] })
    await expect(reader.planning!('outreach_queue', 'warm')).rejects.toThrow('linkage')
  })
})
