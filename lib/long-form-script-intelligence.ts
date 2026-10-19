import sourceRegister from '@/data/video-script-intelligence/youtube-creation-public-sources.json'

export const LONG_FORM_SCRIPT_INTELLIGENCE_VERSION = 'long-form-script-intelligence-v2' as const
export const LONG_FORM_FRAMEWORK_LIBRARY_VERSION = 'youtube-creation-framework-library-v2' as const
export const LONG_FORM_MIN_DURATION_SECONDS = 480
export const LONG_FORM_MAX_DURATION_SECONDS = 720
export const LONG_FORM_DEFAULT_DELIVERY_WPM = 145

export type ScriptReviewStatus = 'passed' | 'blocked' | 'unscored'
export type ScriptDimensionKey =
  | 'first_30_seconds'
  | 'hook_promise_alignment'
  | 'open_loops'
  | 'rehooks'
  | 'proof_placement'
  | 'pacing'
  | 'pattern_interrupts'
  | 'broll_cues'
  | 'payoff'
  | 'spoken_conclusion'
  | 'delivered_cta'
  | 'chapter_development'
  | 'campaign_specificity'
  | 'framework_mapping'

export type PublicFrameworkSource = {
  id: string
  creator: string
  title: string
  url: string
  source_kind: string
  published_at: string | null
  observed_at: string
  public_evidence: string
  evidence_fields: string[]
}

export type DerivedFrameworkRule = {
  id: string
  label: string
  rule: string
  source_ids: string[]
  derivation_receipt: string
  imitation_boundary: string
}

export type LongFormFrameworkLibrary = {
  version: typeof LONG_FORM_FRAMEWORK_LIBRARY_VERSION
  source_register_version: string
  playlist: typeof sourceRegister.playlist
  sources: PublicFrameworkSource[]
  rules: DerivedFrameworkRule[]
  originality_contract: string[]
}

export type LongFormScriptBeat = {
  id: string
  start_seconds: number
  end_seconds: number
  text: string
  role: 'hook' | 'open_loop' | 'frame' | 'proof' | 'teaching' | 'objection' | 'rehook' | 'payoff' | 'conclusion' | 'cta'
  broll_cue?: string | null
  pattern_interrupt?: string | null
  chapter_id?: string | null
  resolves_beat_id?: string | null
  evidence_ids?: string[]
  framework_applications?: Array<{
    rule_id: string
    source_creators: string[]
    change: string
  }>
  primary_cta?: {
    action: string
    destination_label: string
    destination_url: string
  } | null
}

export type TopicOutlierEvidence = {
  id: string
  label: string
  source_url: string
  creator: string
  topic: string
  observed_at: string
  published_at: string
  views: number
  channel_baseline_views: number
  attribution_status: 'attributable' | 'missing' | 'unauthorized'
}

export type CreatorDistanceReceipt = {
  status: 'passed' | 'blocked' | 'unscored'
  compared_source_ids: string[]
  longest_matching_phrase_words: number | null
  maximum_allowed_phrase_words: number
  copied_phrase_hits: string[]
  voice_profile: 'vambah-approved' | 'missing'
  notes: string
}

export type LongFormScriptReviewInput = {
  version: typeof LONG_FORM_SCRIPT_INTELLIGENCE_VERSION
  script_id: string
  script_version: string
  topic: string
  promise: string
  evaluated_at: string
  expected_duration_seconds: number
  delivery_words_per_minute: number
  product_evidence_ids: string[]
  beats: LongFormScriptBeat[]
  topic_outlier_evidence: TopicOutlierEvidence[]
  creator_distance: CreatorDistanceReceipt
  framework_rule_ids: string[]
}

export type LongFormDraftReceipt = {
  id: string
  title?: string | null
  script_text?: string | null
  script_outline?: Record<string, unknown> | null
  script_scorecard?: Record<string, unknown> | null
  research_packet_ids?: string[] | null
  storyboard_json?: { scenes?: Array<{ brollHint?: string | null; description?: string | null }> } | null
  created_at?: string | null
}

export type LongFormResearchPacketReceipt = {
  id: string
  source_url?: string | null
  creator_name?: string | null
  creator_handle?: string | null
  title?: string | null
  metrics?: Record<string, unknown> | null
  score_breakdown?: Record<string, unknown> | null
  status?: string | null
  pattern_status?: string | null
  retrieved_at?: string | null
}

export type ScriptDimensionEvaluation = {
  key: ScriptDimensionKey
  label: string
  status: ScriptReviewStatus
  score: number | null
  formula: string
  observed: string
  blocker: string | null
  recovery: string | null
  input_ids: string[]
  framework_rule_ids: string[]
}

export type LongFormScriptReview = {
  version: typeof LONG_FORM_SCRIPT_INTELLIGENCE_VERSION
  framework_library_version: typeof LONG_FORM_FRAMEWORK_LIBRARY_VERSION
  status: ScriptReviewStatus
  approval_ready: boolean
  overall_score: number | null
  input_fingerprint: string
  topic_evidence: {
    status: ScriptReviewStatus
    included: Array<TopicOutlierEvidence & { outlier_ratio: number }>
    excluded: Array<{ id: string; label: string; reason: string }>
    minimum_sources: number
    freshness_days: number
    minimum_outlier_ratio: number
    blocker: string | null
    recovery: string
  }
  originality: CreatorDistanceReceipt
  script_contract: {
    duration_seconds: number
    delivery_words_per_minute: number
    word_count: number
    minimum_word_count: number
    maximum_word_count: number
  }
  framework_applications: Array<{
    beat_id: string
    rule_id: string
    source_creators: string[]
    change: string
  }>
  dimensions: ScriptDimensionEvaluation[]
  blockers: string[]
  deterministic_inputs: {
    script_id: string
    script_version: string
    evaluated_at: string
    expected_duration_seconds: number
    delivery_words_per_minute: number
    word_count: number
    beat_ids: string[]
    topic_source_ids: string[]
    framework_rule_ids: string[]
  }
}

const DIMENSION_LABELS: Record<ScriptDimensionKey, string> = {
  first_30_seconds: 'First 30 seconds',
  hook_promise_alignment: 'Hook / promise alignment',
  open_loops: 'Open loops',
  rehooks: 'Re-hooks',
  proof_placement: 'Proof placement',
  pacing: 'Pacing',
  pattern_interrupts: 'Pattern interrupts',
  broll_cues: 'B-roll cues',
  payoff: 'Payoff',
  spoken_conclusion: 'Spoken conclusion',
  delivered_cta: 'Delivered CTA',
  chapter_development: 'Chapter development',
  campaign_specificity: 'Campaign specificity',
  framework_mapping: 'Framework mapping',
}

const DERIVED_RULES: DerivedFrameworkRule[] = [
  {
    id: 'rule-hook-promise-contract',
    label: 'Hook and promise contract',
    rule: 'State a concrete viewer problem or outcome in the opening, then deliver the same promise in the body and payoff.',
    source_ids: ['oscar-owen-killer-script-2024', 'vanessa-lau-channel-blueprint-2025'],
    derivation_receipt: 'Derived from the public titles, descriptions, and chapter labels that explicitly promise a script formula, hook guidance, watch-time guidance, and a complete blueprint.',
    imitation_boundary: 'Reuse the abstract contract only. Do not copy the creator wording, cadence, examples, chapter names, or title syntax.',
  },
  {
    id: 'rule-proof-near-claim',
    label: 'Proof near the claim',
    rule: 'Place owned proof early enough to earn the central claim and bind every proof cue to a visible artifact or attributable result.',
    source_ids: ['oscar-owen-killer-script-2024', 'liam-ottley-proof-systems-2025'],
    derivation_receipt: 'Oscar Owen\'s public chapter labels place an example immediately after the intro. Liam Ottley\'s public title explicitly promises proof alongside a concrete system count.',
    imitation_boundary: 'Use AmaduTown, Portfolio, product, or lived proof. Do not borrow creator case studies or performance claims.',
  },
  {
    id: 'rule-visual-cue-purpose',
    label: 'Purposeful visual cues',
    rule: 'Attach B-roll and pattern interrupts to the spoken idea they clarify instead of using decorative footage.',
    source_ids: ['katie-steckly-broll-guide-2025', 'vanessa-lau-thumbnail-process-2024'],
    derivation_receipt: 'Katie Steckly\'s public chapters cover matching B-roll to A-roll or voiceover and timing footage. Vanessa Lau\'s public chapters include mobile testing and A/B testing.',
    imitation_boundary: 'Use the production principle only. Visual identity and shot choices must stay AmaduTown-native.',
  },
  {
    id: 'rule-value-before-cta',
    label: 'Earn the CTA',
    rule: 'Make the viewer outcome, likelihood, time burden, and effort tradeoff clear before asking for an action.',
    source_ids: ['alex-hormozi-value-equation-2024', 'alex-hormozi-value-equation-journal'],
    derivation_receipt: 'The creator-published Value Equation names dream outcome, perceived likelihood, time delay, and effort or sacrifice as the value variables.',
    imitation_boundary: 'Use the equation as an evaluation lens. Do not imitate Alex Hormozi\'s phrasing, delivery, examples, or offer language.',
  },
  {
    id: 'rule-live-topic-demand',
    label: 'Live topic demand before approval',
    rule: 'Require current same-topic outlier evidence before approval; saved playlist examples can calibrate structure but carry no live performance weight.',
    source_ids: ['nick-saraev-next-leg-2026', 'nick-saraev-home-2026'],
    derivation_receipt: 'Nick Saraev\'s creator-published article describes search demand, timing, performance spikes, and longer authoritative content as inputs to content selection.',
    imitation_boundary: 'Use attributable demand signals and original analysis. Do not reproduce creator angles or package a source\'s thesis as Vambah\'s.',
  },
]

export const LONG_FORM_FRAMEWORK_LIBRARY: LongFormFrameworkLibrary = {
  version: LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
  source_register_version: sourceRegister.register_version,
  playlist: sourceRegister.playlist,
  sources: sourceRegister.sources as PublicFrameworkSource[],
  rules: DERIVED_RULES,
  originality_contract: [
    'Public creator sources may contribute abstract structure, never creator imitation.',
    'Vambah voice, owned proof, original examples, and original phrasing remain required.',
    'Private corpus may guide voice internally but must never appear as public-source evidence.',
    'A phrase overlap receipt must pass before approval; missing comparison evidence remains Unscored.',
  ],
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function words(value: string) {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

function tokenSet(value: string) {
  return new Set(words(value).filter((word) => word.length > 2))
}

function overlapScore(left: string, right: string) {
  const a = tokenSet(left)
  const b = tokenSet(right)
  if (!a.size || !b.size) return 0
  const common = [...a].filter((token) => b.has(token)).length
  return Math.round((common / Math.max(1, Math.min(a.size, b.size))) * 100)
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const item = record(value)
    return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${stable(item[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function attributableUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []
}

function normalizeCreatorDistance(value: unknown): CreatorDistanceReceipt {
  const receipt = record(value)
  const status = receipt.status === 'passed' || receipt.status === 'blocked' || receipt.status === 'unscored'
    ? receipt.status
    : 'unscored'
  return {
    status,
    compared_source_ids: stringArray(receipt.compared_source_ids),
    longest_matching_phrase_words: number(receipt.longest_matching_phrase_words),
    maximum_allowed_phrase_words: number(receipt.maximum_allowed_phrase_words) ?? 7,
    copied_phrase_hits: stringArray(receipt.copied_phrase_hits),
    voice_profile: receipt.voice_profile === 'vambah-approved' ? 'vambah-approved' : 'missing',
    notes: text(receipt.notes) || 'A persisted creator-distance receipt is required before long-form approval.',
  }
}

function normalizePersistedBeats(value: unknown): LongFormScriptBeat[] {
  if (!Array.isArray(value)) return []
  const roles = new Set<LongFormScriptBeat['role']>(['hook', 'open_loop', 'frame', 'proof', 'teaching', 'objection', 'rehook', 'payoff', 'conclusion', 'cta'])
  return value.flatMap((candidate) => {
    const beat = record(candidate)
    const role = roles.has(beat.role as LongFormScriptBeat['role']) ? beat.role as LongFormScriptBeat['role'] : null
    const start = number(beat.start_seconds)
    const end = number(beat.end_seconds)
    const beatText = text(beat.text)
    if (!role || start === null || end === null || !beatText) return []
    const applications = Array.isArray(beat.framework_applications) ? beat.framework_applications.flatMap((candidate) => {
      const application = record(candidate)
      const ruleId = text(application.rule_id)
      const change = text(application.change)
      return ruleId && change ? [{ rule_id: ruleId, source_creators: stringArray(application.source_creators), change }] : []
    }) : []
    const cta = record(beat.primary_cta)
    return [{
      id: text(beat.id) || `beat-${start}-${role}`,
      start_seconds: start,
      end_seconds: end,
      role,
      text: beatText,
      broll_cue: text(beat.broll_cue) || null,
      pattern_interrupt: text(beat.pattern_interrupt) || null,
      chapter_id: text(beat.chapter_id) || null,
      resolves_beat_id: text(beat.resolves_beat_id) || null,
      evidence_ids: stringArray(beat.evidence_ids),
      framework_applications: applications,
      primary_cta: text(cta.action) && text(cta.destination_label) && text(cta.destination_url) ? {
        action: text(cta.action), destination_label: text(cta.destination_label), destination_url: text(cta.destination_url),
      } : null,
    }]
  })
}

function fallbackBeats(draft: LongFormDraftReceipt, duration: number): LongFormScriptBeat[] {
  const outline = record(draft.script_outline)
  const storyboard = draft.storyboard_json?.scenes ?? []
  const script = text(draft.script_text)
  const teaching = Array.isArray(outline.teaching_beats) ? outline.teaching_beats.map(text).filter(Boolean) : []
  const candidates = ([
    { role: 'hook', value: text(outline.hook) },
    { role: 'open_loop', value: text(outline.open_loop) },
    { role: 'frame', value: text(outline.frame) },
    { role: 'proof', value: text(outline.proof_demo) },
    ...teaching.map((value) => ({ role: 'teaching' as const, value })),
    { role: 'payoff', value: text(outline.closing_question) || text(outline.frame) },
    { role: 'conclusion', value: text(outline.source_distance_notes) },
    { role: 'cta', value: text(outline.cta) },
  ] as Array<{ role: LongFormScriptBeat['role']; value: string }>).filter((candidate) => candidate.value)
  if (!candidates.length && script) candidates.push({ role: 'teaching', value: script })
  const slice = duration / Math.max(1, candidates.length)
  return candidates.map((candidate, index) => ({
    id: `derived-${index + 1}-${candidate.role}`,
    start_seconds: Number((slice * index).toFixed(2)),
    end_seconds: Number((slice * (index + 1)).toFixed(2)),
    role: candidate.role,
    text: candidate.value,
    broll_cue: text(storyboard[index]?.brollHint) || text(storyboard[index]?.description) || null,
    pattern_interrupt: text(storyboard[index]?.description) || null,
  }))
}

function researchEvidence(packet: LongFormResearchPacketReceipt, topic: string): TopicOutlierEvidence {
  const metrics = record(packet.metrics)
  const score = record(packet.score_breakdown)
  const views = number(metrics.views) ?? 0
  const relative = number(metrics.channel_relative_performance) ?? number(score.channel_relative_performance)
  const explicitBaseline = number(metrics.channel_baseline_views)
  const baseline = explicitBaseline ?? (relative && relative > 0 && views > 0 ? views / relative : 0)
  const observedAt = text(packet.retrieved_at) || text(metrics.retrieved_at) || text(metrics.observed_at)
  const publishedAt = text(metrics.published_at)
  const approved = packet.status === 'approved' && packet.pattern_status === 'usable_framework'
  const attributable = approved && attributableUrl(text(packet.source_url)) && Boolean(observedAt && publishedAt && views > 0 && baseline > 0)
  return {
    id: packet.id,
    label: text(packet.title) || `Research packet ${packet.id}`,
    source_url: text(packet.source_url),
    creator: text(packet.creator_name) || text(packet.creator_handle) || 'Unattributed creator',
    topic,
    observed_at: observedAt,
    published_at: publishedAt,
    views,
    channel_baseline_views: baseline,
    attribution_status: attributable ? 'attributable' : 'missing',
  }
}

export function buildLongFormScriptReviewInputFromDraft(args: {
  draft: LongFormDraftReceipt
  researchPackets: LongFormResearchPacketReceipt[]
  evaluatedAt?: string
}): LongFormScriptReviewInput {
  const { draft, researchPackets } = args
  const outline = record(draft.script_outline)
  const scorecard = record(draft.script_scorecard)
  const persisted = record(scorecard.long_form_script_intelligence)
  const script = text(draft.script_text)
  const wordCount = words(script).length
  const expectedDuration = number(persisted.expected_duration_seconds) ?? Math.round((wordCount / 140) * 60)
  const deliveryWordsPerMinute = number(persisted.delivery_words_per_minute) ?? LONG_FORM_DEFAULT_DELIVERY_WPM
  const packetObservedTimes = researchPackets.map((packet) => text(packet.retrieved_at)).filter(Boolean).sort()
  const evaluatedAt = args.evaluatedAt
    || text(persisted.evaluated_at)
    || packetObservedTimes[packetObservedTimes.length - 1]
    || text(draft.created_at)
    || ''
  const topic = text(persisted.topic) || text(draft.title) || text(outline.pain_point)
  const promise = text(persisted.promise) || text(outline.open_loop) || text(outline.frame)
  const persistedBeats = normalizePersistedBeats(persisted.beats)
  return {
    version: LONG_FORM_SCRIPT_INTELLIGENCE_VERSION,
    script_id: draft.id,
    script_version: text(persisted.script_version) || fnv1a(stable({ script, outline })),
    topic,
    promise,
    evaluated_at: evaluatedAt,
    expected_duration_seconds: expectedDuration,
    delivery_words_per_minute: deliveryWordsPerMinute,
    product_evidence_ids: stringArray(persisted.product_evidence_ids),
    beats: persistedBeats.length ? persistedBeats : fallbackBeats(draft, Math.max(1, expectedDuration)),
    topic_outlier_evidence: researchPackets.map((packet) => researchEvidence(packet, topic)),
    creator_distance: normalizeCreatorDistance(persisted.creator_distance),
    framework_rule_ids: stringArray(persisted.framework_rule_ids).length
      ? stringArray(persisted.framework_rule_ids)
      : DERIVED_RULES.map((rule) => rule.id),
  }
}

function scoredDimension(input: {
  key: ScriptDimensionKey
  score: number
  formula: string
  observed: string
  blocker?: string | null
  recovery?: string | null
  inputIds: string[]
  frameworkRuleIds: string[]
}): ScriptDimensionEvaluation {
  const score = boundedScore(input.score)
  const blocker = input.blocker ?? (score < 70 ? `${DIMENSION_LABELS[input.key]} must score at least 70.` : null)
  return {
    key: input.key,
    label: DIMENSION_LABELS[input.key],
    status: blocker ? 'blocked' : 'passed',
    score,
    formula: input.formula,
    observed: input.observed,
    blocker,
    recovery: blocker ? input.recovery ?? `Repair ${DIMENSION_LABELS[input.key].toLowerCase()} and re-run the same versioned inputs.` : null,
    input_ids: input.inputIds,
    framework_rule_ids: input.frameworkRuleIds,
  }
}

function unscoredDimension(key: ScriptDimensionKey, reason: string, inputIds: string[] = []): ScriptDimensionEvaluation {
  return {
    key,
    label: DIMENSION_LABELS[key],
    status: 'unscored',
    score: null,
    formula: 'No score is produced until every required deterministic input is present.',
    observed: 'Required input missing or invalid.',
    blocker: reason,
    recovery: 'Attach the missing versioned script beat or evidence receipt, then re-run the review.',
    input_ids: inputIds,
    framework_rule_ids: [],
  }
}

function evaluateTopicEvidence(input: LongFormScriptReviewInput) {
  const minimumSources = 3
  const freshnessDays = 30
  const minimumOutlierRatio = 1.5
  const evaluatedAt = Date.parse(input.evaluated_at)
  const topicTokens = tokenSet(input.topic)
  const included: Array<TopicOutlierEvidence & { outlier_ratio: number }> = []
  const excluded: Array<{ id: string; label: string; reason: string }> = []

  for (const source of [...input.topic_outlier_evidence].sort((a, b) => a.id.localeCompare(b.id))) {
    const observedAt = Date.parse(source.observed_at)
    const publishedAt = Date.parse(source.published_at)
    const matchingTokens = [...topicTokens].filter((token) => tokenSet(source.topic).has(token)).length
    const topicMatch = topicTokens.size ? matchingTokens / topicTokens.size : 0
    let reason = ''
    if (source.attribution_status !== 'attributable' || !attributableUrl(source.source_url)) reason = 'Source is missing public attribution or is unauthorized.'
    else if (!Number.isFinite(evaluatedAt) || !Number.isFinite(observedAt) || !Number.isFinite(publishedAt)) reason = 'Freshness timestamps are missing or invalid.'
    else if (observedAt > evaluatedAt || evaluatedAt - observedAt > freshnessDays * 86_400_000) reason = `Observation is outside the ${freshnessDays}-day freshness window.`
    else if (topicMatch < 0.5) reason = 'Source is not specific enough to the current topic.'
    else if (!Number.isFinite(source.views) || !Number.isFinite(source.channel_baseline_views) || source.channel_baseline_views <= 0) reason = 'Performance inputs are missing or invalid.'
    if (reason) excluded.push({ id: source.id, label: source.label, reason })
    else included.push({ ...source, outlier_ratio: Number((source.views / source.channel_baseline_views).toFixed(2)) })
  }

  const hasOutlier = included.some((source) => source.outlier_ratio >= minimumOutlierRatio)
  const blocker = included.length < minimumSources
    ? `Only ${included.length} attributable fresh same-topic sources are available; ${minimumSources} are required.`
    : !hasOutlier
      ? `No included source meets the ${minimumOutlierRatio.toFixed(1)}x topic outlier threshold.`
      : null
  return {
    status: blocker ? 'unscored' as const : 'passed' as const,
    included,
    excluded,
    minimum_sources: minimumSources,
    freshness_days: freshnessDays,
    minimum_outlier_ratio: minimumOutlierRatio,
    blocker,
    recovery: 'Refresh the topic in Content Intelligence, attach three attributable same-topic public observations from the last 30 days, and include a channel-baseline receipt.',
  }
}

function invalidReview(reason: string, input: Partial<LongFormScriptReviewInput> = {}): LongFormScriptReview {
  const keys = Object.keys(DIMENSION_LABELS) as ScriptDimensionKey[]
  return {
    version: LONG_FORM_SCRIPT_INTELLIGENCE_VERSION,
    framework_library_version: LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
    status: 'unscored',
    approval_ready: false,
    overall_score: null,
    input_fingerprint: fnv1a(stable(input)),
    topic_evidence: {
      status: 'unscored', included: [], excluded: [], minimum_sources: 3, freshness_days: 30,
      minimum_outlier_ratio: 1.5, blocker: reason,
      recovery: 'Attach a complete versioned packet and current topic evidence, then run the review again.',
    },
    originality: input.creator_distance ?? {
      status: 'unscored', compared_source_ids: [], longest_matching_phrase_words: null,
      maximum_allowed_phrase_words: 7, copied_phrase_hits: [], voice_profile: 'missing', notes: '',
    },
    script_contract: {
      duration_seconds: input.expected_duration_seconds ?? 0,
      delivery_words_per_minute: input.delivery_words_per_minute ?? 0,
      word_count: 0,
      minimum_word_count: 0,
      maximum_word_count: 0,
    },
    framework_applications: [],
    dimensions: keys.map((key) => unscoredDimension(key, reason)),
    blockers: [reason],
    deterministic_inputs: {
      script_id: input.script_id ?? '', script_version: input.script_version ?? '', evaluated_at: input.evaluated_at ?? '',
      expected_duration_seconds: input.expected_duration_seconds ?? 0,
      delivery_words_per_minute: input.delivery_words_per_minute ?? 0,
      word_count: 0,
      beat_ids: [], topic_source_ids: [], framework_rule_ids: [],
    },
  }
}

export function evaluateLongFormScriptIntelligence(value: unknown): LongFormScriptReview {
  const data = record(value)
  if (data.version !== LONG_FORM_SCRIPT_INTELLIGENCE_VERSION) return invalidReview('Script intelligence packet version is missing or unsupported.', data)
  const input = value as LongFormScriptReviewInput
  if (!input.script_id?.trim() || !input.script_version?.trim() || !input.topic?.trim() || !input.promise?.trim()) return invalidReview('Script identity, version, topic, and promise are required.', input)
  if (!Number.isFinite(Date.parse(input.evaluated_at)) || !Number.isFinite(input.expected_duration_seconds) || input.expected_duration_seconds < LONG_FORM_MIN_DURATION_SECONDS || input.expected_duration_seconds > LONG_FORM_MAX_DURATION_SECONDS) return invalidReview('A valid evaluation time and long-form duration between 480 and 720 seconds are required.', input)
  if (!Number.isFinite(input.delivery_words_per_minute) || input.delivery_words_per_minute < 120 || input.delivery_words_per_minute > 180) return invalidReview('A configured delivery rate between 120 and 180 spoken words per minute is required.', input)
  if (!Array.isArray(input.product_evidence_ids) || input.product_evidence_ids.length < 3) return invalidReview('At least three versioned campaign-specific product evidence bindings are required.', input)
  if (!Array.isArray(input.beats) || !input.beats.length || !Array.isArray(input.topic_outlier_evidence)) return invalidReview('Versioned script beats and topic evidence are required.', input)

  const beats = [...input.beats].sort((a, b) => a.start_seconds - b.start_seconds)
  const validBeats = beats.every((beat) => beat.id && beat.text.trim() && beat.start_seconds >= 0 && beat.end_seconds > beat.start_seconds && beat.end_seconds <= input.expected_duration_seconds)
  if (!validBeats) return invalidReview('Every script beat needs a stable id, spoken text, and valid start/end timing.', input)

  const topicEvidence = evaluateTopicEvidence(input)
  const opening = beats.filter((beat) => beat.start_seconds < 30)
  const openingText = opening.map((beat) => beat.text).join(' ')
  const openingWords = opening.reduce((sum, beat) => sum + words(beat.text).length, 0)
  const hookBeats = beats.filter((beat) => beat.role === 'hook')
  const openLoops = beats.filter((beat) => beat.role === 'open_loop')
  const rehooks = beats.filter((beat) => beat.role === 'rehook')
  const proof = beats.filter((beat) => beat.role === 'proof')
  const payoff = beats.filter((beat) => beat.role === 'payoff')
  const conclusions = beats.filter((beat) => beat.role === 'conclusion')
  const ctas = beats.filter((beat) => beat.role === 'cta')
  const teaching = beats.filter((beat) => beat.role === 'teaching')
  const objections = beats.filter((beat) => beat.role === 'objection')
  const nonClosingBeats = beats.filter((beat) => !['conclusion', 'cta'].includes(beat.role))
  const durationMinutes = input.expected_duration_seconds / 60
  const wordCount = beats.reduce((sum, beat) => sum + words(beat.text).length, 0)
  const wordsPerMinute = wordCount / durationMinutes
  const minimumWordCount = Math.max(1050, Math.round(durationMinutes * input.delivery_words_per_minute * 0.93))
  const maximumWordCount = Math.min(1900, Math.round(durationMinutes * input.delivery_words_per_minute * 1.07))
  const visualCueBeats = nonClosingBeats.filter((beat) => beat.broll_cue?.trim() || beat.pattern_interrupt?.trim())
  const patternBeats = beats.filter((beat) => beat.pattern_interrupt?.trim())
  const gapStarts = [0, ...patternBeats.map((beat) => beat.start_seconds), input.expected_duration_seconds]
  const maxPatternGap = Math.max(...gapStarts.slice(1).map((time, index) => time - gapStarts[index]))
  const finalWindowStart = input.expected_duration_seconds * 0.84
  const firstConclusion = conclusions[0]
  const firstCta = ctas[0]
  const hookText = hookBeats.filter((beat) => beat.start_seconds < 10).map((beat) => beat.text).join(' ')
  const genericHook = /^(?:if you(?:'re| are) trying to understand|today (?:we|i) (?:are going to|will)|in this video|welcome back|have you ever wondered)\b/i.test(hookText.trim())
  const hookTopicSpecific = overlapScore(hookText, input.topic) >= 25
  const hookHasTension = /\b(?:but|problem|fails?|wrong|risk|cost|friction|stuck|harder|lose|burden|surpris|what if|why does|minutes?|seconds?|three|four|five|fight|race|kick)\b/i.test(hookText)
  const hookHasStakes = /\b(?:because|means|leaves|lose|fails?|wrong|burden|stuck|cost|risk|matters|without|before)\b/i.test(hookText)
  const openingHasWhyNow = /\b(?:now|today|still|before|every time|this time|when|right away|already)\b/i.test(openingText)
  const openingHasOutcome = /\b(?:by the end|you will|you'll|show you|walk away|learn|see exactly|understand how)\b/i.test(openingText)
  const payoffIds = new Set(payoff.map((beat) => beat.id))
  const mappedLoops = openLoops.filter((beat) => beat.resolves_beat_id && payoffIds.has(beat.resolves_beat_id))
  const rehookTimeline = [0, ...rehooks.map((beat) => beat.start_seconds), input.expected_duration_seconds]
  const maxRehookGap = Math.max(...rehookTimeline.slice(1).map((time, index) => time - rehookTimeline[index]))
  const requiredRolesPresent = hookBeats.length > 0 && openLoops.length > 0 && beats.some((beat) => beat.role === 'frame') && proof.length > 0 && teaching.length >= 3 && objections.length > 0 && payoff.length > 0 && conclusions.length > 0 && ctas.length > 0
  const distinctChapters = new Set(beats.map((beat) => beat.chapter_id).filter(Boolean)).size
  const usedEvidenceIds = new Set(beats.flatMap((beat) => beat.evidence_ids ?? []))
  const evidenceCoverage = input.product_evidence_ids.filter((id) => usedEvidenceIds.has(id)).length
  const normalizedTeaching = teaching.map((beat) => beat.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
  const repeatedTeaching = normalizedTeaching.some((entry, index) => normalizedTeaching.indexOf(entry) !== index)
  const mappedApplications = beats.flatMap((beat) => (beat.framework_applications ?? []).map((application) => ({ beat_id: beat.id, ...application })))
  const frameworkApplicationsPass = input.framework_rule_ids.every((ruleId) => {
    const rule = DERIVED_RULES.find((candidate) => candidate.id === ruleId)
    const expectedCreators = (rule?.source_ids ?? []).flatMap((sourceId) => {
      const source = LONG_FORM_FRAMEWORK_LIBRARY.sources.find((candidate) => candidate.id === sourceId)
      return source ? [source.creator] : []
    })
    return mappedApplications.some((application) => application.rule_id === ruleId && application.change.length >= 24 && expectedCreators.every((creator) => application.source_creators.includes(creator)))
  })
  const ctaText = firstCta?.text ?? ''
  const ctaContract = firstCta?.primary_cta
  const ctaSpecific = Boolean(
    ctaContract
    && attributableUrl(ctaContract.destination_url)
    && overlapScore(ctaText, `${ctaContract.action} ${ctaContract.destination_label}`) >= 30
    && /\b(?:open|try|download|comment|visit|play|compare|choose|build|read|watch)\b/i.test(ctaText)
    && !/^\s*(?:please )?(?:like and )?subscribe\b/i.test(ctaText),
  )

  const dimensions: ScriptDimensionEvaluation[] = [
    scoredDimension({
      key: 'first_30_seconds',
      score: !genericHook && hookBeats.some((beat) => beat.start_seconds < 10) && hookTopicSpecific && hookHasTension && hookHasStakes && openingHasWhyNow && openingHasOutcome && mappedLoops.length ? 100 : 35,
      formula: 'Pass only when the first 10 seconds contain campaign-specific tension and stakes, and the first 30 seconds add why-now context, a specific outcome, and an open loop mapped to a payoff.',
      observed: `${openingWords} opening words; generic=${genericHook}; topic-specific=${hookTopicSpecific}; tension=${hookHasTension}; stakes=${hookHasStakes}; why-now=${openingHasWhyNow}; outcome=${openingHasOutcome}; mapped loops=${mappedLoops.length}.`,
      recovery: 'Replace the generic lead-in with a campaign-specific tension or surprising claim, state why it matters now, promise a concrete viewer outcome, and map the curiosity loop to its payoff.',
      inputIds: opening.map((beat) => beat.id), frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'hook_promise_alignment', score: !genericHook && hookTopicSpecific && hookHasTension && overlapScore(openingText, `${input.topic} ${input.promise}`) >= 35 ? 100 : 40,
      formula: 'Semantic gate: non-generic campaign tension plus at least 35% meaningful-token overlap between the opening and the exact topic/promise.',
      observed: `Opening-to-promise overlap ${overlapScore(openingText, `${input.topic} ${input.promise}`)}%; generic=${genericHook}; topic-specific=${hookTopicSpecific}; tension=${hookHasTension}.`,
      recovery: 'Rewrite the hook so it names the same topic and practical outcome promised by the video.',
      inputIds: [...opening.map((beat) => beat.id), 'input:promise', 'input:topic'], frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'open_loops', score: openLoops.length && mappedLoops.length === openLoops.length ? 100 : openLoops.length ? 45 : 0,
      formula: 'Every open-loop beat must name a later payoff beat through resolves_beat_id.',
      observed: `${openLoops.length} open loop(s); ${mappedLoops.length} mapped to a real payoff.`,
      recovery: 'Add one explicit question or promised reveal and map it to a later payoff beat.',
      inputIds: [...openLoops, ...payoff].map((beat) => beat.id), frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'rehooks', score: rehooks.length >= Math.floor(input.expected_duration_seconds / 180) && maxRehookGap <= 180 ? 100 : 35,
      formula: 'At least floor(duration / 180s) re-hooks, with no opening-to-rehook, rehook-to-rehook, or rehook-to-end gap above 180 seconds.',
      observed: `${rehooks.length} re-hook(s); longest attention-renewal gap ${Math.round(maxRehookGap)}s.`,
      recovery: 'Add a campaign-specific tension, question, or consequence at least every two to three minutes.',
      inputIds: rehooks.map((beat) => beat.id), frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'proof_placement', score: proof.length ? (proof[0].start_seconds <= Math.min(180, input.expected_duration_seconds * 0.3) ? 100 : 55) : 0,
      formula: '100 when first proof appears by the earlier of 180s or 30% of duration; 55 when later; 0 when absent.',
      observed: proof.length ? `First proof starts at ${proof[0].start_seconds}s.` : 'No proof beat is mapped.',
      recovery: 'Move owned, attributable proof next to the first major claim and label the artifact shown.',
      inputIds: proof.map((beat) => beat.id), frameworkRuleIds: ['rule-proof-near-claim'],
    }),
    scoredDimension({
      key: 'pacing', score: wordCount >= minimumWordCount && wordCount <= maximumWordCount && wordsPerMinute >= 120 && wordsPerMinute <= 180 ? 100 : 25,
      formula: `Pass when spoken copy contains ${minimumWordCount}-${maximumWordCount} words for the configured ${input.delivery_words_per_minute} WPM delivery rate and the observed rate remains 120-180 WPM.`,
      observed: `${wordCount} words / ${durationMinutes.toFixed(1)} minutes = ${Math.round(wordsPerMinute)} WPM; required ${minimumWordCount}-${maximumWordCount} words.`,
      recovery: 'Develop substantive campaign-specific chapters to meet the configured delivery contract; do not pad short copy with repeated or generic paragraphs.',
      inputIds: beats.map((beat) => beat.id), frameworkRuleIds: [],
    }),
    scoredDimension({
      key: 'pattern_interrupts', score: maxPatternGap <= 60 ? 100 : maxPatternGap <= 90 ? 70 : 35,
      formula: '100 when the longest pattern-interrupt gap is <=60s; 70 at <=90s; 35 above 90s.',
      observed: `${patternBeats.length} mapped interrupt(s); longest gap ${Math.round(maxPatternGap)}s.`,
      recovery: 'Add a purposeful visual, on-screen phrase, angle change, or artifact switch before the longest gap.',
      inputIds: patternBeats.map((beat) => beat.id), frameworkRuleIds: ['rule-visual-cue-purpose'],
    }),
    scoredDimension({
      key: 'broll_cues', score: nonClosingBeats.length ? Math.round((visualCueBeats.length / nonClosingBeats.length) * 100) : 0,
      formula: 'Non-closing beats with a B-roll or pattern-interrupt cue / all non-closing beats x 100.',
      observed: `${visualCueBeats.length} of ${nonClosingBeats.length} non-closing beats have a visual cue.`,
      recovery: 'Add a specific, source-safe visual cue to each major teaching or proof beat.',
      inputIds: visualCueBeats.map((beat) => beat.id), frameworkRuleIds: ['rule-visual-cue-purpose'],
    }),
    scoredDimension({
      key: 'payoff', score: payoff.length ? overlapScore(payoff.map((beat) => beat.text).join(' '), input.promise) : 0,
      formula: 'Shared meaningful payoff/promise tokens / smaller meaningful-token set x 100.',
      observed: payoff.length ? `Payoff alignment is ${overlapScore(payoff.map((beat) => beat.text).join(' '), input.promise)}%.` : 'No payoff beat is mapped.',
      recovery: 'Resolve the opening question in plain language and repeat the promised practical outcome.',
      inputIds: [...payoff, ...openLoops].map((beat) => beat.id), frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'spoken_conclusion', score: firstConclusion && firstConclusion.start_seconds >= finalWindowStart ? 100 : firstConclusion ? 55 : 0,
      formula: '100 when a spoken conclusion begins in the final 18% of duration; 55 when earlier; 0 when missing.',
      observed: firstConclusion ? `Conclusion starts at ${firstConclusion.start_seconds}s; final window begins at ${Math.round(finalWindowStart)}s.` : 'No spoken conclusion is mapped.',
      recovery: 'Add a substantive spoken conclusion in the closing window before the CTA.',
      inputIds: conclusions.map((beat) => beat.id), frameworkRuleIds: ['rule-value-before-cta'],
    }),
    scoredDimension({
      key: 'delivered_cta', score: firstCta && firstConclusion && firstCta.start_seconds > firstConclusion.start_seconds && firstCta.end_seconds >= input.expected_duration_seconds * 0.9 && ctaSpecific ? 100 : firstCta ? 35 : 0,
      formula: 'Pass when one audible primary CTA follows the conclusion in the final 10%, names a concrete audience action, and binds that action to an attributable public destination. Subscribe may appear only as a secondary ask.',
      observed: firstCta ? `CTA spans ${firstCta.start_seconds}-${firstCta.end_seconds}s; specific primary action=${ctaSpecific}; destination=${ctaContract?.destination_label ?? 'missing'}.` : 'No delivered CTA is mapped.',
      recovery: 'Name one concrete audience action tied to the delivered value and bind it to the approved public product or source destination.',
      inputIds: [...conclusions, ...ctas].map((beat) => beat.id), frameworkRuleIds: ['rule-value-before-cta'],
    }),
    scoredDimension({
      key: 'chapter_development', score: requiredRolesPresent && distinctChapters >= 9 && !repeatedTeaching ? 100 : 30,
      formula: 'Require hook, setup/open loop, frame/stakes, owned proof, at least three distinct teaching sections, objection/counterpoint, payoff, conclusion, CTA, nine chapter ids, and no repeated teaching paragraphs.',
      observed: `${distinctChapters} chapter ids; ${teaching.length} teaching sections; objection=${objections.length > 0}; repeated teaching=${repeatedTeaching}.`,
      recovery: 'Build a substantive chapter sequence with three distinct lessons, an objection/counterpoint, and a resolved payoff instead of repeated generic paragraphs.',
      inputIds: beats.map((beat) => beat.id), frameworkRuleIds: ['rule-hook-promise-contract', 'rule-proof-near-claim'],
    }),
    scoredDimension({
      key: 'campaign_specificity', score: evidenceCoverage >= 3 && proof.some((beat) => (beat.evidence_ids ?? []).length > 0) ? 100 : 25,
      formula: 'At least three declared campaign product-evidence ids must appear on script beats, including the owned-product proof/demo beat.',
      observed: `${evidenceCoverage} of ${input.product_evidence_ids.length} declared product evidence bindings are used; ${usedEvidenceIds.size} unique bindings appear in the script.`,
      recovery: 'Replace generic product language with named product behavior and bind each major claim to an approved owned artifact.',
      inputIds: [...usedEvidenceIds], frameworkRuleIds: ['rule-proof-near-claim'],
    }),
    scoredDimension({
      key: 'framework_mapping', score: frameworkApplicationsPass ? 100 : 25,
      formula: 'Every declared framework rule must map to a beat, name all source creators for that rule, and explain in at least 24 characters how it changed that beat.',
      observed: `${mappedApplications.length} beat-level framework application(s); all required rules mapped=${frameworkApplicationsPass}.`,
      recovery: 'Attach inspectable creator-to-rule-to-beat applications that describe the concrete script change without copying creator language.',
      inputIds: mappedApplications.map((application) => application.beat_id), frameworkRuleIds: input.framework_rule_ids,
    }),
  ]

  const originality = input.creator_distance
  const originalityBlocker = originality.status !== 'passed'
    ? 'Creator-distance receipt has not passed.'
    : originality.voice_profile !== 'vambah-approved'
      ? 'Vambah voice profile is missing.'
      : originality.longest_matching_phrase_words === null
        ? 'Phrase-distance comparison is missing.'
        : originality.longest_matching_phrase_words > originality.maximum_allowed_phrase_words || originality.copied_phrase_hits.length
          ? 'Creator phrase overlap exceeds the approved originality distance.'
          : null
  const frameworkIds = new Set(DERIVED_RULES.map((rule) => rule.id))
  const missingRules = input.framework_rule_ids.filter((id) => !frameworkIds.has(id))
  const blockers = [
    ...(topicEvidence.blocker ? [topicEvidence.blocker] : []),
    ...(originalityBlocker ? [originalityBlocker] : []),
    ...(missingRules.length ? [`Unknown framework rule ids: ${missingRules.join(', ')}.`] : []),
    ...dimensions.flatMap((dimension) => dimension.blocker ? [`${dimension.label}: ${dimension.blocker}`] : []),
  ]
  const hasUnscored = topicEvidence.status === 'unscored' || originality.status === 'unscored' || dimensions.some((dimension) => dimension.status === 'unscored')
  const status: ScriptReviewStatus = blockers.length === 0 ? 'passed' : hasUnscored ? 'unscored' : 'blocked'
  const scores = dimensions.flatMap((dimension) => dimension.score === null ? [] : [dimension.score])

  return {
    version: LONG_FORM_SCRIPT_INTELLIGENCE_VERSION,
    framework_library_version: LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
    status,
    approval_ready: status === 'passed',
    overall_score: status === 'unscored' ? null : Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length)),
    input_fingerprint: fnv1a(stable(input)),
    topic_evidence: topicEvidence,
    originality,
    script_contract: {
      duration_seconds: input.expected_duration_seconds,
      delivery_words_per_minute: input.delivery_words_per_minute,
      word_count: wordCount,
      minimum_word_count: minimumWordCount,
      maximum_word_count: maximumWordCount,
    },
    framework_applications: mappedApplications,
    dimensions,
    blockers,
    deterministic_inputs: {
      script_id: input.script_id,
      script_version: input.script_version,
      evaluated_at: input.evaluated_at,
      expected_duration_seconds: input.expected_duration_seconds,
      delivery_words_per_minute: input.delivery_words_per_minute,
      word_count: wordCount,
      beat_ids: beats.map((beat) => beat.id),
      topic_source_ids: input.topic_outlier_evidence.map((source) => source.id).sort(),
      framework_rule_ids: [...input.framework_rule_ids].sort(),
    },
  }
}

export function kickLabLongFormQaBeats(): LongFormScriptBeat[] {
  const application = (rule_id: string, source_creators: string[], change: string) => ({ rule_id, source_creators, change })
  const beat = (
    id: string,
    start: number,
    end: number,
    role: LongFormScriptBeat['role'],
    chapter: string,
    textValue: string,
    broll: string,
    interrupt: string,
    evidenceIds: string[] = [],
    applications: LongFormScriptBeat['framework_applications'] = [],
    extra: Pick<LongFormScriptBeat, 'resolves_beat_id' | 'primary_cta'> = {},
  ): LongFormScriptBeat => ({
    id, start_seconds: start, end_seconds: end, role, chapter_id: chapter, text: textValue,
    broll_cue: broll, pattern_interrupt: interrupt, evidence_ids: evidenceIds,
    framework_applications: applications, resolves_beat_id: extra.resolves_beat_id ?? null,
    primary_cta: extra.primary_cta ?? null,
  })
  return [
    beat('kicklab-hook', 0, 9, 'hook', 'hook', 'A punch, a corner, and a free kick look unrelated. KickLab uses all three to ask one question: can kids feel physics before they memorize it?', 'Rapid cuts from Fight impact meter to Race cornering line to Kick ball trajectory, using current owned gameplay capture.', 'Three actions freeze on screen as force arrows appear.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-hook-promise-contract', ['Oscar Owen', 'Vanessa Lau'], 'Replaced a topic introduction with a speakable three-mode tension and one concrete question inside the first nine seconds.')]),
    beat('kicklab-open-loop', 9, 30, 'open_loop', 'setup-stakes', 'Right now, many learning apps add quizzes to a screen and call it engagement. I want to test a different idea across Fight, Race, and Kick: when the equation changes the move immediately, does the math become easier to understand? By the end, you will see exactly which part teaches and which part only entertains.', 'Owned home screen showing the three real gameplay cards and the ages 9–15 label.', 'On-screen promise: change a variable, feel the result, explain why.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-hook-promise-contract', ['Oscar Owen', 'Vanessa Lau'], 'Placed the exact viewer outcome, why-now context, and a curiosity question before the thirty-second mark.')], { resolves_beat_id: 'kicklab-payoff' }),
    beat('kicklab-stakes', 30, 75, 'frame', 'setup-stakes', 'That distinction matters because children already build theories while they play. They predict whether a harder hit will move an opponent farther. They learn that entering a turn too fast changes what the car can do. They adjust the angle of a shot after watching the ball miss. The learning is there, but it usually disappears when the game hides the variables or when the lesson removes the play. KickLab tries to hold both sides together. The move stays fun, and the variable stays visible. This is also why I am cautious about claiming that a game automatically teaches physics. What I can demonstrate is the product behavior: the player changes a measurable input, sees a different outcome, and receives a coach review that connects the two.', 'Split screen: player action, visible variable control, then Coach Review explanation.', 'The words predict, adjust, and explain appear beside the corresponding interaction.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-live-topic-demand', ['Nick Saraev'], 'Used the current learning-game question to frame timing while keeping the claim bounded to visible KickLab behavior.')]),
    beat('kicklab-fight-proof', 75, 130, 'proof', 'owned-product-proof', 'Start in Fight. The player does not choose a cartoon attack and wait for a hidden score. The punch is tied to timing, impulse, momentum, pressure, and the opponent response. Release too early and the hit lacks force. Wait too long and the opening closes. Change the glove or timing conditions and the same button press can produce a different result. The important part is the feedback loop. KickLab shows the impact, records what changed, and opens a Coach Review after the exchange. A young player can see that power is not magic. It comes from measurable choices. That is owned proof from the current game, not a stock animation standing in for a feature. The screen shows the meter, the contact, the result, and the explanation in one sequence.', 'Current KickLab Fight capture: timing band, punch release, impact response, then Coach Review.', 'Pause at contact and draw the impulse relationship over the real frame.', ['kicklab-fight-momentum'], [application('rule-proof-near-claim', ['Oscar Owen', 'Liam Ottley'], 'Moved current owned Fight gameplay directly beside the first learning claim so the audience can inspect the meter, contact, result, and review.')]),
    beat('kicklab-race-lesson', 130, 180, 'teaching', 'teaching-race', 'Race teaches a different kind of restraint. Speed feels like the obvious answer until the corner arrives. The game exposes steering, grip, braking, throttle, vehicle mass, and the radius of the turn. A go-kart, street car, and race car do not respond the same way because their numbers are different. If the player carries too much speed into a tight radius, grip becomes the constraint. Braking earlier may feel slower for one second and still produce the faster lap. That is a useful lesson because the result pushes back against instinct. The player can test the idea, not merely hear it. Watch the line through the turn, the change in speed, and the coach feedback after the run. The math becomes a tool for explaining why the car behaved that way.', 'Owned Race capture comparing the same corner with two speeds and visible grip values.', 'Side-by-side ghost lines reveal the faster-looking run versus the faster completed run.', ['kicklab-race-grip'], [application('rule-visual-cue-purpose', ['Katie Steckly', 'Vanessa Lau'], 'Matched the side-by-side cornering visual to the spoken grip explanation instead of adding decorative racing footage.')]),
    beat('kicklab-rehook-one', 180, 195, 'rehook', 'rehook-one', 'Fight makes force visible. Race makes constraint visible. But Kick raises the harder question: can a player change several variables at once and still understand which choice caused the result?', 'Hard cut from the Race finish line to a frozen free-kick setup with angle, speed, spin, and gravity labels.', 'On-screen question: which variable moved the ball?', ['kicklab-kick-vectors'], [application('rule-hook-promise-contract', ['Oscar Owen', 'Vanessa Lau'], 'Renewed the opening tension at the three-minute mark with a product-specific causal question.')]),
    beat('kicklab-kick-lesson', 195, 255, 'teaching', 'teaching-kick', 'In the Kick lab, the player can work with vectors, gravity, projectile motion, spin, and surface conditions. A free kick begins with a direction and speed, but the path changes when angle or spin changes. The same idea appears in headers, passes, goalkeeper dives, and one-on-one dribbling. The game does not need to stop and announce a lecture. It can let the player aim, act, miss, and adjust. Then the explanation has something real to attach to. One attempt may clear the wall but rise over the crossbar. Another may stay low and reach the goalkeeper. A third may curve into space. Those outcomes give the equation meaning because the player has a reason to care about each number. The goal is still the goal. The math helps the player get there.', 'Owned Kick free-kick capture with three trajectories generated from changed angle and spin values.', 'Trace each path in a different color while keeping the real goal frame visible.', ['kicklab-kick-vectors'], [application('rule-visual-cue-purpose', ['Katie Steckly', 'Vanessa Lau'], 'Synchronized three owned trajectory traces with the exact angle and spin explanation so the visual carries causal meaning.')]),
    beat('kicklab-control-lesson', 255, 315, 'teaching', 'teaching-controls', 'The controls matter as much as the formulas. On a keyboard, touch screen, or gesture surface, the input has to feel connected to the action. Fight still uses its punch meter. Race consumes steering, throttle, and brake strength. Kick changes its control map based on the activity, whether the player is shooting, passing, dribbling, heading, or keeping goal. That consistency protects the lesson. If the interface silently enables a move the simulation does not support, the player learns the interface instead of the physics. KickLab uses a canonical input model so the visible control, the available action, and the game state agree. This is less flashy than a new character or stadium, but it is part of making the experience trustworthy. The equation can only teach when the player action reaches the simulation cleanly.', 'Owned responsive controls on desktop and mobile, followed by the active action state for Fight, Race, and Kick.', 'Control labels snap into place beside the corresponding simulation state.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-proof-near-claim', ['Oscar Owen', 'Liam Ottley'], 'Bound the control-model claim to current owned desktop and mobile states rather than describing an abstract input system.')]),
    beat('kicklab-rehook-two', 315, 330, 'rehook', 'rehook-two', 'So far, the design sounds clean. A player changes a number and sees a result. Here is where the idea can break: too many controls can turn curiosity into homework.', 'The variable panel fills the screen, then collapses to the active variables for one challenge.', 'On-screen tension: experiment or overload?', ['kicklab-kick-vectors'], [application('rule-hook-promise-contract', ['Oscar Owen', 'Vanessa Lau'], 'Introduced the central counterpressure midway through the video so retention comes from a real design tradeoff.')]),
    beat('kicklab-objection', 330, 390, 'objection', 'objection-counterpoint', 'That objection is fair. A physics game can bury a young player under sliders, symbols, and explanations. It can also reward random tapping while pretending that learning happened. KickLab answers that risk by narrowing the active variables around the current challenge. The player can use a simpler control layer, then open deeper adjustments when the experiment calls for them. Coach Review does not need to repeat every formula after every move. It can explain the choice that mattered this time. The design still needs testing with real players, especially across ages nine through fifteen. A nine-year-old and a fifteen-year-old will not read the same screen the same way. I cannot claim the current build has solved that. I can show the operating principle and the places where the product has been designed to reduce overload.', 'Owned variable panel moving from a focused challenge view into the deeper adjustment layer.', 'A visual meter compares useful choice with cognitive overload; no synthetic learner data appears.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-value-before-cta', ['Alex Hormozi'], 'Named the learner outcome, confidence boundary, time burden, and effort tradeoff before asking the audience to act.')]),
    beat('kicklab-progress-lesson', 390, 450, 'teaching', 'teaching-progress', 'Progress creates another design choice. KickLab saves experience, kit choices, challenge history, and a local nickname on the device. The current profile system can keep more than one local player separate while preserving compatibility with the earlier impactlab progress keys. That sounds technical, but the human reason is simple: a returning player should not lose what they earned because the product changed its name or added profiles. The local profiles are not accounts. They do not claim to solve identity, authorization, guardian consent, or cloud sync. Keeping that boundary visible matters in a game for young people. The product can remember enough to support continuity without pretending that a device-local nickname is a secure identity. Good educational technology should reduce burden for families, and it should be honest about what it stores and what it does not.', 'Owned local profile chooser, all-lab scorecard, and progress state; private names remain synthetic.', 'Storage boundary card: local progress, local nickname, no account claim.', ['kicklab-local-progress'], [application('rule-proof-near-claim', ['Oscar Owen', 'Liam Ottley'], 'Placed the local profile and compatibility screens beside the continuity claim and stated the identity boundary in the narration.')]),
    beat('kicklab-rehook-three', 450, 465, 'rehook', 'rehook-three', 'We have seen force, grip, vectors, controls, and progress. One question remains: is this a collection of mini-games, or one learning system?', 'Zoom out from the three labs into the combined all-lab scorecard.', 'Five concepts converge into one loop: act, observe, explain, adjust.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors', 'kicklab-local-progress'], [application('rule-hook-promise-contract', ['Oscar Owen', 'Vanessa Lau'], 'Reopened the main promise late in the video and pointed directly to the synthesis that resolves it.')]),
    beat('kicklab-synthesis', 465, 525, 'teaching', 'teaching-synthesis', 'The system is the loop shared by all three labs. Act. Observe. Explain. Adjust. Fight gives the player a short, physical timing loop. Race stretches the loop across a course and makes tradeoffs visible. Kick combines direction, speed, environment, and opponent response. The scorecard and Coach Review give the player a way to look back across those experiences. That does not replace a teacher, a parent, or a well-designed physics lesson. It gives them something concrete to discuss. Why did the second punch move farther? Why did slowing down before the corner improve the time? Why did spin change the shot path? Those are better questions than asking a child to repeat a definition they have not felt. The product earns its place when the game produces a question worth investigating.', 'Montage of one complete act-observe-review-adjust loop from each lab using owned gameplay.', 'The four-step loop stays on screen while each lab supplies a different example.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-visual-cue-purpose', ['Katie Steckly', 'Vanessa Lau'], 'Used one repeated four-step visual across three owned examples so the montage clarifies the synthesis instead of decorating it.')]),
    beat('kicklab-payoff', 525, 555, 'payoff', 'payoff', 'Now we can answer the opening question. The teaching is not the fact that KickLab contains equations. The teaching is the immediate relationship between a player choice, a visible variable, a changed result, and an explanation tied to that attempt. Fight, Race, and Kick use different mechanics, but they return to that same loop. The entertainment keeps the player willing to try again. The visible math gives the next attempt a reason. That is how KickLab turns a player choice into a visible physics result and an explanation across Fight, Race, and Kick. That is the product promise the current build can demonstrate. Whether it improves learning outcomes at scale still requires real study with the young people, families, and educators the game is meant to serve.', 'Return to the three opening actions, now annotated with choice, variable, result, and explanation.', 'Opening question resolves on screen with the four-part product loop.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-hook-promise-contract', ['Oscar Owen', 'Vanessa Lau'], 'Resolved the mapped opening question with the demonstrated four-part KickLab learning loop and a clear evidence boundary.'), application('rule-value-before-cta', ['Alex Hormozi'], 'Delivered the practical learner value and named the remaining proof gap before the audience request.')]),
    beat('kicklab-conclusion', 555, 580, 'conclusion', 'spoken-conclusion', 'Children do not wait for permission to experiment. They test speed, timing, angle, and force whenever a game lets them. The design challenge is to help them notice what they are already doing and give them language for it. KickLab is one attempt to build that bridge. The current product shows the loop. The next responsibility is to test whether the bridge holds for the learners who cross it.', 'Slow owned montage of Fight, Race, and Kick ending on the KickLab home screen.', 'Final principle on screen: make the variable visible, then let the player test it.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-value-before-cta', ['Alex Hormozi'], 'Closed on the demonstrated value and the honest evidence boundary before making one primary request.')]),
    beat('kicklab-cta', 580, 600, 'cta', 'primary-cta', 'Open the public KickLab repository linked in the description, run the current game, and choose one lab: Fight, Race, or Kick. Change one variable, play the move again, then leave a comment naming the result that surprised you. That specific example will help shape the next round of learner testing. If you want to follow that work, subscribing is the secondary step.', 'Public KickLab GitHub repository card, followed by the three owned lab cards.', 'Primary action stays visible: play one lab, change one variable, report one surprise.', ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors'], [application('rule-value-before-cta', ['Alex Hormozi'], 'Converted the delivered experiment loop into one specific audience action tied to the public KickLab source destination.')], { primary_cta: { action: 'Open and run KickLab, then comment with one surprising result', destination_label: 'public KickLab repository', destination_url: 'https://github.com/vsillah/KickLab' } }),
  ]
}

export function longFormScriptQaFixture(state: 'ready' | 'stale' | 'missing' | 'originality_blocked' = 'ready'): LongFormScriptReviewInput {
  const topic = 'KickLab physics learning through playable Fight Race and Kick experiments'
  const evidence = [
    { id: 'topic-1', label: 'Current proof-led workflow comparison', ratio: 2.4 },
    { id: 'topic-2', label: 'Current evidence-backed content comparison', ratio: 1.2 },
    { id: 'topic-3', label: 'Current YouTube script review comparison', ratio: 1.8 },
  ].map((item, index): TopicOutlierEvidence => ({
    id: item.id,
    label: item.label,
    source_url: `https://example.com/public-topic-evidence/${item.id}`,
    creator: `Public creator ${index + 1}`,
    topic,
    observed_at: state === 'stale' ? '2026-08-01T12:00:00.000Z' : '2026-10-17T12:00:00.000Z',
    published_at: '2026-10-10T12:00:00.000Z',
    views: Math.round(10_000 * item.ratio),
    channel_baseline_views: 10_000,
    attribution_status: state === 'missing' && index === 0 ? 'missing' : 'attributable',
  }))
  return {
    version: LONG_FORM_SCRIPT_INTELLIGENCE_VERSION,
    script_id: 'qa-long-form-script',
    script_version: 'sha256:qa-long-form-script-v1',
    topic,
    promise: 'show how KickLab turns a player choice into a visible physics result and an explanation across Fight Race and Kick',
    evaluated_at: '2026-10-18T23:30:00.000Z',
    expected_duration_seconds: 600,
    delivery_words_per_minute: LONG_FORM_DEFAULT_DELIVERY_WPM,
    product_evidence_ids: ['kicklab-fight-momentum', 'kicklab-race-grip', 'kicklab-kick-vectors', 'kicklab-local-progress'],
    beats: kickLabLongFormQaBeats(),
    topic_outlier_evidence: evidence,
    creator_distance: {
      status: state === 'originality_blocked' ? 'blocked' : 'passed',
      compared_source_ids: ['oscar-owen-killer-script-2024', 'vanessa-lau-channel-blueprint-2025'],
      longest_matching_phrase_words: state === 'originality_blocked' ? 12 : 4,
      maximum_allowed_phrase_words: 7,
      copied_phrase_hits: state === 'originality_blocked' ? ['synthetic copied phrase for QA only'] : [],
      voice_profile: 'vambah-approved',
      notes: 'Synthetic QA receipt. The script uses Vambah voice, owned product proof, and original phrasing.',
    },
    framework_rule_ids: DERIVED_RULES.map((rule) => rule.id),
  }
}

export function longFormSelectedDraftQaFixture(
  state: 'ready' | 'stale' | 'missing' | 'originality_blocked' = 'ready',
): { draft: LongFormDraftReceipt; researchPackets: LongFormResearchPacketReceipt[] } {
  const input = longFormScriptQaFixture(state)
  const researchPackets = input.topic_outlier_evidence.map((evidence): LongFormResearchPacketReceipt => ({
    id: evidence.id,
    source_url: evidence.source_url,
    creator_name: evidence.creator,
    title: evidence.label,
    status: evidence.attribution_status === 'attributable' ? 'approved' : 'draft',
    pattern_status: evidence.attribution_status === 'attributable' ? 'usable_framework' : 'needs_brand_translation',
    retrieved_at: evidence.observed_at,
    metrics: {
      views: evidence.views,
      channel_baseline_views: evidence.channel_baseline_views,
      published_at: evidence.published_at,
      retrieved_at: evidence.observed_at,
    },
    score_breakdown: {
      channel_relative_performance: evidence.channel_baseline_views > 0
        ? evidence.views / evidence.channel_baseline_views
        : 0,
    },
  }))
  return {
    draft: {
      id: input.script_id,
      title: 'Proof-led YouTube script workflow',
      script_text: input.beats.map((beat) => beat.text).join(' '),
      script_outline: {
        pain_point: input.topic,
        hook: input.beats.find((beat) => beat.role === 'hook')?.text ?? '',
        open_loop: input.promise,
        frame: input.beats.find((beat) => beat.role === 'frame')?.text ?? '',
        proof_demo: input.beats.find((beat) => beat.role === 'proof')?.text ?? '',
        teaching_beats: input.beats.filter((beat) => beat.role === 'teaching').map((beat) => beat.text),
        cta: input.beats.find((beat) => beat.role === 'cta')?.text ?? '',
        closing_question: input.beats.find((beat) => beat.role === 'payoff')?.text ?? '',
        source_distance_notes: input.creator_distance.notes,
      },
      script_scorecard: {
        long_form_script_intelligence: {
          topic: input.topic,
          promise: input.promise,
          script_version: input.script_version,
          evaluated_at: input.evaluated_at,
          expected_duration_seconds: input.expected_duration_seconds,
          delivery_words_per_minute: input.delivery_words_per_minute,
          product_evidence_ids: input.product_evidence_ids,
          beats: input.beats,
          creator_distance: input.creator_distance,
          framework_rule_ids: input.framework_rule_ids,
        },
      },
      research_packet_ids: researchPackets.map((packet) => packet.id),
      storyboard_json: {
        scenes: input.beats.flatMap((beat) => beat.broll_cue ? [{ brollHint: beat.broll_cue }] : []),
      },
      created_at: input.evaluated_at,
    },
    researchPackets,
  }
}
