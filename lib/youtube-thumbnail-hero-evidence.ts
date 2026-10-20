export const YOUTUBE_THUMBNAIL_HERO_EVIDENCE_VERSION = 'youtube-thumbnail-hero-evidence/v2' as const

export const YOUTUBE_THUMBNAIL_CREATIVE_DECISIONS = ['hero_selection', 'composition', 'typography', 'teaser', 'contrast', 'visual_style'] as const
export const YOUTUBE_THUMBNAIL_INTERNAL_WORKFLOW_MARKERS = ['review only', 'draft', 'fixture', 'sample data', 'operator', 'internal', 'prompt', 'qa'] as const

export type YouTubeThumbnailHeroEvidenceValidation = { ready: boolean; review_ready: boolean; fixture_ready: boolean; blockers: string[]; recovery_actions: string[] }
type UnknownRecord = Record<string, unknown>
const record = (value: unknown): UnknownRecord | null => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const values = (value: unknown) => Array.isArray(value) ? value : []
const strings = (value: unknown) => values(value).map(text).filter(Boolean)
const sha256 = (value: unknown) => /^sha256:[a-f0-9]{64}$/i.test(text(value))
const pHash = (value: unknown) => /^[a-f0-9]{16}$/i.test(text(value))
const validDate = (value: unknown) => Number.isFinite(Date.parse(text(value))) ? Date.parse(text(value)) : null
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0

function hamming(a: string, b: string) {
  if (!pHash(a) || !pHash(b)) return 0
  let distance = 0
  for (let index = 0; index < a.length; index += 1) { let xor = Number.parseInt(a[index], 16) ^ Number.parseInt(b[index], 16); while (xor) { distance += xor & 1; xor >>= 1 } }
  return distance
}

function containsInternalWorkflowMarker(copy: string[]) {
  const normalized = copy.join(' ').toLowerCase()
  return YOUTUBE_THUMBNAIL_INTERNAL_WORKFLOW_MARKERS.some((marker) => new RegExp(`\\b${marker.replace(' ', '\\s+')}\\b`, 'i').test(normalized))
}

function genericOrSplit(candidate: UnknownRecord) {
  const signature = `${text(candidate.layout_family)} ${text(candidate.composition_signature)}`.toLowerCase()
  return ['generic-fallback', 'shared-template', 'dashboard', 'field-guide', 'text-first', 'multi-panel', 'split-screen', 'side-by-side', 'left-right-split', 'portrait-plus-screenshot'].some((token) => signature.includes(token))
}

export function validateYouTubeThumbnailHeroEvidence(value: unknown, currentContentVersion: string, evaluationAsOf = new Date().toISOString()): YouTubeThumbnailHeroEvidenceValidation {
  const receipt = record(value); const blockers: string[] = []; const recoveryActions: string[] = []
  const block = (message: string, recovery: string) => { blockers.push(message); recoveryActions.push(recovery) }
  if (!receipt || receipt.version !== YOUTUBE_THUMBNAIL_HERO_EVIDENCE_VERSION) return { ready: false, review_ready: false, fixture_ready: false, blockers: ['The YouTube thumbnail hero evidence receipt is missing or malformed.'], recovery_actions: ['Rebuild the campaign-specific generation request and evidence receipt.'] }

  const campaignIdentity = text(receipt.campaign_identity)
  if (!text(receipt.receipt_id) || !campaignIdentity || text(receipt.content_version) !== currentContentVersion) block('The hero evidence receipt is missing its campaign identity or is stale for the current content version.', 'Rebind the hero packet to the exact current Social Content version.')
  const outlier = record(receipt.outlier_evidence); const includedVideoIds = new Set(strings(outlier?.included_video_ids)); const qualifiedVideoIds = strings(outlier?.qualified_outlier_video_ids); const evaluationTime = validDate(evaluationAsOf); const freshUntil = validDate(outlier?.fresh_until)
  if (!outlier || !text(outlier.cohort_id) || !text(outlier.decision_receipt_id) || !validDate(outlier.observed_at) || freshUntil == null || evaluationTime == null || freshUntil < evaluationTime) block('The topic-specific YouTube outlier evidence is missing or stale.', 'Refresh the live same-topic cohort and issue a new version-bound decision receipt.')
  if (!positive(outlier?.minimum_sample_size) || includedVideoIds.size < Number(outlier?.minimum_sample_size)) block('The live YouTube cohort does not meet its declared minimum sample size.', 'Collect enough attributable same-topic long-form examples before review.')
  if (!positive(outlier?.outlier_threshold) || qualifiedVideoIds.length === 0 || qualifiedVideoIds.some((id) => !includedVideoIds.has(id))) block('The live YouTube cohort has no attributable outlier at the declared threshold.', 'Keep creative decisions blocked until an included comparison qualifies numerically.')
  if (Number(outlier?.curated_playlist_performance_weight) !== 0 || outlier?.curated_playlist_role !== 'taste_calibration_only') block('The curated playlist is not constrained to zero-weight taste calibration.', 'Set playlist performance weight to zero and require independent live comparable evidence.')

  const request = record(receipt.generation_request)
  if (!request || !text(request.request_id) || text(request.campaign_identity) !== campaignIdentity || text(request.content_version) !== currentContentVersion || !text(request.approved_path) || !text(request.authorization_status)) block('The campaign-specific generation request is missing or not version-bound.', 'Create a version-bound request with the approved generator path, authorization state, and prompt intent.')
  const identity = record(request?.identity_reference)
  if (!identity || !sha256(identity.sha256) || identity.usage !== 'identity_reference_only') block('The likeness reference is missing or can be reused as output.', 'Bind an exact likeness reference hash and constrain it to identity reference use only.')
  const requiredPromptFields = ['expression', 'pose', 'wardrobe', 'lighting', 'camera', 'environment', 'gaze', 'gesture', 'artifact_interaction']
  if (!requiredPromptFields.every((field) => strings(request?.required_prompt_fields).includes(field))) block('The generation request does not require the complete campaign-specific visual intent.', 'Require expression, pose, wardrobe, lighting, camera, environment, gaze, gesture, and artifact interaction.')

  const heroAssets = values(receipt.hero_assets).map(record).filter((item): item is UnknownRecord => Boolean(item))
  if (heroAssets.length < 2) block('Every candidate needs its own newly generated campaign-specific hero asset.', 'Generate a distinct hero for every candidate; never inherit a prior campaign portrait.')
  const heroById = new Map(heroAssets.map((hero) => [text(hero.asset_id), hero])); const heroHashes = new Set<string>(); const heroPHashes = new Set<string>()
  for (const hero of heroAssets) {
    const id = text(hero.asset_id) || 'hero'; const intent = record(hero.prompt_intent); const anatomy = record(hero.anatomy_quality)
    if (text(hero.campaign_identity) !== campaignIdentity || text(hero.content_version) !== currentContentVersion || !text(hero.public_path) || !sha256(hero.output_sha256) || !pHash(hero.perceptual_hash)) block(`${id} is not exactly version-bound with cryptographic and perceptual output hashes.`, 'Regenerate and bind the exact hero output to this campaign and content version.')
    if (text(hero.output_sha256) === text(identity?.sha256) || hero.source_type === 'reused_exact_photo') block(`${id} reuses the exact identity-reference photo as output.`, 'Generate a new campaign-specific image; use the photo only as a likeness reference.')
    if (!['newly_generated', 'synthetic_fixture'].includes(text(hero.generation_status)) || !text(hero.generator_id) || !text(hero.model_id)) block(`${id} is missing a truthful generator, model, or generation-status record.`, 'Record the exact generator path, model identity, and whether the output is real or synthetic fixture evidence.')
    if (text(hero.generation_status) === 'synthetic_fixture' && hero.final_use_eligible !== false) block(`${id} incorrectly marks a synthetic fixture as final-use eligible.`, 'Keep synthetic fixtures visibly non-final until an authorized real generation succeeds.')
    if (!intent || requiredPromptFields.some((key) => !text(intent[key]))) block(`${id} lacks complete visual intent.`, 'Specify expression, pose, wardrobe, lighting, camera, environment, gaze, gesture, and product interaction.')
    if (!strings(hero.source_receipt_ids).length || !strings(hero.rights_receipt_ids).length || !text(hero.privacy_receipt_id) || !text(hero.likeness_receipt_id)) block(`${id} lacks provenance, likeness, rights, or privacy evidence.`, 'Attach source, likeness, rights, and privacy receipts.')
    if (!validDate(hero.generated_at) || !validDate(hero.fresh_until) || (validDate(hero.fresh_until) ?? 0) < (evaluationTime ?? 0)) block(`${id} is stale or missing generation freshness.`, 'Regenerate the hero and renew its freshness receipt.')
    if (anatomy && (anatomy.status !== 'passed' || !positive(anatomy.visible_hands) || anatomy.visible_fingers_consistent !== true || !text(anatomy.note))) block(`${id} failed the recorded anatomy-quality inspection.`, 'Reject the affected candidate or generate a new bounded concept with complete connected hands and a fresh inspection receipt.')
    heroHashes.add(text(hero.output_sha256)); heroPHashes.add(text(hero.perceptual_hash))
  }
  if (heroAssets.length >= 2 && (heroHashes.size !== heroAssets.length || heroPHashes.size !== heroAssets.length)) block('The candidate set reuses the same hero output or perceptual likeness.', 'Generate materially different expressions, poses, wardrobe, camera, and environments for each candidate.')

  const proof = record(receipt.product_proof)
  if (!proof || !text(proof.asset_id) || !text(proof.public_path) || !sha256(proof.sha256) || !strings(proof.source_receipt_ids).length || !strings(proof.rights_receipt_ids).length || !text(proof.privacy_receipt_id)) block('The separate product-proof binding is missing or malformed.', 'Bind exact owned product proof with source, rights, privacy, and role boundaries.')
  const history = values(receipt.recent_thumbnail_history).map(record).filter((item): item is UnknownRecord => Boolean(item))
  const candidates = values(receipt.candidates).map(record).filter((item): item is UnknownRecord => Boolean(item))
  const selection = record(receipt.selection_decision)
  const pendingHumanQa = selection?.status === 'pending_human_qa'
  if (candidates.length < 2) block('At least two integrated 1280×720 candidates are required.', 'Prepare two materially distinct integrated scene concepts.')
  const families = new Set<string>(); const signatures = new Set<string>(); const candidatePHashes = new Set<string>()
  for (const candidate of candidates) {
    const id = text(candidate.candidate_id) || 'candidate'; const heroBinding = record(candidate.hero_binding); const hero = heroById.get(text(heroBinding?.hero_asset_id)); const integration = record(candidate.integration)
    families.add(text(candidate.layout_family)); signatures.add(text(candidate.composition_signature)); candidatePHashes.add(text(candidate.perceptual_hash))
    if (text(candidate.campaign_identity) !== campaignIdentity || text(candidate.content_version) !== currentContentVersion || !text(candidate.public_path) || !sha256(candidate.sha256) || !pHash(candidate.perceptual_hash) || Number(candidate.width) !== 1280 || Number(candidate.height) !== 720 || candidate.aspect_ratio !== '16:9') block(`${id} is not an exact version-bound 1280×720 output.`, 'Rebuild at 1280×720 and record cryptographic and perceptual hashes.')
    if (!text(candidate.feed_preview_path) || !sha256(candidate.feed_preview_sha256) || Number(candidate.feed_preview_width) !== 320 || Number(candidate.feed_preview_height) !== 180) block(`${id} lacks an exact actual-feed-size preview.`, 'Render and hash the exact 320×180 feed preview.')
    const teaserWords = Number(candidate.text_word_count)
    if (!text(candidate.title) || !text(candidate.teaser) || text(candidate.title).toLowerCase() === text(candidate.teaser).toLowerCase() || teaserWords < 1 || teaserWords > 5) block(`${id} does not keep a short teaser distinct from the title.`, 'Use one to five readable teaser words that add tension.')
    if (!strings(candidate.customer_facing_copy).length || containsInternalWorkflowMarker(strings(candidate.customer_facing_copy))) block(`${id} contains internal workflow language in customer-facing pixels.`, 'Keep fixture and workflow labels in review chrome, never in exported pixels.')
    if (!text(candidate.focal_subject) || candidate.face_text_overlap !== false || candidate.feed_size_legible !== true || candidate.product_legible !== true) block(`${id} fails focal hierarchy, face clearance, product legibility, or feed-size comprehension.`, 'Restore one dominant focal point and keep face, type, and product evidence legible.')
    if (candidate.selection_status === 'selected' && candidate.final_use_eligible !== true) block(`${id} is selected but not final-use eligible.`, 'Bind final-use eligibility only to the Human-QA-selected candidate.')
    if (candidate.selection_status === 'rejected' && (candidate.final_use_eligible !== false || !text(candidate.rejection_reason) || !text(candidate.rejection_reason_code))) block(`${id} does not preserve a fail-closed rejection state.`, 'Keep the rejected candidate in review evidence with final-use eligibility false and a concise quality reason.')
    if (pendingHumanQa && candidate.selection_status === 'pending_human_qa' && candidate.final_use_eligible !== false) block(`${id} is awaiting Human QA but is incorrectly final-use eligible.`, 'Keep every pending candidate review-only and final-use ineligible.')
    if (!['selected', 'rejected'].includes(text(candidate.selection_status)) && !(pendingHumanQa && candidate.selection_status === 'pending_human_qa')) block(`${id} lacks a valid Human QA selection state.`, 'Keep the candidate pending and ineligible before review, then mark it selected or rejected after Human QA.')
    if (!hero || text(heroBinding?.hero_output_sha256) !== text(hero.output_sha256) || text(heroBinding?.output_sha256) !== text(candidate.sha256)) block(`${id} is not bound to its own generated hero and exact output hash.`, 'Bind each candidate to its own generated hero output and final thumbnail hash.')
    if (!text(candidate.layout_family) || !text(candidate.composition_signature) || genericOrSplit(candidate)) block(`${id} uses a prohibited generic, split-panel, or side-by-side composition.`, 'Use a cohesive integrated scene with no pasted-together boundary.')
    if (!integration || integration.cohesive_scene !== true || integration.hard_split_panel !== false || integration.pasted_boundary !== false || integration.lighting_consistent !== true || integration.perspective_consistent !== true || integration.color_grade_consistent !== true || integration.asset_floats_independently !== false || integration.blur_masks_reuse !== false || integration.hero_removal_breaks_story !== true || integration.asset_removal_breaks_story !== true || integration.face_overlap_harm !== false || integration.text_overlap_harm !== false || integration.product_overlap_harm !== false || !text(integration.pose_gaze_gesture_relationship)) block(`${id} does not prove an integrated hero-and-product scene.`, 'Make pose, gaze, gesture, depth, lighting, and product evidence tell one inseparable story without harmful overlap.')
    const traces = values(candidate.evidence_trace).map(record).filter((trace): trace is UnknownRecord => Boolean(trace)); const traceByDecision = new Map(traces.map((trace) => [text(trace.decision_dimension), trace]))
    for (const decision of YOUTUBE_THUMBNAIL_CREATIVE_DECISIONS) { const trace = traceByDecision.get(decision); const sourceIds = strings(trace?.live_evidence_video_ids); if (!trace || text(trace.cohort_id) !== text(outlier?.cohort_id) || trace.evidence_role !== 'informs_not_authorizes' || !text(trace.rationale) || sourceIds.length === 0 || sourceIds.some((sourceId) => !includedVideoIds.has(sourceId))) block(`${id} lacks attributable live evidence for ${decision.replaceAll('_', ' ')}.`, 'Trace each creative choice to current comparisons without copying public artwork.') }
    for (const prior of history) {
      if (hamming(text(candidate.perceptual_hash), text(prior.composition_perceptual_hash)) < 10) block(`${id} is perceptually too close to a recent full composition.`, 'Change composition family, depth, palette, typography, asset placement, and hero interaction.')
      if (hamming(text(hero?.perceptual_hash), text(prior.hero_perceptual_hash)) < 10) block(`${id} is perceptually too close to a recent hero treatment.`, 'Generate a new expression, pose, wardrobe, crop, camera, lighting, and environment.')
    }
  }
  if (candidates.length >= 2 && (families.size !== candidates.length || signatures.size !== candidates.length || candidatePHashes.size !== candidates.length)) block('The candidate set does not contain materially distinct integrated scene directions.', 'Use different scene geometry, depth, palette, type placement, pose, gaze, and artifact interaction—not mirrored variants.')
  if (candidates.length >= 2 && hamming(text(candidates[0].perceptual_hash), text(candidates[1].perceptual_hash)) < 14) block('The candidate compositions are perceptually too similar.', 'Rebuild one candidate in a different integrated composition family.')

  const coreBlockerCount = blockers.length
  const selectedCandidates = candidates.filter((candidate) => candidate.selection_status === 'selected')
  const rejectedCandidates = candidates.filter((candidate) => candidate.selection_status === 'rejected')
  const pendingCandidates = candidates.filter((candidate) => candidate.selection_status === 'pending_human_qa')
  const selectedId = text(selection?.selected_candidate_id)
  const recordedRejected = values(selection?.rejected_candidates).map(record).filter((item): item is UnknownRecord => Boolean(item))
  const pendingDecisionBlocker = 'Human QA has not selected the sole final thumbnail output or recorded the rejected alternatives.'
  if (pendingHumanQa) {
    if (!selection || !text(selection.receipt_id) || text(selection.content_version) !== currentContentVersion || selection.decided_at != null || selectedId || recordedRejected.length || pendingCandidates.length !== candidates.length || pendingCandidates.some((candidate) => candidate.final_use_eligible !== false)) block('The pending Human QA decision receipt is malformed or exposes an eligible output.', 'Keep every candidate pending and final-use ineligible until the exact content-version-bound Human QA decision is recorded.')
    block(pendingDecisionBlocker, 'Review the full-size and 320×180 candidates, select exactly one, and reject every alternative with a concise reason.')
  } else {
    if (!selection || !text(selection.receipt_id) || selection.status !== 'human_qa_approved' || text(selection.content_version) !== currentContentVersion || !validDate(selection.decided_at)) block('The Human QA thumbnail selection receipt is missing or stale.', 'Record the exact content-version-bound Human QA selection before packaging.')
    if (selectedCandidates.length !== 1 || selectedId !== text(selectedCandidates[0]?.candidate_id) || selectedCandidates[0]?.final_use_eligible !== true) block('Exactly one candidate must be selected and bound as the sole final-use output.', 'Bind the Human QA winner as the only final-use-eligible candidate.')
    if (rejectedCandidates.length !== candidates.length - 1 || rejectedCandidates.some((candidate) => candidate.final_use_eligible !== false || !recordedRejected.some((rejection) => text(rejection.candidate_id) === text(candidate.candidate_id) && text(rejection.reason_code) === text(candidate.rejection_reason_code) && text(rejection.reason) === text(candidate.rejection_reason)))) block('Every non-selected candidate must remain fail-closed rejected evidence.', 'Record each rejected candidate and its exact quality reason; never expose it as an eligible output.')
  }

  const finalGateBlocked = request?.authorization_status !== 'authorized' || request?.real_generation_completed !== true || heroAssets.some((hero) => hero.generation_status !== 'newly_generated')
  const uniqueBlockers = [...new Set(blockers)]
  if (finalGateBlocked) { uniqueBlockers.push('Real campaign-specific likeness generation remains blocked pending explicit provider authorization; the displayed images are synthetic contract fixtures and are not final-use artwork.'); recoveryActions.push('Authorize the approved Portfolio image-generation provider and record a successful, version-bound generation receipt without changing any other protected gate.') }
  const reviewReady = !finalGateBlocked && coreBlockerCount === 0 && uniqueBlockers.every((message) => message === pendingDecisionBlocker)
  return { ready: uniqueBlockers.length === 0, review_ready: reviewReady || uniqueBlockers.length === 0, fixture_ready: blockers.length === 0, blockers: uniqueBlockers, recovery_actions: [...new Set(recoveryActions)] }
}
