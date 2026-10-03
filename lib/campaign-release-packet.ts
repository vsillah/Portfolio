import { campaignSourceFingerprint, campaignReleaseActionSchema, campaignReleaseManifestSchema, parseCampaignManifest, releaseHash, freezeOwned, type CampaignReleaseAction, type CampaignReleaseManifest } from './campaign-release-manifest'
import { z } from 'zod'

type Row = Record<string, unknown> & { id: string }
export type ReleaseSourceReader = (table: 'attraction_campaigns' | 'social_content_calendar_items' | 'contact_submissions' | CampaignReleaseAction['source']['table'], id: string) => Promise<Row>
export type PacketSelection = Omit<CampaignReleaseAction, 'copy' | 'source'> & {
  source: Pick<CampaignReleaseAction['source'], 'table' | 'id'>
  review: { sourceFingerprint: string; contentHash: string; accountId: string; recipientHash: string; expiresAt: string }
  calendarId?: string
}
export type ReleasePacketRequest = Omit<CampaignReleaseManifest, 'actions' | 'planningSources'> & { selections: PacketSelection[] }
export const releasePacketRequestSchema = z.object(campaignReleaseManifestSchema.shape).omit({ actions: true, planningSources: true }).extend({
  selections: z.array(campaignReleaseActionSchema.omit({ copy: true, source: true }).extend({
    source: campaignReleaseActionSchema.shape.source.omit({ fingerprint: true }), calendarId: z.uuid().optional(),
    review: z.object({ sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      accountId: campaignReleaseActionSchema.shape.accountId, recipientHash: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: campaignReleaseActionSchema.shape.evidenceExpiresAt }).strict(),
  })).min(1).max(100),
}).strict()
export type CampaignReleasePacket = {
  manifest: CampaignReleaseManifest
  manifestHash: string
  provenance: Array<{ table: string; id: string; fingerprint: string }>
  packetHash: string
  providerExecutionEnabled: false
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing canonical ${field}.`)
  return value
}
/** Read-only assembly. Review bindings (accounts, asset digests, consent and ceilings) must
 * come from the channel's reviewed evidence. This function does not certify that evidence. */
export async function assembleCampaignReleasePacket(request: ReleasePacketRequest, read: ReleaseSourceReader): Promise<CampaignReleasePacket> {
  // Header refinements depend on assembled actions; validate the completed manifest below.
  request = releasePacketRequestSchema.parse(request)
  const campaign = await read('attraction_campaigns', request.campaignId)
  if (campaign.id !== request.campaignId) throw new Error('Campaign identity mismatch.')
  const provenance = [{ table: 'attraction_campaigns', id: campaign.id, fingerprint: campaignSourceFingerprint(campaign) }]
  const actions: CampaignReleaseAction[] = []
  for (const selection of request.selections) {
    const { calendarId, source, review, ...binding } = selection
    const row = await read(source.table, source.id)
    if (row.id !== source.id) throw new Error('Source identity mismatch.')
    if (calendarId) {
      const calendar = await read('social_content_calendar_items', calendarId)
      if (calendar.id !== calendarId || calendar.campaign_id !== campaign.id || calendar.social_content_id !== row.id || source.table !== 'social_content_queue') throw new Error('Calendar does not bind this campaign and source.')
      if (calendar.scheduled_for !== binding.scheduledFor) throw new Error('Calendar schedule changed.')
      provenance.push({ table: 'social_content_calendar_items', id: calendar.id, fingerprint: campaignSourceFingerprint(calendar) })
    } else if (row.campaign_id !== campaign.id && !(source.table === 'video_generation_jobs' && row.target_type === 'campaign' && row.target_id === campaign.id)) throw new Error('An explicit canonical campaign link is required.')
    let copy: CampaignReleaseAction['copy']
    if (source.table === 'social_content_queue') {
      if (row.status !== 'approved') throw new Error('Complete social content review first.')
      const platforms = Array.isArray(row.target_platforms) && row.target_platforms.length ? row.target_platforms : [row.platform]
      if (!platforms.includes(binding.provider)) throw new Error('Platform is not in the canonical plan.')
      copy = { title: binding.provider === 'youtube' ? text(row.youtube_title, 'YouTube title') : '',
        body: binding.provider === 'youtube' ? text(row.youtube_description, 'YouTube description') : text(row.post_text, 'post text'),
        metadata: { cta_text: typeof row.cta_text === 'string' ? row.cta_text : '', cta_url: typeof row.cta_url === 'string' ? row.cta_url : '', hashtags: JSON.stringify(row.hashtags ?? []) } }
      const media = [row.image_url, row.video_url, row.carousel_pdf_url, ...(Array.isArray(row.carousel_slide_urls) ? row.carousel_slide_urls : [])].filter((v): v is string => typeof v === 'string' && Boolean(v))
      if (binding.provider === 'youtube' && !row.video_url) throw new Error('Review the final YouTube video before assembly.')
      if (media.some(ref => !binding.assets.some(asset => asset.ref === ref)) || binding.assets.some(asset => !media.includes(asset.ref))) throw new Error('Asset evidence must match canonical media exactly.')
    } else if (source.table === 'outreach_queue') {
      if (row.status !== 'approved' || !['email', 'linkedin'].includes(String(row.channel))) throw new Error('Complete per-recipient channel review first. SMS is parked.')
      if ((row.channel === 'email') !== (binding.provider === 'gmail')) throw new Error('Outreach channel mismatch.')
      const contact = await read('contact_submissions', text(row.contact_submission_id, 'contact link'))
      const address = row.channel === 'email' ? contact.email : contact.linkedin_url
      if (contact.id !== row.contact_submission_id || binding.recipients.length !== 1 || binding.recipients[0].address !== address) throw new Error('Recipient differs from canonical contact evidence.')
      provenance.push({ table: 'contact_submissions', id: contact.id, fingerprint: campaignSourceFingerprint(contact) })
      if (binding.assets.length) throw new Error('Warm attachment planning is not supported; review a separate packet.')
      copy = { title: typeof row.subject === 'string' ? row.subject : '', body: text(row.body, 'outreach copy'), metadata: {} }
    } else {
      if (binding.provider !== 'heygen' || row.heygen_status !== 'pending' || row.heygen_video_id) throw new Error('Only unsubmitted render plans can be assembled; reconcile existing jobs.')
      if (binding.assets.length) throw new Error('Render inputs need canonical asset evidence before support can be enabled.')
      copy = { title: typeof row.title === 'string' ? row.title : '', body: text(row.script_text, 'video script'),
        metadata: Object.fromEntries(['avatar_id', 'voice_id', 'aspect_ratio', 'channel', 'script_source', 'target_type', 'target_id'].map(key => [key, typeof row[key] === 'string' ? row[key] as string : ''])) }
    }
    const fingerprint = campaignSourceFingerprint(row)
    if (fingerprint !== review.sourceFingerprint || releaseHash({ copy, assets: binding.assets }) !== review.contentHash
      || binding.accountId !== review.accountId || releaseHash(binding.recipients) !== review.recipientHash
      || binding.evidenceExpiresAt !== review.expiresAt) throw new Error('Channel review binding changed; prepare a fresh review.')
    provenance.push({ table: source.table, id: row.id, fingerprint })
    actions.push({ ...binding, source: { ...source, fingerprint }, copy })
  }
  // Normalize sets only during new packet assembly; existing manifests retain their exact hashes.
  const ordered: CampaignReleaseAction[] = []
  const pending = actions.map(action => ({ ...action, dependsOn: [...action.dependsOn].sort() })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  while (pending.length) {
    const next = pending.findIndex(action => action.dependsOn.every(id => ordered.some(done => done.id === id)))
    if (next < 0) throw new Error('Missing or cyclic packet dependency.')
    ordered.push(pending.splice(next, 1)[0])
  }
  const unique = new Map<string, typeof provenance[number]>()
  for (const source of provenance) {
    const key = `${source.table}:${source.id}`, previous = unique.get(key)
    if (previous && previous.fingerprint !== source.fingerprint) throw new Error('Planning evidence changed during assembly.')
    unique.set(key, source)
  }
  provenance.splice(0, provenance.length, ...[...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, source]) => source))
  const { selections: _selections, ...header } = request
  const manifest = parseCampaignManifest({ ...header, planningSources: provenance.filter(row => !['social_content_queue', 'outreach_queue', 'video_generation_jobs'].includes(row.table)), actions: ordered })
  const manifestHash = releaseHash(manifest)
  const packetHash = releaseHash({ manifestHash, provenance })
  return freezeOwned({ manifest, manifestHash, provenance, packetHash, providerExecutionEnabled: false as const })
}

/** Re-read every dependency, including campaign/calendar records, before storing or approving. */
export async function verifyCampaignReleasePacket(packet: CampaignReleasePacket, read: ReleaseSourceReader) {
  if (releaseHash(parseCampaignManifest(packet.manifest)) !== packet.manifestHash || releaseHash({ manifestHash: packet.manifestHash, provenance: packet.provenance }) !== packet.packetHash) throw new Error('Packet integrity failed.')
  for (const source of packet.provenance) {
    const row = await read(source.table as Parameters<ReleaseSourceReader>[0], source.id)
    if (row.id !== source.id || campaignSourceFingerprint(row) !== source.fingerprint) throw new Error('Canonical planning evidence changed. Assemble a fresh packet.')
  }
}
