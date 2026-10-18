import {
  parseArtifactEvaluationReceipt,
  validateArtifactEvaluationReceipt,
  type ArtifactEvaluationKind,
  type ArtifactEvaluationReceipt,
} from '@/lib/artifact-evidence-evaluation'

export const ARTIFACT_EVIDENCE_MANIFEST_VERSION = 'artifact-evidence-manifest/v2' as const

export const ARTIFACT_EVIDENCE_CATEGORIES = [
  'copy_script',
  'visual_field',
  'product_screenshot',
  'visual_template',
  'presenter_avatar',
  'voice_narration',
  'music',
  'thumbnail',
  'title',
  'description',
  'cta',
  'source_research',
  'transformation',
  'final_output',
] as const

export type ArtifactEvidenceCategory = (typeof ARTIFACT_EVIDENCE_CATEGORIES)[number]

export type ArtifactEvidenceRegion = {
  x: number
  y: number
}

export type ThumbnailResearchSample = {
  video_id: string
  youtube_url: string
  title: string
  creator: string
  thumbnail_path: string | null
  source_thumbnail_url: string | null
  link_status: 'verified_openable' | 'blocked'
  view_count: number | null
  subscriber_count: number | null
  duration_seconds: number | null
  published_at: string | null
  observed_at: string
  description_opening: string | null
  description_opening_truncated: boolean
  thumbnail_text: string[]
  thumbnail_text_transcription_status: 'verified' | 'unreadable'
  title_thumbnail_relationship: ThumbnailCopyRelationship
  thumbnail_text_length: number
  hook_type: string
  transcription_provenance: {
    source_thumbnail_url: string
    captured_thumbnail_path: string
    captured_thumbnail_sha256: string
    method: string
  } | null
  channel_baseline_size: number | null
  decision: 'included' | 'excluded'
  decision_reason: string
  channel_relative_ratio: number | null
  audience_view_ratio: number | null
  recency_adjusted_views_per_day: number | null
  normalized_performance_score: number | null
  outlier_qualified: boolean
  supports_candidate_composition: boolean
  composition_support_reason: string
  visual_traits: Record<string, boolean>
}

export type ThumbnailCopyRelationship = 'duplicate' | 'near_duplicate' | 'complementary_teaser' | 'contrasting_question' | 'no_thumbnail_text' | 'unreadable'

export type ThumbnailCopyPairGroup = {
  relationships: ThumbnailCopyRelationship[]
  sample_size: number
  minimum_sample_size: number
  median_normalized_performance_score: number | null
  video_ids: string[]
}

export type ThumbnailCopyPairAnalysis = {
  status: 'scored' | 'unscored'
  hypothesis: string
  comparison_formula: string
  repeated_group: ThumbnailCopyPairGroup
  distinct_group: ThumbnailCopyPairGroup
  observed_difference: number | null
  conclusion: 'supports_distinct_pair' | 'does_not_support_distinct_pair' | 'unscored_insufficient_group_samples'
  limitation: string
}

export type ThumbnailCandidateCopyPair = {
  title: string
  thumbnail_hook: string
  relationship: ThumbnailCopyRelationship
  exact_strings_are_distinct: boolean
  strategy_status: string
  support_scope: 'editorial_hypothesis_only' | 'performance_supported'
  performance_claim: 'unscored' | 'supported'
  rationale: string
  source_example_video_ids: string[]
}

export type ThumbnailVisualNeighbor = {
  id: string
  label: string
  artifact_url: string
  source_url: string
  link_status: 'verified_openable' | 'blocked'
  supports_candidate_composition: boolean
  support_reason: string
  width: number | null
  height: number | null
  aspect_ratio: string | null
}

export type ThumbnailElementBinding = {
  element: 'subject' | 'hook' | 'product_proof' | 'aspect_ratio' | 'brand_treatment'
  source_label: string
  source_url: string
  link_status: 'verified_openable' | 'blocked'
  support: 'supports' | 'does_not_support'
  limitation: string
}

export type ThumbnailCompositionDecision = {
  version: 'youtube-thumbnail-composition/v1'
  layout_family: string
  dominant_subject: string
  focal_hierarchy: string[]
  text_placement: string
  batch_identity: string
  composition_signature: string
  exception_basis: 'none' | 'evidence_required'
  exception_receipt_ids: string[]
}

export type ThumbnailResearchCohort = {
  cohort_id: string
  target: string
  observed_at: string
  sample_size: number
  minimum_sample_size: number
  outlier_rule: string
  outlier_sample_size: number
  formula: string[]
  recurring_visual_traits: string[]
  adopted_traits: string[]
  rejected_traits: string[]
  composition_decision: string
  composition?: ThumbnailCompositionDecision | null
  public_outlier_boundary: string
  first_party_neighbors: ThumbnailVisualNeighbor[]
  candidate: ThumbnailVisualNeighbor | null
  element_bindings: ThumbnailElementBinding[]
  copy_pair_analysis: ThumbnailCopyPairAnalysis
  candidate_copy_pair: ThumbnailCandidateCopyPair
  samples: ThumbnailResearchSample[]
}

export type ArtifactEvidenceElement = {
  id: string
  category: ArtifactEvidenceCategory
  label: string
  input_excerpt: string
  customer_facing: boolean
  review_only: boolean
  redacted: boolean
  source_identity: string
  source_record_type: string
  authoritative_href: string | null
  artifact_url?: string | null
  evidence_receipt_ids: string[]
  version_hash: string
  content_version: string
  rights_privacy_status: 'passed' | 'blocked' | 'missing'
  rights_privacy_receipt_ids: string[]
  transformation_step: string
  evaluation_kind?: ArtifactEvaluationKind
  evaluation_receipt?: ArtifactEvaluationReceipt
  research_cohort?: ThumbnailResearchCohort
  region?: ArtifactEvidenceRegion
}

export type ArtifactEvidenceManifest = {
  version: typeof ARTIFACT_EVIDENCE_MANIFEST_VERSION
  manifest_id: string
  manifest_hash: string
  content_version: string
  artifact_label: string
  preview_url: string | null
  preview_alt: string
  final_output_hashes: Array<{ label: string; sha256: string }>
  elements: ArtifactEvidenceElement[]
}

export type ArtifactEvidenceManifestValidation = {
  manifest: ArtifactEvidenceManifest | null
  ready: boolean
  stale: boolean
  blockers: string[]
}

export type YouTubePackagingTarget = 'youtube' | 'youtube_shorts'

export type YouTubePackagingEvidenceValidation = {
  ready: boolean
  pairBound: boolean
  target: YouTubePackagingTarget
  title: ArtifactEvidenceElement | null
  thumbnail: ArtifactEvidenceElement | null
  blockers: string[]
  recoveryActions: string[]
}

export type YouTubeThumbnailBatchDiversityValidation = {
  ready: boolean
  batchIdentity: string | null
  candidateCount: number
  layoutFamilies: string[]
  compositionSignatures: string[]
  blockers: string[]
  recoveryActions: string[]
}

export type ArtifactManifestSnapshot = {
  manifest_id: string
  manifest_hash: string
  content_version: string
  evaluation_receipt_version: string | null
  evaluation_receipt_ids: string[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
}

function timestamp(value: string): string | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function safeAuthoritativeHref(value: unknown): string | null {
  const href = text(value)
  if (!href) return null
  if (!href.startsWith('/admin/') || href.includes('://') || href.includes('..')) return null
  return href
}

function safeArtifactUrl(value: unknown): string | null {
  const href = text(value)
  if (!href) return null
  if (!href.startsWith('/review-assets/') || href.includes('://') || href.includes('..')) return null
  return href
}

function safeYouTubeUrl(value: unknown): string {
  const href = text(value)
  try {
    const parsed = new URL(href)
    return parsed.protocol === 'https:' && ['www.youtube.com', 'youtube.com'].includes(parsed.hostname) ? href : ''
  } catch {
    return ''
  }
}

function safeHttpsUrl(value: unknown): string {
  const href = text(value)
  try {
    const parsed = new URL(href)
    return parsed.protocol === 'https:' ? href : ''
  } catch {
    return ''
  }
}

function parseVisualNeighbor(value: unknown): ThumbnailVisualNeighbor | null {
  const candidate = record(value)
  if (!candidate) return null
  const artifactUrl = safeArtifactUrl(candidate.artifact_url)
  const sourceUrl = text(candidate.source_url)
  const sourceIsSafe = safeHttpsUrl(sourceUrl) || safeArtifactUrl(sourceUrl)
  if (!text(candidate.id) || !artifactUrl || !sourceIsSafe) return null
  return {
    id: text(candidate.id),
    label: text(candidate.label),
    artifact_url: artifactUrl,
    source_url: sourceIsSafe,
    link_status: candidate.link_status === 'verified_openable' ? 'verified_openable' : 'blocked',
    supports_candidate_composition: candidate.supports_candidate_composition === true,
    support_reason: text(candidate.support_reason),
    width: nullableNumber(candidate.width),
    height: nullableNumber(candidate.height),
    aspect_ratio: text(candidate.aspect_ratio) || null,
  }
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const THUMBNAIL_COPY_RELATIONSHIPS: ThumbnailCopyRelationship[] = ['duplicate', 'near_duplicate', 'complementary_teaser', 'contrasting_question', 'no_thumbnail_text', 'unreadable']

function copyRelationship(value: unknown): ThumbnailCopyRelationship {
  const candidate = text(value) as ThumbnailCopyRelationship
  return THUMBNAIL_COPY_RELATIONSHIPS.includes(candidate) ? candidate : 'unreadable'
}

function parseCopyPairGroup(value: unknown): ThumbnailCopyPairGroup {
  const candidate = record(value) ?? {}
  return {
    relationships: strings(candidate.relationships).map(copyRelationship),
    sample_size: Number(candidate.sample_size),
    minimum_sample_size: Number(candidate.minimum_sample_size),
    median_normalized_performance_score: nullableNumber(candidate.median_normalized_performance_score),
    video_ids: strings(candidate.video_ids),
  }
}

function parseResearchCohort(value: unknown): ThumbnailResearchCohort | undefined {
  const candidate = record(value)
  if (!candidate) return undefined
  const samples = Array.isArray(candidate.samples) ? candidate.samples.map((value) => {
    const sample = record(value)
    if (!sample) return null
    const decision = sample.decision === 'excluded' ? 'excluded' : 'included'
    const rawTraits = record(sample.visual_traits) ?? {}
    return {
      video_id: text(sample.video_id),
      youtube_url: safeYouTubeUrl(sample.youtube_url),
      title: text(sample.title),
      creator: text(sample.creator),
      thumbnail_path: safeArtifactUrl(sample.thumbnail_path),
      source_thumbnail_url: safeHttpsUrl(sample.source_thumbnail_url) || null,
      link_status: sample.link_status === 'verified_openable' ? 'verified_openable' : 'blocked',
      view_count: nullableNumber(sample.view_count),
      subscriber_count: nullableNumber(sample.subscriber_count),
      duration_seconds: nullableNumber(sample.duration_seconds),
      published_at: text(sample.published_at) || null,
      observed_at: text(sample.observed_at),
      description_opening: text(sample.description_opening) || null,
      description_opening_truncated: sample.description_opening_truncated === true,
      thumbnail_text: strings(sample.thumbnail_text),
      thumbnail_text_transcription_status: sample.thumbnail_text_transcription_status === 'verified' ? 'verified' : 'unreadable',
      title_thumbnail_relationship: copyRelationship(sample.title_thumbnail_relationship),
      thumbnail_text_length: Number(sample.thumbnail_text_length),
      hook_type: text(sample.hook_type),
      transcription_provenance: (() => {
        const provenance = record(sample.transcription_provenance)
        if (!provenance) return null
        const sourceThumbnailUrl = safeHttpsUrl(provenance.source_thumbnail_url)
        const capturedThumbnailPath = safeArtifactUrl(provenance.captured_thumbnail_path)
        if (!sourceThumbnailUrl || !capturedThumbnailPath) return null
        return {
          source_thumbnail_url: sourceThumbnailUrl,
          captured_thumbnail_path: capturedThumbnailPath,
          captured_thumbnail_sha256: text(provenance.captured_thumbnail_sha256),
          method: text(provenance.method),
        }
      })(),
      channel_baseline_size: nullableNumber(sample.channel_baseline_size),
      decision,
      decision_reason: text(sample.decision_reason),
      channel_relative_ratio: nullableNumber(sample.channel_relative_ratio),
      audience_view_ratio: nullableNumber(sample.audience_view_ratio),
      recency_adjusted_views_per_day: nullableNumber(sample.recency_adjusted_views_per_day),
      normalized_performance_score: nullableNumber(sample.normalized_performance_score),
      outlier_qualified: sample.outlier_qualified === true,
      supports_candidate_composition: sample.supports_candidate_composition === true,
      composition_support_reason: text(sample.composition_support_reason),
      visual_traits: Object.fromEntries(Object.entries(rawTraits).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')),
    } satisfies ThumbnailResearchSample
  }).filter((sample): sample is ThumbnailResearchSample => Boolean(sample?.video_id && sample.youtube_url)) : []
  const firstPartyNeighbors = Array.isArray(candidate.first_party_neighbors)
    ? candidate.first_party_neighbors.map(parseVisualNeighbor).filter((neighbor): neighbor is ThumbnailVisualNeighbor => Boolean(neighbor))
    : []
  const candidateNeighbor = parseVisualNeighbor(candidate.candidate)
  const elementBindings = Array.isArray(candidate.element_bindings) ? candidate.element_bindings.map((value) => {
    const binding = record(value)
    if (!binding) return null
    const element = text(binding.element)
    const sourceUrl = text(binding.source_url)
    const safeSourceUrl = safeHttpsUrl(sourceUrl) || safeArtifactUrl(sourceUrl) || safeAuthoritativeHref(sourceUrl)
    if (!['subject', 'hook', 'product_proof', 'aspect_ratio', 'brand_treatment'].includes(element) || !safeSourceUrl) return null
    return {
      element: element as ThumbnailElementBinding['element'],
      source_label: text(binding.source_label),
      source_url: safeSourceUrl,
      link_status: binding.link_status === 'verified_openable' ? 'verified_openable' as const : 'blocked' as const,
      support: binding.support === 'supports' ? 'supports' as const : 'does_not_support' as const,
      limitation: text(binding.limitation),
    }
  }).filter((binding): binding is ThumbnailElementBinding => Boolean(binding)) : []
  const rawAnalysis = record(candidate.copy_pair_analysis) ?? {}
  const rawCandidatePair = record(candidate.candidate_copy_pair) ?? {}
  const rawComposition = record(candidate.composition)
  const composition = rawComposition?.version === 'youtube-thumbnail-composition/v1' ? {
    version: 'youtube-thumbnail-composition/v1' as const,
    layout_family: text(rawComposition.layout_family),
    dominant_subject: text(rawComposition.dominant_subject),
    focal_hierarchy: strings(rawComposition.focal_hierarchy),
    text_placement: text(rawComposition.text_placement),
    batch_identity: text(rawComposition.batch_identity),
    composition_signature: text(rawComposition.composition_signature),
    exception_basis: rawComposition.exception_basis === 'evidence_required' ? 'evidence_required' as const : 'none' as const,
    exception_receipt_ids: strings(rawComposition.exception_receipt_ids),
  } : null
  return {
    cohort_id: text(candidate.cohort_id),
    target: text(candidate.target),
    observed_at: text(candidate.observed_at),
    sample_size: Number(candidate.sample_size),
    minimum_sample_size: Number(candidate.minimum_sample_size),
    outlier_rule: text(candidate.outlier_rule),
    outlier_sample_size: Number(candidate.outlier_sample_size),
    formula: strings(candidate.formula),
    recurring_visual_traits: strings(candidate.recurring_visual_traits),
    adopted_traits: strings(candidate.adopted_traits),
    rejected_traits: strings(candidate.rejected_traits),
    composition_decision: text(candidate.composition_decision),
    composition,
    public_outlier_boundary: text(candidate.public_outlier_boundary),
    first_party_neighbors: firstPartyNeighbors,
    candidate: candidateNeighbor,
    element_bindings: elementBindings,
    copy_pair_analysis: {
      status: rawAnalysis.status === 'scored' ? 'scored' : 'unscored',
      hypothesis: text(rawAnalysis.hypothesis),
      comparison_formula: text(rawAnalysis.comparison_formula),
      repeated_group: parseCopyPairGroup(rawAnalysis.repeated_group),
      distinct_group: parseCopyPairGroup(rawAnalysis.distinct_group),
      observed_difference: nullableNumber(rawAnalysis.observed_difference),
      conclusion: ['supports_distinct_pair', 'does_not_support_distinct_pair'].includes(text(rawAnalysis.conclusion))
        ? text(rawAnalysis.conclusion) as ThumbnailCopyPairAnalysis['conclusion']
        : 'unscored_insufficient_group_samples',
      limitation: text(rawAnalysis.limitation),
    },
    candidate_copy_pair: {
      title: text(rawCandidatePair.title),
      thumbnail_hook: text(rawCandidatePair.thumbnail_hook),
      relationship: copyRelationship(rawCandidatePair.relationship),
      exact_strings_are_distinct: rawCandidatePair.exact_strings_are_distinct === true,
      strategy_status: text(rawCandidatePair.strategy_status),
      support_scope: rawCandidatePair.support_scope === 'performance_supported' ? 'performance_supported' : 'editorial_hypothesis_only',
      performance_claim: rawCandidatePair.performance_claim === 'supported' ? 'supported' : 'unscored',
      rationale: text(rawCandidatePair.rationale),
      source_example_video_ids: strings(rawCandidatePair.source_example_video_ids),
    },
    samples,
  }
}

const EVALUATION_KIND_BY_CATEGORY: Partial<Record<ArtifactEvidenceCategory, ArtifactEvaluationKind>> = {
  copy_script: 'script_message',
  visual_field: 'headline_hook',
  visual_template: 'visual_concept',
  thumbnail: 'thumbnail',
  title: 'title_subject',
  description: 'description',
  cta: 'cta',
}

function parseElement(value: unknown): ArtifactEvidenceElement | null {
  const candidate = record(value)
  if (!candidate) return null
  const category = text(candidate.category)
  const status = text(candidate.rights_privacy_status)
  if (!ARTIFACT_EVIDENCE_CATEGORIES.includes(category as ArtifactEvidenceCategory)) return null
  if (!['passed', 'blocked', 'missing'].includes(status)) return null
  const regionRecord = record(candidate.region)
  const region = regionRecord && Number.isFinite(Number(regionRecord.x)) && Number.isFinite(Number(regionRecord.y))
    ? { x: Number(regionRecord.x), y: Number(regionRecord.y) }
    : undefined

  return {
    id: text(candidate.id),
    category: category as ArtifactEvidenceCategory,
    label: text(candidate.label),
    input_excerpt: text(candidate.input_excerpt),
    customer_facing: candidate.customer_facing === true,
    review_only: candidate.review_only === true,
    redacted: candidate.redacted === true,
    source_identity: text(candidate.source_identity),
    source_record_type: text(candidate.source_record_type),
    authoritative_href: safeAuthoritativeHref(candidate.authoritative_href),
    artifact_url: safeArtifactUrl(candidate.artifact_url),
    evidence_receipt_ids: strings(candidate.evidence_receipt_ids),
    version_hash: text(candidate.version_hash),
    content_version: text(candidate.content_version),
    rights_privacy_status: status as ArtifactEvidenceElement['rights_privacy_status'],
    rights_privacy_receipt_ids: strings(candidate.rights_privacy_receipt_ids),
    transformation_step: text(candidate.transformation_step),
    ...(text(candidate.evaluation_kind) ? { evaluation_kind: text(candidate.evaluation_kind) as ArtifactEvaluationKind } : {}),
    ...(candidate.evaluation_receipt ? { evaluation_receipt: parseArtifactEvaluationReceipt(candidate.evaluation_receipt) ?? undefined } : {}),
    ...(candidate.research_cohort ? { research_cohort: parseResearchCohort(candidate.research_cohort) } : {}),
    ...(region ? { region } : {}),
  }
}

function packagingElementIssues(
  element: ArtifactEvidenceElement,
  label: 'Title' | 'Thumbnail',
  currentContentVersion: string,
  evaluationAsOf: string,
  target: YouTubePackagingTarget,
): { blockers: string[]; recoveryActions: string[] } {
  const blockers: string[] = []
  const recoveryActions: string[] = []
  const currentVersion = timestamp(currentContentVersion)
  if (!element.input_excerpt) {
    blockers.push(`${label} evidence is missing the customer-facing ${label === 'Title' ? 'title' : 'headline'}.`)
    recoveryActions.push(`Add the exact customer-facing ${label === 'Title' ? 'title' : 'thumbnail headline'} to the versioned packaging receipt, then rebuild the asset-package review.`)
  }
  if (!element.authoritative_href || !element.evidence_receipt_ids.length) {
    blockers.push(`${label} evidence is not bound to exact safe source links and receipt identities.`)
    recoveryActions.push(`Bind the ${label.toLowerCase()} to its exact approved source links and stable receipt IDs, then rebuild the asset-package review.`)
  }
  if (!element.version_hash || timestamp(element.content_version) !== currentVersion) {
    blockers.push(`${label} evidence is stale or not version-bound to the current content.`)
    recoveryActions.push(`Re-evaluate the ${label.toLowerCase()} against the current content version and issue a new version-bound receipt.`)
  }
  if (label === 'Thumbnail' && !element.artifact_url) {
    blockers.push('Thumbnail evidence is missing its actual bound review asset.')
    recoveryActions.push('Restore the versioned thumbnail file and receipt binding, then rebuild the asset-package review. A brief or poster alone is not sufficient.')
  }
  if (label === 'Thumbnail' && !element.research_cohort) {
    blockers.push('Thumbnail evidence is missing its attributable research cohort and candidate bindings.')
    recoveryActions.push('Attach a fresh same-topic public cohort, first-party element bindings, and the exact candidate record before review.')
  }
  if (label === 'Thumbnail' && element.research_cohort) {
    const research = element.research_cohort
    const candidate = research.candidate
    const requiredCandidate = target === 'youtube_shorts'
      ? { width: 1080, height: 1920, aspectRatio: '9:16', label: 'YouTube Short' }
      : { width: 1280, height: 720, aspectRatio: '16:9', label: 'YouTube long-form' }
    if (!candidate || candidate.width !== requiredCandidate.width || candidate.height !== requiredCandidate.height || candidate.aspect_ratio !== requiredCandidate.aspectRatio) {
      blockers.push(`${requiredCandidate.label} thumbnail evidence must bind an exact ${requiredCandidate.width}×${requiredCandidate.height} ${requiredCandidate.aspectRatio} candidate.`)
      recoveryActions.push(`Rebuild and bind the candidate as a ${requiredCandidate.width}×${requiredCandidate.height} ${requiredCandidate.aspectRatio} asset before review.`)
    }
    const requiredBindings: ThumbnailElementBinding['element'][] = ['subject', 'hook', 'product_proof', 'aspect_ratio', 'brand_treatment']
    const validBindings = new Set(research.element_bindings.filter((binding) => binding.support === 'supports' && binding.link_status === 'verified_openable').map((binding) => binding.element))
    const missingBindings = requiredBindings.filter((binding) => !validBindings.has(binding))
    if (missingBindings.length) {
      blockers.push(`Thumbnail evidence is missing verified supporting bindings for: ${missingBindings.join(', ')}.`)
      recoveryActions.push('Attach an openable attributable source for every candidate element or leave that design choice Unscored.')
    }
    const blockedLinks = [
      ...research.first_party_neighbors.filter((neighbor) => neighbor.link_status !== 'verified_openable').map((neighbor) => neighbor.label),
      ...research.samples.filter((sample) => sample.link_status !== 'verified_openable' || !sample.source_thumbnail_url).map((sample) => sample.title),
    ]
    if (blockedLinks.length) {
      blockers.push(`Thumbnail evidence contains blocked or missing source links: ${blockedLinks.join(', ')}.`)
      recoveryActions.push('Restore absolute, openable public and first-party evidence links before review.')
    }
    const unsupportedPublicClaims = research.samples.filter((sample) => sample.outlier_qualified && sample.supports_candidate_composition)
    if (unsupportedPublicClaims.length) {
      blockers.push('A qualified public outlier is incorrectly marked as supporting the candidate composition.')
      recoveryActions.push('Mark visually dissimilar public outliers as comparison-only and recalculate design fit from attributable first-party inputs.')
    }
    const included = research.samples.filter((sample) => sample.decision === 'included')
    const incompleteSources = included.filter((sample) => (
      !sample.title
      || !sample.hook_type
      || !Number.isFinite(sample.thumbnail_text_length)
      || sample.normalized_performance_score == null
      || sample.channel_relative_ratio == null
      || sample.audience_view_ratio == null
      || sample.recency_adjusted_views_per_day == null
      || sample.channel_baseline_size == null
      || !sample.transcription_provenance
    ))
    if (incompleteSources.length) {
      blockers.push(`Live topic sources are missing required copy-pair evidence: ${incompleteSources.map((sample) => sample.video_id).join(', ')}.`)
      recoveryActions.push('Restore exact titles, attributable description openings when available, transcription provenance, relationship classes, hook types, and normalized performance inputs for every included source.')
    }
    const inferredUnreadable = included.filter((sample) => sample.thumbnail_text_transcription_status === 'unreadable' && sample.thumbnail_text.length > 0)
    if (inferredUnreadable.length) {
      blockers.push(`Unreadable thumbnail copy was inferred for: ${inferredUnreadable.map((sample) => sample.video_id).join(', ')}.`)
      recoveryActions.push('Remove inferred text and mark the captured thumbnail unreadable until a human can verify the visible copy.')
    }
    const analysis = research.copy_pair_analysis
    const repeated = included.filter((sample) => ['duplicate', 'near_duplicate'].includes(sample.title_thumbnail_relationship))
    const distinct = included.filter((sample) => ['complementary_teaser', 'contrasting_question'].includes(sample.title_thumbnail_relationship))
    const sampleCountsMatch = repeated.length === analysis.repeated_group.sample_size && distinct.length === analysis.distinct_group.sample_size
    if (!sampleCountsMatch) {
      blockers.push('Copy-pair performance group sample sizes do not match the classified live sources.')
      recoveryActions.push('Recalculate copy-pair groups directly from the included source classifications.')
    }
    const sameIds = (expected: string[], actual: string[]) => expected.length === actual.length && expected.every((videoId) => actual.includes(videoId))
    if (!sameIds(analysis.repeated_group.video_ids, repeated.map((sample) => sample.video_id)) || !sameIds(analysis.distinct_group.video_ids, distinct.map((sample) => sample.video_id))) {
      blockers.push('Copy-pair performance group membership does not match the classified live sources.')
      recoveryActions.push('Rebuild both comparison groups from the exact included source classifications before review.')
    }
    const sufficient = repeated.length >= analysis.repeated_group.minimum_sample_size && distinct.length >= analysis.distinct_group.minimum_sample_size
    if (!sufficient && (analysis.status !== 'unscored' || analysis.conclusion !== 'unscored_insufficient_group_samples')) {
      blockers.push('The copy-pair heuristic claims a scored conclusion without sufficient samples in both comparison groups.')
      recoveryActions.push('Leave the heuristic Unscored until both repeated and distinct groups meet their declared minimum sample sizes.')
    }
    const candidatePair = research.candidate_copy_pair
    if (!candidatePair.title || !candidatePair.thumbnail_hook || candidatePair.title.trim().toLowerCase() === candidatePair.thumbnail_hook.trim().toLowerCase() || !candidatePair.exact_strings_are_distinct) {
      blockers.push('The candidate title and thumbnail hook must be bound as two non-identical exact strings.')
      recoveryActions.push('Bind the exact customer-facing title and exact thumbnail hook side by side, and keep their wording distinct.')
    }
    const claimsDistinctPair = ['complementary_teaser', 'contrasting_question'].includes(candidatePair.relationship)
    const includedById = new Map(included.map((sample) => [sample.video_id, sample]))
    const editorialSupportIsBound = candidatePair.source_example_video_ids.length > 0 && candidatePair.source_example_video_ids.every((videoId) => {
      const sample = includedById.get(videoId)
      return Boolean(sample && sample.link_status === 'verified_openable' && ['complementary_teaser', 'contrasting_question'].includes(sample.title_thumbnail_relationship))
    })
    const distinctPerformanceIsSupported = analysis.status === 'scored' && analysis.conclusion === 'supports_distinct_pair' && candidatePair.support_scope === 'performance_supported' && candidatePair.performance_claim === 'supported'
    const distinctReviewVariantIsBounded = analysis.status === 'unscored' && analysis.conclusion === 'unscored_insufficient_group_samples' && candidatePair.strategy_status === 'review_only_unscored' && candidatePair.support_scope === 'editorial_hypothesis_only' && candidatePair.performance_claim === 'unscored' && editorialSupportIsBound
    if (claimsDistinctPair && !distinctPerformanceIsSupported && !distinctReviewVariantIsBounded) {
      blockers.push('The candidate distinct copy-pair strategy is not bound to either supported performance evidence or a review-only Unscored editorial hypothesis.')
      recoveryActions.push('Bind the distinct variant to classified editorial examples and keep performance Unscored, or collect enough attributable live samples for a supported performance claim.')
    }
  }
  if (!element.evaluation_receipt) {
    blockers.push(`${label} evidence has no numerical evaluation receipt.`)
    recoveryActions.push(`Attach a current comparable/outlier cohort and complete the ${label.toLowerCase()} scorecard before asset-package review.`)
  } else {
    const evaluation = validateArtifactEvaluationReceipt(element.evaluation_receipt, currentContentVersion, evaluationAsOf)
    if (!evaluation.ready) {
      blockers.push(...evaluation.blockers.map((blocker) => `${label} evidence: ${blocker}`))
      recoveryActions.push(`Resolve the ${label.toLowerCase()} scorecard blockers, attach current attributable cohort receipts, and issue a fresh version-bound evaluation.`)
    }
  }
  return { blockers, recoveryActions }
}

export function validateYouTubePackagingEvidence(
  value: unknown,
  currentContentVersion: string,
  target: YouTubePackagingTarget,
  evaluationAsOf: string = new Date().toISOString(),
): YouTubePackagingEvidenceValidation {
  const manifest = parseArtifactEvidenceManifest(value)
  if (!manifest) {
    return {
      ready: false,
      pairBound: false,
      target,
      title: null,
      thumbnail: null,
      blockers: ['YouTube packaging evidence is missing or malformed.'],
      recoveryActions: ['Restore the versioned title and thumbnail receipts, then rebuild the existing Social Content asset-package review.'],
    }
  }

  const titles = manifest.elements.filter((element) => element.category === 'title' && element.customer_facing)
  const thumbnails = manifest.elements.filter((element) => element.category === 'thumbnail' && element.customer_facing)
  const blockers: string[] = []
  const recoveryActions: string[] = []
  if (titles.length !== 1) {
    blockers.push(titles.length === 0 ? 'Customer-facing title evidence is missing.' : 'Customer-facing title evidence is ambiguous because more than one title is marked current.')
    recoveryActions.push('Bind exactly one current customer-facing title and retire or version older candidates before asset-package review.')
  }
  if (thumbnails.length !== 1) {
    blockers.push(thumbnails.length === 0 ? 'Customer-facing thumbnail evidence is missing.' : 'Customer-facing thumbnail evidence is ambiguous because more than one thumbnail is marked current.')
    recoveryActions.push('Bind exactly one current customer-facing thumbnail and retire or version older candidates before asset-package review.')
  }

  const title = titles.length === 1 ? titles[0] : null
  const thumbnail = thumbnails.length === 1 ? thumbnails[0] : null
  if (title) {
    const issues = packagingElementIssues(title, 'Title', currentContentVersion, evaluationAsOf, target)
    blockers.push(...issues.blockers)
    recoveryActions.push(...issues.recoveryActions)
  }
  if (thumbnail) {
    const issues = packagingElementIssues(thumbnail, 'Thumbnail', currentContentVersion, evaluationAsOf, target)
    blockers.push(...issues.blockers)
    recoveryActions.push(...issues.recoveryActions)
  }
  if (title && thumbnail?.research_cohort) {
    const pair = thumbnail.research_cohort.candidate_copy_pair
    if (pair.title !== title.input_excerpt || pair.thumbnail_hook !== thumbnail.input_excerpt) {
      blockers.push('The candidate copy-pair binding does not match the current title and thumbnail hook.')
      recoveryActions.push('Rebuild the copy-pair receipt from the exact current customer-facing title and thumbnail hook.')
    }
  }

  const pairBound = Boolean(
    title?.input_excerpt
    && title.authoritative_href
    && title.evidence_receipt_ids.length
    && thumbnail?.input_excerpt
    && thumbnail.authoritative_href
    && thumbnail.evidence_receipt_ids.length
    && thumbnail.artifact_url,
  )
  return {
    ready: blockers.length === 0,
    pairBound,
    target,
    title,
    thumbnail,
    blockers: [...new Set(blockers)],
    recoveryActions: [...new Set(recoveryActions)],
  }
}

export function validateYouTubeThumbnailBatchDiversity(
  candidates: Array<{ id: string; manifest: unknown }>,
): YouTubeThumbnailBatchDiversityValidation {
  const blockers: string[] = []
  const recoveryActions: string[] = []
  const parsed = candidates.map(({ id, manifest }) => {
    const parsedManifest = parseArtifactEvidenceManifest(manifest)
    const thumbnails = parsedManifest?.elements.filter((element) => element.category === 'thumbnail' && element.customer_facing) ?? []
    const composition = thumbnails.length === 1 ? thumbnails[0].research_cohort?.composition ?? null : null
    if (!parsedManifest || thumbnails.length !== 1 || !composition) {
      blockers.push(`${id}: thumbnail composition metadata is missing or ambiguous.`)
      recoveryActions.push(`${id}: bind one versioned youtube-thumbnail-composition/v1 decision to the current thumbnail receipt.`)
    }
    return { id, composition }
  })

  if (candidates.length < 2) {
    blockers.push('Thumbnail batch diversity requires at least two current candidates.')
    recoveryActions.push('Evaluate the complete campaign thumbnail batch together before review.')
  }

  const compositions = parsed.flatMap(({ id, composition }) => composition ? [{ id, composition }] : [])
  for (const { id, composition } of compositions) {
    const complete = composition.layout_family
      && composition.dominant_subject
      && composition.focal_hierarchy.length >= 3
      && composition.text_placement
      && composition.batch_identity
      && composition.composition_signature
    if (!complete) {
      blockers.push(`${id}: thumbnail composition metadata is incomplete.`)
      recoveryActions.push(`${id}: record layout family, dominant subject, three-step focal hierarchy, text placement, batch identity, and composition signature.`)
    }
    const genericSignature = `${composition.layout_family}|${composition.composition_signature}`.toLowerCase()
    if (['generic-fallback', 'left-copy-right-product', 'shared-template'].some((token) => genericSignature.includes(token))) {
      blockers.push(`${id}: repeated generic fallback composition signatures are prohibited.`)
      recoveryActions.push(`${id}: replace the generic fallback with a source-bound, campaign-specific composition family.`)
    }
  }

  const batchIdentities = [...new Set(compositions.map(({ composition }) => composition.batch_identity).filter(Boolean))]
  if (batchIdentities.length !== 1) {
    blockers.push('Current thumbnail candidates are not bound to one versioned batch identity.')
    recoveryActions.push('Bind every current campaign thumbnail to the same batch identity before evaluating diversity.')
  }

  const duplicateIssue = (field: 'layout_family' | 'composition_signature', label: string) => {
    const groups = new Map<string, typeof compositions>()
    for (const entry of compositions) {
      const key = entry.composition[field]
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }
    for (const [value, entries] of groups) {
      if (!value || entries.length < 2) continue
      const receiptSets = entries.map(({ composition }) => new Set(composition.exception_receipt_ids))
      const sharedReceipts = [...(receiptSets[0] ?? [])].filter((receipt) => receiptSets.every((set) => set.has(receipt)))
      const attributableException = entries.every(({ composition }) => composition.exception_basis === 'evidence_required') && sharedReceipts.length > 0
      if (!attributableException) {
        blockers.push(`Thumbnail batch repeats the ${label} "${value}" without an attributable evidence-required exception.`)
        recoveryActions.push(`Give each candidate a materially distinct ${label}, or attach the same explicit evidence receipt requiring the shared composition.`)
      }
    }
  }
  duplicateIssue('layout_family', 'layout family')
  duplicateIssue('composition_signature', 'composition signature')

  return {
    ready: blockers.length === 0 && compositions.length === candidates.length,
    batchIdentity: batchIdentities.length === 1 ? batchIdentities[0] : null,
    candidateCount: candidates.length,
    layoutFamilies: compositions.map(({ composition }) => composition.layout_family),
    compositionSignatures: compositions.map(({ composition }) => composition.composition_signature),
    blockers: [...new Set(blockers)],
    recoveryActions: [...new Set(recoveryActions)],
  }
}

export function parseArtifactEvidenceManifest(value: unknown): ArtifactEvidenceManifest | null {
  const candidate = record(value)
  if (!candidate || candidate.version !== ARTIFACT_EVIDENCE_MANIFEST_VERSION) return null
  const elements = Array.isArray(candidate.elements)
    ? candidate.elements.map(parseElement).filter((entry): entry is ArtifactEvidenceElement => Boolean(entry))
    : []
  const hashes = Array.isArray(candidate.final_output_hashes)
    ? candidate.final_output_hashes.map((value) => {
        const hash = record(value)
        return hash ? { label: text(hash.label), sha256: text(hash.sha256) } : null
      }).filter((entry): entry is { label: string; sha256: string } => Boolean(entry))
    : []
  return {
    version: ARTIFACT_EVIDENCE_MANIFEST_VERSION,
    manifest_id: text(candidate.manifest_id),
    manifest_hash: text(candidate.manifest_hash),
    content_version: text(candidate.content_version),
    artifact_label: text(candidate.artifact_label),
    preview_url: text(candidate.preview_url) || null,
    preview_alt: text(candidate.preview_alt),
    final_output_hashes: hashes,
    elements,
  }
}

export function validateArtifactEvidenceManifest(
  value: unknown,
  currentContentVersion: string,
  evaluationAsOf: string = new Date().toISOString(),
): ArtifactEvidenceManifestValidation {
  const manifest = parseArtifactEvidenceManifest(value)
  if (!manifest) return { manifest: null, ready: false, stale: false, blockers: ['The artifact evidence manifest is missing or malformed.'] }

  const blockers: string[] = []
  const currentVersion = timestamp(currentContentVersion)
  const manifestVersion = timestamp(manifest.content_version)
  const stale = !currentVersion || !manifestVersion || currentVersion !== manifestVersion

  if (!manifest.manifest_id) blockers.push('The manifest identity is missing.')
  if (!/^sha256:[a-f0-9]{64}$/i.test(manifest.manifest_hash)) blockers.push('The manifest hash is missing or invalid.')
  if (stale) blockers.push('The artifact evidence manifest is stale for the current content version. Rebuild the review packet from the current artifact inputs.')
  if (!manifest.preview_alt) blockers.push('The artifact preview needs accessible alternative text.')
  if (!manifest.final_output_hashes.length || manifest.final_output_hashes.some((entry) => !entry.label || !/^[a-f0-9]{64}$/i.test(entry.sha256))) {
    blockers.push('Every final output needs a valid SHA-256 hash.')
  }

  const ids = new Set<string>()
  for (const category of ARTIFACT_EVIDENCE_CATEGORIES) {
    if (!manifest.elements.some((element) => element.category === category)) blockers.push(`Manifest category ${category.replaceAll('_', ' ')} is missing.`)
  }

  for (const element of manifest.elements) {
    if (!element.id || ids.has(element.id)) blockers.push('Every manifested element needs a unique stable identity.')
    ids.add(element.id)
    if (!element.label || !element.source_identity || !element.source_record_type || !element.version_hash || !element.transformation_step) {
      blockers.push(`${element.label || element.id || 'Manifest element'} is missing source, version, or transformation detail.`)
    }
    if (timestamp(element.content_version) !== manifestVersion) blockers.push(`${element.label || element.id} is stale for this manifest version.`)
    if (element.customer_facing) {
      if (!element.input_excerpt) blockers.push(`${element.label || element.id} is customer-facing but has no bounded input excerpt.`)
      if (!element.authoritative_href) blockers.push(`${element.label || element.id} is customer-facing but has no safe authoritative source link.`)
      if (!element.evidence_receipt_ids.length) blockers.push(`${element.label || element.id} is customer-facing but has no evidence receipt.`)
      if (element.rights_privacy_status !== 'passed' || !element.rights_privacy_receipt_ids.length) blockers.push(`${element.label || element.id} is customer-facing but lacks a passing rights/privacy receipt.`)
      if (element.redacted) blockers.push(`${element.label || element.id} cannot be both customer-facing and redacted.`)
    }
    const expectedEvaluationKind = EVALUATION_KIND_BY_CATEGORY[element.category]
    if (element.customer_facing && expectedEvaluationKind) {
      if (element.evaluation_kind !== expectedEvaluationKind || !element.evaluation_receipt) {
        blockers.push(`${element.label || element.id} is missing its versioned ${expectedEvaluationKind.replaceAll('_', ' ')} evaluation receipt.`)
      } else {
        const evaluation = validateArtifactEvaluationReceipt(element.evaluation_receipt, manifest.content_version, evaluationAsOf)
        if (element.evaluation_receipt.evaluation_kind !== expectedEvaluationKind) blockers.push(`${element.label || element.id} has the wrong evaluation kind.`)
        if (!evaluation.ready) blockers.push(...evaluation.blockers.map((blocker) => `${element.label || element.id}: ${blocker}`))
      }
    }
  }

  return { manifest, ready: blockers.length === 0, stale, blockers: [...new Set(blockers)] }
}

export function artifactManifestSnapshot(value: unknown): ArtifactManifestSnapshot | null {
  const manifest = parseArtifactEvidenceManifest(value)
  if (!manifest?.manifest_id || !manifest.manifest_hash || !manifest.content_version) return null
  const evaluationReceipts = manifest.elements
    .map((element) => element.evaluation_receipt)
    .filter((receipt): receipt is ArtifactEvaluationReceipt => Boolean(receipt))
  return {
    manifest_id: manifest.manifest_id,
    manifest_hash: manifest.manifest_hash,
    content_version: manifest.content_version,
    evaluation_receipt_version: evaluationReceipts[0]?.version ?? null,
    evaluation_receipt_ids: evaluationReceipts.map((receipt) => receipt.receipt_id).sort(),
  }
}
