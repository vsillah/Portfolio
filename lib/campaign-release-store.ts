import { supabaseAdmin } from '@/lib/supabase'
import { campaignSourceFingerprint, decideCampaignRelease, parseCampaignManifest, releaseHash, type CampaignReleaseManifest, type ReleaseDecision, type ReleaseRecord } from './campaign-release-manifest'

export const CAMPAIGN_RELEASE_KIND = 'campaign_release_manifest'
const fields = 'id,metadata'
export async function assertCurrentCampaignSources(manifest: CampaignReleaseManifest) {
  if (!supabaseAdmin) throw new Error('Release database unavailable.')
  for (const action of manifest.actions) {
    const { data, error } = await supabaseAdmin.from(action.source.table).select('*').eq('id', action.source.id).single()
    if (error || !data || campaignSourceFingerprint(data) !== action.source.fingerprint) throw new Error('Source changed or unavailable. Prepare a new release.')
  }
}
function table() {
  if (!supabaseAdmin) throw new Error('Release database unavailable.')
  return supabaseAdmin.from('agent_runs')
}
export async function getCampaignRelease(id: string): Promise<ReleaseRecord> {
  const { data, error } = await table().select(fields).eq('kind', CAMPAIGN_RELEASE_KIND).eq('id', id).single()
  if (error || !data) throw new Error('Release unavailable.')
  const record = data.metadata as ReleaseRecord
  const manifest = parseCampaignManifest(record.manifest)
  if (releaseHash(manifest) !== record.hash) throw new Error('Release integrity check failed.')
  return { ...record, manifest }
}
export async function createCampaignRelease(value: unknown, actor: string): Promise<ReleaseRecord> {
  const manifest = parseCampaignManifest(value)
  const now = Date.now()
  if (Date.parse(manifest.expiresAt) <= now || Date.parse(manifest.createdAt) > now) throw new Error('Release is outside its authorization window.')
  await assertCurrentCampaignSources(manifest)
  const record: ReleaseRecord = { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] }
  const { error } = await table().insert({ id: manifest.releaseId, kind: CAMPAIGN_RELEASE_KIND,
    runtime: 'manual', title: 'Campaign release review', status: 'waiting_for_approval',
    subject_type: 'campaign', subject_id: manifest.campaignId, trigger_source: 'portfolio',
    current_step: 'Review exact manifest; provider execution unavailable',
    idempotency_key: `campaign-release:${manifest.releaseId}`, metadata: record,
    outcome: { createdBy: actor, providerExecutionEnabled: false } })
  if (error?.code === '23505') {
    const existing = await getCampaignRelease(manifest.releaseId)
    if (existing.hash === record.hash) return existing
    throw new Error('Release ID already belongs to different content. Use a new release ID.')
  }
  if (error) throw new Error('Release save unconfirmed.')
  return record
}
export async function decideStoredCampaignRelease(id: string, hash: string, decision: ReleaseDecision, actor: string): Promise<ReleaseRecord> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await getCampaignRelease(id)
    if (decision === 'approve') await assertCurrentCampaignSources(current.manifest)
    const next = decideCampaignRelease(current, hash, decision, actor)
    if (next === current) return current
    const { data, error } = await table().update({ metadata: next,
      status: next.state === 'stopped' ? 'cancelled' : 'waiting_for_approval',
      current_step: `${next.state}; provider execution unavailable` })
      .eq('id', id).eq('kind', CAMPAIGN_RELEASE_KIND)
      .eq('metadata->>hash', current.hash).eq('metadata->>version', String(current.version))
      .select('id').maybeSingle()
    if (error) throw new Error('Release decision unconfirmed. Reload before retrying.')
    if (data) return next
    // Re-read after a concurrent decision. A stop wins and cannot be approved over.
  }
  throw new Error('Release changed concurrently. Reload the current decision.')
}
