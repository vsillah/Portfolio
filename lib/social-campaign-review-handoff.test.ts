import { describe, it, expect } from 'vitest'
import { campaignReviewPreview, prepareCampaignReviewHandoff, prepareVideoAttachment, prepareMediaReview } from './social-campaign-review-handoff'
import { prepareManualCopyUpdate, socialCopyVersion } from './social-copy-revision'
import { socialVideoAssetVersion, socialVideoReviewReady, LINKEDIN_VIDEO_BLOCKER } from './social-video-review'
import { buildPlatformOrchestrationPlan } from './social-platform-orchestration'
export function fixture() {
  const item: any = { id: 'draft', status: 'draft', updated_at: '2026-10-06T00:00:00Z', post_text: 'Existing human copy', platform: 'linkedin', rag_context: { source: 'social_content_calendar_authorization', calendar_item_id: 'calendar' } }
  const calendar: any = { id: 'calendar', social_content_id: item.id, campaign_id: 'campaign', channel: 'linkedin', authorization_status: 'authorized', metadata: { platform_draft_handoff: { work_item_id: 'work' } } }
  const packet: any = { channel: 'linkedin', approval_status: 'approved', decided_at: '2026-10-06', shared_source: { social_content_id: 'draft', work_item_id: 'work', calendar_item_id: 'calendar', campaign_id: 'campaign' }, fields: { post_text: 'A reviewed workflow.', cta: 'Who reviews yours?', hashtags: ['#Workflow'], claim_boundaries: ['No outcome claims'] }, enrichment_receipt: { status: 'passed', voice: 'receipt', editorial: 'receipt' }, source_research_patterns: [{ id: 'evidence' }] }
  const work: any = { id: 'work', source_type: 'social_content_calendar_authorization', metadata: { draft_handoff_only: true, social_content_id: 'draft', calendar_item_id: 'calendar', campaign_id: 'campaign', channel_lanes: { linkedin: { status: 'approved', draft_packet: packet } } } }
  return { item, calendar, work, packet }
}
const now = '2026-10-07T00:00:00Z'
const job: any = { id: '11111111-1111-4111-8111-111111111111', updated_at: now, heygen_status: 'completed', video_url: 'https://example.invalid/final.mp4', thumbnail_url: null }
describe('campaign handoff', () => {
  it('preserves the whole approved packet and previous human copy, resets approval, and repeats without writes', () => {
    const f = fixture(), p = campaignReviewPreview(f.item, f.calendar, f.work)
    const patch = prepareCampaignReviewHandoff(f.item, p, p.packet_version, f.item.updated_at, 'admin', now)!
    const saved = { ...f.item, ...patch }
    expect(saved.rag_context.campaign_review_handoff.packet).toEqual(f.packet)
    expect(saved.rag_context.campaign_review_handoff.previous_copy.post_text).toBe('Existing human copy')
    expect(saved).toMatchObject({ status: 'draft', post_text: 'A reviewed workflow.', cta_text: 'Who reviews yours?' })
    const repeat = campaignReviewPreview(saved, f.calendar, f.work)
    expect(prepareCampaignReviewHandoff(saved, repeat, repeat.packet_version, 'old', 'admin', now)).toBeNull()
    saved.post_text = 'New human edit'
    expect(campaignReviewPreview(saved, f.calendar, f.work).state).toBe('conflict')
    expect(() => prepareCampaignReviewHandoff(saved, campaignReviewPreview(saved, f.calendar, f.work), p.packet_version, saved.updated_at, 'admin', now)).toThrow('Human copy edits')
  })
  it('rejects stale source and target versions, unapproved packets, and mismatched lineage', () => {
    const f = fixture(), p = campaignReviewPreview(f.item, f.calendar, f.work)
    expect(() => prepareCampaignReviewHandoff(f.item, p, 'old', f.item.updated_at, 'a', now)).toThrow('Campaign packet changed')
    expect(() => prepareCampaignReviewHandoff(f.item, p, p.packet_version, 'old', 'a', now)).toThrow('Social Content changed')
    f.packet.approval_status = 'in_review'
    expect(() => campaignReviewPreview(f.item, f.calendar, f.work)).toThrow()
    f.packet.approval_status = 'approved'; f.calendar.social_content_id = 'other'
    expect(() => campaignReviewPreview(f.item, f.calendar, f.work)).toThrow()
  })
})
describe('exact video review', () => {
  it('requires a completed job, copy approval, privacy attestation, and exact current job version', () => {
    const { item } = fixture()
    expect(() => prepareVideoAttachment(item, { ...job, heygen_status: 'processing' }, 'a', now)).toThrow()
    const attached = { ...item, ...prepareVideoAttachment(item, job, 'a', now) }
    expect(socialVideoReviewReady(attached)).toBe(false)
    const version = socialVideoAssetVersion(attached)
    expect(() => prepareMediaReview(attached, job, version, true, 'a', now)).toThrow('Approve copy first')
    attached.status = 'approved'
    expect(() => prepareMediaReview(attached, job, version, false, 'a', now)).toThrow()
    expect(() => prepareMediaReview(attached, { ...job, updated_at: 'new' }, version, true, 'a', now)).toThrow('asset changed')
    Object.assign(attached, prepareMediaReview(attached, job, version, true, 'a', now))
    expect(socialVideoReviewReady(attached)).toBe(true)
    expect(prepareVideoAttachment(attached, job, 'a', now)).toBeNull()
    const newVersion = { ...attached, ...prepareVideoAttachment(attached, { ...job, updated_at: '2026-10-08T00:00:00Z' }, 'a', now) }
    expect(socialVideoReviewReady(newVersion)).toBe(false)
    const replaced = { ...attached, ...prepareVideoAttachment(attached, { ...job, video_url: 'https://example.invalid/replacement.mp4' }, 'a', now) }
    expect(socialVideoReviewReady(replaced)).toBe(false)
    expect(replaced.rag_context.platform_submission_gate.status).toBe('pending')
  })
  it('protects server receipts from generic edits and invalidates media on copy edits', () => {
    const { item } = fixture()
    Object.assign(item, prepareVideoAttachment(item, job, 'a', now)); item.status = 'approved'
    Object.assign(item, prepareMediaReview(item, job, socialVideoAssetVersion(item), true, 'a', now))
    const p = prepareManualCopyUpdate({ current: item, patch: { rag_context: { media_review: { status: 'forged' }, reviewed_video_asset: {} } }, expectedVersion: socialCopyVersion(item), actor: 'a', now })
    expect((p.rag_context as any).media_review).toEqual(item.rag_context.media_review)
    const edit = prepareManualCopyUpdate({ current: item, patch: { post_text: 'Edited copy' }, expectedVersion: socialCopyVersion(item), actor: 'a', now })
    expect(socialVideoReviewReady({ ...item, ...edit })).toBe(false)
  })
  it('blocks native video even with all other gates and override inputs ready', () => {
    const { item } = fixture(); Object.assign(item, prepareVideoAttachment(item, job, 'a', now)); item.status = 'approved'
    const input = { item, targetPlatforms: ['linkedin'] as const, copyApproved: true, productionReady: true, redactionReady: true, draftHandoffReady: true, finalSubmissionGateReady: true }
    const plan = buildPlatformOrchestrationPlan({ ...input, targetPlatforms: ['linkedin'], platformAssetReadiness: { linkedin: { ready: true, detail: 'override' } } })
    expect(plan.platforms[0].stages.find(s => s.key === 'asset_readiness')?.state).toBe('blocked')
    Object.assign(item, prepareMediaReview(item, job, socialVideoAssetVersion(item), true, 'a', now))
    const ready = buildPlatformOrchestrationPlan({ ...input, targetPlatforms: ['linkedin'] })
    expect(ready.platforms[0].stages.find(s => s.key === 'platform_configuration')).toMatchObject({ state: 'blocked', detail: LINKEDIN_VIDEO_BLOCKER })
  })
})
