export const HEYGEN_LONG_FORM_RECIPE_VERSION = 'heygen_long_form_recipe_v1' as const

export const HEYGEN_CAPABILITY_SNAPSHOT_VERSION = 'heygen_capabilities_2026_10_17' as const

export type HeyGenEngine = 'avatar_v' | 'avatar_iv' | 'avatar_iii' | 'video_agent'
export type HeyGenVisualModel = 'heygen_video_1'
export type ApprovalStatus = 'pending' | 'approved' | 'revision_requested'

export const HEYGEN_REVIEW_CAPABILITY_CATALOG = {
  avatar_v: { route: 'avatar_video', long_form: true, reference_look_binding: true },
  avatar_iv: { route: 'avatar_video', long_form: true, reference_look_binding: false },
  avatar_iii: { route: 'avatar_video', long_form: true, reference_look_binding: false },
  video_agent: { route: 'video_agent', long_form: true, reference_look_binding: false },
  heygen_video_1: { route: 'visual_clip', minimum_seconds: 5, maximum_seconds: 15 },
} as const

export type HeyGenRotationOption = {
  id: string
  label: string
  capability_verified: boolean
}

export type HeyGenLongFormProductionRecipe = {
  version: typeof HEYGEN_LONG_FORM_RECIPE_VERSION
  recipe_id: string
  status: 'review_only'
  campaign: {
    campaign_id: string
    content_id: string
    content_version: string
  }
  evidence: {
    packet_id: string
    packet_version: string
    approval_receipt_id: string
    product_proof_required: boolean
    product_screenshots: Array<{
      asset_id: string
      label: string
      sha256: string
      source_receipt_id: string
      rights_receipt_id: string
    }>
    outlier: {
      packet_id: string
      observed_at: string
      expires_at: string
      source_receipt_id: string
    }
  }
  deliverables: {
    master: {
      deliverable_id: string
      channel: 'youtube'
      aspect_ratio: '16:9'
      duration_seconds: number
      approval_status: ApprovalStatus
      script_input_id: string
      title_input_id: string
      description_input_id: string
      thumbnail_input_id: string
    }
    derivatives: Array<{
      deliverable_id: string
      channel: 'youtube_shorts' | 'linkedin' | 'instagram_reels' | 'tiktok'
      aspect_ratio: '9:16' | '1:1' | '4:5' | '16:9'
      source_master_id: string
      source_master_version: string
      inherited_evidence_packet_id: string
      packaging_input_id: string
      approval_status: ApprovalStatus
    }>
  }
  provider: {
    provider: 'heygen'
    plan: 'pro'
    capability_snapshot: {
      version: typeof HEYGEN_CAPABILITY_SNAPSHOT_VERSION
      observed_at: string
      expires_at: string
      account_capability_verified: boolean
      supported_engines: HeyGenEngine[]
      duration_verified: boolean
      credits_verified: boolean
      supported_visual_models: HeyGenVisualModel[]
    }
    selected_engine: HeyGenEngine
    visual_clip_model: HeyGenVisualModel | null
    avatar_v_reference_look_id: string | null
    production_route: 'avatar_video_native_composite' | 'video_agent'
    avatar_identity_id: string
    voice_id: string
    aspect_ratio: '16:9'
  }
  rotation: {
    seed: string
    previous_look_id: string | null
    previous_environment_id: string | null
    look_pool: HeyGenRotationOption[]
    environment_pool: HeyGenRotationOption[]
    proposed_look_id: string
    proposed_environment_id: string
    override_look_id: string | null
    override_environment_id: string | null
  }
  scene_plan: Array<{
    scene_id: string
    start_seconds: number
    end_seconds: number
    look_id: string
    environment_id: string
    role: 'presenter' | 'product_demo' | 'b_roll' | 'presenter_return' | 'cta'
    motion_prompt: string
    product_asset_ids: string[]
    generated_clip: { model: HeyGenVisualModel; duration_seconds: number } | null
    native_composite: {
      required: boolean
      source_media_is_visual_truth: boolean
      preserve_source_fps_and_duration: boolean
      mix_source_audio_at_scene_timestamps: boolean
    }
  }>
  music: {
    track_id: string
    authorization_receipt_id: string
    rights_receipt_id: string
  }
  receipts: {
    approved_source_receipt_ids: string[]
    approved_rights_receipt_ids: string[]
    privacy_receipt_id: string
  }
  budget: {
    estimated_run_credits: number
    per_run_credit_ceiling: number
    aggregate_committed_credits: number
    aggregate_credit_ceiling: number
    estimated_run_usd: number
    per_run_usd_ceiling: number
    aggregate_committed_usd: number
    aggregate_usd_ceiling: number
  }
  execution_boundary: {
    provider_calls_authorized: false
    provider_calls_executed: 0
    upload_authorized: false
    platform_draft_authorized: false
    scheduling_authorized: false
    publishing_authorized: false
    external_send_authorized: false
  }
  customer_artifacts: {
    internal_prompt_fields: []
    governance_text_included: false
  }
}

export type HeyGenLongFormReadiness = {
  readyForReview: boolean
  readyForProviderGeneration: false
  blockers: string[]
  selectedLookId: string | null
  selectedEnvironmentId: string | null
}

function parseTime(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function hasApprovedReceipt(receiptId: string, approved: string[]) {
  return receiptId.trim().length > 0 && approved.includes(receiptId)
}

function stableIndex(seed: string, length: number) {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) % length
}

export function selectDeterministicRotationOption(input: {
  seed: string
  options: HeyGenRotationOption[]
  previousId: string | null
}) {
  const eligible = input.options.filter((option) => option.capability_verified && option.id !== input.previousId)
  if (!eligible.length) return null
  return eligible[stableIndex(input.seed, eligible.length)]
}

export function evaluateHeyGenLongFormRecipe(input: {
  recipe: HeyGenLongFormProductionRecipe | null | undefined
  expectedContentVersion: string
  now?: string
}): HeyGenLongFormReadiness {
  const value = input.recipe
  if (!value) {
    return {
      readyForReview: false,
      readyForProviderGeneration: false,
      blockers: ['A version-bound HeyGen long-form production recipe is required.'],
      selectedLookId: null,
      selectedEnvironmentId: null,
    }
  }

  const blockers: string[] = []
  const now = parseTime(input.now ?? new Date().toISOString())
  const snapshotExpiresAt = parseTime(value.provider.capability_snapshot.expires_at)
  const outlierExpiresAt = parseTime(value.evidence.outlier.expires_at)

  if (value.version !== HEYGEN_LONG_FORM_RECIPE_VERSION) blockers.push('The production recipe version is unsupported.')
  if (value.status !== 'review_only') blockers.push('The production recipe must remain review-only.')
  if (!value.campaign.campaign_id.trim() || !value.campaign.content_id.trim() || value.campaign.content_version !== input.expectedContentVersion) blockers.push('The campaign or content version binding is stale.')
  if (!value.evidence.packet_id.trim() || !value.evidence.packet_version.trim() || !value.evidence.approval_receipt_id.trim()) blockers.push('An approved, versioned evidence packet is required.')

  if (value.evidence.product_proof_required && value.evidence.product_screenshots.length === 0) blockers.push('Product screenshots are required when the topic references Vambah’s work.')
  const approvedProductAssetIds = new Set(value.evidence.product_screenshots
    .filter((asset) => asset.asset_id.trim()
      && asset.sha256.startsWith('sha256:')
      && hasApprovedReceipt(asset.source_receipt_id, value.receipts.approved_source_receipt_ids)
      && hasApprovedReceipt(asset.rights_receipt_id, value.receipts.approved_rights_receipt_ids))
    .map((asset) => asset.asset_id))
  for (const asset of value.evidence.product_screenshots) {
    if (!asset.asset_id.trim() || !asset.sha256.startsWith('sha256:')) blockers.push('Every product screenshot needs an exact asset and SHA-256 binding.')
    if (!hasApprovedReceipt(asset.source_receipt_id, value.receipts.approved_source_receipt_ids)) blockers.push('A product screenshot source receipt is missing or unapproved.')
    if (!hasApprovedReceipt(asset.rights_receipt_id, value.receipts.approved_rights_receipt_ids)) blockers.push('A product screenshot rights receipt is missing or unapproved.')
  }
  if (!hasApprovedReceipt(value.evidence.outlier.source_receipt_id, value.receipts.approved_source_receipt_ids)) blockers.push('The outlier evidence source receipt is missing or unapproved.')
  if (now === null || outlierExpiresAt === null || outlierExpiresAt < now) blockers.push('The outlier packaging evidence is stale.')

  const master = value.deliverables.master
  if (!master.deliverable_id.trim() || master.duration_seconds <= 0 || !master.script_input_id.trim() || !master.title_input_id.trim() || !master.description_input_id.trim() || !master.thumbnail_input_id.trim()) blockers.push('The channel master needs bound script, title, description, thumbnail, aspect ratio, and duration inputs.')
  for (const derivative of value.deliverables.derivatives) {
    if (derivative.source_master_id !== master.deliverable_id || derivative.source_master_version !== value.campaign.content_version) blockers.push('A derivative is not fenced to the current channel master version.')
    if (derivative.inherited_evidence_packet_id !== value.evidence.packet_id || !derivative.packaging_input_id.trim()) blockers.push('A derivative needs inherited approved evidence and channel-native packaging.')
  }

  const capability = value.provider.capability_snapshot
  if (capability.version !== HEYGEN_CAPABILITY_SNAPSHOT_VERSION || !capability.account_capability_verified || !capability.duration_verified || !capability.credits_verified || snapshotExpiresAt === null || now === null || snapshotExpiresAt < now) blockers.push('Current HeyGen account capability, duration, and credits must be verified.')
  if (!capability.supported_engines.includes(value.provider.selected_engine)) blockers.push('The selected HeyGen engine is unsupported by the verified account capability snapshot.')
  if (value.provider.visual_clip_model && !capability.supported_visual_models.includes(value.provider.visual_clip_model)) blockers.push('The selected HeyGen visual clip model is unsupported by the verified account capability snapshot.')
  if (value.provider.selected_engine === 'avatar_v' && !value.provider.avatar_v_reference_look_id?.trim()) blockers.push('Avatar V requires a verified reference-look binding.')
  if (value.provider.production_route === 'video_agent' && value.provider.selected_engine !== 'video_agent') blockers.push('The Video Agent route requires the verified Video Agent engine.')
  if (value.provider.production_route === 'avatar_video_native_composite' && value.provider.selected_engine === 'video_agent') blockers.push('The native presenter composite route requires an Avatar Video engine.')
  if (!value.provider.avatar_identity_id.trim() || !value.provider.voice_id.trim()) blockers.push('Avatar identity and voice must be bound before review readiness.')

  const expectedLook = selectDeterministicRotationOption({ seed: `${value.rotation.seed}:look`, options: value.rotation.look_pool, previousId: value.rotation.previous_look_id })
  const expectedEnvironment = selectDeterministicRotationOption({ seed: `${value.rotation.seed}:environment`, options: value.rotation.environment_pool, previousId: value.rotation.previous_environment_id })
  const selectedLookId = value.rotation.override_look_id ?? value.rotation.proposed_look_id
  const selectedEnvironmentId = value.rotation.override_environment_id ?? value.rotation.proposed_environment_id
  if (!expectedLook || value.rotation.proposed_look_id !== expectedLook.id) blockers.push('The proposed avatar look does not match the deterministic eligible rotation.')
  if (!expectedEnvironment || value.rotation.proposed_environment_id !== expectedEnvironment.id) blockers.push('The proposed environment does not match the deterministic eligible rotation.')
  if (!value.rotation.look_pool.some((option) => option.id === selectedLookId && option.capability_verified)) blockers.push('The selected avatar look is unavailable or unverified.')
  if (!value.rotation.environment_pool.some((option) => option.id === selectedEnvironmentId && option.capability_verified)) blockers.push('The selected environment is unavailable or unverified.')
  if (selectedLookId === value.rotation.previous_look_id) blockers.push('The selected avatar look repeats the previous production.')
  if (selectedEnvironmentId === value.rotation.previous_environment_id) blockers.push('The selected environment repeats the previous production.')
  const verifiedLookIds = new Set(value.rotation.look_pool.filter((option) => option.capability_verified).map((option) => option.id))
  const verifiedEnvironmentIds = new Set(value.rotation.environment_pool.filter((option) => option.capability_verified).map((option) => option.id))

  let previousEnd = 0
  let hasProductDemo = false
  let hasBroll = false
  for (const [index, scene] of value.scene_plan.entries()) {
    if (index === 0 && Math.abs(scene.start_seconds) > 0.001) blockers.push('The first scene must start at 0 seconds.')
    if (!scene.scene_id.trim() || !scene.motion_prompt.trim() || scene.end_seconds <= scene.start_seconds || scene.start_seconds < previousEnd || scene.end_seconds > master.duration_seconds) blockers.push('Every scene needs ordered timing and a motion prompt inside the master duration.')
    if (index > 0 && Math.abs(scene.start_seconds - previousEnd) > 0.05) blockers.push('The scene plan contains an unbound timing gap.')
    previousEnd = scene.end_seconds
    if (!verifiedLookIds.has(scene.look_id)) blockers.push('Every scene avatar look must resolve to a capability-verified rotation entry.')
    if (!verifiedEnvironmentIds.has(scene.environment_id)) blockers.push('Every scene environment must resolve to a capability-verified rotation entry.')
    if (scene.product_asset_ids.some((assetId) => !approvedProductAssetIds.has(assetId))) blockers.push('Every scene product asset must resolve to an approved product screenshot with passing source and rights receipts.')
    if (scene.role === 'product_demo') hasProductDemo = true
    if (scene.role === 'b_roll') hasBroll = true
    if ((scene.role === 'product_demo' || scene.role === 'b_roll') && scene.product_asset_ids.length === 0) blockers.push('Product-demo and B-roll scenes require bound visual assets.')
    if (scene.generated_clip && (scene.generated_clip.model !== 'heygen_video_1' || scene.generated_clip.duration_seconds < HEYGEN_REVIEW_CAPABILITY_CATALOG.heygen_video_1.minimum_seconds || scene.generated_clip.duration_seconds > HEYGEN_REVIEW_CAPABILITY_CATALOG.heygen_video_1.maximum_seconds || value.provider.visual_clip_model !== scene.generated_clip.model)) blockers.push('HeyGen Video 1 scene clips must use the verified model and remain between 5 and 15 seconds.')
    if (scene.native_composite.required && (!scene.native_composite.source_media_is_visual_truth || !scene.native_composite.preserve_source_fps_and_duration || !scene.native_composite.mix_source_audio_at_scene_timestamps)) blockers.push('Native presenter and media composites must preserve source visuals, frame rate, duration, and timestamped audio.')
  }
  if (!value.scene_plan.length || !hasProductDemo || !hasBroll || Math.abs(previousEnd - master.duration_seconds) > 0.05) blockers.push('The long-form scene plan must cover the full master and include product-demo and B-roll timing.')

  if (!hasApprovedReceipt(value.music.authorization_receipt_id, value.receipts.approved_source_receipt_ids) || !hasApprovedReceipt(value.music.rights_receipt_id, value.receipts.approved_rights_receipt_ids)) blockers.push('Music authorization and rights receipts are required.')
  if (!value.receipts.privacy_receipt_id.trim()) blockers.push('A privacy receipt is required.')

  const budget = value.budget
  if ([budget.estimated_run_credits, budget.per_run_credit_ceiling, budget.aggregate_committed_credits, budget.aggregate_credit_ceiling, budget.estimated_run_usd, budget.per_run_usd_ceiling, budget.aggregate_committed_usd, budget.aggregate_usd_ceiling].some((amount) => !Number.isFinite(amount) || amount < 0)) blockers.push('Credit and cost estimates and ceilings must be explicit non-negative numbers.')
  if (budget.estimated_run_credits > budget.per_run_credit_ceiling || budget.aggregate_committed_credits + budget.estimated_run_credits > budget.aggregate_credit_ceiling || budget.estimated_run_usd > budget.per_run_usd_ceiling || budget.aggregate_committed_usd + budget.estimated_run_usd > budget.aggregate_usd_ceiling) blockers.push('The planned run exceeds its provider-credit or cost ceiling.')

  const boundary = value.execution_boundary
  if (boundary.provider_calls_authorized !== false || boundary.provider_calls_executed !== 0 || boundary.upload_authorized !== false || boundary.platform_draft_authorized !== false || boundary.scheduling_authorized !== false || boundary.publishing_authorized !== false || boundary.external_send_authorized !== false) blockers.push('Provider, upload, draft, scheduling, publishing, and external-send gates must remain closed.')
  if (value.customer_artifacts.internal_prompt_fields.length !== 0 || value.customer_artifacts.governance_text_included) blockers.push('Customer-facing artifacts cannot contain internal prompts or governance text.')

  return {
    readyForReview: blockers.length === 0,
    readyForProviderGeneration: false,
    blockers: [...new Set(blockers)],
    selectedLookId,
    selectedEnvironmentId,
  }
}
