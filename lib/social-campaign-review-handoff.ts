import { archiveId } from './video-media-url'
import { createHash } from 'node:crypto'
import { hasSocialCopyReleaseEvidence, prepareManualCopyUpdate, socialCopyVersion } from './social-copy-revision'
import { nextSocialReleaseVersion } from './social-release-safety'
import { reviewRecord as record, socialVideoAssetVersion } from './social-video-review'

type Row = Record<string, unknown> & { id: string; video_url?: unknown; rag_context?: unknown }
export function packetVersion(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)]))
    return v
  }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
export function campaignReviewPreview(current: Row, calendar: Row, work: Row) {
  const rag = record(current.rag_context), meta = record(work.metadata)
  const lane = record(record(meta.channel_lanes).linkedin), packet = record(lane.draft_packet)
  const source = record(packet.shared_source), fields = record(packet.fields)
  if (rag.calendar_item_id !== calendar.id || calendar.social_content_id !== current.id
    || !calendar.campaign_id || calendar.authorization_status !== 'authorized'
    || record(record(calendar.metadata).platform_draft_handoff).work_item_id !== work.id
    || work.source_type !== 'social_content_calendar_authorization' || meta.draft_handoff_only !== true
    || meta.social_content_id !== current.id || meta.calendar_item_id !== calendar.id || meta.campaign_id !== calendar.campaign_id
    || source.social_content_id !== current.id || source.work_item_id !== work.id || source.calendar_item_id !== calendar.id || source.campaign_id !== calendar.campaign_id
    || packet.channel !== 'linkedin' || lane.status !== 'approved' || packet.approval_status !== 'approved' || !packet.decided_at
    || record(packet.enrichment_receipt).status !== 'passed') throw new Error('Approve the linked LinkedIn campaign packet with passing enrichment before handoff.')
  if (typeof fields.post_text !== 'string' || !fields.post_text.trim() || !Array.isArray(fields.hashtags) || fields.hashtags.some(t => typeof t !== 'string')) throw new Error('The approved packet has incomplete copy fields.')
  const copy = { post_text: fields.post_text, cta_text: typeof fields.cta === 'string' ? fields.cta : null, cta_url: typeof fields.cta_url === 'string' ? fields.cta_url : null, hashtags: fields.hashtags }
  const receipt = record(rag.campaign_review_handoff)
  const version = packetVersion({ packet, work_id: work.id, calendar_id: calendar.id })
  const unchanged = receipt.packet_version === version
  const conflict = Boolean(receipt.copy_version && receipt.copy_version !== socialCopyVersion(current))
  return { packet, copy, packet_version: version, target_version: current.updated_at, source_work_item_id: work.id,
    state: conflict ? 'conflict' : unchanged ? 'synchronized' : 'ready',
    message: conflict ? 'Human copy edits differ from the last handoff. Keep those edits and reconcile against the campaign packet manually.' : unchanged ? 'This exact packet is already synchronized.' : 'Review the incoming copy below before replacing the linked draft. Copy and release approvals will need review.' }
}
export function prepareCampaignReviewHandoff(current: Row, preview: ReturnType<typeof campaignReviewPreview>, expectedPacket: unknown, expectedTarget: unknown, actor: string, now: string) {
  if (preview.state === 'conflict') throw new Error(preview.message)
  if (expectedPacket !== preview.packet_version) throw new Error('Campaign packet changed. Reload the handoff preview.')
  if (preview.state === 'synchronized') return null
  if (expectedTarget !== current.updated_at) throw new Error('Social Content changed. Reload and review the incoming copy again.')
  if (hasSocialCopyReleaseEvidence(current)) throw new Error('Resolve release or schedule evidence before handoff.')
  const patch = prepareManualCopyUpdate({ current, patch: { ...preview.copy, status: 'draft' }, expectedVersion: socialCopyVersion(current), actor, now })
  const rag = { ...record(current.rag_context), ...record(patch.rag_context) }
  return { ...patch, status: 'draft', reviewed_by: null, updated_at: nextSocialReleaseVersion(current.updated_at, Date.parse(now)), rag_context: {
    ...rag,
    section_gate_reviews: Object.fromEntries(Object.entries(record(rag.section_gate_reviews)).map(([key, value]) => [key, { ...record(value), status: 'pending', invalidation_reason: 'campaign_handoff', invalidated_at: now }])),
    campaign_review_handoff_history: [...(Array.isArray(rag.campaign_review_handoff_history) ? rag.campaign_review_handoff_history : []), ...(rag.campaign_review_handoff ? [rag.campaign_review_handoff] : [])],
    campaign_review_handoff: { packet_version: preview.packet_version, source_work_item_id: preview.source_work_item_id, packet: preview.packet, copy_version: socialCopyVersion({ ...current, ...patch }), synchronized_by: actor, synchronized_at: now, previous_copy: { post_text: current.post_text, cta_text: current.cta_text, cta_url: current.cta_url, hashtags: current.hashtags } },
    media_review: { ...record(rag.media_review), status: 'pending', invalidation_reason: 'campaign_handoff' },
    platform_submission_gate: { status: 'pending', invalidation_reason: 'campaign_handoff' },
  } }
}
export function prepareVideoAttachment(current: Row, job: Row, actor: string, now: string) {
  if (hasSocialCopyReleaseEvidence(current)) throw new Error('Resolve release or schedule evidence before replacing the video.')
  if (job.heygen_status !== 'completed' || job.deleted_at || !job.updated_at || typeof job.video_url !== 'string') throw new Error('Choose a completed, available Video Generation job.')
  if (!archiveId(job.video_url) || !/^[a-f0-9]{64}$/.test(String(job.media_version)) || job.media_blocker) throw new Error('This video needs a verified private archive before attachment. Open Video Generation to recover it.')
  const rag = record(current.rag_context)
  const asset = { job_id: job.id, job_version: job.media_version, url: job.video_url, thumbnail_url: job.thumbnail_url ?? null }
  if (socialVideoAssetVersion(current) === socialVideoAssetVersion({ video_url: job.video_url, rag_context: { reviewed_video_asset: asset } })) return null
  const gates = { ...record(rag.section_gate_reviews) }
  for (const key of ['visual_assets', 'asset_packet', 'privacy', 'linkedin_draft', 'platform_draft', 'submit']) gates[key] = { status: 'pending', invalidation_reason: 'video_replaced', invalidated_at: now }
  return { video_url: job.video_url, updated_at: nextSocialReleaseVersion(current.updated_at, Date.parse(now)), rag_context: { ...rag,
    reviewed_video_asset: { ...asset, attached_by: actor, attached_at: now },
    section_gate_reviews: gates, media_review: { status: 'pending', invalidation_reason: 'video_replaced' },
    platform_submission_gate: { status: 'pending', invalidation_reason: 'video_replaced' },
    linkedin_draft_handoff: null, platform_draft_handoff: null,
  } }
}
export function prepareMediaReview(current: Row, job: Row, expectedAsset: unknown, privacyConfirmed: unknown, actor: string, now: string) {
  if (hasSocialCopyReleaseEvidence(current)) throw new Error('Resolve release evidence before media review.')
  const version = socialVideoAssetVersion(current), asset = record(record(current.rag_context).reviewed_video_asset)
  if (!version || expectedAsset !== version || asset.job_id !== job.id || asset.job_version !== job.media_version || !archiveId(job.video_url) || Boolean(job.media_blocker) || asset.url !== job.video_url || job.heygen_status !== 'completed' || job.deleted_at) throw new Error('The rendered asset changed. Attach and review the current completed job again.')
  if (current.status !== 'approved' || privacyConfirmed !== true) throw new Error('Approve copy first, then confirm the rendered video, rights, and privacy review.')
  return { updated_at: nextSocialReleaseVersion(current.updated_at, Date.parse(now)), rag_context: { ...record(current.rag_context), media_review: { status: 'approved', asset_version: version, approved_by: actor, approved_at: now, privacy_confirmed: true }, platform_submission_gate: { status: 'pending' } } }
}
