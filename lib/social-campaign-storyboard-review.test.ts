import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import assetReceipt from '@/artifacts/research/social-campaign-storyboard-assets-2026-10-19/receipt.json'
import { socialCampaignApprovedAdaptationQaProjection } from '@/lib/social-campaign-approved-adaptation-qa-fixture'

function fileHash(publicPath: string) {
  return `sha256:${createHash('sha256').update(readFileSync(`public${publicPath}`)).digest('hex')}`
}

describe('provider-free Social Content storyboard review', () => {
  const review = socialCampaignApprovedAdaptationQaProjection()

  it('binds one provider-free 16:9 asset to each existing campaign identity and exact content inputs', () => {
    expect(review.adaptations).toHaveLength(2)
    for (const adaptation of review.adaptations) {
      const packet = adaptation.storyboard_review
      expect(packet.assets).toHaveLength(1)
      expect(packet.assets[0]).toMatchObject({
        width: 1280,
        height: 720,
        aspect_ratio: '16:9',
        provider: 'none',
        review_only: true,
        customer_facing: true,
        approval_status: 'review_direction_only',
        title_thumbnail_distinct: true,
        logo_path: '/amadutown-logo-upscaled.png',
        logo_aspect_ratio: 'natural_portrait',
      })
      expect(packet.assets[0].title).not.toBe(packet.assets[0].teaser)
      expect(fileHash(packet.assets[0].public_path)).toBe(packet.assets[0].sha256)
      expect(packet.calendar_item_id).toBe(adaptation.calendar_item_id)
      expect(packet.social_content_id).toBe(adaptation.social_content_id)
      expect(packet.content_version).toBe(adaptation.current_content_version)
      expect(packet.script_input_version).toBe(adaptation.source_input_version)
      expect(new Set(Object.values(packet.external_gates))).toEqual(new Set([false]))
    }
    expect(assetReceipt).toMatchObject({ provider_calls: 0, paid_media_generations: 0, external_writes: 0 })
  })

  it('provides complete, non-overlapping long-form and Shorts scene contracts', () => {
    for (const adaptation of review.adaptations) {
      const scenes = adaptation.storyboard_review.scenes
      expect(scenes).toHaveLength(9)
      for (const target of ['youtube_long_form', 'youtube_shorts'] as const) {
        const targetScenes = scenes.filter((scene) => scene.target === target)
        expect(targetScenes).toHaveLength(target === 'youtube_long_form' ? 6 : 3)
        expect(targetScenes[0].start_seconds).toBe(0)
        expect(targetScenes.at(-1)?.end_seconds).toBe(target === 'youtube_long_form' ? 240 : 45)
        targetScenes.forEach((scene, index) => {
          expect(scene.end_seconds).toBeGreaterThan(scene.start_seconds)
          if (index) expect(scene.start_seconds).toBeGreaterThanOrEqual(targetScenes[index - 1].end_seconds)
          expect(scene.spoken_beat).toBeTruthy()
          expect(scene.customer_facing_copy.length).toBeGreaterThan(0)
          expect(scene.customer_facing_copy.join(' ')).not.toMatch(/provider|receipt|source|fixture|sample data|prompt|code logic|hold/i)
          expect(scene.proof.length).toBeGreaterThan(0)
          expect(scene.shot.type).toBeTruthy()
          expect(scene.shot.framing).toBeTruthy()
          expect(scene.shot.camera_angle).toBeTruthy()
          expect(scene.shot.camera_movement).toBeTruthy()
          expect(scene.avatar_environment_direction).toContain('provider-free review')
          expect(scene.asset_animation).toContain('Preserve the source pixels')
          expect(scene.transition).toBeTruthy()
          expect(scene.continuity).toHaveLength(3)
          expect(scene.b_roll_cue).toBeTruthy()
          expect(scene.music_ducking_note).toContain('duck')
          expect(scene.proof_source_binding.content_version).toBe(adaptation.current_content_version)
          expect(scene.proof_source_binding.script_input_version).toBe(adaptation.source_input_version)
        })
        expect(targetScenes.at(-1)?.cta_delivery).toMatchObject({ required: true, exception_receipt_id: null })
        expect(targetScenes.at(-1)?.cta_delivery.spoken_line).toMatch(/Subscribe to AmaduTown/i)
      }
    }
  })

  it('fails closed on exact thumbnail, description, script, and stale-version gaps with recovery links', () => {
    const [jev, darkCastle] = review.adaptations.map((adaptation) => adaptation.storyboard_review)
    expect(jev.status).toBe('review_direction_blocked')
    expect(jev.evidence_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'outlier', status: 'passed' }),
      expect.objectContaining({ key: 'description', status: 'blocked' }),
      expect.objectContaining({ key: 'thumbnail', status: 'blocked' }),
      expect.objectContaining({ key: 'script', status: 'blocked' }),
      expect.objectContaining({ key: 'freshness', status: 'stale' }),
    ]))
    expect(darkCastle.status).toBe('review_direction_blocked')
    expect(darkCastle.evidence_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'outlier', status: 'passed' }),
      expect.objectContaining({ key: 'description', status: 'blocked' }),
      expect.objectContaining({ key: 'thumbnail', status: 'blocked' }),
      expect.objectContaining({ key: 'script', status: 'blocked' }),
      expect.objectContaining({ key: 'freshness', status: 'passed' }),
    ]))
    expect([...jev.recovery_actions, ...darkCastle.recovery_actions].every((action) => action.href.startsWith('/admin/social-content?workflow=evidence'))).toBe(true)
    expect([...jev.evidence_gates, ...darkCastle.evidence_gates]).toHaveLength(20)
  })
})
