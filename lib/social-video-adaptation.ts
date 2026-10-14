export const SOCIAL_VIDEO_ADAPTATION_VERSION = 'social_video_adaptation_v1' as const

export const SOCIAL_VIDEO_ADAPTATION_RECEIPT_KINDS = [
  'source',
  'voice',
  'framework',
  'privacy',
  'visual',
  'rights',
  'challenger',
  'script_quality',
] as const

export type SocialVideoAdaptationReceiptKind = (typeof SOCIAL_VIDEO_ADAPTATION_RECEIPT_KINDS)[number]
export type SocialVideoTarget = 'youtube_long_form' | 'youtube_shorts'
export type SocialVideoTargetDecision = 'long_form' | 'shorts' | 'both'

export type SocialVideoAdaptationReceipt = {
  receipt_id: string
  kind: SocialVideoAdaptationReceiptKind
  status: 'approved' | 'passed' | 'complete' | 'pending' | 'blocked'
  input_version: string
  reviewed_at: string
  valid_until?: string | null
}

export type SocialVideoSourceIdentity = {
  campaign_id: string
  product_id: string
  topic_id: string
  source_ids: string[]
  channel_packet_ids: string[]
}

export type SocialVideoClaim = {
  claim_id: string
  text: string
  source_receipt_ids: string[]
  proof_receipt_ids: string[]
  privacy_boundary: string
}

export type SocialVideoEvidenceAsset = {
  asset_id: string
  asset_type: 'product_screenshot' | 'gameplay_capture' | 'dashboard_capture' | 'workflow_capture' | 'diagram' | 'document' | 'product_image'
  label: string
  reference: string
  source_receipt_ids: string[]
  privacy_receipt_id: string
  rights_receipt_id: string
  approved_use: string
}

export type SocialVideoScene = {
  scene_id: string
  target: SocialVideoTarget
  purpose: string
  narration: string
  claim_ids: string[]
  artifact_ids: string[]
  source_receipt_ids: string[]
  on_screen_text: string[]
  motion_direction: string
}

export type SocialVideoShot = {
  shot_id: string
  scene_id: string
  artifact_id: string
  framing: string
  action: string
  source_receipt_ids: string[]
  privacy_boundary: string
}

export type SocialVideoAdaptationDraft = {
  title_options: Array<{
    title: string
    targets: SocialVideoTarget[]
    promise: string
    claim_ids: string[]
  }>
  format_adaptations: Array<{
    target: SocialVideoTarget
    opening_hook: string
    full_spoken_script: string
    target_duration_seconds: number
    adaptation_rationale: string
  }>
  practical_value: string
  why_artifact_matters: string
  scenes: SocialVideoScene[]
  shot_plan: SocialVideoShot[]
  thumbnail_brief: {
    headline: string
    visual_subject: string
    artifact_ids: string[]
    claim_ids: string[]
    source_receipt_ids: string[]
    composition: string
    mobile_readability_note: string
  }
  composition_rationale: {
    dominant_composition: string
    why_this_structure: string
    motion_rationale: string
    recent_approved_compositions: string[]
    composition_reuse_rationale?: string | null
  }
  traceability_summary: string
}

export type SocialVideoAdaptationInput = {
  adaptation_id: string
  generated_at: string
  input_version: string
  target_decision: SocialVideoTargetDecision
  identity: SocialVideoSourceIdentity
  source_channel_packet: {
    campaign_id: string
    product_id: string
    topic_id: string
    source_ids: string[]
    channel_packet_ids: string[]
    linkedin_copy: string
  }
  receipts: Partial<Record<SocialVideoAdaptationReceiptKind, SocialVideoAdaptationReceipt>>
  claims: SocialVideoClaim[]
  evidence_assets: SocialVideoEvidenceAsset[]
  draft: SocialVideoAdaptationDraft
}

export type SocialVideoAdaptationReadiness = {
  ready: boolean
  blockers: string[]
  targets: SocialVideoTarget[]
}

export type SocialVideoAdaptationPacket = Omit<SocialVideoAdaptationInput, 'receipts'> & {
  version: typeof SOCIAL_VIDEO_ADAPTATION_VERSION
  status: 'ready_for_render_approval'
  targets: SocialVideoTarget[]
  receipts: Record<SocialVideoAdaptationReceiptKind, SocialVideoAdaptationReceipt>
  video_generation_bridge: {
    status: 'manual_draft_packet_ready'
    route: '/admin/content/video-generation'
    render_gate: 'explicit_approval_required'
    approval_boundary: string
    side_effects: {
      provider_generation: false
      render: false
      upload: false
      platform_draft: false
      schedule: false
      publish: false
      external_send: false
      credential_change: false
      spending: false
    }
  }
}

export class SocialVideoAdaptationError extends Error {
  blockers: string[]

  constructor(blockers: string[]) {
    super(blockers.join(' '))
    this.name = 'SocialVideoAdaptationError'
    this.blockers = blockers
  }
}

function targetsForDecision(decision: SocialVideoTargetDecision): SocialVideoTarget[] {
  if (decision === 'long_form') return ['youtube_long_form']
  if (decision === 'shorts') return ['youtube_shorts']
  return ['youtube_long_form', 'youtube_shorts']
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function sameSet(left: string[], right: string[]) {
  const a = unique(left).sort()
  const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function validTimestamp(value: string) {
  return Number.isFinite(Date.parse(value))
}

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((word) => word.length > 2)
}

function isThinLinkedInRestatement(linkedinCopy: string, script: string) {
  const source = normalizedWords(linkedinCopy)
  const adapted = normalizedWords(script)
  if (!source.length || !adapted.length) return false
  if (source.join(' ') === adapted.join(' ')) return true
  const sourceWords = new Set(source)
  const overlap = adapted.filter((word) => sourceWords.has(word)).length / adapted.length
  return overlap >= 0.82 && adapted.length <= source.length * 1.5
}

function receiptPassed(receipt: SocialVideoAdaptationReceipt | undefined) {
  return Boolean(receipt && ['approved', 'passed', 'complete'].includes(receipt.status))
}

function minScriptCharacters(targets: SocialVideoTarget[]) {
  return targets.includes('youtube_long_form') ? 600 : 160
}

export function evaluateSocialVideoAdaptation(input: SocialVideoAdaptationInput): SocialVideoAdaptationReadiness {
  const blockers: string[] = []
  const targets = targetsForDecision(input.target_decision)
  const generatedAt = Date.parse(input.generated_at)

  if (!text(input.adaptation_id) || !text(input.input_version) || !validTimestamp(input.generated_at)) {
    blockers.push('Adaptation identity, input version, and generated timestamp are required.')
  }

  const identityFields = ['campaign_id', 'product_id', 'topic_id'] as const
  for (const field of identityFields) {
    if (!text(input.identity[field]) || input.identity[field] !== input.source_channel_packet[field]) {
      blockers.push(`Stable ${field.replace('_', ' ')} is missing or conflicts with the source channel packet.`)
    }
  }
  if (!input.identity.source_ids.length || !sameSet(input.identity.source_ids, input.source_channel_packet.source_ids)) {
    blockers.push('Stable source identities are missing or conflict with the source channel packet.')
  }
  if (!input.identity.channel_packet_ids.length || !sameSet(input.identity.channel_packet_ids, input.source_channel_packet.channel_packet_ids)) {
    blockers.push('Channel packet identities are missing or conflict with the approved source packet.')
  }
  if (!text(input.source_channel_packet.linkedin_copy)) blockers.push('The approved source channel copy is missing.')

  for (const kind of SOCIAL_VIDEO_ADAPTATION_RECEIPT_KINDS) {
    const receipt = input.receipts[kind]
    if (!receipt || receipt.kind !== kind || !text(receipt.receipt_id)) {
      blockers.push(`Required ${kind.replace('_', ' ')} receipt is missing.`)
      continue
    }
    if (!receiptPassed(receipt)) blockers.push(`${kind.replace('_', ' ')} receipt has not passed.`)
    if (receipt.input_version !== input.input_version) blockers.push(`${kind.replace('_', ' ')} receipt is stale for the current input version.`)
    if (!validTimestamp(receipt.reviewed_at)) blockers.push(`${kind.replace('_', ' ')} receipt has no valid review timestamp.`)
    if (receipt.valid_until && (!validTimestamp(receipt.valid_until) || Date.parse(receipt.valid_until) < generatedAt)) {
      blockers.push(`${kind.replace('_', ' ')} receipt expired before this packet was generated.`)
    }
  }

  const receiptIds = new Set(Object.values(input.receipts).map((receipt) => text(receipt?.receipt_id)).filter(Boolean))
  const sourceReceiptId = text(input.receipts.source?.receipt_id)
  const privacyReceiptId = text(input.receipts.privacy?.receipt_id)
  const rightsReceiptId = text(input.receipts.rights?.receipt_id)
  const visualReceiptId = text(input.receipts.visual?.receipt_id)
  const claimIds = new Set<string>()
  for (const claim of input.claims) {
    if (!text(claim.claim_id) || claimIds.has(claim.claim_id)) blockers.push('Every claim requires a unique stable claim identity.')
    claimIds.add(claim.claim_id)
    if (!text(claim.text) || !text(claim.privacy_boundary)) blockers.push(`Claim ${claim.claim_id || '(missing id)'} requires text and a privacy boundary.`)
    if (!claim.source_receipt_ids.includes(sourceReceiptId) || claim.source_receipt_ids.some((id) => !receiptIds.has(id))) {
      blockers.push(`Claim ${claim.claim_id || '(missing id)'} is not bound to current source receipts.`)
    }
    if (!claim.proof_receipt_ids.length || claim.proof_receipt_ids.some((id) => !receiptIds.has(id))) {
      blockers.push(`Claim ${claim.claim_id || '(missing id)'} is not bound to current proof receipts.`)
    }
  }
  if (!input.claims.length) blockers.push('At least one source-bound customer-facing claim is required.')

  const artifactIds = new Set<string>()
  for (const asset of input.evidence_assets) {
    if (!text(asset.asset_id) || artifactIds.has(asset.asset_id)) blockers.push('Every evidence artifact requires a unique stable identity.')
    artifactIds.add(asset.asset_id)
    if (!text(asset.label) || !text(asset.reference) || !text(asset.approved_use)) {
      blockers.push(`Evidence artifact ${asset.asset_id || '(missing id)'} needs a label, reference, and approved-use boundary.`)
    }
    if (!asset.source_receipt_ids.length || asset.source_receipt_ids.some((id) => !receiptIds.has(id)) || !asset.source_receipt_ids.includes(sourceReceiptId)) {
      blockers.push(`Evidence artifact ${asset.asset_id || '(missing id)'} is not bound to the current source receipt.`)
    }
    if (asset.privacy_receipt_id !== privacyReceiptId || asset.rights_receipt_id !== rightsReceiptId) {
      blockers.push(`Evidence artifact ${asset.asset_id || '(missing id)'} is missing current privacy or rights clearance.`)
    }
  }
  if (!input.evidence_assets.length) blockers.push('At least one approved screenshot, gameplay capture, dashboard, diagram, or other evidence artifact is required.')

  const draft = input.draft
  if (draft.title_options.length < 2) blockers.push('At least two artifact-specific title options are required.')
  for (const option of draft.title_options) {
    if (!text(option.title) || !text(option.promise) || !option.targets.length) blockers.push('Every title option needs a title, audience promise, and explicit target format.')
    if (option.targets.some((target) => !targets.includes(target))) blockers.push('Title options cannot target an unsupported format.')
    if (!option.claim_ids.length || option.claim_ids.some((id) => !claimIds.has(id))) blockers.push('Every title option must bind to a valid customer-facing claim.')
  }
  for (const target of targets) {
    if (!draft.title_options.some((option) => option.targets.includes(target))) blockers.push(`No title option supports ${target}.`)
  }
  for (const target of targets) {
    const adaptations = draft.format_adaptations.filter((adaptation) => adaptation.target === target)
    if (adaptations.length !== 1) {
      blockers.push(`${target} requires exactly one format-specific spoken-script adaptation.`)
      continue
    }
    const adaptation = adaptations[0]
    if (text(adaptation.opening_hook).length < 30) blockers.push(`${target} opening hook must establish a concrete artifact-specific tension.`)
    if (text(adaptation.full_spoken_script).length < minScriptCharacters([target])) blockers.push(`${target} full spoken script is too thin for the selected format.`)
    if (!Number.isFinite(adaptation.target_duration_seconds) || adaptation.target_duration_seconds <= 0) blockers.push(`${target} requires a positive target duration.`)
    if (text(adaptation.adaptation_rationale).length < 30) blockers.push(`${target} requires a format-specific adaptation rationale.`)
    if (isThinLinkedInRestatement(input.source_channel_packet.linkedin_copy, adaptation.full_spoken_script)) {
      blockers.push(`${target} script merely restates the LinkedIn copy instead of adapting the artifact for video.`)
    }
  }
  if (draft.format_adaptations.some((adaptation) => !targets.includes(adaptation.target))) blockers.push('Format adaptations cannot target an unsupported format.')
  if (text(draft.practical_value).length < 30 || text(draft.why_artifact_matters).length < 30 || text(draft.traceability_summary).length < 30) {
    blockers.push('Practical value, why the artifact matters, and traceability must each be explicit.')
  }

  const sceneIds = new Set<string>()
  for (const scene of draft.scenes) {
    if (!text(scene.scene_id) || sceneIds.has(scene.scene_id)) blockers.push('Every scene requires a unique stable identity.')
    sceneIds.add(scene.scene_id)
    if (!targets.includes(scene.target)) blockers.push(`Scene ${scene.scene_id || '(missing id)'} targets an unsupported format.`)
    if (!text(scene.purpose) || !text(scene.narration) || !text(scene.motion_direction)) blockers.push(`Scene ${scene.scene_id || '(missing id)'} lacks purpose, narration, or motion direction.`)
    if (!scene.claim_ids.length || scene.claim_ids.some((id) => !claimIds.has(id))) blockers.push(`Scene ${scene.scene_id || '(missing id)'} has missing or invalid claim bindings.`)
    if (!scene.artifact_ids.length || scene.artifact_ids.some((id) => !artifactIds.has(id))) blockers.push(`Scene ${scene.scene_id || '(missing id)'} has missing or invalid artifact bindings.`)
    if (!scene.source_receipt_ids.includes(sourceReceiptId) || scene.source_receipt_ids.some((id) => !receiptIds.has(id))) blockers.push(`Scene ${scene.scene_id || '(missing id)'} has missing or invalid source receipts.`)
    if (!scene.on_screen_text.length || scene.on_screen_text.some((value) => !text(value))) blockers.push(`Scene ${scene.scene_id || '(missing id)'} needs bounded on-screen text.`)
  }
  for (const target of targets) {
    const minimumScenes = target === 'youtube_long_form' ? 4 : 3
    if (draft.scenes.filter((scene) => scene.target === target).length < minimumScenes) {
      blockers.push(`${target} requires at least ${minimumScenes} source-bound storyboard scenes.`)
    }
  }

  const shotIds = new Set<string>()
  for (const shot of draft.shot_plan) {
    if (!text(shot.shot_id) || shotIds.has(shot.shot_id) || !sceneIds.has(shot.scene_id) || !artifactIds.has(shot.artifact_id)) blockers.push('Every shot must bind a unique shot identity to a valid scene and evidence artifact.')
    shotIds.add(shot.shot_id)
    if (!text(shot.framing) || !text(shot.action) || !text(shot.privacy_boundary)) blockers.push(`Shot ${shot.shot_id || '(missing id)'} lacks framing, action, or a privacy boundary.`)
    if (!shot.source_receipt_ids.includes(sourceReceiptId) || shot.source_receipt_ids.some((id) => !receiptIds.has(id))) blockers.push(`Shot ${shot.shot_id || '(missing id)'} has missing or invalid source receipts.`)
  }
  for (const scene of draft.scenes) {
    if (!draft.shot_plan.some((shot) => shot.scene_id === scene.scene_id)) blockers.push(`Scene ${scene.scene_id} has no B-roll, screenshot, gameplay, or artifact shot plan.`)
  }

  const thumbnail = draft.thumbnail_brief
  if (!text(thumbnail.headline) || !text(thumbnail.visual_subject) || !text(thumbnail.composition) || !text(thumbnail.mobile_readability_note)) {
    blockers.push('Thumbnail or cover brief is incomplete.')
  }
  if (!thumbnail.artifact_ids.length || thumbnail.artifact_ids.some((id) => !artifactIds.has(id))) blockers.push('Thumbnail or cover brief must use approved evidence artifacts.')
  if (!thumbnail.claim_ids.length || thumbnail.claim_ids.some((id) => !claimIds.has(id))) blockers.push('Thumbnail or cover brief must bind to valid claims.')
  if (!thumbnail.source_receipt_ids.includes(sourceReceiptId) || !thumbnail.source_receipt_ids.includes(visualReceiptId)) {
    blockers.push('Thumbnail or cover brief requires current source and visual receipts.')
  }

  const composition = draft.composition_rationale
  if (!text(composition.dominant_composition) || !text(composition.why_this_structure) || !text(composition.motion_rationale)) {
    blockers.push('Composition and motion rationale are required so the packet is not a generic repeated template.')
  }
  if (
    composition.recent_approved_compositions.includes(composition.dominant_composition)
    && !text(composition.composition_reuse_rationale)
  ) {
    blockers.push('A recently approved composition cannot be reused without an artifact-specific rationale.')
  }

  return { ready: blockers.length === 0, blockers: unique(blockers), targets }
}

export function buildSocialVideoAdaptationPacket(input: SocialVideoAdaptationInput): SocialVideoAdaptationPacket {
  const readiness = evaluateSocialVideoAdaptation(input)
  if (!readiness.ready) throw new SocialVideoAdaptationError(readiness.blockers)

  return {
    ...input,
    version: SOCIAL_VIDEO_ADAPTATION_VERSION,
    status: 'ready_for_render_approval',
    targets: readiness.targets,
    receipts: input.receipts as Record<SocialVideoAdaptationReceiptKind, SocialVideoAdaptationReceipt>,
    video_generation_bridge: {
      status: 'manual_draft_packet_ready',
      route: '/admin/content/video-generation',
      render_gate: 'explicit_approval_required',
      approval_boundary: 'This packet may be reviewed or imported as a manual Video Generation draft only. Rendering, provider calls, uploads, platform drafts, scheduling, publishing, external sends, credentials, and spending remain separately approved actions.',
      side_effects: {
        provider_generation: false,
        render: false,
        upload: false,
        platform_draft: false,
        schedule: false,
        publish: false,
        external_send: false,
        credential_change: false,
        spending: false,
      },
    },
  }
}
