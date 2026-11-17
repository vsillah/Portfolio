import { describe, expect, it } from 'vitest'
import {
  ACCELERATED_ACTIVATION_ITEMS, ACCELERATED_ACTIVATION_SCOPE, ACCELERATED_CAMPAIGN_ID,
  ACCELERATED_EXCLUDED_X_ID, approvedMediaBinding, approvedRasterHashes, approvedRasterUrls,
  hasApprovedAcceleratedVisualLifecycleEvidence,
} from './accelerated-campaign-activation'
import { hasSocialContentVisualPrerequisites, deriveSocialContentLifecycleProjection } from './social-content-lifecycle'
import { socialReleaseFingerprint } from './social-release-evidence'
import { ACCELERATED_VISUAL_IDS } from './accelerated-visual-ids'

const manifest = '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297'
const jit = '039488c2ef7fa22f6872617f70060893c49d03ee0936170379a44a2e1f9a18b8'
const account = (channel: 'linkedin' | 'instagram'): Record<string, any> => channel === 'linkedin'
  ? { platform: 'linkedin', is_active: true, settings: { author_urn: 'urn:li:person:IXpDF_c4-m', campaign_zero_fee_verified: true, campaign_zero_fee_cap_usd: 0 }, credentials: { access_token: 'synthetic-token', person_urn: 'urn:li:person:IXpDF_c4-m' } }
  : { platform: 'instagram', is_active: true, settings: { instagram_username: 'amadutown', instagram_content_publish_permission: true, campaign_zero_fee_verified: true, campaign_zero_fee_cap_usd: 0 }, credentials: { access_token: 'synthetic-token', ig_user_id: 'synthetic-account', scope: 'instagram_content_publish' } }

function fixture(id: keyof typeof ACCELERATED_ACTIVATION_ITEMS) {
  const expected = ACCELERATED_ACTIVATION_ITEMS[id]
  const item: Record<string, any> = {
    id, status: 'scheduled', platform: expected.channel, target_platforms: [expected.channel],
    scheduled_for: expected.scheduledFor, updated_at: '2026-11-17T13:00:00Z',
    post_text: 'Synthetic reviewed copy', cta_url: 'https://amadutown.com/accelerated',
    ...approvedMediaBinding(expected.assetCount),
    rag_context: {
      campaign_id: ACCELERATED_CAMPAIGN_ID, calendar_item_id: expected.calendarId,
      accelerated_campaign_activation: {
        scope: ACCELERATED_ACTIVATION_SCOPE, campaign_id: ACCELERATED_CAMPAIGN_ID,
        calendar_item_id: expected.calendarId, channel: expected.channel, scheduled_for: expected.scheduledFor,
        copy_sha256: expected.copyHash, asset_urls: approvedRasterUrls(expected.assetCount),
        asset_sha256: approvedRasterHashes(expected.assetCount), source_manifest_sha256: manifest,
        jit_packet_sha256: jit, fee_usd: 0, no_spend: true,
        activated_by: 'synthetic-admin', activated_at: '2026-11-17T12:00:00Z',
      },
      platform_submission_gate: { status: 'approved', platforms: [expected.channel], submit_after_approval: false },
    },
  }
  item.rag_context.platform_submission_gate.approved_fingerprint = socialReleaseFingerprint(item)
  return item
}

const ids = Object.keys(ACCELERATED_ACTIVATION_ITEMS) as Array<keyof typeof ACCELERATED_ACTIVATION_ITEMS>

describe('Accelerated raster lifecycle recognition', () => {
  it('keeps the client-safe lifecycle ID set aligned with the activation allowlist', () => {
    expect([...ACCELERATED_VISUAL_IDS].sort()).toEqual([...ids].sort())
  })

  it.each(ids)('recognizes only exact activation evidence for %s', id => {
    const item = fixture(id), config = account(ACCELERATED_ACTIVATION_ITEMS[id].channel)
    const hash = ACCELERATED_ACTIVATION_ITEMS[id].copyHash
    expect(hasApprovedAcceleratedVisualLifecycleEvidence(item, config, hash)).toBe(true)
    expect(hasSocialContentVisualPrerequisites({ ...item, publishes: [{ status: 'pending' }] }, true)).toBe(true)
    expect(deriveSocialContentLifecycleProjection({ item: { ...item, publishes: [{ status: 'pending' }] }, acceleratedVisualEvidenceApproved: true }).steps.visuals.state).toBe('approved')
    expect(hasApprovedAcceleratedVisualLifecycleEvidence({ ...item, updated_at: 'trigger-owned-new-version', publishes: [{ status: 'pending' }] }, config, hash)).toBe(true)
    expect(hasApprovedAcceleratedVisualLifecycleEvidence({ ...item, scheduled_for: expectedIso(id) }, config, hash)).toBe(true)
  })

  it.each(ids)('fails closed on URL, hash, account, fee, and fingerprint drift for %s', id => {
    const item = fixture(id), config = account(ACCELERATED_ACTIVATION_ITEMS[id].channel), hash = ACCELERATED_ACTIVATION_ITEMS[id].copyHash
    const check = (changed: Record<string, any>, cfg: Record<string, any> | null = config, copyHash: string = hash) => hasApprovedAcceleratedVisualLifecycleEvidence(changed, cfg, copyHash)
    expect(check(item, config, 'wrong-copy-hash')).toBe(false)
    expect(check({ ...item, image_url: 'https://example.com/changed.png' })).toBe(false)
    expect(check({ ...item, carousel_slide_urls: ['https://example.com/changed.png'] })).toBe(false)
    expect(check({ ...item, rag_context: { ...item.rag_context, accelerated_campaign_activation: { ...item.rag_context.accelerated_campaign_activation, asset_sha256: ['wrong'] } } })).toBe(false)
    expect(check({ ...item, post_text: 'Changed after approval' })).toBe(false)
    expect(check({ ...item, rag_context: { ...item.rag_context, accelerated_campaign_activation: null } })).toBe(false)
    expect(check({ ...item, rag_context: { ...item.rag_context, platform_submission_gate: null } })).toBe(false)
    expect(check(item, null)).toBe(false)
    const legacyFlags = { ...item, rag_context: { ...item.rag_context, section_gate_reviews: {
      visual_assets: { status: 'approved' }, asset_packet: { status: 'approved' }, privacy: { status: 'approved' },
    }, accelerated_campaign_activation: { ...item.rag_context.accelerated_campaign_activation, asset_sha256: ['wrong'] } } }
    expect(hasSocialContentVisualPrerequisites(legacyFlags, check(legacyFlags))).toBe(false)
    expect(check(item, { ...config, is_active: false })).toBe(false)
    expect(check(item, { ...config, settings: { ...config.settings, campaign_zero_fee_verified: false } })).toBe(false)
  })

  it('leaves X and unrelated records on their existing lifecycle path', () => {
    const item = fixture(ids[0])
    expect(hasApprovedAcceleratedVisualLifecycleEvidence({ ...item, id: ACCELERATED_EXCLUDED_X_ID }, account('linkedin'), ACCELERATED_ACTIVATION_ITEMS[ids[0]].copyHash)).toBe(false)
    expect(hasSocialContentVisualPrerequisites({ ...item, id: ACCELERATED_EXCLUDED_X_ID }, true)).toBe(false)
    expect(hasApprovedAcceleratedVisualLifecycleEvidence({ ...item, id: 'unrelated' }, account('linkedin'), ACCELERATED_ACTIVATION_ITEMS[ids[0]].copyHash)).toBe(false)
    expect(hasSocialContentVisualPrerequisites({ ...item, id: 'unrelated' }, true)).toBe(false)
    const unrelated = { id: 'unrelated', status: 'scheduled' as const, platform: 'linkedin' as const,
      target_platforms: ['linkedin' as const], image_url: 'https://example.com/visual.png',
      rag_context: { section_gate_reviews: { visual_assets: { status: 'approved' }, asset_packet: { status: 'approved' }, privacy: { status: 'approved' } } } }
    expect(hasSocialContentVisualPrerequisites(unrelated)).toBe(true)
    expect(hasSocialContentVisualPrerequisites({ ...unrelated, rag_context: {} })).toBe(false)
    expect(hasSocialContentVisualPrerequisites({ id: ACCELERATED_EXCLUDED_X_ID, status: 'draft', platform: 'x', target_platforms: ['x'], rag_context: {
      x_batch_approval: { status: 'approved', approved_scope: ['copy', 'source_distance_review', 'privacy_review'] },
      privacy_review: { status: 'approved' }, source_distance_review: { status: 'approved' },
    } })).toBe(true)
  })
})

function expectedIso(id: keyof typeof ACCELERATED_ACTIVATION_ITEMS) {
  return ACCELERATED_ACTIVATION_ITEMS[id].scheduledFor.replace('.000Z', '+00:00')
}
