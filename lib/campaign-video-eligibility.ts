import { archiveId } from './video-media-url'
import { campaignVideoScript, currentEditorialReceipt, editorialInputVersion, screenVideoEditorial, VIDEO_EDITORIAL_CRITERIA } from './video-editorial-quality'

type Row = { id?: unknown; rag_context?: unknown; voiceover_text?: unknown; [key: string]: unknown }
const record = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}
export const campaignChannel = (v: unknown) => v === 'linkedin_video' ? 'linkedin' : String(v || '')
export function campaignVideoContext(item: Row) {
  const rag = record(item.rag_context), handoff = record(rag.campaign_review_handoff)
  const packet = record(handoff.packet), source = record(packet.shared_source)
  const blockers: string[] = []
  if (!item.id || !source.campaign_id || !source.work_item_id || source.social_content_id !== item.id
    || source.calendar_item_id !== rag.calendar_item_id || handoff.source_work_item_id !== source.work_item_id
    || !handoff.packet_version || packet.approval_status !== 'approved')
    blockers.push('Synchronize the approved campaign packet with this Social Content item first.')
  if (item.status !== 'approved') blockers.push('Approve the saved copy before editorial production review.')
  const script = campaignVideoScript(item), screening = screenVideoEditorial(script)
  blockers.push(...screening.blockers)
  return { campaign_id: source.campaign_id, work_item_id: source.work_item_id, social_content_id: item.id,
    channel: campaignChannel(packet.channel), input_version: editorialInputVersion(item), script,
    screening, blockers, receipt: currentEditorialReceipt(item) }
}
export function prepareCampaignVideoEditorial(item: Row, input: Record<string, unknown>, actor: string, now: string) {
  const context = campaignVideoContext(item)
  if (context.blockers.length) throw new Error(context.blockers.join(' '))
  if (input.input_version !== context.input_version) throw new Error('Script, campaign packet, or assets changed. Reload editorial review.')
  if (!input.avatar_id || !input.voice_id) throw new Error('Choose an approved avatar and voice in Video Generation settings first.')
  if (!Object.keys(VIDEO_EDITORIAL_CRITERIA).every(key => record(input.checks)[key] === true)
    || typeof input.notes !== 'string' || input.notes.trim().length < 20)
    throw new Error('Review every production-quality criterion and record the supporting editorial evidence.')
  return { status: 'approved', input_version: context.input_version, reviewer: actor, reviewed_at: now,
    avatar_id: input.avatar_id, voice_id: input.voice_id, checks: input.checks, notes: input.notes.trim(),
    campaign_id: context.campaign_id, work_item_id: context.work_item_id, social_content_id: item.id,
    channel: context.channel, implementation: 'human_production_quality_review_v1' }
}
/** Only a successful, gated render may create this receipt. Never infer it from playback. */
export function campaignVideoRenderBinding(item: Row, jobId: string) {
  const c = campaignVideoContext(item)
  if (c.blockers.length || !c.receipt) throw new Error('Current campaign editorial and avatar receipts are required before rendering.')
  return { job_id: jobId, campaign_id: c.campaign_id, work_item_id: c.work_item_id, social_content_id: item.id,
    channel: c.channel, input_version: c.input_version, editorial_reviewed_at: c.receipt.reviewed_at,
    avatar_id: c.receipt.avatar_id, voice_id: c.receipt.voice_id }
}
export function campaignVideoEligibility(item: Row, job: Row) {
  const c = campaignVideoContext(item), blockers = [...c.blockers]
  const binding = record(record(record(item.rag_context).campaign_video_bindings)[String(job.id)])
  if (!binding.job_id || binding.job_id !== job.id || binding.campaign_id !== c.campaign_id
    || binding.work_item_id !== c.work_item_id || binding.social_content_id !== item.id
    || job.target_type !== 'campaign' || job.target_id !== c.campaign_id)
    blockers.push('History only: this render is not linked to this campaign, work item, and Social Content item.')
  if (!c.channel || campaignChannel(job.channel) !== c.channel || binding.channel !== c.channel)
    blockers.push('The video channel does not match the approved campaign channel.')
  if (!c.receipt || binding.editorial_reviewed_at !== c.receipt?.reviewed_at)
    blockers.push('A current production-quality challenger review is required; safety checks alone are insufficient.')
  if (job.script_text !== c.script || binding.input_version !== c.input_version)
    blockers.push('The approved script or asset packet changed; render and review the current version.')
  if (!job.avatar_id || !job.voice_id || job.avatar_id !== c.receipt?.avatar_id || job.voice_id !== c.receipt?.voice_id
    || binding.avatar_id !== job.avatar_id || binding.voice_id !== job.voice_id)
    blockers.push('The avatar and voice receipts do not match this render.')
  if (job.heygen_status !== 'completed' || job.deleted_at || !archiveId(job.video_url)
    || !/^[a-f0-9]{64}$/.test(String(job.media_version)) || job.media_blocker)
    blockers.push('A completed video with a verified current private archive is required.')
  return { eligible: blockers.length === 0, label: blockers.length ? 'Ineligible · history only' : 'Eligible for campaign review', blockers,
    input_version: c.input_version, editorial_reviewed_at: c.receipt?.reviewed_at ?? null }
}
