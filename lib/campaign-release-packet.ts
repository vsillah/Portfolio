import { campaignSourceFingerprint, parseCampaignManifest, releaseHash, type CampaignReleaseAction, type CampaignReleaseManifest } from './campaign-release-manifest'

/** Read-only bridge from canonical planning rows. Review bindings are supplied by channel
 * review readers, never inferred from a generic approved status or a generated future asset. */
export type CampaignPacketPlan = Omit<CampaignReleaseAction, 'copy' | 'source'> & {
  source: { table: CampaignReleaseAction['source']['table']; id: string }
  review: { sourceFingerprint: string; contentHash: string; accountId: string; recipientHash: string; expiresAt: string }
}
export interface CampaignPacketReader {
  campaign(id: string): Promise<{ id: string; name: string }>
  planning?(table: CampaignReleaseAction['source']['table'], id: string): Promise<{ campaignId: string; scheduledFor: string }>
  source(table: CampaignReleaseAction['source']['table'], id: string): Promise<Record<string, unknown>>
}
function required(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing final ${field}; return to channel review.`)
  return value
}
function copyFrom(row: Record<string, unknown>, provider: CampaignReleaseAction['provider']): CampaignReleaseAction['copy'] {
  if (provider === 'gmail' || provider === 'manual_social') return { title: typeof row.subject === 'string' ? row.subject : '', body: required(row, 'body'), metadata: {} }
  if (provider === 'heygen') return { title: '', body: required(row, 'script_text'), metadata: {} }
  if (provider === 'youtube') return { title: required(row, 'youtube_title'), body: required(row, 'youtube_description'), metadata: {} }
  const parts = [required(row, 'post_text')]
  if (row.cta_text) parts.push(`\n${required(row, 'cta_text')}`)
  if (row.cta_url) parts.push(required(row, 'cta_url'))
  if (Array.isArray(row.hashtags) && row.hashtags.length) {
    if (!row.hashtags.every(tag => typeof tag === 'string')) throw new Error('Invalid source hashtags.')
    parts.push(`\n${row.hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ')}`)
  }
  return { title: '', body: parts.join('\n'), metadata: {} }
}
export async function assembleCampaignPacket(input: {
  manifest: Omit<CampaignReleaseManifest, 'actions' | 'objective'>; plans: CampaignPacketPlan[]; reader: CampaignPacketReader
}): Promise<CampaignReleaseManifest> {
  const campaign = await input.reader.campaign(input.manifest.campaignId)
  if (campaign.id !== input.manifest.campaignId) throw new Error('Campaign mismatch.')
  const actions = await Promise.all(input.plans.map(async plan => {
    const row = await input.reader.source(plan.source.table, plan.source.id)
    const planning = input.reader.planning ? await input.reader.planning(plan.source.table, plan.source.id) : { campaignId: row.campaign_id, scheduledFor: plan.scheduledFor }
    if (planning.scheduledFor !== plan.scheduledFor) throw new Error('Calendar timing changed; rebuild the packet.')
    if (row.id !== plan.source.id || planning.campaignId !== campaign.id) throw new Error('Source is not linked to this campaign.')
    const fingerprint = campaignSourceFingerprint(row), copy = copyFrom(row, plan.provider)
    if (fingerprint !== plan.review.sourceFingerprint || releaseHash({ copy, assets: plan.assets }) !== plan.review.contentHash
      || plan.accountId !== plan.review.accountId || releaseHash(plan.recipients) !== plan.review.recipientHash
      || plan.evidenceExpiresAt !== plan.review.expiresAt) throw new Error('Channel review binding changed; prepare a fresh review.')
    if (plan.provider === 'youtube' && (!plan.assets.length || !plan.assets.some(asset => asset.ref === row.video_url))) throw new Error('Review the final rendered YouTube asset first.')
    const { review: _review, ...action } = plan
    return { ...action, copy, source: { ...plan.source, fingerprint } }
  }))
  // Stable topological order gives equivalent source sets the same hash and visits predecessors first.
  const ordered: CampaignReleaseAction[] = [], pending = actions.sort((a, b) => a.id.localeCompare(b.id))
  while (pending.length) {
    const next = pending.findIndex(action => action.dependsOn.every(id => ordered.some(done => done.id === id)))
    if (next < 0) throw new Error('Missing or cyclic packet dependency.')
    ordered.push(pending.splice(next, 1)[0])
  }
  return parseCampaignManifest({ ...input.manifest, objective: campaign.name, actions: ordered })
}

/** Offline canonical export reader. Original rows stay byte-equivalent for fingerprinting;
 * campaign membership comes from the existing calendar linkage rather than invented queue fields. */
export function campaignPacketReaderFromSnapshot(input: {
  campaigns: Array<{ id: string; name: string }>
  calendar: Array<{ id: string; campaign_id: string | null; social_content_id: string | null; scheduled_for: string }>
  social: Record<string, unknown>[]; outreach: Record<string, unknown>[]; video: Record<string, unknown>[]
}): CampaignPacketReader {
  const snapshot = structuredClone(input)
  const source = async (table: CampaignReleaseAction['source']['table'], id: string) => {
    const rows = table === 'social_content_queue' ? snapshot.social : table === 'outreach_queue' ? snapshot.outreach : snapshot.video
    const matches = rows.filter(row => row.id === id)
    if (matches.length !== 1) throw new Error('Canonical source missing or ambiguous.')
    return structuredClone(matches[0])
  }
  return {
    async campaign(id) {
      const rows = snapshot.campaigns.filter(row => row.id === id)
      if (rows.length !== 1) throw new Error('Canonical campaign missing or ambiguous.')
      return structuredClone(rows[0])
    }, source,
    async planning(table, id) {
      const row = await source(table, id)
      let calendarId: unknown, socialId: unknown
      if (table === 'social_content_queue') socialId = id
      else if (table === 'outreach_queue') {
        const inputs = row.generation_inputs as { calendar_source?: { id?: string } } | null
        calendarId = inputs?.calendar_source?.id
      } else {
        const parents = snapshot.social.filter(social => {
          const context = social.rag_context as { social_video_production?: { version?: string; video_generation_job_id?: string } } | null
          return context?.social_video_production?.version === 'social_video_production_v1' && context.social_video_production.video_generation_job_id === id
        })
        if (parents.length !== 1) throw new Error('Video planning linkage missing or ambiguous.')
        socialId = parents[0].id
      }
      const links = snapshot.calendar.filter(item => calendarId ? item.id === calendarId : Boolean(socialId) && item.social_content_id === socialId)
      if (links.length !== 1 || !links[0].campaign_id) throw new Error('Canonical calendar linkage missing or ambiguous; return to planning.')
      return { campaignId: links[0].campaign_id, scheduledFor: links[0].scheduled_for }
    },
  }
}
