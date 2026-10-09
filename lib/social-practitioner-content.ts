import { HORMOZI_FRAMEWORK_TYPES, type HormoziFramework, type HormoziFrameworkType, type SocialContentItem, type SocialPlatform } from '@/lib/social-content'
import type { SocialContentExperimentTags } from '@/lib/social-content-calibration-library'

export const PRACTITIONER_CONTENT_QUALITY_VERSION = 'practitioner_evidence_v1' as const
export const AMADUTOWN_VISUAL_SYSTEM_VERSION = 'amadutown_deterministic_v1' as const

export type PractitionerEvidencePacket = {
  status: 'draft' | 'approved' | 'blocked'
  situation: string
  operational_constraint: string
  practitioner_only_detail: string
  decision_intervention: string
  observable_result: {
    status: 'observed' | 'metric_pending'
    summary: string
    metric?: string | null
  }
  approved_public_details: string[]
  supported_claims: string[]
  disclosure_boundary: {
    classification: 'anonymized'
    summary: string
    prohibited_details: string[]
  }
  source_provenance: Array<{
    source_id: string
    source_type: string
    label: string
    approved_for_public_use: boolean
  }>
  redaction_receipt: {
    receipt_id: string
    status: 'pending' | 'passed' | 'blocked'
    reviewed_at: string | null
    redactions: string[]
    unresolved_identifier_types: string[]
  }
}

export type PractitionerEngagementExperiment = SocialContentExperimentTags & {
  captured_engagement?: {
    captured_at: string
    impressions?: number | null
    reactions?: number | null
    comments?: number | null
    shares?: number | null
  } | null
}

export type PractitionerFrameworkApplicationReceipt = {
  receipt_id: string
  status: 'draft' | 'applied' | 'blocked'
  applied_at: string | null
  selected_framework: {
    framework_type: HormoziFrameworkType
    hook_type: string
    proof_pattern: string
    cta_pattern: string
    approved_pattern_id: string
    approved_pattern_source: string
  }
  copy_beats: {
    hook_tension: string
    practitioner_scene: string
    operational_constraint: string
    decision_mechanism: string
    proof_result_boundary: string
    practical_takeaway: string
    cta: string
  }
  voice_calibration: {
    status: 'applied' | 'blocked'
    reference_ids: string[]
    principles_applied: string[]
  }
  performance_calibration: {
    status: 'applied' | 'bounded_fallback' | 'blocked'
    reference_ids: string[]
    fallback_reason: string | null
    causal_claim_boundary: 'correlational_only'
  }
  content_shape: {
    format: 'standard_post' | 'justified_short_form'
    target_min_characters: number
    target_max_characters: number
    short_form_justification: string | null
  }
}

export type DeterministicVisualSpec = {
  system_version: typeof AMADUTOWN_VISUAL_SYSTEM_VERSION
  template: 'practitioner_signal_card' | 'constraint_decision_result'
  aspect_ratio: '1.91:1' | '1:1' | '4:5' | '9:16'
  eyebrow: string
  headline: string
  evidence_lines: string[]
  result_label: string
  argument_map: {
    context: string
    constraint: string
    decision_mechanism: string
    result_boundary: string
    practical_takeaway: string
  }
  visual_rationale: string
  candidate: {
    candidate_id: string
    status: 'draft' | 'in_review' | 'approved' | 'rejected'
    renderer: 'html_svg'
    artifact_url?: string | null
  }
  art_direction_receipt: {
    provider: string
    model: string | null
    receipt_id: string
    status: 'not_called' | 'receipt_recorded'
  }
}

export type PractitionerContentQualityRecord = {
  version: typeof PRACTITIONER_CONTENT_QUALITY_VERSION
  evidence_packet: PractitionerEvidencePacket
  engagement_experiment: PractitionerEngagementExperiment
  framework_application: PractitionerFrameworkApplicationReceipt | null
  deterministic_visual: DeterministicVisualSpec
}

export type PractitionerContentQualityFinding = {
  code: string
  message: string
}

export type PractitionerContentQualityGate = {
  required: boolean
  status: 'passed' | 'blocked' | 'not_required'
  specificity_result: 'specific' | 'insufficient' | 'not_required'
  findings: PractitionerContentQualityFinding[]
  matched_public_details: string[]
  summary: string
  recovery_action: string
  record: PractitionerContentQualityRecord | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : []
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%$]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function includesMeaningfulDetail(copy: string, detail: string) {
  const normalizedCopy = normalized(copy)
  const words = normalized(detail).split(' ').filter((word) => word.length >= 4)
  if (words.length === 0) return false
  const matchingWords = words.filter((word) => normalizedCopy.includes(word))
  return matchingWords.length >= Math.min(3, words.length)
}

function includesReceiptBeat(copy: string, beat: string) {
  const normalizedBeat = normalized(beat)
  return normalizedBeat.length >= 18 && normalized(copy).includes(normalizedBeat)
}

function sharesMeaningfulDetail(left: string, right: string) {
  const leftWords = new Set(normalized(left).split(' ').filter((word) => word.length >= 5))
  const rightWords = new Set(normalized(right).split(' ').filter((word) => word.length >= 5))
  let overlap = 0
  for (const word of leftWords) {
    if (rightWords.has(word)) overlap += 1
  }
  return overlap >= 2
}

function parseEvidencePacket(value: unknown): PractitionerEvidencePacket | null {
  const packet = asRecord(value)
  const result = asRecord(packet?.observable_result)
  const boundary = asRecord(packet?.disclosure_boundary)
  const receipt = asRecord(packet?.redaction_receipt)
  if (!packet || !result || !boundary || !receipt) return null

  return {
    status: asString(packet.status) as PractitionerEvidencePacket['status'],
    situation: asString(packet.situation),
    operational_constraint: asString(packet.operational_constraint),
    practitioner_only_detail: asString(packet.practitioner_only_detail),
    decision_intervention: asString(packet.decision_intervention),
    observable_result: {
      status: asString(result.status) as PractitionerEvidencePacket['observable_result']['status'],
      summary: asString(result.summary),
      metric: asString(result.metric) || null,
    },
    approved_public_details: asStrings(packet.approved_public_details),
    supported_claims: asStrings(packet.supported_claims),
    disclosure_boundary: {
      classification: asString(boundary.classification) as 'anonymized',
      summary: asString(boundary.summary),
      prohibited_details: asStrings(boundary.prohibited_details),
    },
    source_provenance: Array.isArray(packet.source_provenance)
      ? packet.source_provenance.map(asRecord).filter(Boolean).map((source) => ({
        source_id: asString(source?.source_id),
        source_type: asString(source?.source_type),
        label: asString(source?.label),
        approved_for_public_use: source?.approved_for_public_use === true,
      }))
      : [],
    redaction_receipt: {
      receipt_id: asString(receipt.receipt_id),
      status: asString(receipt.status) as PractitionerEvidencePacket['redaction_receipt']['status'],
      reviewed_at: asString(receipt.reviewed_at) || null,
      redactions: asStrings(receipt.redactions),
      unresolved_identifier_types: asStrings(receipt.unresolved_identifier_types),
    },
  }
}

function parseExperiment(value: unknown): PractitionerEngagementExperiment | null {
  const experiment = asRecord(value)
  if (!experiment) return null
  const engagement = asRecord(experiment.captured_engagement)
  return {
    experiment_id: asString(experiment.experiment_id),
    anecdote_depth: asString(experiment.anecdote_depth) as PractitionerEngagementExperiment['anecdote_depth'],
    specificity: asString(experiment.specificity) as PractitionerEngagementExperiment['specificity'],
    hook_framework: asString(experiment.hook_framework),
    channel: asString(experiment.channel),
    visual_treatment: asString(experiment.visual_treatment),
    hypothesis: asString(experiment.hypothesis),
    evidence_type: asString(experiment.evidence_type) as PractitionerEngagementExperiment['evidence_type'],
    causal_claim_boundary: asString(experiment.causal_claim_boundary) as 'correlational_only',
    captured_engagement: engagement ? {
      captured_at: asString(engagement.captured_at),
      impressions: typeof engagement.impressions === 'number' ? engagement.impressions : null,
      reactions: typeof engagement.reactions === 'number' ? engagement.reactions : null,
      comments: typeof engagement.comments === 'number' ? engagement.comments : null,
      shares: typeof engagement.shares === 'number' ? engagement.shares : null,
    } : null,
  }
}

function parseFrameworkApplication(value: unknown): PractitionerFrameworkApplicationReceipt | null {
  const application = asRecord(value)
  const framework = asRecord(application?.selected_framework)
  const beats = asRecord(application?.copy_beats)
  const voice = asRecord(application?.voice_calibration)
  const performance = asRecord(application?.performance_calibration)
  const shape = asRecord(application?.content_shape)
  if (!application || !framework || !beats || !voice || !performance || !shape) return null

  return {
    receipt_id: asString(application.receipt_id),
    status: asString(application.status) as PractitionerFrameworkApplicationReceipt['status'],
    applied_at: asString(application.applied_at) || null,
    selected_framework: {
      framework_type: asString(framework.framework_type) as HormoziFrameworkType,
      hook_type: asString(framework.hook_type),
      proof_pattern: asString(framework.proof_pattern),
      cta_pattern: asString(framework.cta_pattern),
      approved_pattern_id: asString(framework.approved_pattern_id),
      approved_pattern_source: asString(framework.approved_pattern_source),
    },
    copy_beats: {
      hook_tension: asString(beats.hook_tension),
      practitioner_scene: asString(beats.practitioner_scene),
      operational_constraint: asString(beats.operational_constraint),
      decision_mechanism: asString(beats.decision_mechanism),
      proof_result_boundary: asString(beats.proof_result_boundary),
      practical_takeaway: asString(beats.practical_takeaway),
      cta: asString(beats.cta),
    },
    voice_calibration: {
      status: asString(voice.status) as PractitionerFrameworkApplicationReceipt['voice_calibration']['status'],
      reference_ids: asStrings(voice.reference_ids),
      principles_applied: asStrings(voice.principles_applied),
    },
    performance_calibration: {
      status: asString(performance.status) as PractitionerFrameworkApplicationReceipt['performance_calibration']['status'],
      reference_ids: asStrings(performance.reference_ids),
      fallback_reason: asString(performance.fallback_reason) || null,
      causal_claim_boundary: asString(performance.causal_claim_boundary) as 'correlational_only',
    },
    content_shape: {
      format: asString(shape.format) as PractitionerFrameworkApplicationReceipt['content_shape']['format'],
      target_min_characters: typeof shape.target_min_characters === 'number' ? shape.target_min_characters : 0,
      target_max_characters: typeof shape.target_max_characters === 'number' ? shape.target_max_characters : 0,
      short_form_justification: asString(shape.short_form_justification) || null,
    },
  }
}

function parseVisual(value: unknown): DeterministicVisualSpec | null {
  const visual = asRecord(value)
  const receipt = asRecord(visual?.art_direction_receipt)
  if (!visual || !receipt) return null
  return {
    system_version: asString(visual.system_version) as typeof AMADUTOWN_VISUAL_SYSTEM_VERSION,
    template: asString(visual.template) as DeterministicVisualSpec['template'],
    aspect_ratio: asString(visual.aspect_ratio) as DeterministicVisualSpec['aspect_ratio'],
    eyebrow: asString(visual.eyebrow),
    headline: asString(visual.headline),
    evidence_lines: asStrings(visual.evidence_lines),
    result_label: asString(visual.result_label),
    argument_map: {
      context: asString(asRecord(visual.argument_map)?.context),
      constraint: asString(asRecord(visual.argument_map)?.constraint),
      decision_mechanism: asString(asRecord(visual.argument_map)?.decision_mechanism),
      result_boundary: asString(asRecord(visual.argument_map)?.result_boundary),
      practical_takeaway: asString(asRecord(visual.argument_map)?.practical_takeaway),
    },
    visual_rationale: asString(visual.visual_rationale),
    candidate: {
      candidate_id: asString(asRecord(visual.candidate)?.candidate_id),
      status: asString(asRecord(visual.candidate)?.status) as DeterministicVisualSpec['candidate']['status'],
      renderer: asString(asRecord(visual.candidate)?.renderer) as 'html_svg',
      artifact_url: asString(asRecord(visual.candidate)?.artifact_url) || null,
    },
    art_direction_receipt: {
      provider: asString(receipt.provider),
      model: asString(receipt.model) || null,
      receipt_id: asString(receipt.receipt_id),
      status: asString(receipt.status) as DeterministicVisualSpec['art_direction_receipt']['status'],
    },
  }
}

export function readPractitionerContentQuality(value: unknown): PractitionerContentQualityRecord | null {
  const ragContext = asRecord(value)
  const quality = asRecord(ragContext?.practitioner_content_quality)
  const evidencePacket = parseEvidencePacket(quality?.evidence_packet)
  const experiment = parseExperiment(asRecord(ragContext?.content_calibration)?.experiment_tags)
  const visual = parseVisual(quality?.deterministic_visual)
  if (!quality || !evidencePacket || !experiment || !visual) return null
  return {
    version: asString(quality.version) as typeof PRACTITIONER_CONTENT_QUALITY_VERSION,
    evidence_packet: evidencePacket,
    engagement_experiment: experiment,
    framework_application: parseFrameworkApplication(quality.framework_application),
    deterministic_visual: visual,
  }
}

export function requiresPractitionerContentQuality(item: Pick<SocialContentItem, 'rag_context'>) {
  const ragContext = asRecord(item.rag_context)
  return asString(asRecord(ragContext?.practitioner_content_quality)?.version) === PRACTITIONER_CONTENT_QUALITY_VERSION
}

export function validatePractitionerContentQuality(
  item: Pick<SocialContentItem, 'rag_context' | 'post_text' | 'cta_text' | 'voiceover_text' | 'youtube_title' | 'youtube_description'> & {
    hormozi_framework?: HormoziFramework | null
  },
): PractitionerContentQualityGate {
  if (!requiresPractitionerContentQuality(item)) {
    return {
      required: false,
      status: 'not_required',
      specificity_result: 'not_required',
      findings: [],
      matched_public_details: [],
      summary: 'Practitioner evidence gate is not required for this legacy source.',
      recovery_action: 'Continue through the existing review gates.',
      record: null,
    }
  }

  const findings: PractitionerContentQualityFinding[] = []
  const record = readPractitionerContentQuality(item.rag_context)
  if (!record || record.version !== PRACTITIONER_CONTENT_QUALITY_VERSION) {
    findings.push({ code: 'packet_missing', message: 'Add the structured practitioner evidence packet.' })
  }
  const packet = record?.evidence_packet
  if (packet?.status !== 'approved') findings.push({ code: 'packet_not_approved', message: 'Approve the practitioner evidence packet before Human QA.' })
  for (const [key, value] of Object.entries({
    situation: packet?.situation,
    operational_constraint: packet?.operational_constraint,
    practitioner_only_detail: packet?.practitioner_only_detail,
    decision_intervention: packet?.decision_intervention,
    observable_result: packet?.observable_result.summary,
  })) {
    if (!value || value.length < 12) findings.push({ code: `${key}_missing`, message: `Add a specific ${key.replace(/_/g, ' ')}.` })
  }
  if (!['observed', 'metric_pending'].includes(packet?.observable_result.status ?? '')) {
    findings.push({ code: 'result_status_missing', message: 'Mark the result as observed or metric pending.' })
  }
  if ((packet?.approved_public_details.length ?? 0) < 2) {
    findings.push({ code: 'public_details_missing', message: 'Approve at least two anonymized practitioner details for public copy.' })
  }
  if (packet?.disclosure_boundary.classification !== 'anonymized' || !packet.disclosure_boundary.summary) {
    findings.push({ code: 'disclosure_boundary_missing', message: 'Record the anonymized disclosure boundary.' })
  }
  if (!packet?.source_provenance.length || packet.source_provenance.some((source) => !source.source_id || !source.source_type || !source.approved_for_public_use)) {
    findings.push({ code: 'provenance_unapproved', message: 'Attach approved, traceable source provenance.' })
  }
  if (packet?.redaction_receipt.status !== 'passed' || !packet.redaction_receipt.receipt_id || !packet.redaction_receipt.reviewed_at) {
    findings.push({ code: 'redaction_not_passed', message: 'Record a passing redaction receipt.' })
  }
  if (packet?.redaction_receipt.unresolved_identifier_types.length) {
    findings.push({ code: 'identifiers_unresolved', message: 'Resolve identifying details before Human QA.' })
  }

  const publicCopy = [item.post_text, item.cta_text, item.voiceover_text, item.youtube_title, item.youtube_description]
    .map(asString)
    .filter(Boolean)
    .join('\n')
  const matchedPublicDetails = (packet?.approved_public_details ?? []).filter((detail) => includesMeaningfulDetail(publicCopy, detail))
  if (matchedPublicDetails.length < 2) {
    findings.push({ code: 'generic_theory', message: 'Finished copy must carry at least two approved practitioner details.' })
  }
  if (/\bVambah(?: Sillah|'s)?\s+(?:believes|thinks|learned|observed|found|knows|uses|built|did|said|noticed)\b/i.test(publicCopy)) {
    findings.push({ code: 'third_person_self_reference', message: 'Rewrite third-person self-reference in Vambah\'s first-person voice.' })
  }
  const numericClaims = publicCopy.match(/(?:\$\s?\d[\d,.]*|\b\d+(?:\.\d+)?%|\b\d{2,}[\d,.]*\b)/g) ?? []
  const claimEvidence = normalized([
    packet?.observable_result.summary ?? '',
    packet?.observable_result.metric ?? '',
    ...(packet?.supported_claims ?? []),
  ].join(' '))
  if (numericClaims.some((claim) => !claimEvidence.includes(normalized(claim)))) {
    findings.push({ code: 'unsupported_numeric_claim', message: 'Tie every numeric claim to the approved evidence packet.' })
  }

  const application = record?.framework_application
  const itemFramework = item.hormozi_framework
  const frameworkType = asString(itemFramework?.framework_type)
  if (!frameworkType || !HORMOZI_FRAMEWORK_TYPES.includes(frameworkType as (typeof HORMOZI_FRAMEWORK_TYPES)[number])
    || !asString(itemFramework?.hook_type) || !asString(itemFramework?.proof_pattern) || !asString(itemFramework?.cta_pattern)) {
    findings.push({ code: 'framework_unapplied', message: 'Apply one approved Social Content framework with hook, proof, and CTA structure.' })
  }
  if (!application || application.status !== 'applied' || !application.receipt_id || !application.applied_at
    || !application.selected_framework.approved_pattern_id || !application.selected_framework.approved_pattern_source) {
    findings.push({ code: 'framework_receipt_missing', message: 'Record the applied framework and approved pattern in a traceable receipt.' })
  }
  if (application && itemFramework && [
    ['framework_type', itemFramework.framework_type],
    ['hook_type', itemFramework.hook_type],
    ['proof_pattern', itemFramework.proof_pattern],
    ['cta_pattern', itemFramework.cta_pattern],
  ].some(([key, value]) => asString(value) !== asString(application.selected_framework[key as keyof typeof application.selected_framework]))) {
    findings.push({ code: 'framework_receipt_mismatch', message: 'Make the applied-framework receipt match the selected Social Content framework.' })
  }

  const postText = asString(item.post_text)
  const first210 = postText.slice(0, 210)
  const beats = application?.copy_beats
  const beatChecks = [
    ['hook_not_concrete', 'Put the concrete practitioner tension inside the first 210 characters.', beats?.hook_tension, first210],
    ['practitioner_scene_missing', 'Carry the anonymized practitioner scene into the finished copy.', beats?.practitioner_scene, postText],
    ['operational_constraint_missing', 'Name the operating constraint in the finished copy.', beats?.operational_constraint, postText],
    ['decision_mechanism_missing', 'Explain the decision mechanism in the finished copy.', beats?.decision_mechanism, postText],
    ['result_boundary_missing', 'Separate the observed result from the metric still pending.', beats?.proof_result_boundary, postText],
    ['practical_takeaway_missing', 'Give the reader a usable practical takeaway.', beats?.practical_takeaway, postText],
    ['cta_missing', 'End with a specific question or CTA tied to the operating problem.', beats?.cta, publicCopy],
  ] as const
  const missingBeatCodes = beatChecks
    .filter(([, , beat, copy]) => !beat || !includesReceiptBeat(copy, beat))
    .map(([code, message]) => {
      findings.push({ code, message })
      return code
    })
  if (missingBeatCodes.length) {
    findings.push({ code: 'copy_structure_incomplete', message: 'Make every receipt-backed framework beat visible in the finished copy.' })
  }
  if (beats && (!packet || !sharesMeaningfulDetail(beats.practitioner_scene, packet.situation))) {
    findings.push({ code: 'practitioner_scene_unbound', message: 'Bind the copy scene to the approved anonymized practitioner situation.' })
  }
  if (beats?.cta && (!beats.cta.endsWith('?') || beats.cta.length < 24)) {
    findings.push({ code: 'cta_not_specific', message: 'Use a specific response-driving question rather than a generic CTA.' })
  }

  const shape = application?.content_shape
  const standardShape = shape?.format === 'standard_post'
    && shape.target_min_characters === 1800
    && shape.target_max_characters === 2100
    && postText.length >= 1800
    && postText.length <= 2100
  const justifiedShortShape = shape?.format === 'justified_short_form'
    && postText.length >= 800
    && postText.length < 1800
    && (shape.short_form_justification?.length ?? 0) >= 30
  if ((!standardShape && !justifiedShortShape) || postText.length > 3000) {
    findings.push({ code: 'post_length_out_of_range', message: `Use the 1,800-2,100 character standard-post target or document a justified short-form path. Current copy: ${postText.length} characters.` })
  }

  const voice = application?.voice_calibration
  const performance = application?.performance_calibration
  const voiceReady = voice?.status === 'applied'
    && voice.reference_ids.length > 0
    && voice.principles_applied.length >= 2
  const performanceReady = performance?.status === 'applied'
    ? performance.reference_ids.length > 0
    : performance?.status === 'bounded_fallback' && (performance.fallback_reason?.length ?? 0) >= 30
  if (!voiceReady || !performanceReady || performance?.causal_claim_boundary !== 'correlational_only') {
    findings.push({ code: 'calibration_trace_missing', message: 'Attach voice and performance-learning references, or record a bounded performance fallback.' })
  }

  const experiment = record?.engagement_experiment
  if (!experiment?.experiment_id || !experiment.hook_framework || !experiment.channel || !experiment.visual_treatment || !experiment.hypothesis) {
    findings.push({ code: 'experiment_tags_missing', message: 'Complete the engagement experiment tags.' })
  }
  if (!['brief', 'scene', 'full_case'].includes(experiment?.anecdote_depth ?? '') || !['medium', 'high'].includes(experiment?.specificity ?? '')) {
    findings.push({ code: 'experiment_dimensions_invalid', message: 'Tag anecdote depth and specificity with supported values.' })
  }
  if (!['practitioner_anecdote', 'observed_result', 'metric_pending'].includes(experiment?.evidence_type ?? '')) {
    findings.push({ code: 'evidence_type_missing', message: 'Tag the approved evidence type for cohort comparison.' })
  }
  if (experiment?.causal_claim_boundary !== 'correlational_only') {
    findings.push({ code: 'causal_boundary_missing', message: 'Keep engagement comparison explicitly correlational.' })
  }

  const visual = record?.deterministic_visual
  if (visual?.system_version !== AMADUTOWN_VISUAL_SYSTEM_VERSION || !visual.headline || visual.evidence_lines.length < 2 || !visual.visual_rationale) {
    findings.push({ code: 'deterministic_visual_missing', message: 'Complete the deterministic AmaduTown visual specification.' })
  }
  if (visual && !['1.91:1', '1:1', '4:5', '9:16'].includes(visual.aspect_ratio)) {
    findings.push({ code: 'aspect_ratio_invalid', message: 'Choose a supported platform aspect ratio.' })
  }
  if (!visual?.art_direction_receipt.receipt_id || !visual.art_direction_receipt.provider || !['not_called', 'receipt_recorded'].includes(visual.art_direction_receipt.status)) {
    findings.push({ code: 'art_direction_receipt_missing', message: 'Record the modular art-direction provider boundary and receipt.' })
  }
  if (!visual?.candidate.candidate_id || visual.candidate.renderer !== 'html_svg' || visual.candidate.status !== 'in_review') {
    findings.push({ code: 'visual_candidate_not_ready', message: 'Create an HTML/SVG visual candidate and place it in the existing in-review lifecycle.' })
  }
  const argumentMap = visual?.argument_map
  const argumentValues = argumentMap ? Object.values(argumentMap) : []
  const visualSources = [
    packet?.situation ?? '',
    packet?.operational_constraint ?? '',
    packet?.decision_intervention ?? '',
    packet?.observable_result.summary ?? '',
    beats?.practical_takeaway ?? '',
  ]
  const visualArgumentComplete = argumentValues.length === 5
    && argumentValues.every((value) => value.length >= 20)
    && new Set(argumentValues.map(normalized)).size === 5
    && argumentValues.every((value, index) => sharesMeaningfulDetail(value, visualSources[index]))
  if (!visualArgumentComplete) {
    findings.push({ code: 'visual_argument_incomplete', message: 'Map context, constraint, decision mechanism, result boundary, and practical takeaway into the deterministic visual.' })
  }

  const status = findings.length ? 'blocked' : 'passed'
  return {
    required: true,
    status,
    specificity_result: matchedPublicDetails.length >= 2 ? 'specific' : 'insufficient',
    findings,
    matched_public_details: matchedPublicDetails,
    summary: status === 'passed'
      ? 'Specificity, privacy, applied framework, voice calibration, performance trace, complete copy, and visual coverage are ready for Human QA.'
      : `${findings.length} practitioner-content blocker${findings.length === 1 ? '' : 's'} must be resolved before Human QA.`,
    recovery_action: status === 'passed'
      ? 'Review the finished copy and deterministic candidate together.'
      : 'Complete the evidence, applied-framework receipt, calibration trace, finished-copy structure, privacy review, and full-argument visual before Human QA.',
    record,
  }
}

export function practitionerContentQualityFailure(gate: PractitionerContentQualityGate) {
  if (gate.status !== 'blocked') return null
  return {
    error: 'Practitioner evidence and privacy gate blocked Human QA.',
    lifecycle_step: 'copy',
    current_gate: 'practitioner_content_quality',
    revision_state: 'revision_needed',
    blockers: gate.findings.map((finding) => finding.message),
    recovery_action: gate.recovery_action,
    practitioner_quality_gate: gate,
  }
}

function aspectRatioForPlatform(platform: SocialPlatform | string) : DeterministicVisualSpec['aspect_ratio'] {
  if (platform === 'instagram' || platform === 'tiktok' || platform === 'youtube_shorts') return '4:5'
  if (platform === 'facebook') return '1:1'
  return '1.91:1'
}

export function buildPractitionerContentQualityScaffold(input: {
  channel: string
  title: string
  plannedAngle: string | null
}) {
  const experimentTags: PractitionerEngagementExperiment = {
    experiment_id: '',
    anecdote_depth: 'scene',
    specificity: 'high',
    evidence_type: 'metric_pending',
    hook_framework: '',
    channel: input.channel,
    visual_treatment: 'deterministic_practitioner_signal_card',
    hypothesis: '',
    causal_claim_boundary: 'correlational_only',
    captured_engagement: null,
  }
  const practitionerContentQuality = {
    version: PRACTITIONER_CONTENT_QUALITY_VERSION,
    evidence_packet: {
      status: 'draft',
      situation: '',
      operational_constraint: '',
      practitioner_only_detail: '',
      decision_intervention: '',
      observable_result: { status: 'metric_pending', summary: '', metric: null },
      approved_public_details: [],
      supported_claims: [],
      disclosure_boundary: {
        classification: 'anonymized',
        summary: '',
        prohibited_details: ['client identity', 'personal contact details', 'private internal notes'],
      },
      source_provenance: [],
      redaction_receipt: {
        receipt_id: '',
        status: 'pending',
        reviewed_at: null,
        redactions: [],
        unresolved_identifier_types: [],
      },
    },
    framework_application: {
      receipt_id: '',
      status: 'draft',
      applied_at: null,
      selected_framework: {
        framework_type: '',
        hook_type: '',
        proof_pattern: '',
        cta_pattern: '',
        approved_pattern_id: '',
        approved_pattern_source: '',
      },
      copy_beats: {
        hook_tension: '',
        practitioner_scene: '',
        operational_constraint: '',
        decision_mechanism: '',
        proof_result_boundary: '',
        practical_takeaway: '',
        cta: '',
      },
      voice_calibration: {
        status: 'blocked',
        reference_ids: [],
        principles_applied: [],
      },
      performance_calibration: {
        status: 'blocked',
        reference_ids: [],
        fallback_reason: null,
        causal_claim_boundary: 'correlational_only',
      },
      content_shape: {
        format: 'standard_post',
        target_min_characters: 1800,
        target_max_characters: 2100,
        short_form_justification: null,
      },
    },
    deterministic_visual: {
      system_version: AMADUTOWN_VISUAL_SYSTEM_VERSION,
      template: 'practitioner_signal_card',
      aspect_ratio: aspectRatioForPlatform(input.channel),
      eyebrow: 'Field note',
      headline: input.title,
      evidence_lines: [],
      result_label: 'Metric pending',
      argument_map: {
        context: '',
        constraint: '',
        decision_mechanism: '',
        result_boundary: '',
        practical_takeaway: '',
      },
      visual_rationale: input.plannedAngle ? `Support the approved practitioner story for: ${input.plannedAngle}` : '',
      candidate: {
        candidate_id: '',
        status: 'draft',
        renderer: 'html_svg',
        artifact_url: null,
      },
      art_direction_receipt: {
        provider: 'none',
        model: null,
        receipt_id: 'local-deterministic-scaffold',
        status: 'not_called',
      },
    },
  }
  return {
    practitioner_content_quality: practitionerContentQuality,
    content_calibration: {
      experiment_tags: experimentTags,
    },
  }
}
