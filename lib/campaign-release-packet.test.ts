import { describe, expect, it } from 'vitest'
import { fixture } from './campaign-release-test-fixture'
import { assembleCampaignReleasePacket, releasePacketRequestSchema, verifyCampaignReleasePacket, type ReleasePacketRequest, type ReleaseSourceReader } from './campaign-release-packet'
import { campaignSourceFingerprint, releaseHash } from './campaign-release-manifest'

function sources() {
  const m = fixture(), { copy: _copy, source, ...binding } = m.actions[0], { actions: _actions, ...header } = m
  const request: ReleasePacketRequest = { ...header, selections: [{ ...binding, source: { table: source.table, id: source.id }, review: { sourceFingerprint: 'a'.repeat(64), contentHash: 'a'.repeat(64), accountId: binding.accountId, recipientHash: releaseHash(binding.recipients), expiresAt: binding.evidenceExpiresAt } }] }
  const rows: Record<string, Record<string, unknown> & { id: string }> = {
    [m.campaignId]: { id: m.campaignId, name: 'Synthetic campaign' },
    [source.id]: { id: source.id, campaign_id: m.campaignId, status: 'approved', platform: 'linkedin', post_text: 'Exact canonical copy.  ', hashtags: [], image_url: null },
  }
  const read: ReleaseSourceReader = async (_table, id) => { if (!rows[id]) throw new Error('Missing row'); return rows[id] }
  const refreshReview = () => {
    for (const s of request.selections) {
      const row = rows[s.source.id]
      const copy = s.source.table === 'outreach_queue' ? { title: row.subject, body: row.body, metadata: {} }
        : s.source.table === 'video_generation_jobs' ? { title: typeof row.title === 'string' ? row.title : '', body: row.script_text, metadata: Object.fromEntries(['avatar_id', 'voice_id', 'aspect_ratio', 'channel', 'script_source', 'target_type', 'target_id'].map(key => [key, typeof row[key] === 'string' ? row[key] : ''])) }
        : { title: s.provider === 'youtube' ? row.youtube_title : '', body: s.provider === 'youtube' ? row.youtube_description : row.post_text, metadata: { cta_text: '', cta_url: '', hashtags: JSON.stringify(row.hashtags ?? []) } }
      s.review = { sourceFingerprint: campaignSourceFingerprint(row), contentHash: releaseHash({ copy, assets: s.assets }), accountId: s.accountId, recipientHash: releaseHash(s.recipients), expiresAt: s.evidenceExpiresAt }
    }
  }
  refreshReview()
  return { request, rows, read, sourceId: source.id, refreshReview }
}
describe('canonical packet assembly', () => {
  it('assembles exact stored copy and binds campaign planning evidence into the approval hash', async () => {
    const x = sources(), input = releasePacketRequestSchema.parse(x.request)
    const packet = await assembleCampaignReleasePacket(input, x.read)
    expect(packet.manifest.actions[0].copy.body).toBe('Exact canonical copy.  ')
    expect(packet.manifestHash).toBe(releaseHash(packet.manifest))
    expect(packet.manifest.planningSources?.[0].table).toBe('attraction_campaigns')
    expect(Object.isFrozen(packet.manifest.actions[0].copy)).toBe(true)
    await verifyCampaignReleasePacket(packet, x.read)
    x.rows[x.request.campaignId].name = 'Changed'
    await expect(verifyCampaignReleasePacket(packet, x.read)).rejects.toThrow('changed')
  })
  it('rejects missing campaign linkage, unreviewed copy, and media substitution', async () => {
    const x = sources()
    delete x.rows[x.sourceId].campaign_id
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('campaign link')
    x.rows[x.sourceId].campaign_id = x.request.campaignId; x.rows[x.sourceId].status = 'draft'
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('review')
    x.rows[x.sourceId].status = 'approved'; x.rows[x.sourceId].image_url = 'reviewed.png'
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('Asset evidence')
  })
  it('uses the canonical calendar link and detects changed scheduling', async () => {
    const x = sources(), calendarId = '11111111-1111-4111-8111-000000000008'
    x.request.selections[0].calendarId = calendarId; delete x.rows[x.sourceId].campaign_id
    x.rows[calendarId] = { id: calendarId, campaign_id: x.request.campaignId, social_content_id: x.sourceId, scheduled_for: x.request.selections[0].scheduledFor }
    x.refreshReview()
    const packet = await assembleCampaignReleasePacket(x.request, x.read)
    expect(packet.manifest.planningSources).toHaveLength(2)
    x.rows[calendarId].scheduled_for = '2026-10-03T14:00:00Z'
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('schedule changed')
  })
  it('binds warm copy to the exact canonical recipient and excludes SMS', async () => {
    const x = sources(), s = x.request.selections[0], contactId = '11111111-1111-4111-8111-000000000009'
    x.request.class = 'relationship_outreach_batch'; s.provider = 'gmail'; s.operation = 'send'; s.expectedReceipt = 'gmail_message_id'; s.source.table = 'outreach_queue'
    s.recipients = [{ address: 'synthetic@example.invalid', consentEvidenceId: 'consent', suppressionEvidenceId: 'suppression' }]
    Object.assign(x.rows[x.sourceId], { channel: 'email', subject: 'Exact subject', body: 'Reviewed warm copy', contact_submission_id: contactId })
    x.rows[contactId] = { id: contactId, email: 'synthetic@example.invalid' }
    x.refreshReview()
    const packet = await assembleCampaignReleasePacket(x.request, x.read)
    expect(packet.manifest.actions[0].copy.title).toBe('Exact subject')
    expect(packet.manifest.planningSources?.some(p => p.table === 'contact_submissions')).toBe(true)
    x.rows[contactId].email = 'other@example.invalid'
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('Recipient')
    x.rows[x.sourceId].channel = 'sms'
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('SMS is parked')
  })
  it('requires the final YouTube asset and rejects already-submitted render jobs', async () => {
    const x = sources(), s = x.request.selections[0]
    s.provider = 'youtube'; Object.assign(x.rows[x.sourceId], { platform: 'youtube', youtube_title: 'Title', youtube_description: 'Description' })
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('final YouTube video')
    x.rows[x.sourceId].video_url = 'final.mp4'; s.assets = [{ ref: 'final.mp4', sha256: 'c'.repeat(64), privacyReviewId: 'review' }]
    x.refreshReview()
    expect((await assembleCampaignReleasePacket(x.request, x.read)).manifest.actions[0].copy.body).toBe('Description')
    s.provider = 'heygen'; s.operation = 'render'; s.expectedReceipt = 'heygen_video_id'; s.source.table = 'video_generation_jobs'; s.assets = []
    Object.assign(x.rows[x.sourceId], { script_text: 'Reviewed script', heygen_status: 'pending', heygen_video_id: 'already-submitted' })
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('reconcile existing jobs')
    x.rows[x.sourceId].heygen_video_id = null
    x.refreshReview()
    expect((await assembleCampaignReleasePacket(x.request, x.read)).manifest.actions[0].copy.body).toBe('Reviewed script')
  })
  it('does not accept caller-supplied copy or forged table names at the API boundary', () => {
    const x = sources()
    expect(releasePacketRequestSchema.safeParse({ ...x.request, selections: [{ ...x.request.selections[0], copy: { body: 'override' } }] }).success).toBe(false)
    expect(releasePacketRequestSchema.safeParse({ ...x.request, selections: [{ ...x.request.selections[0], source: { table: 'credentials', id: x.sourceId } }] }).success).toBe(false)
  })
})


describe('packet reconciliation guarantees', () => {
  it('requires source, content/assets, account, recipients and expiry to match reviewed bindings', async () => {
    for (const field of ['sourceFingerprint', 'contentHash', 'accountId', 'recipientHash', 'expiresAt'] as const) {
      const x = sources()
      x.request.selections[0].review[field] = field === 'expiresAt' ? '2026-10-05T00:00:00Z' : field === 'accountId' ? 'other-account' : 'e'.repeat(64)
      await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('review binding changed')
    }
    const x = sources()
    const { review: _review, ...selection } = x.request.selections[0]
    expect(releasePacketRequestSchema.safeParse({ ...x.request, selections: [selection] }).success).toBe(false)
    x.rows[x.sourceId].post_text = 'Changed after channel review'
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('review binding changed')
  })
  it('deep freezes the entire packet and owns all caller data', async () => {
    const x = sources(), packet = await assembleCampaignReleasePacket(x.request, x.read)
    expect(Object.isFrozen(packet)).toBe(true)
    expect(Object.isFrozen(packet.provenance)).toBe(true)
    expect(Object.isFrozen(packet.provenance[0])).toBe(true)
    expect(() => { packet.provenance[0].fingerprint = 'e'.repeat(64) }).toThrow()
    x.request.selections[0].accountId = 'changed'
    expect(packet.manifest.actions[0].accountId).not.toBe('changed')
    await verifyCampaignReleasePacket(packet, x.read)
  })
  it('gives equivalent selections the same packet hash in stable predecessor order', async () => {
    const x = sources(), first = x.request.selections[0]
    const second = structuredClone(first)
    second.id = '11111111-1111-4111-8111-000000000005'
    second.source.id = '11111111-1111-4111-8111-000000000006'
    second.dependsOn = [first.id]
    x.rows[second.source.id] = { ...x.rows[x.sourceId], id: second.source.id }
    x.request.selections.push(second); x.refreshReview()
    const one = await assembleCampaignReleasePacket(x.request, x.read)
    x.request.selections.reverse()
    const two = await assembleCampaignReleasePacket(x.request, x.read)
    expect(two).toEqual(one)
    expect(two.manifest.actions.map(a => a.id)).toEqual([first.id, second.id])
    x.request.selections[1].dependsOn = [second.id]
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('cyclic')
  })
})
