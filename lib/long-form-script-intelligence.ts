import sourceRegister from '@/data/video-script-intelligence/youtube-creation-public-sources.json'

export const LONG_FORM_SCRIPT_INTELLIGENCE_VERSION = 'long-form-script-intelligence-v1' as const
export const LONG_FORM_FRAMEWORK_LIBRARY_VERSION = 'youtube-creation-framework-library-v1' as const

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
  role: 'hook' | 'open_loop' | 'frame' | 'proof' | 'teaching' | 'rehook' | 'payoff' | 'conclusion' | 'cta'
  broll_cue?: string | null
  pattern_interrupt?: string | null
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
  beats: LongFormScriptBeat[]
  topic_outlier_evidence: TopicOutlierEvidence[]
  creator_distance: CreatorDistanceReceipt
  framework_rule_ids: string[]
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
  dimensions: ScriptDimensionEvaluation[]
  blockers: string[]
  deterministic_inputs: {
    script_id: string
    script_version: string
    evaluated_at: string
    expected_duration_seconds: number
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
    dimensions: keys.map((key) => unscoredDimension(key, reason)),
    blockers: [reason],
    deterministic_inputs: {
      script_id: input.script_id ?? '', script_version: input.script_version ?? '', evaluated_at: input.evaluated_at ?? '',
      expected_duration_seconds: input.expected_duration_seconds ?? 0, beat_ids: [], topic_source_ids: [], framework_rule_ids: [],
    },
  }
}

export function evaluateLongFormScriptIntelligence(value: unknown): LongFormScriptReview {
  const data = record(value)
  if (data.version !== LONG_FORM_SCRIPT_INTELLIGENCE_VERSION) return invalidReview('Script intelligence packet version is missing or unsupported.', data)
  const input = value as LongFormScriptReviewInput
  if (!input.script_id?.trim() || !input.script_version?.trim() || !input.topic?.trim() || !input.promise?.trim()) return invalidReview('Script identity, version, topic, and promise are required.', input)
  if (!Number.isFinite(Date.parse(input.evaluated_at)) || !Number.isFinite(input.expected_duration_seconds) || input.expected_duration_seconds < 180) return invalidReview('A valid evaluation time and long-form duration of at least 180 seconds are required.', input)
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
  const nonClosingBeats = beats.filter((beat) => !['conclusion', 'cta'].includes(beat.role))
  const durationMinutes = input.expected_duration_seconds / 60
  const wordCount = beats.reduce((sum, beat) => sum + words(beat.text).length, 0)
  const wordsPerMinute = wordCount / durationMinutes
  const visualCueBeats = nonClosingBeats.filter((beat) => beat.broll_cue?.trim() || beat.pattern_interrupt?.trim())
  const patternBeats = beats.filter((beat) => beat.pattern_interrupt?.trim())
  const gapStarts = [0, ...patternBeats.map((beat) => beat.start_seconds), input.expected_duration_seconds]
  const maxPatternGap = Math.max(...gapStarts.slice(1).map((time, index) => time - gapStarts[index]))
  const finalWindowStart = input.expected_duration_seconds * 0.82
  const firstConclusion = conclusions[0]
  const firstCta = ctas[0]

  const dimensions: ScriptDimensionEvaluation[] = [
    scoredDimension({
      key: 'first_30_seconds',
      score: Math.min(100, (hookBeats.some((beat) => beat.start_seconds < 8) ? 40 : 0) + (openLoops.some((beat) => beat.start_seconds < 30) ? 35 : 0) + (openingWords >= 45 && openingWords <= 95 ? 25 : 10)),
      formula: '40 points for a hook starting before 8s + 35 for an open loop before 30s + 25 for 45-95 spoken words in the opening.',
      observed: `${openingWords} words; ${hookBeats.filter((beat) => beat.start_seconds < 8).length} early hook(s); ${openLoops.filter((beat) => beat.start_seconds < 30).length} early loop(s).`,
      recovery: 'Move a concrete hook into the first 8 seconds and state the open promise before 30 seconds.',
      inputIds: opening.map((beat) => beat.id), frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'hook_promise_alignment', score: overlapScore(openingText, `${input.topic} ${input.promise}`),
      formula: 'Shared meaningful opening/promise tokens / smaller meaningful-token set x 100.',
      observed: `Opening-to-promise token overlap is ${overlapScore(openingText, `${input.topic} ${input.promise}`)}%.`,
      recovery: 'Rewrite the hook so it names the same topic and practical outcome promised by the video.',
      inputIds: [...opening.map((beat) => beat.id), 'input:promise', 'input:topic'], frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'open_loops', score: openLoops.length ? Math.min(100, 60 + (payoff.length ? 40 : 0)) : 0,
      formula: '60 points for at least one explicit open-loop beat + 40 when a payoff beat is present.',
      observed: `${openLoops.length} open loop(s); ${payoff.length} payoff beat(s).`,
      recovery: 'Add one explicit question or promised reveal and map it to a later payoff beat.',
      inputIds: [...openLoops, ...payoff].map((beat) => beat.id), frameworkRuleIds: ['rule-hook-promise-contract'],
    }),
    scoredDimension({
      key: 'rehooks', score: input.expected_duration_seconds < 360 ? (rehooks.length >= 1 ? 100 : 40) : Math.min(100, Math.round((rehooks.length / Math.max(1, Math.floor(input.expected_duration_seconds / 180))) * 100)),
      formula: 'Required re-hooks = max(1, floor(duration / 180s)); score = observed / required x 100.',
      observed: `${rehooks.length} re-hook(s) across ${Math.round(input.expected_duration_seconds)} seconds.`,
      recovery: 'Add a fresh tension, question, or consequence about every three minutes.',
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
      key: 'pacing', score: wordsPerMinute >= 115 && wordsPerMinute <= 175 ? 100 : wordsPerMinute >= 95 && wordsPerMinute <= 195 ? 70 : 35,
      formula: '100 for 115-175 WPM; 70 for 95-195 WPM; 35 outside that band.',
      observed: `${wordCount} words / ${durationMinutes.toFixed(1)} minutes = ${Math.round(wordsPerMinute)} WPM.`,
      recovery: 'Tighten or expand spoken copy so the delivery stays readable without rushing.',
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
      key: 'delivered_cta', score: firstCta && firstConclusion && firstCta.start_seconds > firstConclusion.start_seconds && firstCta.end_seconds >= input.expected_duration_seconds * 0.9 ? 100 : firstCta ? 50 : 0,
      formula: '100 when the CTA follows the conclusion and ends in the final 10% of the video; 50 when present elsewhere; 0 when absent.',
      observed: firstCta ? `CTA spans ${firstCta.start_seconds}-${firstCta.end_seconds}s.` : 'No delivered CTA is mapped.',
      recovery: 'Place one bounded spoken CTA after the conclusion and inside the final 10% of the script.',
      inputIds: [...conclusions, ...ctas].map((beat) => beat.id), frameworkRuleIds: ['rule-value-before-cta'],
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
    dimensions,
    blockers,
    deterministic_inputs: {
      script_id: input.script_id,
      script_version: input.script_version,
      evaluated_at: input.evaluated_at,
      expected_duration_seconds: input.expected_duration_seconds,
      beat_ids: beats.map((beat) => beat.id),
      topic_source_ids: input.topic_outlier_evidence.map((source) => source.id).sort(),
      framework_rule_ids: [...input.framework_rule_ids].sort(),
    },
  }
}

function readyBeats(): LongFormScriptBeat[] {
  const beat = (id: string, start: number, end: number, role: LongFormScriptBeat['role'], text: string): LongFormScriptBeat => ({
    id, start_seconds: start, end_seconds: end, role, text,
    broll_cue: role === 'cta' || role === 'conclusion' ? null : `Owned Portfolio workflow for ${id}`,
    pattern_interrupt: role === 'cta' || role === 'conclusion' ? null : `On-screen chapter change for ${id}`,
  })
  return [
    beat('beat-hook', 0, 7, 'hook', 'Most teams do not have a content problem. They have a proof problem that makes every YouTube script feel generic, even when the underlying work deserves attention.'),
    beat('beat-loop', 7, 25, 'open_loop', 'By the end, you will see how a receipt-backed script turns current topic evidence into a clear proof-led review. You will also see the exact checks that stop weak evidence from reaching approval.'),
    beat('beat-frame', 25, 40, 'frame', 'Start with the viewer problem, bind the promise to current evidence, and show the operating system behind the claim. That keeps the story useful instead of borrowing confidence from another creator.'),
    beat('beat-proof', 40, 60, 'proof', 'This Portfolio review shows the exact source receipt, freshness window, input fingerprint, and reason each decision passed. The screen is the proof: every score opens into its formula, inputs, source ids, and recovery path.'),
    beat('beat-teaching-1', 60, 85, 'teaching', 'The first check asks whether the opening makes the same promise the body will deliver and whether proof appears beside the claim. It also checks the first thirty seconds for a real hook, an open loop, and enough spoken substance to orient the viewer.'),
    beat('beat-rehook-1', 85, 100, 'rehook', 'But a strong opening can still fail if the middle loses the question that brought the viewer here. That is where the re-hook earns its place: it renews the tension without changing the subject.'),
    beat('beat-teaching-2', 100, 125, 'teaching', 'Re-hooks reset the tension. Pattern interrupts change the visual without changing the subject. B-roll clarifies the spoken point. None of those cues count merely because they exist; each cue must connect to the idea, artifact, or decision being explained.'),
    beat('beat-payoff', 125, 145, 'payoff', 'The payoff is a clear proof-led review built from current topic evidence. The result is a reviewable script with visible decisions and a practical next action, written in Vambah voice without copying another creator.'),
    beat('beat-rehook-2', 145, 150, 'rehook', 'The final test is simple: did the script deliver the exact proof-led review promised in the opening, or did it drift into claims the evidence cannot carry?'),
    beat('beat-conclusion', 150, 165, 'conclusion', 'A durable YouTube workflow does not guess its way to approval. It shows the evidence, the decision, the limitation, and the boundary. That is how useful content earns trust before any provider or publishing gate opens.'),
    beat('beat-cta', 165, 180, 'cta', 'Open the source trace, inspect one decision, and send the script back if the proof does not hold. If the evidence and payoff match, move only to the separate render-readiness review.'),
  ]
}

export function longFormScriptQaFixture(state: 'ready' | 'stale' | 'missing' | 'originality_blocked' = 'ready'): LongFormScriptReviewInput {
  const evidence = [
    { id: 'topic-1', label: 'Current proof-led workflow comparison', ratio: 2.4 },
    { id: 'topic-2', label: 'Current evidence-backed content comparison', ratio: 1.2 },
    { id: 'topic-3', label: 'Current YouTube script review comparison', ratio: 1.8 },
  ].map((item, index): TopicOutlierEvidence => ({
    id: item.id,
    label: item.label,
    source_url: `https://example.com/public-topic-evidence/${item.id}`,
    creator: `Public creator ${index + 1}`,
    topic: 'proof led YouTube script workflow',
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
    topic: 'proof led YouTube script workflow',
    promise: 'a clear proof led review built from current topic evidence',
    evaluated_at: '2026-10-18T23:30:00.000Z',
    expected_duration_seconds: 180,
    beats: readyBeats(),
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
