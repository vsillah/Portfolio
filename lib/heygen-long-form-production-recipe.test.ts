import { describe, expect, it } from 'vitest'
import {
  HEYGEN_CAPABILITY_SNAPSHOT_VERSION,
  HEYGEN_LONG_FORM_RECIPE_VERSION,
  evaluateHeyGenLongFormRecipe,
  selectDeterministicRotationOption,
  type HeyGenLongFormProductionRecipe,
} from './heygen-long-form-production-recipe'

const now = '2026-10-17T12:00:00.000Z'
const contentVersion = 'content:v7'

export function makeHeyGenLongFormRecipe(): HeyGenLongFormProductionRecipe {
  const lookPool = [
    { id: 'look-previous', label: 'Warm studio', capability_verified: true },
    { id: 'look-navy', label: 'Navy editorial', capability_verified: true },
    { id: 'look-sand', label: 'Sand workshop', capability_verified: true },
  ]
  const environmentPool = [
    { id: 'env-previous', label: 'Library', capability_verified: true },
    { id: 'env-product', label: 'Product wall', capability_verified: true },
    { id: 'env-studio', label: 'Quiet studio', capability_verified: true },
  ]
  const seed = 'campaign-42:content:v7'
  const proposedLook = selectDeterministicRotationOption({ seed: `${seed}:look`, options: lookPool, previousId: 'look-previous' })!
  const proposedEnvironment = selectDeterministicRotationOption({ seed: `${seed}:environment`, options: environmentPool, previousId: 'env-previous' })!

  return {
    version: HEYGEN_LONG_FORM_RECIPE_VERSION,
    recipe_id: 'recipe-42-v7',
    status: 'review_only',
    campaign: { campaign_id: 'campaign-42', content_id: 'content-42', content_version: contentVersion },
    evidence: {
      packet_id: 'evidence-42-v3',
      packet_version: 'v3',
      approval_receipt_id: 'approval:evidence-42-v3',
      product_proof_required: true,
      product_screenshots: [{
        asset_id: 'asset-dashboard',
        label: 'Portfolio approval dashboard',
        sha256: 'sha256:dashboard',
        source_receipt_id: 'source:dashboard',
        rights_receipt_id: 'rights:dashboard',
      }],
      outlier: {
        packet_id: 'outlier-youtube-12',
        observed_at: '2026-10-16T12:00:00.000Z',
        expires_at: '2026-10-24T12:00:00.000Z',
        source_receipt_id: 'source:outlier',
      },
    },
    deliverables: {
      master: {
        deliverable_id: 'youtube-master-42',
        channel: 'youtube',
        aspect_ratio: '16:9',
        duration_seconds: 600,
        approval_status: 'pending',
        script_input_id: 'script-42-v7',
        title_input_id: 'title-42-v7',
        description_input_id: 'description-42-v7',
        thumbnail_input_id: 'thumbnail-42-v7',
      },
      derivatives: [{
        deliverable_id: 'short-42-v7',
        channel: 'youtube_shorts',
        aspect_ratio: '9:16',
        source_master_id: 'youtube-master-42',
        source_master_version: contentVersion,
        inherited_evidence_packet_id: 'evidence-42-v3',
        packaging_input_id: 'short-packaging-42-v7',
        approval_status: 'pending',
      }],
    },
    provider: {
      provider: 'heygen',
      plan: 'pro',
      capability_snapshot: {
        version: HEYGEN_CAPABILITY_SNAPSHOT_VERSION,
        observed_at: now,
        expires_at: '2026-10-24T12:00:00.000Z',
        account_capability_verified: true,
        supported_engines: ['avatar_v', 'avatar_iv', 'avatar_iii', 'video_agent'],
        supported_visual_models: ['heygen_video_1'],
        duration_verified: true,
        credits_verified: true,
      },
      selected_engine: 'avatar_iv',
      visual_clip_model: 'heygen_video_1',
      avatar_v_reference_look_id: null,
      production_route: 'avatar_video_native_composite',
      avatar_identity_id: 'avatar:vambah',
      voice_id: 'voice:vambah',
      aspect_ratio: '16:9',
    },
    rotation: {
      seed,
      previous_look_id: 'look-previous',
      previous_environment_id: 'env-previous',
      look_pool: lookPool,
      environment_pool: environmentPool,
      proposed_look_id: proposedLook.id,
      proposed_environment_id: proposedEnvironment.id,
      override_look_id: null,
      override_environment_id: null,
    },
    scene_plan: [
      { scene_id: 'scene-1', start_seconds: 0, end_seconds: 90, look_id: proposedLook.id, environment_id: proposedEnvironment.id, role: 'presenter', motion_prompt: 'Measured opening with direct eye line.', product_asset_ids: [], generated_clip: null, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
      { scene_id: 'scene-2', start_seconds: 90, end_seconds: 360, look_id: proposedLook.id, environment_id: 'env-product', role: 'product_demo', motion_prompt: 'Move through the approved dashboard screenshots at reading pace.', product_asset_ids: ['asset-dashboard'], generated_clip: null, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
      { scene_id: 'scene-3', start_seconds: 360, end_seconds: 510, look_id: proposedLook.id, environment_id: 'env-studio', role: 'b_roll', motion_prompt: 'Use evidence-bound B-roll under the original narration.', product_asset_ids: ['asset-dashboard'], generated_clip: { model: 'heygen_video_1', duration_seconds: 10 }, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
      { scene_id: 'scene-4', start_seconds: 510, end_seconds: 600, look_id: proposedLook.id, environment_id: proposedEnvironment.id, role: 'cta', motion_prompt: 'Return to presenter for the practical invitation.', product_asset_ids: [], generated_clip: null, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
    ],
    music: { track_id: 'music:stream', authorization_receipt_id: 'source:music', rights_receipt_id: 'rights:music' },
    receipts: {
      approved_source_receipt_ids: ['source:dashboard', 'source:outlier', 'source:music'],
      approved_rights_receipt_ids: ['rights:dashboard', 'rights:music'],
      privacy_receipt_id: 'privacy:recipe-42-v7',
    },
    budget: {
      estimated_run_credits: 10,
      per_run_credit_ceiling: 12,
      aggregate_committed_credits: 20,
      aggregate_credit_ceiling: 40,
      estimated_run_usd: 3.5,
      per_run_usd_ceiling: 5,
      aggregate_committed_usd: 6,
      aggregate_usd_ceiling: 15,
    },
    execution_boundary: {
      provider_calls_authorized: false,
      provider_calls_executed: 0,
      upload_authorized: false,
      platform_draft_authorized: false,
      scheduling_authorized: false,
      publishing_authorized: false,
      external_send_authorized: false,
    },
    customer_artifacts: { internal_prompt_fields: [], governance_text_included: false },
  }
}

function evaluate(recipe: HeyGenLongFormProductionRecipe) {
  return evaluateHeyGenLongFormRecipe({ recipe, expectedContentVersion: contentVersion, now })
}

describe('evaluateHeyGenLongFormRecipe', () => {
  it('passes a complete review-only, version-bound recipe while keeping generation closed', () => {
    const result = evaluate(makeHeyGenLongFormRecipe())
    expect(result.readyForReview).toBe(true)
    expect(result.readyForProviderGeneration).toBe(false)
    expect(result.blockers).toEqual([])
  })

  it('fails a stale content version', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.campaign.content_version = 'content:v6'
    expect(evaluate(recipe).blockers).toContain('The campaign or content version binding is stale.')
  })

  it('fails an unsupported selected engine', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.provider.capability_snapshot.supported_engines = ['avatar_iii']
    expect(evaluate(recipe).blockers).toContain('The selected HeyGen engine is unsupported by the verified account capability snapshot.')
  })

  it('fails a repeated avatar look even when set as an operator override', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.rotation.override_look_id = recipe.rotation.previous_look_id
    expect(evaluate(recipe).blockers).toContain('The selected avatar look repeats the previous production.')
  })

  it('fails when product evidence is required but missing', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.evidence.product_screenshots = []
    expect(evaluate(recipe).blockers).toContain('Product screenshots are required when the topic references Vambah’s work.')
  })

  it('fails a missing rights receipt', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.receipts.approved_rights_receipt_ids = ['rights:music']
    expect(evaluate(recipe).blockers).toContain('A product screenshot rights receipt is missing or unapproved.')
  })

  it('fails stale outlier evidence', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.evidence.outlier.expires_at = '2026-10-16T12:00:00.000Z'
    expect(evaluate(recipe).blockers).toContain('The outlier packaging evidence is stale.')
  })

  it('fails per-run and aggregate over-budget plans', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.budget.estimated_run_credits = 25
    expect(evaluate(recipe).blockers).toContain('The planned run exceeds its provider-credit or cost ceiling.')
  })

  it('fails when the native composite stops preserving source media truth', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.scene_plan[1].native_composite.source_media_is_visual_truth = false
    expect(evaluate(recipe).blockers).toContain('Native presenter and media composites must preserve source visuals, frame rate, duration, and timestamped audio.')
  })

  it('fails when the first scene starts after the master timeline origin', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.scene_plan[0].start_seconds = 5
    expect(evaluate(recipe).blockers).toContain('The first scene must start at 0 seconds.')
  })

  it('fails scene look and environment bindings that are absent or capability-unverified', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.scene_plan[1].look_id = 'look-missing'
    recipe.rotation.environment_pool.find((option) => option.id === 'env-product')!.capability_verified = false
    expect(evaluate(recipe).blockers).toContain('Every scene avatar look must resolve to a capability-verified rotation entry.')
    expect(evaluate(recipe).blockers).toContain('Every scene environment must resolve to a capability-verified rotation entry.')
  })

  it('fails scene product assets that are not approved screenshot evidence', () => {
    const recipe = makeHeyGenLongFormRecipe()
    recipe.scene_plan[1].product_asset_ids = ['asset-unbound']
    expect(evaluate(recipe).blockers).toContain('Every scene product asset must resolve to an approved product screenshot with passing source and rights receipts.')
  })

  it('fails closed when the recipe is missing and keeps provider generation closed', () => {
    expect(evaluateHeyGenLongFormRecipe({
      recipe: null,
      expectedContentVersion: contentVersion,
      now,
    })).toEqual({
      readyForReview: false,
      readyForProviderGeneration: false,
      blockers: ['A version-bound HeyGen long-form production recipe is required.'],
      selectedLookId: null,
      selectedEnvironmentId: null,
    })
  })

  it('keeps review blocked when any provider, upload, or publish gate opens', () => {
    const openings = [
      { provider_calls_authorized: true },
      { provider_calls_executed: 1 },
      { upload_authorized: true },
      { platform_draft_authorized: true },
      { scheduling_authorized: true },
      { publishing_authorized: true },
      { external_send_authorized: true },
    ] as const

    for (const opening of openings) {
      const recipe = makeHeyGenLongFormRecipe()
      recipe.execution_boundary = {
        ...recipe.execution_boundary,
        ...opening,
      } as HeyGenLongFormProductionRecipe['execution_boundary']
      const result = evaluate(recipe)
      expect(result.readyForReview).toBe(false)
      expect(result.readyForProviderGeneration).toBe(false)
      expect(result.blockers).toContain('Provider, upload, draft, scheduling, publishing, and external-send gates must remain closed.')
    }
  })

  it('blocks customer artifacts that include internal prompts or governance text', () => {
    const prompts = makeHeyGenLongFormRecipe()
    prompts.customer_artifacts = {
      internal_prompt_fields: ['system prompt'],
      governance_text_included: false,
    } as unknown as HeyGenLongFormProductionRecipe['customer_artifacts']
    expect(evaluate(prompts).blockers).toContain('Customer-facing artifacts cannot contain internal prompts or governance text.')

    const governance = makeHeyGenLongFormRecipe()
    governance.customer_artifacts = {
      internal_prompt_fields: [],
      governance_text_included: true,
    } as unknown as HeyGenLongFormProductionRecipe['customer_artifacts']
    expect(evaluate(governance).blockers).toContain('Customer-facing artifacts cannot contain internal prompts or governance text.')
    expect(evaluate(governance).readyForProviderGeneration).toBe(false)
  })

  it('rejects an engine that does not match the selected production route', () => {
    const videoAgentRoute = makeHeyGenLongFormRecipe()
    videoAgentRoute.provider.production_route = 'video_agent'
    expect(evaluate(videoAgentRoute).blockers).toContain('The Video Agent route requires the verified Video Agent engine.')

    const nativeComposite = makeHeyGenLongFormRecipe()
    nativeComposite.provider.selected_engine = 'video_agent'
    expect(evaluate(nativeComposite).blockers).toContain('The native presenter composite route requires an Avatar Video engine.')

    const avatarV = makeHeyGenLongFormRecipe()
    avatarV.provider.selected_engine = 'avatar_v'
    avatarV.provider.avatar_v_reference_look_id = '   '
    expect(evaluate(avatarV).blockers).toContain('Avatar V requires a verified reference-look binding.')
  })

  it('rejects HeyGen Video 1 clips outside the verified duration window', () => {
    const tooShort = makeHeyGenLongFormRecipe()
    tooShort.scene_plan[2].generated_clip = { model: 'heygen_video_1', duration_seconds: 4 }
    expect(evaluate(tooShort).blockers).toContain('HeyGen Video 1 scene clips must use the verified model and remain between 5 and 15 seconds.')

    const tooLong = makeHeyGenLongFormRecipe()
    tooLong.scene_plan[2].generated_clip = { model: 'heygen_video_1', duration_seconds: 16 }
    expect(evaluate(tooLong).blockers).toContain('HeyGen Video 1 scene clips must use the verified model and remain between 5 and 15 seconds.')
  })

  it('fails a stale capability snapshot and an unfenced derivative', () => {
    const staleCapability = makeHeyGenLongFormRecipe()
    staleCapability.provider.capability_snapshot.expires_at = '2026-10-16T12:00:00.000Z'
    expect(evaluate(staleCapability).blockers).toContain('Current HeyGen account capability, duration, and credits must be verified.')

    const derivative = makeHeyGenLongFormRecipe()
    derivative.deliverables.derivatives[0].source_master_version = 'content:v6'
    expect(evaluate(derivative).blockers).toContain('A derivative is not fenced to the current channel master version.')
  })

  it('skips the previous and unverified rotation options', () => {
    const options = [
      { id: 'previous', label: 'Previous', capability_verified: true },
      { id: 'unverified', label: 'Unverified', capability_verified: false },
      { id: 'eligible', label: 'Eligible', capability_verified: true },
    ]
    expect(selectDeterministicRotationOption({
      seed: 'campaign-42',
      options,
      previousId: 'previous',
    })?.id).toBe('eligible')
    expect(selectDeterministicRotationOption({
      seed: 'campaign-42',
      options: options.slice(0, 2),
      previousId: 'previous',
    })).toBeNull()
  })
})
