export const YOUTUBE_THUMBNAIL_HERO_EVIDENCE_VERSION = 'youtube-thumbnail-hero-evidence/v1' as const

export const YOUTUBE_THUMBNAIL_CREATIVE_DECISIONS = [
  'hero_selection',
  'composition',
  'typography',
  'teaser',
  'contrast',
  'visual_style',
] as const

export type YouTubeThumbnailCreativeDecision = (typeof YOUTUBE_THUMBNAIL_CREATIVE_DECISIONS)[number]

export type YouTubeThumbnailHeroEvidenceValidation = {
  ready: boolean
  blockers: string[]
  recovery_actions: string[]
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function values(value: unknown) {
  return Array.isArray(value) ? value : []
}

function strings(value: unknown) {
  return values(value).map(text).filter(Boolean)
}

function sha256(value: unknown) {
  return /^sha256:[a-f0-9]{64}$/i.test(text(value))
}

function validDate(value: unknown) {
  const parsed = Date.parse(text(value))
  return Number.isFinite(parsed) ? parsed : null
}

function positive(value: unknown) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}

function candidateLooksGeneric(candidate: UnknownRecord) {
  const signature = `${text(candidate.layout_family)} ${text(candidate.composition_signature)}`.toLowerCase()
  return [
    'generic-fallback',
    'shared-template',
    'dashboard',
    'field-guide',
    'text-first',
    'multi-panel',
    'split-screen',
    'synthetic-office',
    'generic-portrait',
  ].some((token) => signature.includes(token))
}

export function validateYouTubeThumbnailHeroEvidence(
  value: unknown,
  currentContentVersion: string,
  evaluationAsOf = new Date().toISOString(),
): YouTubeThumbnailHeroEvidenceValidation {
  const receipt = record(value)
  const blockers: string[] = []
  const recoveryActions: string[] = []
  const block = (message: string, recovery: string) => {
    blockers.push(message)
    recoveryActions.push(recovery)
  }

  if (!receipt || receipt.version !== YOUTUBE_THUMBNAIL_HERO_EVIDENCE_VERSION) {
    return {
      ready: false,
      blockers: ['The YouTube thumbnail hero evidence receipt is missing or malformed.'],
      recovery_actions: ['Rebuild the candidate through the existing Social Content thumbnail evidence route.'],
    }
  }

  const campaignIdentity = text(receipt.campaign_identity)
  if (!text(receipt.receipt_id) || !campaignIdentity || text(receipt.content_version) !== currentContentVersion) {
    block('The hero evidence receipt is missing its campaign identity or is stale for the current content version.', 'Rebind the hero packet to the exact current Social Content version.')
  }

  const outlier = record(receipt.outlier_evidence)
  const includedVideoIds = new Set(strings(outlier?.included_video_ids))
  const qualifiedVideoIds = strings(outlier?.qualified_outlier_video_ids)
  const evaluationTime = validDate(evaluationAsOf)
  const freshUntil = validDate(outlier?.fresh_until)
  if (
    !outlier
    || !text(outlier.cohort_id)
    || !text(outlier.decision_receipt_id)
    || !validDate(outlier.observed_at)
    || freshUntil == null
    || evaluationTime == null
    || freshUntil < evaluationTime
  ) {
    block('The topic-specific YouTube outlier evidence is missing or stale.', 'Refresh the live same-topic cohort and issue a new version-bound decision receipt.')
  }
  if (!positive(outlier?.minimum_sample_size) || includedVideoIds.size < Number(outlier?.minimum_sample_size)) {
    block('The live YouTube cohort does not meet its declared minimum sample size.', 'Collect enough attributable same-topic long-form examples before review.')
  }
  if (!positive(outlier?.outlier_threshold) || qualifiedVideoIds.length === 0 || qualifiedVideoIds.some((id) => !includedVideoIds.has(id))) {
    block('The live YouTube cohort has no attributable outlier at the declared threshold.', 'Keep hero selection and creative decisions blocked until at least one included comparison qualifies numerically.')
  }
  if (Number(outlier?.curated_playlist_performance_weight) !== 0 || outlier?.curated_playlist_role !== 'taste_calibration_only') {
    block('The curated playlist is not constrained to zero-weight taste calibration.', 'Set playlist performance weight to zero and require independent live comparable evidence.')
  }

  const hero = record(receipt.hero_asset)
  if (!hero) {
    block('A campaign-specific thumbnail hero asset is required.', 'Attach an exact hero source with provenance, rights, privacy, crop, focal-subject, and safe-text evidence.')
  } else {
    if (!text(hero.asset_id) || text(hero.campaign_identity) !== campaignIdentity || !text(hero.public_path) || !sha256(hero.source_sha256)) {
      block('The hero asset is not exactly bound to this campaign and source hash.', 'Bind one staged campaign-specific hero asset and its exact SHA-256 source hash.')
    }
    if (hero.generic !== false) {
      block('Generic or unclassified hero imagery cannot advance.', 'Use a truthful campaign-specific human, product, or environment hero and mark generic imagery rejected.')
    }
    if (!positive(hero.width) || !positive(hero.height) || !text(hero.focal_subject) || !text(hero.safe_text_region)) {
      block('The hero asset is missing source dimensions, focal subject, or safe-text guidance.', 'Record the hero dimensions, focal subject, and face-safe text region before composition.')
    }
    if (!text(hero.digital_source_type) || !text(hero.provenance_note)) {
      block('The hero asset is missing its digital-source disclosure.', 'Record whether the hero is photographed, generated, or AI-assisted without inventing provenance.')
    }
    if (!strings(hero.source_receipt_ids).length || !strings(hero.rights_receipt_ids).length || !text(hero.privacy_receipt_id)) {
      block('The hero asset lacks source, rights, or privacy receipts.', 'Attach exact source, rights, and privacy receipts for the selected hero asset.')
    }
  }

  const proof = record(receipt.product_proof)
  if (!proof || !text(proof.asset_id) || !text(proof.public_path) || !sha256(proof.sha256)) {
    block('The separate product-proof binding is missing or malformed.', 'Bind the exact Jev product proof separately from the attention-earning hero.')
  } else {
    if (text(proof.asset_id) === text(hero?.asset_id)) block('The thumbnail hero and product proof must remain separate assets.', 'Keep the hero as the attention source and bind product proof to the video or storyboard substantiation layer.')
    if (!strings(proof.source_receipt_ids).length || !strings(proof.rights_receipt_ids).length || !text(proof.privacy_receipt_id) || !text(proof.role)) {
      block('The product-proof asset lacks source, rights, privacy, or role boundaries.', 'Restore the exact source-bound product proof and its story-only role.')
    }
  }

  const candidates = values(receipt.candidates).map(record).filter((candidate): candidate is UnknownRecord => Boolean(candidate))
  if (candidates.length < 2) block('At least two hero-led 1280×720 candidates are required.', 'Prepare two materially distinct review candidates from the same validated hero contract.')
  const layoutFamilies = new Set<string>()
  const signatures = new Set<string>()
  for (const candidate of candidates) {
    const candidateId = text(candidate.candidate_id) || 'candidate'
    const layoutFamily = text(candidate.layout_family)
    const signature = text(candidate.composition_signature)
    layoutFamilies.add(layoutFamily)
    signatures.add(signature)
    if (
      text(candidate.campaign_identity) !== campaignIdentity
      || text(candidate.content_version) !== currentContentVersion
      || !text(candidate.public_path)
      || !sha256(candidate.sha256)
      || Number(candidate.width) !== 1280
      || Number(candidate.height) !== 720
      || candidate.aspect_ratio !== '16:9'
    ) {
      block(`${candidateId} is not an exact version-bound 1280×720 output.`, 'Rebuild the candidate at 1280×720 and record its exact output SHA-256.')
    }
    if (!text(candidate.feed_preview_path) || !sha256(candidate.feed_preview_sha256) || Number(candidate.feed_preview_width) !== 320 || Number(candidate.feed_preview_height) !== 180) {
      block(`${candidateId} lacks an exact actual-feed-size preview.`, 'Render and hash a 320×180 feed preview for the exact candidate output.')
    }
    const teaserWords = Number(candidate.text_word_count)
    if (!text(candidate.title) || !text(candidate.teaser) || text(candidate.title).toLowerCase() === text(candidate.teaser).toLowerCase() || teaserWords < 1 || teaserWords > 5) {
      block(`${candidateId} does not keep a short thumbnail teaser distinct from the title.`, 'Use one to five large teaser words that add tension without repeating the title.')
    }
    if (!text(candidate.focal_subject) || candidate.face_text_overlap !== false || candidate.feed_size_legible !== true) {
      block(`${candidateId} fails focal-subject, face-clearance, or feed-legibility requirements.`, 'Restore one dominant focal subject, keep text off the face, and verify the 320×180 preview.')
    }
    const safeRegion = record(candidate.safe_text_region)
    const crop = record(candidate.crop)
    if (!safeRegion || !positive(safeRegion.width) || !positive(safeRegion.height) || !crop || text(crop.source_asset_id) !== text(hero?.asset_id) || !positive(crop.width) || !positive(crop.height)) {
      block(`${candidateId} is missing its exact hero crop or safe-text region.`, 'Bind the candidate crop to the validated hero asset and record a positive face-safe text rectangle.')
    }
    const heroBinding = record(candidate.hero_binding)
    if (
      !heroBinding
      || text(heroBinding.hero_asset_id) !== text(hero?.asset_id)
      || text(heroBinding.hero_source_sha256) !== text(hero?.source_sha256)
      || text(heroBinding.output_sha256) !== text(candidate.sha256)
    ) {
      block(`${candidateId} is not bound to the exact hero source and output hash.`, 'Rebuild the candidate binding from the exact hero source hash and rendered output hash.')
    }
    if (!layoutFamily || !signature || candidateLooksGeneric(candidate)) {
      block(`${candidateId} uses a missing or prohibited generic composition identity.`, 'Replace dashboard, field-guide, text-first, split-screen, or shared-template output with a campaign-specific hero composition.')
    }
    const traces = values(candidate.evidence_trace).map(record).filter((trace): trace is UnknownRecord => Boolean(trace))
    const traceByDecision = new Map(traces.map((trace) => [text(trace.decision_dimension), trace]))
    for (const decision of YOUTUBE_THUMBNAIL_CREATIVE_DECISIONS) {
      const trace = traceByDecision.get(decision)
      const sourceIds = strings(trace?.live_evidence_video_ids)
      if (!trace || text(trace.cohort_id) !== text(outlier?.cohort_id) || trace.evidence_role !== 'informs_not_authorizes' || !text(trace.rationale) || sourceIds.length === 0 || sourceIds.some((id) => !includedVideoIds.has(id))) {
        block(`${candidateId} lacks an attributable live-evidence trace for ${decision.replaceAll('_', ' ')}.`, 'Trace hero selection, composition, typography, teaser, contrast, and visual style to current included comparisons without copying public source artwork.')
      }
    }
  }
  if (candidates.length >= 2 && (layoutFamilies.size !== candidates.length || signatures.size !== candidates.length)) {
    block('The candidate set does not contain materially distinct creative directions.', 'Give each candidate a distinct layout family and composition signature.')
  }

  return {
    ready: blockers.length === 0,
    blockers: [...new Set(blockers)],
    recovery_actions: [...new Set(recoveryActions)],
  }
}
