import { beforeEach, describe, expect, it } from 'vitest'
import { campaignVideoEligibility, prepareCampaignVideoEditorial } from './campaign-video-eligibility'
import { currentEditorialReceipt, editorialInputVersion, screenVideoEditorial, VIDEO_EDITORIAL_CRITERIA } from './video-editorial-quality'
import { prepareMediaReview, prepareVideoAttachment } from './social-campaign-review-handoff'
import { prepareManualCopyUpdate, socialCopyVersion } from './social-copy-revision'
import { socialVideoAssetVersion, socialVideoReviewReady } from './social-video-review'
import { reset, tables } from '../scripts/qa/campaign-video-fixture'
beforeEach(reset)
const current = () => ({ item: tables.social_content_queue[0], job: { ...tables.video_generation_jobs[0], media_version: 'a'.repeat(64) } })
describe('campaign video eligibility', () => {
  it('allows exact eligible attachment and media review, with idempotent attachment', () => {
    const { item, job } = current()
    expect(campaignVideoEligibility(item, job).eligible).toBe(true)
    Object.assign(item, prepareVideoAttachment(item, job, 'admin', '2026-10-07T01:00:00Z'))
    expect(socialVideoReviewReady(item)).toBe(false)
    Object.assign(item, prepareMediaReview(item, job, socialVideoAssetVersion(item), true, 'admin', '2026-10-07T02:00:00Z'))
    expect(socialVideoReviewReady(item)).toBe(true)
    expect(prepareVideoAttachment(item, job, 'admin', '2026-10-07T03:00:00Z')).toBeNull()
  })
  it.each(['legacy', 'stale-script', 'wrong-channel', 'failed-editorial', 'changed-asset', 'wrong-avatar', 'wrong-campaign', 'wrong-work-item'])('fails closed for %s and rejects direct attachment calls', state => {
    const { item, job } = current()
    if (state === 'legacy') item.rag_context.campaign_video_bindings = {}
    if (state === 'stale-script') job.script_text += ' Old script.'
    if (state === 'wrong-channel') job.channel = 'youtube'
    if (state === 'failed-editorial') item.rag_context.campaign_video_editorial.checks.narrative_coherence = false
    if (state === 'changed-asset') item.rag_context.production_assets.broll.assets[0].version = 'v2'
    if (state === 'wrong-avatar') job.avatar_id = 'other'
    if (state === 'wrong-campaign') job.target_id = 'other'
    if (state === 'wrong-work-item') item.rag_context.campaign_video_bindings[job.id].work_item_id = 'other'
    expect(campaignVideoEligibility(item, job).eligible).toBe(false)
    expect(() => prepareVideoAttachment(item, job, 'admin', '2026-10-07')).toThrow()
  })
  it('invalidates editorial and media review when script or production assets change', () => {
    const { item, job } = current()
    Object.assign(item, prepareVideoAttachment(item, job, 'admin', '2026-10-07'))
    Object.assign(item, prepareMediaReview(item, job, socialVideoAssetVersion(item), true, 'admin', '2026-10-07'))
    item.rag_context.production_assets.video_script.script_text += ' A changed ending.'
    expect(currentEditorialReceipt(item)).toBeNull()
    expect(socialVideoReviewReady(item)).toBe(false)
    expect(() => prepareMediaReview(item, job, socialVideoAssetVersion(item), true, 'admin', '2026-10-07')).toThrow()
  })
  it('rejects an archive version changed after attachment', () => {
    const { item, job } = current()
    Object.assign(item, prepareVideoAttachment(item, job, 'admin', '2026-10-07'))
    expect(() => prepareMediaReview(item, { ...job, media_version: 'b'.repeat(64) }, socialVideoAssetVersion(item), true, 'admin', '2026-10-07')).toThrow('asset changed')
  })
  it('protects editorial and render receipts from generic client edits', () => {
    const { item } = current()
    const patch = prepareManualCopyUpdate({ current: item, patch: { rag_context: { campaign_video_editorial: { status: 'forged' }, campaign_video_bindings: { forged: true } } }, expectedVersion: socialCopyVersion(item), actor: 'a', now: '2026-10-07' })
    expect((patch.rag_context as any).campaign_video_editorial).toEqual(item.rag_context.campaign_video_editorial)
    expect((patch.rag_context as any).campaign_video_bindings).toEqual(item.rag_context.campaign_video_bindings)
  })
  it('keeps an approval invalid after an asset edit is reverted through generic edits', () => {
    const { item } = current(), original = structuredClone(item.rag_context.production_assets)
    const changed = structuredClone(original); changed.broll.assets[0].version = 'v2'
    for (const assets of [changed, original]) {
      Object.assign(item, prepareManualCopyUpdate({ current: item, patch: { rag_context: { production_assets: assets } }, expectedVersion: socialCopyVersion(item), actor: 'a', now: '2026-10-07' }))
      expect(currentEditorialReceipt(item)).toBeNull()
    }
  })
})
describe('production quality versus deterministic screening', () => {
  it.each([
    'Audience: business owners\nObjective: explain governance\nCTA: join the challenge.',
    '- Name the problem.\n- Show a workflow.\n- Ask for a decision.',
    'The script must include a pain point. Ensure that the CTA is clear.',
    'Vambah teaches a useful workflow. Join the workshop.',
    'Show the operating layer: the draft and b-roll. Join the challenge.',
  ])('rejects checklist or internal-note scripts: %s', script => {
    expect(screenVideoEditorial(script).blockers.length).toBeGreaterThan(0)
  })
  it('requires evidence and all production criteria even when safety screening passes', () => {
    const { item } = current()
    const input = { input_version: editorialInputVersion(item), avatar_id: 'a', voice_id: 'v', notes: 'This is an explicit evidence assessment.', checks: Object.fromEntries(Object.keys(VIDEO_EDITORIAL_CRITERIA).map(key => [key, true])) }
    expect(screenVideoEditorial(item.rag_context.production_assets.video_script.script_text).production_quality.status).toBe('needs_review')
    for (const key of Object.keys(VIDEO_EDITORIAL_CRITERIA)) expect(() => prepareCampaignVideoEditorial(item, { ...input, checks: { ...input.checks, [key]: false } }, 'reviewer', '2026-10-07')).toThrow()
    expect(() => prepareCampaignVideoEditorial(item, { ...input, input_version: 'old' }, 'r', '2026-10-07')).toThrow('changed')
  })
})
