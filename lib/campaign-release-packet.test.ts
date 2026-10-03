import { describe, expect, it } from 'vitest'
import { fixture } from './campaign-release-test-fixture'
import { assembleCampaignReleasePacket, releasePacketRequestSchema, verifyCampaignReleasePacket, type ReleasePacketRequest, type ReleaseSourceReader } from './campaign-release-packet'
import { releaseHash } from './campaign-release-manifest'

function sources() {
  const m = fixture(), { copy: _copy, source, ...binding } = m.actions[0], { actions: _actions, ...header } = m
  const request: ReleasePacketRequest = { ...header, selections: [{ ...binding, source: { table: source.table, id: source.id } }] }
  const rows: Record<string, Record<string, unknown> & { id: string }> = {
    [m.campaignId]: { id: m.campaignId, name: 'Synthetic campaign' },
    [source.id]: { id: source.id, campaign_id: m.campaignId, status: 'approved', platform: 'linkedin', post_text: 'Exact canonical copy.  ', hashtags: [], image_url: null },
  }
  const read: ReleaseSourceReader = async (_table, id) => { if (!rows[id]) throw new Error('Missing row'); return rows[id] }
  return { request, rows, read, sourceId: source.id }
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
    expect((await assembleCampaignReleasePacket(x.request, x.read)).manifest.actions[0].copy.body).toBe('Description')
    s.provider = 'heygen'; s.operation = 'render'; s.expectedReceipt = 'heygen_video_id'; s.source.table = 'video_generation_jobs'; s.assets = []
    Object.assign(x.rows[x.sourceId], { script_text: 'Reviewed script', heygen_status: 'pending', heygen_video_id: 'already-submitted' })
    await expect(assembleCampaignReleasePacket(x.request, x.read)).rejects.toThrow('reconcile existing jobs')
    x.rows[x.sourceId].heygen_video_id = null
    expect((await assembleCampaignReleasePacket(x.request, x.read)).manifest.actions[0].copy.body).toBe('Reviewed script')
  })
  it('does not accept caller-supplied copy or forged table names at the API boundary', () => {
    const x = sources()
    expect(releasePacketRequestSchema.safeParse({ ...x.request, selections: [{ ...x.request.selections[0], copy: { body: 'override' } }] }).success).toBe(false)
    expect(releasePacketRequestSchema.safeParse({ ...x.request, selections: [{ ...x.request.selections[0], source: { table: 'credentials', id: x.sourceId } }] }).success).toBe(false)
  })
})
