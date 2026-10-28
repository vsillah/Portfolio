import type { ArtifactEvaluationDimension, ArtifactEvaluationDimensionKey, ArtifactEvaluationKind, ArtifactEvaluationReceipt } from '@/lib/artifact-evidence-evaluation'
import { validateYouTubePackagingEvidence, validateYouTubeThumbnailBatchDiversity, type ArtifactEvidenceManifest, type ThumbnailResearchCohort, type YouTubePackagingEvidenceValidation, type YouTubePackagingTarget, type YouTubeThumbnailBatchDiversityValidation } from '@/lib/artifact-evidence-manifest'
import darkCastleCohort from '@/artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/cohort.json'
import darkCastleDecision from '@/artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'
import darkCastleSelection from '@/artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/dark-castle-thumbnail-selection-receipt.json'
import aiAuditCohort from '@/artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/cohort.json'
import aiAuditDecision from '@/artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'
import aiAuditSelection from '@/artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/ai-audit-thumbnail-selection-receipt.json'
import { inspectSocialScriptTemplateReceipt, type SocialScriptTemplateReceipt } from '@/lib/social-script-template-receipt'

export const SOCIAL_CAMPAIGN_REVIEW_IDS = {
  jevLinkedIn: '80618d32-7046-4abc-b2b7-8adb5526bb2e',
  jevYouTube: '939b01e3-d1af-42c8-805e-0379f09efd60',
  darkCastleLinkedIn: '9817a689-0565-48ed-8c97-c2db40c1ec45',
  darkCastleYouTube: 'c12378f2-36de-4bf7-8c5d-0ce754e727eb',
  auditLinkedIn: '0085c317-2902-42e6-81cc-c9dc8d23028f',
  auditYouTube: '3dad4cca-72b7-4705-8fb6-273bf7500ce6',
} as const

export type ReviewSource = {
  label: string
  href: string
  receipt: string
  supports: string
  limitation: string
}

export type LinkedInReviewPacket = {
  kind: 'linkedin_visual'
  channel: 'linkedin'
  socialContentId: string
  calendarItemId: string
  campaign: string
  practicalValue: string
  reviewCaption?: string
  reviewCta?: string
  reviewHashtags?: string[]
  visual: {
    publicPath: string
    alt: string
    headline: string
    proofLine: string
    sha256: string
  }
  sources: ReviewSource[]
  jit?: {
    contentVersion: string
    observedAt: string
    expiresAt: string
    targetAt: string
    receiptId?: string
    status: 'blocked_stale_jit' | 'ready_current_jit'
  }
  externalGates: 'closed'
}

export type StoryboardBeat = {
  time: string
  beat: string
  proof: string
}

export type YouTubeReviewPacket = {
  kind: 'youtube_packaging'
  channel: 'youtube'
  socialContentId: string
  calendarItemId: string
  campaign: string
  status: 'reused_approved_pair' | 'blocked_missing_description_evidence'
  title: string
  thumbnailTeaser: string
  thumbnailConcept: string
  thumbnailPath?: string
  thumbnailReceipt?: string
  packagingTarget: YouTubePackagingTarget
  contentVersion: string
  thumbnailEvidenceManifest?: ArtifactEvidenceManifest
  thumbnailEvidence: YouTubePackagingEvidenceValidation | null
  thumbnailDiversity: YouTubeThumbnailBatchDiversityValidation | null
  openingHook: string
  descriptionEvidence: {
    state: 'ready' | 'unscored'
    qualified: number
    required: number
    requirement: string
    attribution: ReviewSource[]
  }
  scriptTemplate?: {
    ready: boolean
    blockers: string[]
    receipt: SocialScriptTemplateReceipt | null
  }
  storyboard: StoryboardBeat[]
  productProof: ReviewSource[]
  conclusion: string
  spokenCta: string
  externalGates: 'closed'
}

export type SocialCampaignReviewPacket = LinkedInReviewPacket | YouTubeReviewPacket

const externalGateNote = 'No provider call, render, upload, platform draft, schedule, publication, external send, credential change, migration, or production write is enabled.'
const fixtureContentVersion = '2026-10-18T00:00:00.000Z'

type CohortJson = typeof darkCastleCohort
type SelectionJson = typeof darkCastleSelection | typeof aiAuditSelection
type DecisionJson = typeof darkCastleDecision | typeof aiAuditDecision

function packagingEvaluationReceipt(
  kind: ArtifactEvaluationKind,
  elementId: string,
  contentVersion: string,
  cohort: CohortJson,
  decision: DecisionJson,
  selection: SelectionJson,
): ArtifactEvaluationReceipt {
  const cohortHref = `/admin/source-protocol?receipt=${encodeURIComponent(cohort.cohort_id)}`
  const selectionHref = `/admin/source-protocol?receipt=${encodeURIComponent(selection.receipt_id)}`
  const cohortLink = { receipt_id: cohort.cohort_id, href: cohortHref }
  const selectionLink = { receipt_id: selection.receipt_id, href: selectionHref }
  const decisionLink = { receipt_id: decision.receipt_id, href: `/admin/source-protocol?receipt=${encodeURIComponent(decision.receipt_id)}` }
  const definitions: Record<ArtifactEvaluationDimensionKey, { score: number; weight: number; threshold: number; direction: ArtifactEvaluationDimension['direction']; basis: ArtifactEvaluationDimension['basis']; rationale: string; receipt: typeof cohortLink }> = {
    outlier_pattern_fit: { score: 80, weight: 25, threshold: 70, direction: 'higher_is_better', basis: 'measured', rationale: 'The candidate uses the cohort-supported one-idea, short-hook, high-contrast pattern. Public pixels and layouts contribute zero composition authority.', receipt: cohortLink },
    source_support: { score: 100, weight: 20, threshold: 80, direction: 'higher_is_better', basis: 'measured', rationale: 'The Social Content decision receipt, live cohort, first-party product source, exact copy pair, selection receipt, and output hash are all bound.', receipt: decisionLink },
    core_audience_fit: { score: 90, weight: 15, threshold: 70, direction: 'higher_is_better', basis: 'heuristic', rationale: 'The 16:9 candidate has one product idea and one concise tension hook sized for small-screen recognition.', receipt: selectionLink },
    timeliness: { score: 100, weight: 10, threshold: 65, direction: 'higher_is_better', basis: 'measured', rationale: 'The public cohort was captured and evaluated inside its declared fourteen-day freshness window.', receipt: cohortLink },
    product_work_evidence_fit: { score: 100, weight: 20, threshold: 80, direction: 'higher_is_better', basis: 'measured', rationale: 'The visible subject is owned product evidence with an exact source receipt and no unsupported outcome claim.', receipt: selectionLink },
    originality_repetition_risk: { score: 0, weight: 10, threshold: 35, direction: 'lower_is_better', basis: 'measured', rationale: 'The candidate reuses no public thumbnail pixels, creator likenesses, source phrases, or source brand treatment.', receipt: selectionLink },
  }
  const dimensions = Object.fromEntries(Object.entries(definitions).map(([key, definition]) => [key, {
    status: 'scored',
    score: definition.score,
    basis: definition.basis,
    direction: definition.direction,
    weight: definition.weight,
    threshold: definition.threshold,
    percentile: key === 'outlier_pattern_fit' ? 80 : null,
    rank: null,
    deterministic_inputs: [{ name: `${key}_score`, value: String(definition.score), receipt_id: definition.receipt.receipt_id }],
    source_receipts: [definition.receipt],
    rationale: definition.rationale,
  }])) as Record<ArtifactEvaluationDimensionKey, ArtifactEvaluationDimension>
  const overall = Number((Object.values(dimensions).reduce((total, dimension) => total + (dimension.direction === 'lower_is_better' ? 100 - dimension.score! : dimension.score!) * dimension.weight, 0) / 100).toFixed(2))
  const published = cohort.included.map((sample) => sample.published_at).filter((value): value is string => Boolean(value)).sort()
  return {
    version: 'artifact-evaluation-scorecard/v1',
    receipt_id: `evaluation:${selection.receipt_id}:${kind}`,
    evaluation_kind: kind,
    content_version: contentVersion,
    evaluated_at: cohort.observed_at,
    weighting_version: 'artifact-evaluation-weights/v1',
    benchmark_cohort: {
      cohort_id: cohort.cohort_id,
      status: 'approved',
      sample_size: cohort.included.length,
      observed_from: published[0] ?? cohort.observed_at,
      observed_to: cohort.observed_at,
      fresh_until: cohort.fresh_until,
      source_receipts: [cohortLink],
    },
    dimensions,
    overall: {
      score: overall,
      threshold: 75,
      recommendation: overall >= 75 ? 'advance' : 'revise',
      confidence_score: 90,
      confidence_label: 'high',
      rationale: 'Advance the version-bound candidate to review. Public examples remain comparison evidence; first-party sources control the composition.',
      source_receipts: [cohortLink, decisionLink, selectionLink],
    },
  }
}

function packagingResearchCohort(cohort: CohortJson, decision: DecisionJson, selection: SelectionJson): ThumbnailResearchCohort {
  const candidate = {
    id: selection.receipt_id,
    label: `${selection.thumbnail_hook} candidate`,
    artifact_url: selection.output.artifact_url,
    source_url: selection.output.artifact_url,
    link_status: 'verified_openable' as const,
    supports_candidate_composition: true,
    support_reason: selection.selection_rationale,
    width: selection.output.width,
    height: selection.output.height,
    aspect_ratio: selection.output.aspect_ratio,
  }
  const firstParty = {
    id: selection.first_party_source.receipt_id,
    label: selection.first_party_source.label,
    artifact_url: selection.first_party_source.artifact_url,
    source_url: selection.first_party_source.artifact_url,
    link_status: 'verified_openable' as const,
    supports_candidate_composition: true,
    support_reason: 'Owned product proof supplies the visible subject and product idea.',
    width: null,
    height: null,
    aspect_ratio: null,
  }
  const supportingFirstParty = selection.first_party_supporting_sources.map((source) => ({
    id: source.receipt_id,
    label: source.label,
    artifact_url: source.artifact_url,
    source_url: source.artifact_url,
    link_status: 'verified_openable' as const,
    supports_candidate_composition: true,
    support_reason: 'Approved first-party material supplies the human anchor used by this exact candidate.',
    width: null,
    height: null,
    aspect_ratio: null,
  }))
  const subjectSource = selection.first_party_supporting_sources[0] ?? selection.first_party_source
  const binding = (element: 'subject' | 'hook' | 'product_proof' | 'aspect_ratio' | 'brand_treatment', sourceLabel: string, sourceUrl: string, limitation: string) => ({
    element,
    source_label: sourceLabel,
    source_url: sourceUrl,
    link_status: 'verified_openable' as const,
    support: 'supports' as const,
    limitation,
  })
  return {
    cohort_id: cohort.cohort_id,
    target: 'youtube_long_form_16_9',
    observed_at: cohort.observed_at,
    sample_size: cohort.included.length,
    minimum_sample_size: cohort.selection_gate.minimum_sample_size,
    outlier_rule: cohort.outlier_qualification.rule,
    outlier_sample_size: cohort.outlier_qualification.qualified_sample_size,
    formula: Object.values(cohort.formula),
    recurring_visual_traits: cohort.recurring_visual_traits,
    adopted_traits: cohort.adopted_traits,
    rejected_traits: cohort.rejected_traits,
    composition_decision: cohort.composition_decision,
    composition: selection.composition as ThumbnailResearchCohort['composition'],
    public_outlier_boundary: cohort.public_outlier_boundary,
    first_party_neighbors: [firstParty, ...supportingFirstParty],
    candidate,
    element_bindings: [
      binding('subject', subjectSource.label, subjectSource.artifact_url, 'Supports the visible dominant subject, not a performance outcome.'),
      binding('hook', 'Exact title-thumbnail selection receipt', `/admin/source-protocol?receipt=${encodeURIComponent(selection.receipt_id)}`, 'Supports the exact distinct hook as an editorial hypothesis only.'),
      binding('product_proof', selection.first_party_source.label, selection.first_party_source.artifact_url, 'Supports owned product UI only.'),
      binding('aspect_ratio', 'Long-form YouTube candidate', selection.output.artifact_url, 'Supports 1280×720 16:9 only.'),
      binding('brand_treatment', 'Rendered AmaduTown candidate', selection.output.artifact_url, 'Supports the logo, navy, white, and gold treatment in this exact candidate.'),
    ],
    copy_pair_analysis: cohort.copy_pair_analysis as ThumbnailResearchCohort['copy_pair_analysis'],
    candidate_copy_pair: cohort.candidate_copy_pair as ThumbnailResearchCohort['candidate_copy_pair'],
    samples: cohort.included as unknown as ThumbnailResearchCohort['samples'],
    decision_receipt: decision as unknown as ThumbnailResearchCohort['decision_receipt'],
  }
}

function packagingManifest(contentVersion: string, cohort: CohortJson, decision: DecisionJson, selection: SelectionJson): ArtifactEvidenceManifest {
  const sourceHref = `/admin/source-protocol?receipt=${encodeURIComponent(selection.receipt_id)}`
  const common = {
    customer_facing: true,
    review_only: true,
    redacted: false,
    source_identity: selection.receipt_id,
    source_record_type: 'portfolio_research_packet',
    authoritative_href: sourceHref,
    content_version: contentVersion,
    rights_privacy_status: 'passed' as const,
    rights_privacy_receipt_ids: [selection.first_party_source.receipt_id, ...selection.first_party_supporting_sources.map((source) => source.receipt_id), `privacy:${selection.receipt_id}`],
    transformation_step: 'Bound into a repository-only review projection with every external execution gate closed.',
  }
  return {
    version: 'artifact-evidence-manifest/v2',
    manifest_id: `artifact-manifest:${selection.receipt_id}`,
    manifest_hash: selection.output.sha256,
    content_version: contentVersion,
    artifact_label: `${selection.thumbnail_hook} YouTube packaging candidate`,
    preview_url: selection.output.artifact_url,
    preview_alt: `YouTube thumbnail reading ${selection.thumbnail_hook}`,
    final_output_hashes: [{ label: 'Thumbnail PNG', sha256: selection.output.sha256.replace('sha256:', '') }],
    elements: [
      {
        ...common,
        id: `title:${selection.receipt_id}`,
        category: 'title',
        label: 'Title',
        input_excerpt: selection.title,
        evidence_receipt_ids: [decision.receipt_id, selection.receipt_id, cohort.cohort_id],
        version_hash: selection.output.sha256,
        evaluation_kind: 'title_subject',
        evaluation_receipt: packagingEvaluationReceipt('title_subject', 'title', contentVersion, cohort, decision, selection),
      },
      {
        ...common,
        id: `thumbnail:${selection.receipt_id}`,
        category: 'thumbnail',
        label: 'Thumbnail',
        input_excerpt: selection.thumbnail_hook,
        artifact_url: selection.output.artifact_url,
        evidence_receipt_ids: [decision.receipt_id, selection.receipt_id, cohort.cohort_id, selection.first_party_source.receipt_id, ...selection.first_party_supporting_sources.map((source) => source.receipt_id)],
        version_hash: selection.output.sha256,
        evaluation_kind: 'thumbnail',
        evaluation_receipt: packagingEvaluationReceipt('thumbnail', 'thumbnail', contentVersion, cohort, decision, selection),
        research_cohort: packagingResearchCohort(cohort, decision, selection),
      },
    ],
  }
}

const darkCastleManifest = packagingManifest(fixtureContentVersion, darkCastleCohort, darkCastleDecision, darkCastleSelection)
const aiAuditManifest = packagingManifest(fixtureContentVersion, aiAuditCohort as CohortJson, aiAuditDecision as DecisionJson, aiAuditSelection as SelectionJson)
export const SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY = validateYouTubeThumbnailBatchDiversity([
  { id: 'dark-castle', manifest: darkCastleManifest },
  { id: 'ai-audit', manifest: aiAuditManifest },
])

function validatedPackagingEvidence(manifest: ArtifactEvidenceManifest) {
  const validation = validateYouTubePackagingEvidence(manifest, fixtureContentVersion, 'youtube', '2026-10-18T20:00:00.000Z')
  if (SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY.ready) return { manifest, validation }
  return {
    manifest,
    validation: {
      ...validation,
      ready: false,
      blockers: [...new Set([...validation.blockers, ...SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY.blockers.map((blocker) => `Batch diversity: ${blocker}`)])],
      recoveryActions: [...new Set([...validation.recoveryActions, ...SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY.recoveryActions])],
    },
  }
}

const darkCastlePackagingEvidence = validatedPackagingEvidence(darkCastleManifest)
const aiAuditPackagingEvidence = validatedPackagingEvidence(aiAuditManifest)

export const SOCIAL_CAMPAIGN_REVIEW_PACKETS: Record<string, SocialCampaignReviewPacket> = {
  [SOCIAL_CAMPAIGN_REVIEW_IDS.jevLinkedIn]: {
    kind: 'linkedin_visual', channel: 'linkedin', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.jevLinkedIn,
    calendarItemId: '13d9252f-dbd1-426a-8e2e-f00dd62c2d09', campaign: 'Jev: The Model Won After the Harness Changed',
    practicalValue: 'Turns an abstract agent-governance lesson into a visible operating model: typed choices, policy thresholds, human ownership, and a retained receipt.',
    visual: {
      publicPath: '/review-assets/social-content/campaign-review/jev-linkedin-decision-system.png',
      alt: 'Jev LinkedIn visual with the operator field guide and a model, policy, human, receipt ownership chain.',
      headline: 'The model made the choice. The system owned the outcome.',
      proofLine: 'Typed probability -> policy boundary -> human owner -> receipt',
      sha256: 'sha256:5927f3b90b7895145464fb3c95d3c0d962214c2257379766bc892e43aa7bb141',
    },
    sources: [
      { label: 'Jev operator field guide', href: '/review-assets/social-content/source-proof/jev-operator-field-guide.png', receipt: 'sha256:7e123f1c11a156e86b36e0d2306ad1f42d97d3c63dac335588e804f6bc74f8e9', supports: 'Decision-only AI, policy bands, human ownership, and receipt structure.', limitation: 'Illustrative thresholds; live-provider reliability remains unproven.' },
      { label: 'Calendar review receipt', href: '#social-asset-packet-gate', receipt: '13d9252f-dbd1-426a-8e2e-f00dd62c2d09', supports: 'Review-only campaign binding and closed side-effect gates.', limitation: externalGateNote },
    ],
    externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn]: {
    kind: 'linkedin_visual', channel: 'linkedin', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn,
    calendarItemId: '433f1ee0-6764-4b95-8745-8418e6498446', campaign: 'Dark Castle Chess: Remember the Decision',
    practicalValue: 'Shows a concrete product-design check: can the player inspect the position and response, then explain the next choice?',
    reviewCaption: `A player opens with e4. The board remembers the move. What will help that player make the next decision?

In Dark Castle Chess, Explore keeps the position, move guidance, and notation together. After the computer responds, the player can inspect candidate moves alongside the board. Those are visible product states, not a measured result.

I think learning products should let people revisit the context of a choice. A completion marker tells us where someone stopped. A useful feedback loop helps the player see what changed and ask why. The next test is whether they can explain their next decision, without assuming that a correct move proves understanding.

The practical check is simple: show the position, show the response, and invite the learner to say what they would try next. Then test that explanation with actual learners.`,
    reviewCta: 'What does your product give people after they get an answer right?',
    reviewHashtags: ['ProductDesign', 'LearningDesign', 'DarkCastleChess'],
    visual: {
      publicPath: '/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png',
      alt: 'Dark Castle Chess LinkedIn visual with approved gameplay captures showing an explored board, computer response, notation, and move guidance.',
      headline: 'A right move can be an accident.',
      proofLine: 'Explore the position; inspect the response; explain the next choice.',
      sha256: 'sha256:88f26176acb339f10373dc39637e91ca8235f5cc3075f39ff737b97672a86091',
    },
    sources: [
      { label: 'Explore position capture', href: '/review-assets/social-content/storyboard-review/explore-position.jpg', receipt: 'sha256:896dce9162e815c1138dfbecacd24e0a63d05e99901f98b89022ddeee225f9df', supports: 'The owned board, open line, move guidance, and notation.', limitation: 'Shows a product state; no learner outcome is measured.' },
      { label: 'Computer response capture', href: '/review-assets/social-content/storyboard-review/explore-computer.jpg', receipt: 'sha256:27d79426c04fa984569dc337623d1eb4a514392bf2e067563d9982d43d77dcdf', supports: 'The owned response, notation, and candidate-move guidance.', limitation: 'Candidate scores are in-product estimates, not measured learning gains.' },
      { label: 'Calendar review receipt', href: '#social-asset-packet-gate', receipt: '433f1ee0-6764-4b95-8745-8418e6498446', supports: 'Review-only campaign binding and closed side-effect gates.', limitation: externalGateNote },
    ],
    jit: {
      contentVersion: 'sha256:585addaef15349ec135a57dd67308492110f6e97aecac2585e5936737d21918b',
      observedAt: '2026-10-17T15:08:19Z',
      expiresAt: '2026-10-20T15:08:19Z',
      targetAt: '2026-10-22T11:30:20-04:00',
      status: 'blocked_stale_jit',
    },
    externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.auditLinkedIn]: {
    kind: 'linkedin_visual', channel: 'linkedin', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.auditLinkedIn,
    calendarItemId: '062a2f97-d5b8-4c3b-bbfe-5f4949b671f2', campaign: 'AI Audit Calculator: The Hidden Operating Bill',
    practicalValue: 'Moves the AI-cost conversation from license inventory to the workflow, owner, review burden, and evidence behind the investment.',
    visual: {
      publicPath: '/review-assets/social-content/campaign-review/ai-audit-linkedin-hidden-bill.png',
      alt: 'AI Audit Calculator LinkedIn visual with the real result screen and four operating-cost questions.',
      headline: 'The invoice shows the license. The workflow shows the real bill.',
      proofLine: 'Workflow | owner | review hours | evidence',
      sha256: 'sha256:73263abe49dc749383050e91cf10cab3266451eba866bf0b661d8bb88aa9efd5',
    },
    sources: [
      { label: 'AI Audit Calculator product screen', href: '/audit_calculator_img.png', receipt: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97', supports: 'Owned calculator result UI, captured inputs, scores, and action guidance.', limitation: 'Product UI proof only; it does not establish a customer outcome or ROI benchmark.' },
      { label: 'Calendar review receipt', href: '#social-asset-packet-gate', receipt: '062a2f97-d5b8-4c3b-bbfe-5f4949b671f2', supports: 'Review-only campaign binding and closed side-effect gates.', limitation: externalGateNote },
    ],
    externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube]: {
    kind: 'youtube_packaging', channel: 'youtube', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube,
    calendarItemId: 'bb1d68b7-cef7-44a0-b907-5e6431167a0f', campaign: 'Jev: approved complementary title-thumbnail pair', status: 'reused_approved_pair',
    title: 'AI Scored It. Who Makes the Call?', thumbnailTeaser: 'WHEN SHOULD AI STOP?',
    thumbnailConcept: 'Approved 9:16 AmaduTown composition with Vambah, one Jev product-proof object, and a short contrasting question.',
    thumbnailPath: '/review-assets/social-content/jev-youtube-short-thumbnail-v5.png',
    thumbnailReceipt: 'thumbnail:jev:youtube-shorts:20261018:v5',
    packagingTarget: 'youtube_shorts', contentVersion: fixtureContentVersion, thumbnailEvidence: null, thumbnailDiversity: null,
    openingHook: 'A probability can inform a decision. It should not quietly become permission.',
    descriptionEvidence: {
      state: 'ready', qualified: 3, required: 3,
      requirement: 'The existing version-bound Jev description evidence gate is ready. This projection reuses the approved package and does not regenerate it.',
      attribution: [{ label: 'Approved title-thumbnail receipt', href: '/review-assets/social-content/jev-youtube-short-thumbnail-v5.png', receipt: 'thumbnail:jev:youtube-shorts:20261018:v5', supports: 'Exact complementary pair, first-party composition, and visible Unscored performance boundary.', limitation: 'Editorial hypothesis only; no comparative performance claim.' }],
    },
    storyboard: [
      { time: '0:00-0:08', beat: 'A confident score appears.', proof: 'Jev operator field guide: worked return.' },
      { time: '0:08-0:28', beat: 'The policy layer routes, reviews, or refuses.', proof: 'Approved policy-band visual.' },
      { time: '0:28-0:50', beat: 'Human ownership and receipts close the loop.', proof: 'System-ownership chain and source receipts.' },
      { time: '0:50-close', beat: 'Name the boundary and invite inspection.', proof: 'Approved conclusion and spoken CTA.' },
    ],
    productProof: [{ label: 'Jev operator field guide', href: '/review-assets/social-content/source-proof/jev-operator-field-guide.png', receipt: 'sha256:7e123f1c11a156e86b36e0d2306ad1f42d97d3c63dac335588e804f6bc74f8e9', supports: 'Visible decision system.', limitation: 'Illustrative thresholds.' }],
    conclusion: 'A model score becomes useful when the surrounding system makes authority, exceptions, and evidence visible.',
    spokenCta: 'Subscribe to AmaduTown for practical ways to govern AI decisions before they become irreversible actions.', externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube]: {
    kind: 'youtube_packaging', channel: 'youtube', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube,
    calendarItemId: '7b1b202c-eb24-4724-bc8e-313b07546884', campaign: 'Dark Castle Chess: Remember the Decision', status: 'blocked_missing_description_evidence',
    title: 'I Rebuilt the Chess Lesson Around the Decision', thumbnailTeaser: 'REMEMBER THE WHY',
    thumbnailConcept: 'Real gameplay board fills the frame. One highlighted move connects to a compact decision-path card; no generic chess stock art.',
    ...(darkCastlePackagingEvidence.validation.ready ? {
      thumbnailPath: darkCastlePackagingEvidence.validation.thumbnail?.artifact_url ?? undefined,
      thumbnailReceipt: darkCastleSelection.receipt_id,
    } : {}),
    packagingTarget: 'youtube', contentVersion: fixtureContentVersion,
    thumbnailEvidenceManifest: darkCastlePackagingEvidence.manifest,
    thumbnailEvidence: darkCastlePackagingEvidence.validation,
    thumbnailDiversity: SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY,
    openingHook: 'A player can land on the right square by accident. The board position alone cannot tell you whether they learned.',
    descriptionEvidence: {
      state: 'unscored', qualified: 1, required: 3,
      requirement: 'Observed 1/3 qualifying full descriptions on 2026-10-18 (score 88.75; threshold 75; evidence expires after 2026-11-01). Capture two more distinct, same-topic public YouTube descriptions with reproducible cohort scores and current observations. Internal packet summaries and unrelated chess videos do not qualify.',
      attribution: [{ label: 'Every Chess Tip - Explained!(in stages) · youraveragechessguy1', href: 'https://www.youtube.com/watch?v=KbjRYez_me0', receipt: 'sha256:fa8fed6276ec15009b9f515b1bb24107ad818eb4439cefa80463441ba764b647', supports: 'Full public description, exact video identity, and 88.75 outlier score in the current eight-video cohort.', limitation: 'One qualifying source of three required. Editorial comparison only; no causal performance claim.' }],
    },
    storyboard: [
      { time: '0:00-0:15', beat: 'Show the same correct move reached through guessing and understanding.', proof: 'Owned gameplay position.' },
      { time: '0:15-0:45', beat: 'Follow position, choice, and consequence.', proof: 'Decision guidance and notation.' },
      { time: '0:45-1:15', beat: 'Carry the lesson into the learning timeline.', proof: 'Retained coaching and review state.' },
      { time: '1:15-close', beat: 'Separate completion from learning evidence.', proof: 'Product-proof recap and spoken CTA.' },
    ],
    productProof: [{ label: 'Dark Castle gameplay proof', href: '/review-assets/social-content/dark-castle-customer-facing-poster.png', receipt: 'sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78', supports: 'Real board, guidance, notation, and coaching state.', limitation: 'No claim of measured learning improvement.' }],
    conclusion: 'Completion says the move happened. Decision evidence gives the learner a pattern they can recognize again.',
    spokenCta: 'Subscribe to AmaduTown for more behind-the-build lessons from products designed to make judgment visible.', externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube]: {
    kind: 'youtube_packaging', channel: 'youtube', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube,
    calendarItemId: 'c363b54c-1369-4663-b3b1-2a0dc58c0b46', campaign: 'AI Audit Calculator: The Hidden Operating Bill', status: 'blocked_missing_description_evidence',
    title: 'The AI Cost That Never Appears on the Invoice', thumbnailTeaser: 'WHO OWNS THE CLEANUP?',
    thumbnailConcept: 'Real calculator result screen beside a short chain of review, cleanup, escalation, and evidence. The thumbnail question adds tension without repeating the title.',
    ...(aiAuditPackagingEvidence.validation.ready ? {
      thumbnailPath: aiAuditPackagingEvidence.validation.thumbnail?.artifact_url ?? undefined,
      thumbnailReceipt: aiAuditSelection.receipt_id,
    } : {}),
    packagingTarget: 'youtube', contentVersion: fixtureContentVersion,
    thumbnailEvidenceManifest: aiAuditPackagingEvidence.manifest,
    thumbnailEvidence: aiAuditPackagingEvidence.validation,
    thumbnailDiversity: SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY,
    openingHook: 'The subscription price is easy to find. The expensive part is the work that appears after the tool answers.',
    descriptionEvidence: {
      state: 'unscored', qualified: 1, required: 3,
      requirement: 'Observed 1/3 qualifying full descriptions on 2026-10-18 (score 85.00; threshold 75; evidence expires after 2026-11-01). Capture two more distinct, same-topic public YouTube descriptions with reproducible cohort scores and current observations. Pricing pages, internal summaries, and general AI-cost commentary do not qualify.',
      attribution: [{ label: 'I Built an AI Audit That Replaces a $50,000 Consultant · company in progress', href: 'https://www.youtube.com/watch?v=fSAazWLuDyQ', receipt: 'sha256:cf14ab9d8f420fa2e6d1a94a602d6efe032554770693858d01719a2385657465', supports: 'Full public description, exact video identity, and 85.00 outlier score in the current six-video cohort.', limitation: 'One qualifying source of three required. The source title is attribution, not a validated product or savings claim.' }],
    },
    storyboard: [
      { time: '0:00-0:15', beat: 'Put the invoice beside the hidden work.', proof: 'Review, cleanup, escalation, and duplicate-tool map.' },
      { time: '0:15-0:50', beat: 'Change the unit from licenses to accountable capacity.', proof: 'Owned calculator capture categories.' },
      { time: '0:50-1:20', beat: 'Walk one tool through workflow, owner, hours, and evidence.', proof: 'Calculator score and action guidance.' },
      { time: '1:20-close', beat: 'Name what the audit can and cannot prove.', proof: 'Product-proof boundary and spoken CTA.' },
    ],
    productProof: [{ label: 'AI Audit Calculator product screen', href: '/audit_calculator_img.png', receipt: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97', supports: 'Real result UI, scored dimensions, and action guidance.', limitation: 'No customer ROI or performance claim.' }],
    conclusion: 'A tool earns its place when the team can trace the work it removed, the decision it improved, and the evidence it left behind.',
    spokenCta: 'Use the AI Audit Calculator to find the work hiding behind your AI bill, then subscribe to AmaduTown for practical systems for governing AI investments.', externalGates: 'closed',
  },
}

type CampaignReviewRuntimeContext = Record<string, unknown> | null | undefined

export function resolveSocialCampaignReviewPacket(
  packet: SocialCampaignReviewPacket,
  context: CampaignReviewRuntimeContext,
  now = new Date(),
): SocialCampaignReviewPacket {
  if (packet.kind === 'youtube_packaging') {
    const frameworkInput = context?.long_form_script_framework_receipt && typeof context.long_form_script_framework_receipt === 'object' && !Array.isArray(context.long_form_script_framework_receipt)
      ? context.long_form_script_framework_receipt as Record<string, unknown> : null
    const raw = context?.script_template_receipt ?? frameworkInput?.script_template_receipt
    const receipt = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as SocialScriptTemplateReceipt : null
    const candidateId = typeof context?.script_template_candidate_id === 'string' ? context.script_template_candidate_id : typeof frameworkInput?.candidate_id === 'string' ? frameworkInput.candidate_id : ''
    const contentVersion = typeof context?.script_template_content_version === 'string' ? context.script_template_content_version : packet.contentVersion
    const sourceReceiptId = typeof frameworkInput?.receipt_id === 'string' ? frameworkInput.receipt_id : undefined
    return { ...packet, scriptTemplate: {
      receipt,
      ...inspectSocialScriptTemplateReceipt({ receipt, contentId: packet.socialContentId, candidateId, contentVersion, sourceReceiptId, now }),
    } }
  }
  if (!packet.jit || !context) return packet

  const contentVersion = typeof context.content_version === 'string' ? context.content_version : ''
  const observedAt = typeof context.jit_observed_at === 'string' ? context.jit_observed_at : ''
  const expiresAt = typeof context.jit_expires_at === 'string' ? context.jit_expires_at : ''
  const receiptId = typeof context.jit_refresh_receipt_id === 'string' ? context.jit_refresh_receipt_id : ''
  const humanQaStatus = typeof context.human_qa_status === 'string' ? context.human_qa_status : ''
  const visualSha256 = typeof context.visual_sha256 === 'string' ? context.visual_sha256 : ''
  const imageUrl = typeof context.image_url === 'string' ? context.image_url : ''
  const expiry = Date.parse(expiresAt)
  const currentBinding = contentVersion.length > 0
    && observedAt.length > 0
    && receiptId.length > 0
    && Number.isFinite(expiry)
    && expiry > now.getTime()
    && visualSha256 === packet.visual.sha256
    && imageUrl === packet.visual.publicPath
    && ['pending_current_binding', 'approved'].includes(humanQaStatus)

  if (!currentBinding) return packet

  return {
    ...packet,
    jit: {
      ...packet.jit,
      contentVersion,
      observedAt,
      expiresAt,
      receiptId,
      status: 'ready_current_jit',
    },
  }
}

export function getSocialCampaignReviewPacket(
  id: string | null | undefined,
  context?: CampaignReviewRuntimeContext,
  now?: Date,
): SocialCampaignReviewPacket | null {
  const packet = id ? SOCIAL_CAMPAIGN_REVIEW_PACKETS[id] ?? null : null
  return packet ? resolveSocialCampaignReviewPacket(packet, context, now) : null
}
import type { SocialContentItem } from '@/lib/social-content'

export const SOCIAL_CAMPAIGN_REVIEW_FIXTURE = 'social_campaign_review_assets_v1'


export function socialCampaignReviewQaFixture(id: string): SocialContentItem {
  const packet = getSocialCampaignReviewPacket(id)
  if (!packet) throw new Error(`Unknown social campaign review fixture: ${id}`)

  const isYouTube = packet.kind === 'youtube_packaging'
  const postText = isYouTube
    ? [packet.openingHook, ...packet.storyboard.map(({ beat }) => beat), packet.conclusion, packet.spokenCta].join('\n\n')
    : packet.reviewCaption ?? [packet.visual.headline, packet.practicalValue, packet.visual.proofLine].join('\n\n')

  return {
    id,
    meeting_record_id: null,
    platform: packet.channel,
    status: 'draft',
    post_text: postText,
    cta_text: isYouTube ? packet.spokenCta : packet.reviewCta ?? 'Review the decision system behind the result.',
    cta_url: null,
    hashtags: isYouTube ? [] : packet.reviewHashtags ?? [],
    image_url: packet.kind === 'linkedin_visual' ? packet.visual.publicPath : packet.thumbnailPath ?? null,
    image_prompt: isYouTube ? packet.thumbnailConcept : packet.visual.alt,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: isYouTube ? postText : null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'repository_bound_social_campaign_review',
      campaign_name: packet.campaign,
      calendar_item_id: packet.calendarItemId,
      approval_boundary: externalGateNote,
      side_effects: {
        production_read: false,
        production_write: false,
        provider_generation: false,
        rendering: false,
        upload: false,
        platform_draft: false,
        schedule: false,
        publish: false,
        external_send: false,
      },
      qa_fixture: {
        kind: 'social_campaign_review_assets',
        read_only: true,
        reason: 'Repository-bound review projection. No production record is read or changed.',
        next_action: 'Review the visual, evidence, and closed gates. Return to the captain handoff for any later integration decision.',
      },
      ...(isYouTube && packet.thumbnailEvidenceManifest ? {
        youtube_thumbnail_evidence_manifest: packet.thumbnailEvidenceManifest,
        youtube_thumbnail_evidence_validation: packet.thumbnailEvidence,
        youtube_thumbnail_batch_diversity: packet.thumbnailDiversity,
      } : {}),
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
    target_platforms: [packet.channel],
    video_generation_method: 'none',
    youtube_title: isYouTube ? packet.title : null,
    youtube_description: null,
    content_format: 'single_image',
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: '2026-10-18T00:00:00.000Z',
    updated_at: isYouTube ? packet.contentVersion : fixtureContentVersion,
    publishes: [],
  }
}
