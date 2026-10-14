export const SOCIAL_VIDEO_ADAPTATION_VERSION = 'social_video_adaptation_v1' as const
export const SOCIAL_VIDEO_ADAPTATION_SOURCE_VERSION = 'social_video_adaptation_source_v1' as const
export const SOCIAL_VIDEO_ADAPTATION_SOURCE_METADATA_KEY = 'artifact_video_adaptation_source' as const

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

export type SocialVideoAdaptationSourceInput = Omit<SocialVideoAdaptationInput, 'draft'> & {
  source_version: typeof SOCIAL_VIDEO_ADAPTATION_SOURCE_VERSION
  artifact_semantics: {
    product_label: string
    subject_label: string
    audience_problem: string
    operating_tension: string
    practical_value: string
    why_artifact_matters: string
    closing_principle: string
    thumbnail_promise: string
    evidence_regions: Array<{
      region_id: string
      asset_id: string
      label: string
      description: string
      claim_ids: string[]
      on_screen_text: string
    }>
    process_steps: Array<{
      step_id: string
      label: string
      description: string
      claim_ids: string[]
      evidence_region_ids: string[]
    }>
    recent_approved_compositions: string[]
    composition_reuse_rationale?: string | null
  }
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

function compositionForAsset(asset: SocialVideoEvidenceAsset) {
  if (asset.asset_type === 'gameplay_capture') {
    return {
      name: 'gameplay_decision_sequence',
      structure: 'Use the real gameplay state as the visual anchor, then follow the player decision, product response, and traceable learning value.',
      motion: 'Hold the full board or gameplay state first, then crop to the decision region and follow the approved sequence without inventing unrecorded play.',
    }
  }
  if (asset.asset_type === 'dashboard_capture') {
    return {
      name: 'dashboard_evidence_path',
      structure: 'Use the real dashboard as the visual anchor, then follow its evidence regions in the same order an operator uses them to make a decision.',
      motion: 'Begin with the full dashboard, move between approved evidence regions, and pause at each decision or receipt boundary for inspection.',
    }
  }
  if (asset.asset_type === 'workflow_capture') {
    return {
      name: 'workflow_handoff_path',
      structure: 'Use the real workflow capture as the visual anchor and follow the handoff from input through decision to the bounded next action.',
      motion: 'Trace the approved workflow path in order, retaining enough surrounding context to keep ownership and gates legible.',
    }
  }
  if (asset.asset_type === 'diagram') {
    return {
      name: 'diagram_explainer_path',
      structure: 'Use the approved diagram as the visual anchor and reveal its relationships in the order needed to understand the operating model.',
      motion: 'Reveal one approved diagram relationship at a time and return to the full model before the conclusion.',
    }
  }
  return {
    name: 'artifact_evidence_walkthrough',
    structure: 'Use the approved artifact as the visual anchor and organize the explanation around its evidence regions, process, value, and traceability.',
    motion: 'Begin with the full artifact, move only to approved evidence regions, and return to the complete artifact for the final principle.',
  }
}

function privacyBoundaryForClaims(claims: SocialVideoClaim[], claimIds: string[]) {
  return unique(claims
    .filter((claim) => claimIds.includes(claim.claim_id))
    .map((claim) => claim.privacy_boundary))
    .join(' ')
}

export function produceSocialVideoAdaptationInput(
  source: SocialVideoAdaptationSourceInput,
): SocialVideoAdaptationInput {
  const blockers: string[] = []
  const semantics = source.artifact_semantics
  const targets = targetsForDecision(source.target_decision)
  const assetsById = new Map(source.evidence_assets.map((asset) => [asset.asset_id, asset]))
  const claimsById = new Map(source.claims.map((claim) => [claim.claim_id, claim]))
  const regionsById = new Map(semantics.evidence_regions.map((region) => [region.region_id, region]))

  const requiredNarrative = [
    ['product label', semantics.product_label, 2],
    ['subject label', semantics.subject_label, 8],
    ['audience problem', semantics.audience_problem, 30],
    ['operating tension', semantics.operating_tension, 30],
    ['practical value', semantics.practical_value, 30],
    ['why the artifact matters', semantics.why_artifact_matters, 30],
    ['closing principle', semantics.closing_principle, 30],
    ['thumbnail promise', semantics.thumbnail_promise, 8],
  ] as const
  if (source.source_version !== SOCIAL_VIDEO_ADAPTATION_SOURCE_VERSION) blockers.push('Artifact adaptation source contract is missing or unsupported.')
  for (const [label, value, minimumLength] of requiredNarrative) {
    if (text(value).length < minimumLength) blockers.push(`Artifact semantics require a specific ${label}.`)
  }
  if (semantics.process_steps.length < 2) blockers.push('Artifact semantics require at least two evidence-backed process steps.')
  if (semantics.evidence_regions.length < 2) blockers.push('Artifact semantics require at least two inspectable evidence regions.')
  for (const region of semantics.evidence_regions) {
    if (!text(region.region_id) || !assetsById.has(region.asset_id) || !text(region.label) || !text(region.description) || !text(region.on_screen_text)) {
      blockers.push(`Evidence region ${region.region_id || '(missing id)'} is incomplete or references an unknown artifact.`)
    }
    if (!region.claim_ids.length || region.claim_ids.some((claimId) => !claimsById.has(claimId))) blockers.push(`Evidence region ${region.region_id || '(missing id)'} has invalid claim bindings.`)
  }
  for (const step of semantics.process_steps) {
    if (!text(step.step_id) || !text(step.label) || !text(step.description)) blockers.push(`Process step ${step.step_id || '(missing id)'} is incomplete.`)
    if (!step.claim_ids.length || step.claim_ids.some((claimId) => !claimsById.has(claimId))) blockers.push(`Process step ${step.step_id || '(missing id)'} has invalid claim bindings.`)
    if (!step.evidence_region_ids.length || step.evidence_region_ids.some((regionId) => !regionsById.has(regionId))) blockers.push(`Process step ${step.step_id || '(missing id)'} has invalid evidence-region bindings.`)
  }
  if (blockers.length) throw new SocialVideoAdaptationError(unique(blockers))

  const primaryRegion = semantics.evidence_regions[0]
  const finalRegion = semantics.evidence_regions[semantics.evidence_regions.length - 1]
  const primaryAsset = assetsById.get(primaryRegion.asset_id)!
  const composition = compositionForAsset(primaryAsset)
  const allClaimIds = unique(semantics.process_steps.flatMap((step) => step.claim_ids))
  const sourceReceiptIds = unique(source.evidence_assets.flatMap((asset) => asset.source_receipt_ids))
  const visualReceiptId = text(source.receipts.visual?.receipt_id)
  const thumbnailReceiptIds = unique([...sourceReceiptIds, visualReceiptId])
  const processNarration = semantics.process_steps.map((step, index) => {
    const regionLabels = step.evidence_region_ids.map((id) => regionsById.get(id)?.label).filter(Boolean).join(' and ')
    return `Step ${index + 1}, ${step.label}. ${step.description} The approved ${regionLabels} evidence keeps this explanation tied to what the artifact actually shows.`
  })
  const traceabilityLine = `Every customer-facing claim in this adaptation remains bound to ${source.identity.source_ids.length} approved source identities, ${source.evidence_assets.length} cleared artifact${source.evidence_assets.length === 1 ? '' : 's'}, and the current privacy, rights, challenger, and script-quality receipts.`
  const longHook = semantics.operating_tension
  const shortHook = `${semantics.operating_tension} ${semantics.subject_label} makes that tension visible.`
  const longScript = [
    longHook,
    semantics.audience_problem,
    `${semantics.subject_label} gives us a concrete ${primaryAsset.asset_type.replaceAll('_', ' ')} to inspect. We will use its approved evidence regions rather than turning the source copy into a generic talking-head summary.`,
    ...processNarration,
    semantics.practical_value,
    semantics.why_artifact_matters,
    traceabilityLine,
    semantics.closing_principle,
  ].join('\n\n')
  const shortScript = [
    shortHook,
    semantics.audience_problem,
    ...semantics.process_steps.map((step) => `${step.label}: ${step.description}`),
    semantics.practical_value,
    traceabilityLine,
    semantics.closing_principle,
  ].join(' ')

  const scenes: SocialVideoScene[] = []
  const addScene = (input: {
    id: string
    target: SocialVideoTarget
    purpose: string
    narration: string
    claimIds: string[]
    regionIds: string[]
    onScreenText: string[]
  }) => {
    const regions = input.regionIds.map((id) => regionsById.get(id)!).filter(Boolean)
    const artifactIds = unique(regions.map((region) => region.asset_id))
    const regionAssets = artifactIds.map((id) => assetsById.get(id)!).filter(Boolean)
    scenes.push({
      scene_id: input.id,
      target: input.target,
      purpose: input.purpose,
      narration: input.narration,
      claim_ids: unique(input.claimIds),
      artifact_ids: artifactIds,
      source_receipt_ids: unique(regionAssets.flatMap((asset) => asset.source_receipt_ids)),
      on_screen_text: input.onScreenText,
      motion_direction: composition.motion,
    })
  }

  if (targets.includes('youtube_long_form')) {
    addScene({ id: 'long-hook', target: 'youtube_long_form', purpose: 'Establish the artifact-specific operating tension.', narration: longHook, claimIds: primaryRegion.claim_ids, regionIds: [primaryRegion.region_id], onScreenText: [primaryRegion.on_screen_text] })
    for (const step of semantics.process_steps) {
      addScene({ id: `long-${step.step_id}`, target: 'youtube_long_form', purpose: `Teach ${step.label} through approved artifact evidence.`, narration: `${step.label}. ${step.description}`, claimIds: step.claim_ids, regionIds: step.evidence_region_ids, onScreenText: step.evidence_region_ids.map((id) => regionsById.get(id)!.on_screen_text) })
    }
    addScene({ id: 'long-value', target: 'youtube_long_form', purpose: 'Explain practical value and why the artifact matters.', narration: `${semantics.practical_value} ${semantics.why_artifact_matters}`, claimIds: finalRegion.claim_ids, regionIds: [finalRegion.region_id], onScreenText: [semantics.thumbnail_promise] })
    addScene({ id: 'long-traceability', target: 'youtube_long_form', purpose: 'Close on traceability and the bounded next action.', narration: `${traceabilityLine} ${semantics.closing_principle}`, claimIds: allClaimIds, regionIds: [primaryRegion.region_id, finalRegion.region_id], onScreenText: ['Source → evidence → decision → boundary'] })
  }
  if (targets.includes('youtube_shorts')) {
    addScene({ id: 'short-hook', target: 'youtube_shorts', purpose: 'Name the artifact-specific tension in the opening seconds.', narration: shortHook, claimIds: primaryRegion.claim_ids, regionIds: [primaryRegion.region_id], onScreenText: [primaryRegion.on_screen_text] })
    addScene({ id: 'short-process', target: 'youtube_shorts', purpose: 'Compress the approved process into one evidence sequence.', narration: semantics.process_steps.map((step) => `${step.label}: ${step.description}`).join(' '), claimIds: allClaimIds, regionIds: unique(semantics.process_steps.flatMap((step) => step.evidence_region_ids)), onScreenText: semantics.process_steps.map((step) => step.label) })
    addScene({ id: 'short-close', target: 'youtube_shorts', purpose: 'Close on practical value and traceability.', narration: `${semantics.practical_value} ${semantics.closing_principle}`, claimIds: finalRegion.claim_ids, regionIds: [finalRegion.region_id], onScreenText: [semantics.thumbnail_promise] })
  }

  const shotPlan: SocialVideoShot[] = scenes.flatMap((scene) => scene.artifact_ids.map((artifactId, artifactIndex) => {
    const asset = assetsById.get(artifactId)!
    return {
      shot_id: `${scene.scene_id}-shot-${artifactIndex + 1}`,
      scene_id: scene.scene_id,
      artifact_id: artifactId,
      framing: scene.scene_id.endsWith('hook') ? `Establish the complete ${asset.label}.` : `Crop to the evidence region named by the scene while retaining enough ${semantics.subject_label} context to remain legible.`,
      action: composition.motion,
      source_receipt_ids: asset.source_receipt_ids,
      privacy_boundary: `${asset.approved_use} ${privacyBoundaryForClaims(source.claims, scene.claim_ids)}`,
    }
  }))

  return {
    adaptation_id: source.adaptation_id,
    generated_at: source.generated_at,
    input_version: source.input_version,
    target_decision: source.target_decision,
    identity: source.identity,
    source_channel_packet: source.source_channel_packet,
    receipts: source.receipts,
    claims: source.claims,
    evidence_assets: source.evidence_assets,
    draft: {
      title_options: [
        { title: `${semantics.product_label}: what the artifact makes visible`, targets, promise: semantics.thumbnail_promise, claim_ids: allClaimIds },
        { title: `The process behind ${semantics.subject_label}`, targets, promise: semantics.practical_value, claim_ids: allClaimIds },
      ],
      format_adaptations: targets.map((target) => ({
        target,
        opening_hook: target === 'youtube_long_form' ? longHook : shortHook,
        full_spoken_script: target === 'youtube_long_form' ? longScript : shortScript,
        target_duration_seconds: target === 'youtube_long_form' ? Math.max(240, Math.ceil(longScript.split(/\s+/).length / 2.2)) : 45,
        adaptation_rationale: target === 'youtube_long_form'
          ? `Long form follows ${semantics.subject_label} through its approved evidence regions, process, value, and receipt trail with time for inspection.`
          : `Shorts compresses ${semantics.subject_label} into one tension, one evidence sequence, and one traceable operating principle.`,
      })),
      practical_value: semantics.practical_value,
      why_artifact_matters: semantics.why_artifact_matters,
      scenes,
      shot_plan: shotPlan,
      thumbnail_brief: {
        headline: semantics.thumbnail_promise,
        visual_subject: `${semantics.subject_label}, anchored by ${primaryAsset.label}.`,
        artifact_ids: [primaryAsset.asset_id],
        claim_ids: allClaimIds,
        source_receipt_ids: thumbnailReceiptIds,
        composition: `${composition.structure} Use one artifact-specific evidence path rather than a generic repeated card layout.`,
        mobile_readability_note: `Keep ${semantics.subject_label} recognizable at phone size and preserve the evidence region that supports the promise.`,
      },
      composition_rationale: {
        dominant_composition: composition.name,
        why_this_structure: composition.structure,
        motion_rationale: composition.motion,
        recent_approved_compositions: semantics.recent_approved_compositions,
        composition_reuse_rationale: semantics.composition_reuse_rationale,
      },
      traceability_summary: traceabilityLine,
    },
  }
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
