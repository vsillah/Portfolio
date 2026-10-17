export const YOUTUBE_DESCRIPTION_LIBRARY_VERSION = 'youtube-outlier-description-library-v1' as const
export const YOUTUBE_DESCRIPTION_REMEDIATION_VERSION = 'youtube-description-remediation-v1' as const

export type YouTubeDescriptionLibraryStatus = 'ready' | 'unscored'

type DescriptionPattern = {
  opening_style: 'question' | 'command' | 'claim'
  length_band: 'short' | 'medium' | 'long'
  paragraph_count: number
  proof_style: 'product_evidence' | 'data_or_case' | 'explanation_only'
  cta_style: 'question' | 'subscribe' | 'comment' | 'resource_link' | 'none'
  link_placement: 'early' | 'late' | 'none'
  uses_chapters: boolean
  hashtag_count: number
}

export type YouTubeDescriptionGateDecision = {
  gate: 'framework_approval' | 'source_attribution' | 'description_capture' | 'outlier_score' | 'freshness' | 'topic_match' | 'audience_band'
  label: string
  status: 'passed' | 'failed' | 'not_evaluated' | 'not_applicable'
  requirement: string
  observed: string
}

export type YouTubeDescriptionRemediationGate =
  | YouTubeDescriptionGateDecision['gate']
  | 'cohort_size'
  | 'artifact_conformance'
  | 'description_structure'

export type YouTubeDescriptionRecoveryAction =
  | 'approve_source_framework'
  | 'restore_public_source_attribution'
  | 'capture_public_description_with_provenance'
  | 'qualify_outlier_evidence'
  | 'refresh_public_evidence'
  | 'repair_topic_identity'
  | 'repair_audience_cohort'
  | 'qualify_additional_cohort_sources'
  | 'repair_description_artifact_conformance'
  | 'repair_description_structure'

export type YouTubeDescriptionRemediationOwner = 'research-source-register' | 'voice-content-architect'

export type YouTubeDescriptionRemediationReceipt = {
  version: typeof YOUTUBE_DESCRIPTION_REMEDIATION_VERSION
  receipt_id: string
  scope_fingerprint: string
  subject_type: 'source' | 'cohort'
  source_id: string | null
  source_url: string | null
  failed_gate: YouTubeDescriptionRemediationGate
  observed_value: string
  requirement: string
  recovery_action: YouTubeDescriptionRecoveryAction
  designated_owner: YouTubeDescriptionRemediationOwner
  recorder: 'decision-journal'
  attempt_count: number
  prior_evidence_fingerprint: string | null
  current_evidence_fingerprint: string
  status: 'open' | 'awaiting_evidence' | 'recheck_failed' | 'resolved'
  recheck_result: 'not_run_no_prior_receipt' | 'not_run_inputs_unchanged' | 'failed_after_input_change' | 'passed_after_input_change'
  release_readiness: 'blocked' | 'ready'
}

export type YouTubeDescriptionLibrarySource = {
  source_id: string
  source_url: string
  source_title: string
  creator: string | null
  thumbnail_url: string | null
  description_provenance: string
  outlier_score: number
  published_at: string
  retrieved_at: string
  audience_size: number | null
  topic_matches: string[]
  topic_match_score: number
  description_fingerprint: string
  pattern: DescriptionPattern
  gate_decisions: YouTubeDescriptionGateDecision[]
}

export type YouTubeDescriptionLibraryExclusion = {
  source_id: string
  source_url: string | null
  source_title: string
  reason: string
  gate_decisions: YouTubeDescriptionGateDecision[]
}

export type YouTubeDescriptionLibraryReceipt = {
  version: typeof YOUTUBE_DESCRIPTION_LIBRARY_VERSION
  status: YouTubeDescriptionLibraryStatus
  generated_at: string
  target_topics: string[]
  minimum_source_count: number
  minimum_outlier_score: number
  freshness_days: number
  library_entry_count: number
  sources: YouTubeDescriptionLibrarySource[]
  excluded_sources: YouTubeDescriptionLibraryExclusion[]
  recommended_structure: {
    opening_style: DescriptionPattern['opening_style'] | null
    length_band: DescriptionPattern['length_band'] | null
    proof_style: DescriptionPattern['proof_style'] | null
    cta_style: DescriptionPattern['cta_style'] | null
    link_placement: DescriptionPattern['link_placement'] | null
    uses_chapters: boolean | null
    blueprint: string[]
  }
  blockers: string[]
  release_readiness: 'blocked' | 'ready'
  remediation_receipts: YouTubeDescriptionRemediationReceipt[]
  originality_boundary: string
  input_fingerprint: string
}

const TOPIC_STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'because', 'before', 'being', 'between',
  'content', 'could', 'from', 'have', 'into', 'more', 'most', 'other', 'practical',
  'product', 'should', 'system', 'team', 'that', 'their', 'there', 'these', 'they',
  'this', 'those', 'through', 'trust', 'using', 'video', 'what', 'when', 'where',
  'which', 'while', 'with', 'work', 'would', 'your', 'youtube',
])

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => typeof entry === 'string' && entry.trim() ? [entry.trim()] : [])
    : []
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'feature' || key === 'si') url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return value
  }
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>
    return `{${Object.keys(data).sort().map((key) => `${JSON.stringify(key)}:${stableValue(data[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function fingerprint(value: unknown) {
  const source = stableValue(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function routeYouTubeDescriptionRemediation(gate: YouTubeDescriptionRemediationGate): {
  designated_owner: YouTubeDescriptionRemediationOwner
  recovery_action: YouTubeDescriptionRecoveryAction
} {
  switch (gate) {
    case 'framework_approval':
      return { designated_owner: 'voice-content-architect', recovery_action: 'approve_source_framework' }
    case 'artifact_conformance':
      return { designated_owner: 'voice-content-architect', recovery_action: 'repair_description_artifact_conformance' }
    case 'description_structure':
      return { designated_owner: 'voice-content-architect', recovery_action: 'repair_description_structure' }
    case 'source_attribution':
      return { designated_owner: 'research-source-register', recovery_action: 'restore_public_source_attribution' }
    case 'description_capture':
      return { designated_owner: 'research-source-register', recovery_action: 'capture_public_description_with_provenance' }
    case 'outlier_score':
      return { designated_owner: 'research-source-register', recovery_action: 'qualify_outlier_evidence' }
    case 'freshness':
      return { designated_owner: 'research-source-register', recovery_action: 'refresh_public_evidence' }
    case 'topic_match':
      return { designated_owner: 'research-source-register', recovery_action: 'repair_topic_identity' }
    case 'audience_band':
      return { designated_owner: 'research-source-register', recovery_action: 'repair_audience_cohort' }
    case 'cohort_size':
      return { designated_owner: 'research-source-register', recovery_action: 'qualify_additional_cohort_sources' }
  }
}

function remediationReceiptId(scopeFingerprint: string, subjectType: 'source' | 'cohort', sourceId: string | null, gate: YouTubeDescriptionRemediationGate) {
  return `youtube-description-remediation:${fingerprint({ gate, scopeFingerprint, sourceId, subjectType }).slice('fnv1a:'.length)}`
}

function remediationReceipt(input: {
  subjectType: 'source' | 'cohort'
  sourceId: string | null
  sourceUrl: string | null
  scopeFingerprint: string
  gate: YouTubeDescriptionRemediationGate
  observed: string
  requirement: string
  evidenceFingerprint: string
  prior?: YouTubeDescriptionRemediationReceipt
  resolved?: boolean
}): YouTubeDescriptionRemediationReceipt {
  const route = routeYouTubeDescriptionRemediation(input.gate)
  const inputsChanged = Boolean(input.prior && input.prior.current_evidence_fingerprint !== input.evidenceFingerprint)
  const resolved = Boolean(input.resolved && inputsChanged)
  return {
    version: YOUTUBE_DESCRIPTION_REMEDIATION_VERSION,
    receipt_id: remediationReceiptId(input.scopeFingerprint, input.subjectType, input.sourceId, input.gate),
    scope_fingerprint: input.scopeFingerprint,
    subject_type: input.subjectType,
    source_id: input.sourceId,
    source_url: input.sourceUrl,
    failed_gate: input.gate,
    observed_value: input.observed,
    requirement: input.requirement,
    recovery_action: route.recovery_action,
    designated_owner: route.designated_owner,
    recorder: 'decision-journal',
    attempt_count: (input.prior?.attempt_count ?? 0) + (inputsChanged ? 1 : 0),
    prior_evidence_fingerprint: input.prior?.current_evidence_fingerprint ?? null,
    current_evidence_fingerprint: input.evidenceFingerprint,
    status: resolved
      ? 'resolved'
      : !input.prior
        ? 'open'
        : inputsChanged
          ? 'recheck_failed'
          : 'awaiting_evidence',
    recheck_result: resolved
      ? 'passed_after_input_change'
      : !input.prior
        ? 'not_run_no_prior_receipt'
        : inputsChanged
          ? 'failed_after_input_change'
          : 'not_run_inputs_unchanged',
    release_readiness: resolved ? 'ready' : 'blocked',
  }
}

function topicTokens(...values: unknown[]): string[] {
  const tokens: string[] = []
  for (const value of values) {
    if (Array.isArray(value)) {
      tokens.push(...topicTokens(...value))
      continue
    }
    tokens.push(...text(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !TOPIC_STOP_WORDS.has(token)))
  }
  return [...new Set(tokens)]
}

function audienceBand(size: number) {
  if (size < 10_000) return 'micro'
  if (size < 100_000) return 'emerging'
  if (size < 1_000_000) return 'established'
  return 'large'
}

function descriptionPattern(description: string): DescriptionPattern {
  const paragraphs = description.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const words = description.split(/\s+/).filter(Boolean)
  const firstLine = description.split(/\n/).map((line) => line.trim()).find(Boolean) ?? ''
  const lastParagraph = paragraphs.at(-1) ?? ''
  const urls = [...description.matchAll(/https?:\/\/\S+/gi)].map((match) => match.index ?? 0)
  const firstUrl = urls[0] ?? -1
  const openingStyle: DescriptionPattern['opening_style'] = firstLine.endsWith('?')
    ? 'question'
    : /^(?:build|calculate|compare|discover|download|learn|look|make|see|start|stop|try|watch)\b/i.test(firstLine)
      ? 'command'
      : 'claim'
  const ctaStyle: DescriptionPattern['cta_style'] = /subscribe|follow the channel/i.test(lastParagraph)
    ? 'subscribe'
    : /comment|tell me|share your/i.test(lastParagraph)
      ? 'comment'
      : lastParagraph.endsWith('?')
        ? 'question'
        : /https?:\/\//i.test(lastParagraph)
          ? 'resource_link'
          : 'none'

  return {
    opening_style: openingStyle,
    length_band: words.length < 80 ? 'short' : words.length < 220 ? 'medium' : 'long',
    paragraph_count: paragraphs.length,
    proof_style: /screenshot|screen recording|walkthrough|demo|product|calculator|dashboard/i.test(description)
      ? 'product_evidence'
      : /data|study|research|case study|result|measured/i.test(description)
        ? 'data_or_case'
        : 'explanation_only',
    cta_style: ctaStyle,
    link_placement: firstUrl < 0 ? 'none' : firstUrl < description.length / 2 ? 'early' : 'late',
    uses_chapters: /^\s*\d{1,2}:\d{2}\s+/m.test(description),
    hashtag_count: (description.match(/#[A-Za-z0-9_]+/g) ?? []).length,
  }
}

function mode<T extends string>(values: T[]): T | null {
  if (!values.length) return null
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0]
}

function descriptionBlueprint(pattern: YouTubeDescriptionLibraryReceipt['recommended_structure']) {
  const steps = [
    pattern.opening_style === 'question'
      ? 'Open with one audience-facing question tied to the topic.'
      : pattern.opening_style === 'command'
        ? 'Open with a direct action or promise tied to the topic.'
        : 'Open with a concrete claim tied to the topic.',
    pattern.proof_style === 'product_evidence'
      ? 'Connect the claim to an inspectable first-party product example or screenshot.'
      : pattern.proof_style === 'data_or_case'
        ? 'Support the claim with attributable data or a bounded case example.'
        : 'Explain the practical lesson in plain language.',
    'State what the viewer will learn and why it matters now.',
  ]
  if (pattern.uses_chapters) steps.push('Add chapters only when the final video timing is known.')
  if (pattern.link_placement !== 'none') steps.push(`Place the primary approved resource link ${pattern.link_placement} in the description.`)
  steps.push(pattern.cta_style === 'subscribe'
    ? 'Close with a natural channel subscription invitation.'
    : pattern.cta_style === 'comment'
      ? 'Close with a specific comment invitation.'
      : pattern.cta_style === 'question'
        ? 'Close with one specific audience question.'
        : pattern.cta_style === 'resource_link'
          ? 'Close with one approved resource link and its purpose.'
          : 'Close with one concrete next action.')
  return steps
}

function packetTopics(packet: Record<string, unknown>) {
  const metadata = record(packet.actor_metadata)
  const pattern = record(packet.pattern_packet)
  return topicTokens(
    stringArray(packet.topics),
    stringArray(metadata.topics),
    stringArray(metadata.topic_ids),
    stringArray(metadata.entity_identities),
    stringArray(pattern.topics),
    stringArray(pattern.topic_ids),
    packet.title,
    pattern.promise_value,
    pattern.hook_structure,
  )
}

function capturedSourceDescription(packet: Record<string, unknown>) {
  const metadata = record(packet.actor_metadata)
  const pattern = record(packet.pattern_packet)
  return text(metadata.source_description)
    || text(metadata.source_description_excerpt)
    || text(pattern.source_description)
}

function descriptionProvenance(packet: Record<string, unknown>) {
  const metadata = record(packet.actor_metadata)
  return text(metadata.description_provenance)
}

function gateDecisions(input: {
  status: string
  sourceUrl: string
  description: string
  provenance: string
  outlierScore: number | null
  minimumOutlierScore: number
  evidenceTime: number
  generatedAt: number
  freshnessDays: number
  matches: string[]
  targetAudienceBand: string | null
  audienceSize: number | null
}) {
  const raw: Array<{
    gate: YouTubeDescriptionGateDecision['gate']
    label: string
    pass: boolean
    notApplicable?: boolean
    requirement: string
    observed: string
    reason: string
  }> = [
    {
      gate: 'framework_approval' as const,
      label: 'Framework approval',
      pass: input.status === 'usable_framework',
      requirement: 'pattern_status must be usable_framework',
      observed: input.status || 'Missing',
      reason: 'Pattern has not been approved as a usable framework.',
    },
    {
      gate: 'source_attribution' as const,
      label: 'Source attribution',
      pass: validHttpUrl(input.sourceUrl),
      requirement: 'Attributable HTTP source URL',
      observed: validHttpUrl(input.sourceUrl) ? input.sourceUrl : 'Missing or invalid URL',
      reason: 'Source URL is missing or is not attributable.',
    },
    {
      gate: 'description_capture' as const,
      label: 'Public description capture',
      pass: Boolean(input.description && input.provenance),
      requirement: 'Separately captured public description plus provenance',
      observed: input.description && input.provenance ? input.provenance : 'Description or provenance missing',
      reason: 'No separately proven public YouTube description was captured; the internal packet summary is not description evidence.',
    },
    {
      gate: 'outlier_score' as const,
      label: 'Outlier threshold',
      pass: input.outlierScore !== null && input.outlierScore >= input.minimumOutlierScore,
      requirement: `Outlier score at least ${input.minimumOutlierScore}`,
      observed: input.outlierScore === null ? 'Missing' : String(input.outlierScore),
      reason: input.outlierScore === null ? 'Outlier score is missing.' : `Outlier score ${input.outlierScore} is below the ${input.minimumOutlierScore} threshold.`,
    },
    {
      gate: 'freshness' as const,
      label: 'Evidence freshness',
      pass: Number.isFinite(input.evidenceTime)
        && input.generatedAt - input.evidenceTime >= 0
        && input.generatedAt - input.evidenceTime <= input.freshnessDays * 86_400_000,
      requirement: `Evidence dated no later than evaluation and within ${input.freshnessDays} days`,
      observed: Number.isFinite(input.evidenceTime) ? new Date(input.evidenceTime).toISOString() : 'Missing date',
      reason: !Number.isFinite(input.evidenceTime)
        ? 'Publication or retrieval date is missing.'
        : input.generatedAt - input.evidenceTime < 0
          ? 'Evidence date is later than the evaluation time.'
          : `Evidence is older than the ${input.freshnessDays}-day freshness window.`,
    },
    {
      gate: 'topic_match' as const,
      label: 'Topic identity',
      pass: input.matches.length > 0,
      requirement: 'At least one stable topic-token match',
      observed: input.matches.length ? input.matches.join(', ') : 'No matching topic token',
      reason: 'No stable topic identity matches the current comparison.',
    },
    {
      gate: 'audience_band' as const,
      label: 'Audience comparison band',
      pass: !input.targetAudienceBand || (input.audienceSize !== null && audienceBand(input.audienceSize) === input.targetAudienceBand),
      notApplicable: !input.targetAudienceBand,
      requirement: input.targetAudienceBand ? `Audience must be in the ${input.targetAudienceBand} band` : 'No audience-size band requested',
      observed: input.audienceSize === null ? 'Missing audience size' : `${input.audienceSize} (${audienceBand(input.audienceSize)})`,
      reason: `Audience size is missing or outside the ${input.targetAudienceBand} comparison band.`,
    },
  ]
  let failed = false
  const decisions: YouTubeDescriptionGateDecision[] = raw.map((decision) => {
    const status: YouTubeDescriptionGateDecision['status'] = decision.notApplicable
      ? 'not_applicable'
      : failed
        ? 'not_evaluated'
        : decision.pass
          ? 'passed'
          : 'failed'
    if (status === 'failed') failed = true
    return {
      gate: decision.gate,
      label: decision.label,
      status,
      requirement: decision.requirement,
      observed: decision.observed,
    }
  })
  const failedIndex = decisions.findIndex((decision) => decision.status === 'failed')
  return {
    decisions,
    reason: failedIndex >= 0 ? raw[failedIndex].reason : null,
  }
}

export function buildYouTubeOutlierDescriptionLibrary(input: {
  researchPackets: unknown[]
  targetTopics: string[]
  generatedAt: string
  targetAudienceSize?: number | null
  minimumSourceCount?: number
  minimumOutlierScore?: number
  freshnessDays?: number
  maximumSources?: number
  priorRemediationReceipts?: YouTubeDescriptionRemediationReceipt[]
}): YouTubeDescriptionLibraryReceipt {
  const priorReceipts = input.priorRemediationReceipts ?? []
  const priorMinimumSourceCount = Math.max(0, ...priorReceipts
    .filter((receipt) => receipt.failed_gate === 'cohort_size')
    .map((receipt) => Number(receipt.requirement.match(/At least (\d+)/)?.[1] ?? 0)))
  const priorMinimumOutlierScore = Math.max(0, ...priorReceipts
    .filter((receipt) => receipt.failed_gate === 'outlier_score')
    .map((receipt) => Number(receipt.requirement.match(/at least (\d+(?:\.\d+)?)/i)?.[1] ?? 0)))
  const priorFreshnessDays = priorReceipts
    .filter((receipt) => receipt.failed_gate === 'freshness')
    .map((receipt) => Number(receipt.requirement.match(/within (\d+) days/i)?.[1] ?? Number.POSITIVE_INFINITY))
  const minimumSourceCount = Math.max(2, input.minimumSourceCount ?? 3, priorMinimumSourceCount)
  const minimumOutlierScore = Math.max(priorMinimumOutlierScore, Math.max(0, Math.min(100, input.minimumOutlierScore ?? 65)))
  const freshnessDays = Math.min(Math.max(1, input.freshnessDays ?? 180), ...priorFreshnessDays)
  const maximumSources = Math.max(minimumSourceCount, input.maximumSources ?? 5)
  const generatedAt = Date.parse(input.generatedAt)
  const targetTopics = topicTokens(input.targetTopics)
  const targetAudienceBand = typeof input.targetAudienceSize === 'number' && input.targetAudienceSize >= 0
    ? audienceBand(input.targetAudienceSize)
    : null
  const scopeFingerprint = fingerprint({ targetAudienceBand, targetTopics })
  const sources = new Map<string, YouTubeDescriptionLibrarySource>()
  const excludedSources: YouTubeDescriptionLibraryExclusion[] = []
  const sourceEvaluations = new Map<string, {
    sourceUrl: string | null
    evidenceFingerprint: string
    decisions: YouTubeDescriptionGateDecision[]
  }>()
  const priorRemediationReceipts = new Map(priorReceipts.map((receipt) => [receipt.receipt_id, receipt]))

  if (Number.isFinite(generatedAt) && targetTopics.length) {
    for (const rawPacket of input.researchPackets) {
      const packet = record(rawPacket)
      const platform = text(packet.platform)
      const status = text(packet.pattern_status)
      const sourceUrl = canonicalUrl(text(packet.source_url))
      const description = capturedSourceDescription(packet)
      const provenance = descriptionProvenance(packet)
      const metrics = record(packet.metrics)
      const outlierScore = number(packet.outlier_score) ?? number(record(packet.actor_metadata).score_breakdown && record(record(packet.actor_metadata).score_breakdown).outlier_score)
      const publishedAt = text(metrics.published_at) || text(packet.published_at)
      const retrievedAt = text(packet.retrieved_at)
      const evidenceTime = Date.parse(publishedAt || retrievedAt)
      const audienceSize = number(metrics.follower_count) ?? number(metrics.subscriber_count)
      const topics = packetTopics(packet)
      const matches = targetTopics.filter((topic) => topics.includes(topic))
      const sourceId = text(packet.id) || fingerprint(sourceUrl || text(packet.title))
      const evidenceFingerprint = fingerprint({
        audienceSize,
        description,
        matches,
        outlierScore,
        platform,
        provenance,
        publishedAt,
        retrievedAt,
        sourceUrl,
        status,
        topics,
      })
      const evaluation = gateDecisions({
        status,
        sourceUrl,
        description,
        provenance,
        outlierScore,
        minimumOutlierScore,
        evidenceTime,
        generatedAt,
        freshnessDays,
        matches,
        targetAudienceBand,
        audienceSize,
      })
      const reason = platform === 'youtube' || platform === 'youtube_shorts' ? evaluation.reason : null

      if (platform === 'youtube' || platform === 'youtube_shorts') {
        sourceEvaluations.set(sourceId, {
          sourceUrl: validHttpUrl(sourceUrl) ? sourceUrl : null,
          evidenceFingerprint,
          decisions: evaluation.decisions,
        })
      }

      if (reason) {
        excludedSources.push({
          source_id: sourceId,
          source_url: validHttpUrl(sourceUrl) ? sourceUrl : null,
          source_title: text(packet.title) || 'Untitled YouTube source',
          reason,
          gate_decisions: evaluation.decisions,
        })
        continue
      }
      if (platform !== 'youtube' && platform !== 'youtube_shorts') continue
      if (outlierScore === null) continue

      const matchScore = Number(((matches.length / targetTopics.length) * 0.65 + (outlierScore / 100) * 0.35).toFixed(4))
      const source: YouTubeDescriptionLibrarySource = {
        source_id: sourceId,
        source_url: sourceUrl,
        source_title: text(packet.title) || 'Untitled YouTube source',
        creator: text(packet.creator_name) || text(packet.creator_handle) || null,
        thumbnail_url: validHttpUrl(text(packet.thumbnail_url)) ? text(packet.thumbnail_url) : null,
        description_provenance: provenance,
        outlier_score: outlierScore,
        published_at: publishedAt || retrievedAt,
        retrieved_at: retrievedAt || publishedAt,
        audience_size: audienceSize,
        topic_matches: matches,
        topic_match_score: matchScore,
        description_fingerprint: fingerprint(description),
        pattern: descriptionPattern(description),
        gate_decisions: evaluation.decisions,
      }
      const existing = sources.get(sourceUrl)
      if (!existing || source.topic_match_score > existing.topic_match_score) sources.set(sourceUrl, source)
    }
  }

  const ranked = [...sources.values()]
    .sort((left, right) => right.topic_match_score - left.topic_match_score || right.outlier_score - left.outlier_score || left.source_url.localeCompare(right.source_url))
    .slice(0, maximumSources)
  const status: YouTubeDescriptionLibraryStatus = ranked.length >= minimumSourceCount ? 'ready' : 'unscored'
  const recommendedStructure: YouTubeDescriptionLibraryReceipt['recommended_structure'] = {
    opening_style: status === 'ready' ? mode(ranked.map((source) => source.pattern.opening_style)) : null,
    length_band: status === 'ready' ? mode(ranked.map((source) => source.pattern.length_band)) : null,
    proof_style: status === 'ready' ? mode(ranked.map((source) => source.pattern.proof_style)) : null,
    cta_style: status === 'ready' ? mode(ranked.map((source) => source.pattern.cta_style)) : null,
    link_placement: status === 'ready' ? mode(ranked.map((source) => source.pattern.link_placement)) : null,
    uses_chapters: status === 'ready' ? ranked.filter((source) => source.pattern.uses_chapters).length > ranked.length / 2 : null,
    blueprint: [],
  }
  recommendedStructure.blueprint = status === 'ready' ? descriptionBlueprint(recommendedStructure) : []
  const blockers = [
    ...(targetTopics.length ? [] : ['No stable target topics were available for description matching.']),
    ...(Number.isFinite(generatedAt) ? [] : ['The description-library evaluation time is invalid.']),
    ...(ranked.length >= minimumSourceCount ? [] : [`Only ${ranked.length} fresh, attributable same-topic outlier description(s) qualified; ${minimumSourceCount} are required.`]),
  ]
  const currentRemediations: YouTubeDescriptionRemediationReceipt[] = []
  for (const excluded of excludedSources) {
    const failedDecision = excluded.gate_decisions.find((decision) => decision.status === 'failed')
    const sourceEvaluation = sourceEvaluations.get(excluded.source_id)
    if (!failedDecision || !sourceEvaluation) continue
    const receiptId = remediationReceiptId(scopeFingerprint, 'source', excluded.source_id, failedDecision.gate)
    currentRemediations.push(remediationReceipt({
      subjectType: 'source',
      sourceId: excluded.source_id,
      sourceUrl: excluded.source_url,
      scopeFingerprint,
      gate: failedDecision.gate,
      observed: failedDecision.observed,
      requirement: failedDecision.requirement,
      evidenceFingerprint: sourceEvaluation.evidenceFingerprint,
      prior: priorRemediationReceipts.get(receiptId),
    }))
  }
  const cohortEvidenceFingerprint = fingerprint({
    sourceEvidence: [...sourceEvaluations.entries()].sort(([left], [right]) => left.localeCompare(right)),
    targetAudienceBand,
    targetTopics,
  })
  if (status === 'unscored') {
    const receiptId = remediationReceiptId(scopeFingerprint, 'cohort', null, 'cohort_size')
    currentRemediations.push(remediationReceipt({
      subjectType: 'cohort',
      sourceId: null,
      sourceUrl: null,
      scopeFingerprint,
      gate: 'cohort_size',
      observed: `${ranked.length} qualified source(s)`,
      requirement: `At least ${minimumSourceCount} independent qualifying sources`,
      evidenceFingerprint: cohortEvidenceFingerprint,
      prior: priorRemediationReceipts.get(receiptId),
    }))
  }
  const currentReceiptIds = new Set(currentRemediations.map((receipt) => receipt.receipt_id))
  for (const prior of priorRemediationReceipts.values()) {
    if (currentReceiptIds.has(prior.receipt_id) || prior.status === 'resolved') continue
    if (prior.scope_fingerprint !== scopeFingerprint) continue
    if (prior.subject_type === 'cohort' && prior.failed_gate === 'cohort_size') {
      currentRemediations.push(remediationReceipt({
        subjectType: 'cohort',
        sourceId: null,
        sourceUrl: null,
        scopeFingerprint,
        gate: 'cohort_size',
        observed: `${ranked.length} qualified source(s)`,
        requirement: prior.requirement,
        evidenceFingerprint: cohortEvidenceFingerprint,
        prior,
        resolved: status === 'ready',
      }))
      continue
    }
    if (!prior.source_id) continue
    const sourceEvaluation = sourceEvaluations.get(prior.source_id)
    const decision = sourceEvaluation?.decisions.find((candidate) => candidate.gate === prior.failed_gate)
    if (!sourceEvaluation || !decision || decision.status !== 'passed') continue
    currentRemediations.push(remediationReceipt({
      subjectType: 'source',
      sourceId: prior.source_id,
      sourceUrl: sourceEvaluation.sourceUrl,
      scopeFingerprint,
      gate: prior.failed_gate,
      observed: decision.observed,
      requirement: decision.requirement,
      evidenceFingerprint: sourceEvaluation.evidenceFingerprint,
      prior,
      resolved: true,
    }))
  }
  const remediationReceipts = currentRemediations.sort((left, right) => left.receipt_id.localeCompare(right.receipt_id))
  const result = {
    version: YOUTUBE_DESCRIPTION_LIBRARY_VERSION,
    status,
    generated_at: input.generatedAt,
    target_topics: targetTopics,
    minimum_source_count: minimumSourceCount,
    minimum_outlier_score: minimumOutlierScore,
    freshness_days: freshnessDays,
    library_entry_count: ranked.length,
    sources: ranked,
    excluded_sources: excludedSources.sort((left, right) => left.source_title.localeCompare(right.source_title)),
    recommended_structure: recommendedStructure,
    blockers,
    release_readiness: status === 'ready' ? 'ready' as const : 'blocked' as const,
    remediation_receipts: remediationReceipts,
    originality_boundary: 'Reuse aggregate description structure only. Do not copy source wording, title language, creator identity, links, claims, or calls to action.',
  }
  return { ...result, input_fingerprint: fingerprint(result) }
}
