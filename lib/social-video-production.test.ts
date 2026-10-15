import { describe, expect, it } from 'vitest'
import {
  SOCIAL_VIDEO_GENERATION_CONTRACT,
  SOCIAL_VIDEO_GENERATION_CONTRACT_VERSION,
  buildSocialVideoProductionProjection,
  evaluateSocialVideoGenerationContract,
  selectFavoriteVoice,
  selectRotatingFavoriteAvatar,
  type SocialVideoGenerationEvidence,
} from './social-video-production'

function validGenerationEvidence(): SocialVideoGenerationEvidence {
  return {
    contract_version: SOCIAL_VIDEO_GENERATION_CONTRACT_VERSION,
    artifact_id: 'future-video-v1',
    input_version: 'sha256:future-v1',
    research: { sources_current: true, outlier_evidence_bound: true, topic_title_thumbnail_description_script_aligned: true },
    product_evidence: { topic_references_owned_product: true, approved_first_party_asset_ids: ['dark-castle-gameplay-1'], screenshots_current: true, privacy_and_rights_cleared: true, visual_claim_bindings_complete: true, narration_cue_bindings_complete: true, omission_reason: '' },
    script: { youtube_template_run_passed: true, practitioner_specific: true, complete_conclusion: true, approved_cta_text: 'Subscribe to the channel for more practical ways to govern AI decisions.', spoken_cta_transcript_present: true },
    customer_facing: { internal_text_leakage: [] },
    avatar: { approved_avatar_id: 'avatar-2', approved_voice_id: 'voice-1', rights_receipt_id: 'rights-1', look_rotation_receipt_id: 'rotation-1', repeats_prior_look_without_exception: false, native_source_mp4_bound: true, native_composite_used_when_required: true },
    presentation: { presenter_forward_opening: true, presenter_forward_conclusion: true, presenter_large_left_during_evidence: true, assets_right: true, smooth_transitions: true },
    motion: { native_animation_preserved: true, source_hashes_bound: true, reduced_motion_fallback: true, lost_or_substituted_scene_ids: [] },
    assets: { inventory_complete: true, every_used_once: true, every_asset_cue_bound: true, loops_or_repeats: false, max_concurrent_visible: 1, omissions_have_receipts: true },
    layout: { timing_synchronized: true, safe_areas_passed: true, padding_passed: true, overlap_or_crowding: false, top_stacking_or_clipping: false },
    music: { rights_receipt_id: 'music-rights-1', instrumental: true, audible_under_speech: true, moderate_ducking_passed: true, vocals: false, loop: false, bounded_fades: true },
    voice: { timing_preserved: true, lip_sync_passed: true, dsp_scope: 'eq_dynamics_only', claims_new_prosody: false, deceptive_word_splicing: false },
    packaging: { shared_research_version_bound: true, title_receipt_id: 'title-1', thumbnail_receipt_id: 'thumb-1', description_receipt_id: 'description-1', script_receipt_id: 'script-1' },
    provenance: { source_receipts_current: true, rights_receipts_current: true, privacy_receipt_id: 'privacy-1', field_level_proof_reviewable: true, excluded_from_customer_frames: true },
    validation: { duration_passed: true, frame_count_passed: true, full_decode_passed: true, av_sync_passed: true, speech_audibility_passed: true, cta_semantics_passed: true, clipping_samples: 0, green_spill_passed: true, motion_preservation_passed: true, no_repeats_passed: true, overlap_safe_area_passed: true },
    gate_authorizations: { render: false, provider: false, upload: false, platform_draft: false, schedule: false, publish: false, external_send: false },
    human_qa: { exact_route: '/admin/social-content/future?step=copy', screenshot_path: 'artifacts/future.png', playable_mp4_path: 'artifacts/future.mp4', what_changed: 'New video', value: 'Clearer evidence', review_script: 'Review opening, evidence, and CTA.', next_authorization: 'Approve Human QA only.' },
    accepted_exceptions: [],
  }
}

describe('Social Video Generation Contract', () => {
  it('codifies the complete prospective generation rule set', () => {
    expect(SOCIAL_VIDEO_GENERATION_CONTRACT.rule_ids).toHaveLength(29)
    expect(SOCIAL_VIDEO_GENERATION_CONTRACT.prospective_defaults).toMatchObject({ spoken_cta_required: true, teaching_asset_appearance_count: 1, max_concurrent_teaching_assets: 1, avatar_look_rotation_required: true, native_motion_flattening_allowed: false, deceptive_word_splicing_allowed: false, first_party_product_evidence_required_when_applicable: true })
    expect(evaluateSocialVideoGenerationContract(validGenerationEvidence())).toEqual({ ready: true, blockers: [], acceptedExceptionRuleIds: [] })
  })

  it('fails closed for missing CTA semantics, internal text, repeated assets, and unsafe external-gate drift', () => {
    const value = validGenerationEvidence()
    value.script.spoken_cta_transcript_present = false
    value.validation.cta_semantics_passed = false
    value.customer_facing.internal_text_leakage = ['operator_note']
    value.assets.loops_or_repeats = true
    value.assets.max_concurrent_visible = 2
    ;(value.gate_authorizations as Record<string, boolean>).combined_render_and_publish = true
    expect(evaluateSocialVideoGenerationContract(value).blockers).toEqual(expect.arrayContaining([
      'Spoken CTA transcript is missing: Subscribe to the channel for more practical ways to govern AI decisions.',
      'Customer-facing frames contain internal prompts, logic, receipts, QA labels, or operator notes.',
      'Teaching assets must be inventoried, cue-bound, shown once, and mutually exclusive per frame.',
      'External actions must remain separate explicit gates.',
    ]))
  })

  it('allows the explicit Jev visual-only CTA exception without weakening future defaults', () => {
    const value = validGenerationEvidence()
    value.artifact_id = 'social-video-review:jev:20261015:v2'
    value.input_version = 'sha256:e6fc9ae4aadd61e3a871e8f7af2dd0a2d424d5c20ae6a8d0eac861b16e796bd5'
    value.script.spoken_cta_transcript_present = false
    value.validation.cta_semantics_passed = false
    value.accepted_exceptions = [{ artifact_id: value.artifact_id, input_version: value.input_version, rule_id: 'script.semantic_spoken_cta', accepted_by_user: true, visual_cta_present: true, reason: 'Vambah accepted this completed Jev master without commissioning new audio.', weakens_future_default: false }]
    expect(evaluateSocialVideoGenerationContract(value)).toEqual({ ready: true, blockers: [], acceptedExceptionRuleIds: ['script.semantic_spoken_cta'] })
    expect(SOCIAL_VIDEO_GENERATION_CONTRACT.prospective_defaults.spoken_cta_required).toBe(true)
  })

  it('fails owned-product topics without approved first-party visual evidence or an omission reason', () => {
    const value = validGenerationEvidence()
    value.product_evidence.approved_first_party_asset_ids = []
    expect(evaluateSocialVideoGenerationContract(value)).toEqual(expect.objectContaining({
      ready: false,
      blockers: expect.arrayContaining([
        'Owned-product topics require approved first-party screenshots or comparable product evidence bound to the exact claims and narration cues, or an explicit omission reason.',
      ]),
    }))
  })

  it('fails owned-product evidence that is stale, uncleared, or disconnected from narration', () => {
    const value = validGenerationEvidence()
    value.product_evidence.screenshots_current = false
    value.product_evidence.narration_cue_bindings_complete = false
    expect(evaluateSocialVideoGenerationContract(value).ready).toBe(false)
  })

  it('does not require product screenshots for topics that do not reference an owned product', () => {
    const value = validGenerationEvidence()
    value.product_evidence = { topic_references_owned_product: false, approved_first_party_asset_ids: [], screenshots_current: false, privacy_and_rights_cleared: false, visual_claim_bindings_complete: false, narration_cue_bindings_complete: false, omission_reason: '' }
    expect(evaluateSocialVideoGenerationContract(value).ready).toBe(true)
  })
})

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    status: 'approved',
    platform: 'youtube',
    target_platforms: ['youtube'],
    video_url: null,
    image_url: 'https://cdn.example.com/thumb.png',
    rag_context: {
      source: 'social_content_calendar_authorization',
      production_assets: {
        version: 'social_production_assets_v2',
        broll: {
          status: 'matched',
          assets: [{
            id: 'broll-1',
            route: '/admin/social-content/social-1',
            route_description: 'Social Content review',
            filename: 'social-content-review.mp4',
            screenshot_path: null,
            clip_path: '/design-files/broll/social-content-review.mp4',
            captured_at: '2026-08-04T12:00:00.000Z',
          }],
        },
        video_redaction_manifest: {
          items: [],
        },
      },
      ...overrides,
    },
  } as never
}

describe('buildSocialVideoProductionProjection', () => {
  it('uses approved favorite avatar and voice assets when no defaults are configured', () => {
    const projection = buildSocialVideoProductionProjection({
      item: baseItem(),
      defaults: { avatarId: null, voiceId: null },
      favoriteAvatars: [{ asset_id: 'avatar-favorite-1', asset_name: 'Vambah Gray Sweater', is_favorite: true }],
      favoriteVoices: [{ asset_id: 'voice-favorite-1', asset_name: 'Young Black CEO Voice', is_favorite: true }],
      job: null,
    })

    expect(projection.status).toBe('ready_for_render_approval')
    expect(projection.selectedAvatarId).toBe('avatar-favorite-1')
    expect(projection.selectedAvatarSource).toBe('favorite_pool')
    expect(projection.selectedVoiceId).toBe('voice-favorite-1')
    expect(projection.selectedVoiceSource).toBe('favorite')
    expect(projection.avatarPoolSize).toBe(1)
    expect(projection.readiness.blockers).toEqual([])
  })

  it('projects a completed HeyGen job into final video and thumbnail readiness', () => {
    const projection = buildSocialVideoProductionProjection({
      item: baseItem({
        social_video_production: {
          version: 'social_video_production_v1',
          source: 'youtube_social_content_heygen_bridge',
          video_generation_job_id: 'job-1',
          selected_avatar_id: 'avatar-1',
          selected_voice_id: 'voice-1',
          selected_broll_asset_ids: ['broll-1'],
          broll_candidates: [],
          render_approval: null,
          approval_boundary: 'Internal render only.',
          side_effects: {
            heygen_render: true,
            youtube_upload: false,
            schedule: false,
            publish: false,
            provider_draft: false,
          },
          updated_at: '2026-08-04T12:00:00.000Z',
        },
      }),
      defaults: { avatarId: 'avatar-default', voiceId: 'voice-default' },
      job: {
        id: 'job-1',
        heygenVideoId: 'heygen-1',
        heygenStatus: 'completed',
        videoUrl: 'https://cdn.example.com/final.mp4',
        videoShareUrl: 'https://app.heygen.com/share/heygen-1',
        thumbnailUrl: 'https://cdn.example.com/final-thumb.jpg',
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        brollAssetIds: ['broll-1'],
        createdAt: '2026-08-04T12:00:00.000Z',
        updatedAt: '2026-08-04T12:10:00.000Z',
      },
    })

    expect(projection.status).toBe('completed')
    expect(projection.finalVideoUrl).toBe('https://cdn.example.com/final.mp4')
    expect(projection.thumbnailUrl).toBe('https://cdn.example.com/final-thumb.jpg')
    expect(projection.selectedAvatarId).toBe('avatar-1')
    expect(projection.selectedVoiceId).toBe('voice-1')
    expect(projection.readiness.nextAction).toContain('final video')
  })
})

describe('selectRotatingFavoriteAvatar', () => {
  it('avoids repeating the most recently prepared avatar when another favorite is available', () => {
    const selected = selectRotatingFavoriteAvatar({
      defaults: { avatarId: null },
      favoriteAvatars: [
        { asset_id: 'avatar-a', is_favorite: true },
        { asset_id: 'avatar-b', is_favorite: true },
      ],
      stableKey: 'agentified-episode-1',
      lastAvatarId: null,
    })

    const nextSelected = selectRotatingFavoriteAvatar({
      defaults: { avatarId: null },
      favoriteAvatars: [
        { asset_id: 'avatar-a', is_favorite: true },
        { asset_id: 'avatar-b', is_favorite: true },
      ],
      stableKey: 'agentified-episode-1',
      lastAvatarId: selected,
    })

    expect(nextSelected).toBeTruthy()
    expect(nextSelected).not.toBe(selected)
  })

  it('falls back to the configured default when no favorites exist', () => {
    expect(selectRotatingFavoriteAvatar({
      defaults: { avatarId: 'avatar-default' },
      favoriteAvatars: [],
      stableKey: 'agentified-episode-1',
    })).toBe('avatar-default')
  })
})

describe('selectFavoriteVoice', () => {
  it('uses the first favorite voice when no default is configured', () => {
    expect(selectFavoriteVoice({
      defaults: { voiceId: null },
      favoriteVoices: [
        { asset_id: 'voice-favorite-1', is_favorite: true },
      ],
    })).toBe('voice-favorite-1')
  })
})
