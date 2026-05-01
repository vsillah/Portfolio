export const MEDIA_GENERATION_PROVIDERS = [
  'fal',
  'replicate',
  'openrouter',
  'direct_provider',
] as const

export type MediaGenerationProvider = (typeof MEDIA_GENERATION_PROVIDERS)[number]

export type MediaGenerationMode =
  | 'image'
  | 'image_edit'
  | 'text_to_video'
  | 'image_to_video'
  | 'avatar_video'
  | 'campaign_media'

export type MediaGenerationPriority =
  | 'quality'
  | 'speed'
  | 'cost'
  | 'brand_control'
  | 'production_reliability'

export type MediaGenerationDecision =
  | 'promote_to_default'
  | 'pilot_with_guardrails'
  | 'keep_as_specialist'
  | 'sandbox_only'
  | 'reject_for_current_workflow'

export interface MediaGenerationBakeoffInput {
  title: string
  useCase: string
  mode: MediaGenerationMode
  priority: MediaGenerationPriority
  requiredAspectRatios?: string[]
  referenceAssets?: string[]
  prompts?: string[]
  currentDefaultProvider?: MediaGenerationProvider
  needsBatchGeneration?: boolean
  needsApiInstallPath?: boolean
  needsHumanApproval?: boolean
  needsBrandConsistency?: boolean
  needsVideoAudio?: boolean
  requiresFirstPartyFeatures?: boolean
  maxAcceptableLatencySeconds?: number
  maxAcceptableCostUsd?: number
}

export interface MediaGenerationScore {
  dimension: string
  score: number
  weight: number
  weightedScore: number
  evidence: string
}

export interface MediaGenerationCandidate {
  provider: MediaGenerationProvider
  label: string
  role: string
  bestFor: string
  watchOutFor: string
  playgroundPlan: string[]
  modelDiscoveryPlan: string[]
  installPlan: string[]
  scores: MediaGenerationScore[]
  totalScore: number
  decision: MediaGenerationDecision
  decisionLabel: string
}

export interface MediaGenerationBakeoffPlan {
  generatedAt: string
  title: string
  useCase: string
  mode: MediaGenerationMode
  recommendedProvider: MediaGenerationProvider
  recommendedLabel: string
  recommendation: string
  scoringMethodology: string[]
  benchmarkRunbook: string[]
  promotionGate: string[]
  portfolioIntegrationPlan: string[]
  candidates: MediaGenerationCandidate[]
}

const PROVIDER_LABELS: Record<MediaGenerationProvider, string> = {
  fal: 'fal media model gallery',
  replicate: 'Replicate model API',
  openrouter: 'OpenRouter image gateway',
  direct_provider: 'Direct model provider',
}

const PROVIDER_ROLES: Record<MediaGenerationProvider, string> = {
  fal: 'Primary playground and aggregator for image, video, audio, and 3D media models',
  replicate: 'Broad API fallback for hosted open and partner models',
  openrouter: 'Unified gateway when image generation should sit beside text model routing',
  direct_provider: 'Specialist path for a model that outperforms aggregators or needs first-party features',
}

const PROVIDER_STRENGTHS: Record<MediaGenerationProvider, string> = {
  fal: 'Fast media experimentation, public model pages, playgrounds, generated code samples, latency visibility, and broad media coverage.',
  replicate: 'Simple API runs, strong model catalog, useful for comparing open and partner models without owning infrastructure.',
  openrouter: 'Good fit when image-capable models need the same routing surface as text models and model discovery should be API-driven.',
  direct_provider: 'Best when a first-party provider exposes capabilities, rights, controls, or reliability the aggregators do not carry yet.',
}

const PROVIDER_RISKS: Record<MediaGenerationProvider, string> = {
  fal: 'Model availability and schemas vary by model, so production selection needs stored model ids and per-model run records.',
  replicate: 'Latency, pricing, licensing, and output quality can vary widely across individual models.',
  openrouter: 'Currently stronger for image routing than full video generation, so it should not be the only media provider.',
  direct_provider: 'Locks the app into a provider-specific API and makes future comparisons harder unless wrapped behind a common interface.',
}

const SCORE_WEIGHTS = {
  output_quality: 0.22,
  prompt_and_reference_fidelity: 0.16,
  speed_and_throughput: 0.14,
  cost_control: 0.1,
  brand_and_text_control: 0.12,
  workflow_fit: 0.1,
  api_installability: 0.08,
  observability_and_provenance: 0.08,
} as const

type ScoreDimension = keyof typeof SCORE_WEIGHTS

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  output_quality: 'Output quality',
  prompt_and_reference_fidelity: 'Prompt and reference fidelity',
  speed_and_throughput: 'Speed and throughput',
  cost_control: 'Cost control',
  brand_and_text_control: 'Brand and text control',
  workflow_fit: 'Workflow fit',
  api_installability: 'API installability',
  observability_and_provenance: 'Observability and provenance',
}

const DECISION_LABELS: Record<MediaGenerationDecision, string> = {
  promote_to_default: 'Promote to default',
  pilot_with_guardrails: 'Pilot with guardrails',
  keep_as_specialist: 'Keep as specialist option',
  sandbox_only: 'Sandbox only',
  reject_for_current_workflow: 'Reject for current workflow',
}

function bounded(value: number): number {
  return Math.max(1, Math.min(5, value))
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean)
}

function modeLabel(mode: MediaGenerationMode): string {
  return mode.replaceAll('_', ' ')
}

function baseScore(provider: MediaGenerationProvider, dimension: ScoreDimension): number {
  const scores: Record<MediaGenerationProvider, Record<ScoreDimension, number>> = {
    fal: {
      output_quality: 4,
      prompt_and_reference_fidelity: 4,
      speed_and_throughput: 5,
      cost_control: 4,
      brand_and_text_control: 4,
      workflow_fit: 5,
      api_installability: 5,
      observability_and_provenance: 4,
    },
    replicate: {
      output_quality: 4,
      prompt_and_reference_fidelity: 4,
      speed_and_throughput: 3,
      cost_control: 3,
      brand_and_text_control: 3,
      workflow_fit: 4,
      api_installability: 5,
      observability_and_provenance: 4,
    },
    openrouter: {
      output_quality: 4,
      prompt_and_reference_fidelity: 4,
      speed_and_throughput: 4,
      cost_control: 4,
      brand_and_text_control: 4,
      workflow_fit: 4,
      api_installability: 4,
      observability_and_provenance: 4,
    },
    direct_provider: {
      output_quality: 5,
      prompt_and_reference_fidelity: 5,
      speed_and_throughput: 3,
      cost_control: 2,
      brand_and_text_control: 5,
      workflow_fit: 3,
      api_installability: 3,
      observability_and_provenance: 3,
    },
  }
  return scores[provider][dimension]
}

function scoreAdjustment(
  provider: MediaGenerationProvider,
  dimension: ScoreDimension,
  input: MediaGenerationBakeoffInput
): number {
  let adjustment = 0

  if (input.mode === 'text_to_video' || input.mode === 'image_to_video' || input.mode === 'campaign_media') {
    if (provider === 'fal' && dimension === 'workflow_fit') adjustment += 1
    if (provider === 'openrouter' && dimension === 'workflow_fit') adjustment -= 2
  }

  if (input.mode === 'image' || input.mode === 'image_edit') {
    if (provider === 'openrouter' && dimension === 'workflow_fit') adjustment += 1
  }

  if (input.priority === 'speed' && provider === 'fal' && dimension === 'speed_and_throughput') adjustment += 1
  if (input.priority === 'quality' && provider === 'direct_provider' && dimension === 'output_quality') adjustment += 1
  if (input.priority === 'cost' && provider === 'direct_provider' && dimension === 'cost_control') adjustment -= 1
  if (input.priority === 'brand_control' && provider === 'direct_provider' && dimension === 'brand_and_text_control') adjustment += 1

  if (input.needsBatchGeneration && provider === 'fal' && dimension === 'speed_and_throughput') adjustment += 1
  if (input.needsBatchGeneration && provider === 'direct_provider' && dimension === 'workflow_fit') adjustment -= 1

  if (input.needsApiInstallPath && provider !== 'direct_provider' && dimension === 'api_installability') adjustment += 1
  if (input.needsBrandConsistency && dimension === 'brand_and_text_control') {
    if (provider === 'fal' || provider === 'direct_provider') adjustment += 1
    if (provider === 'replicate') adjustment -= 1
  }

  if (input.needsVideoAudio) {
    if (provider === 'fal' && dimension === 'workflow_fit') adjustment += 1
    if (provider === 'openrouter' && dimension === 'workflow_fit') adjustment -= 1
  }

  if (input.requiresFirstPartyFeatures) {
    if (provider === 'direct_provider' && dimension === 'output_quality') adjustment += 1
    if (provider === 'direct_provider' && dimension === 'prompt_and_reference_fidelity') adjustment += 1
    if (provider === 'direct_provider' && dimension === 'workflow_fit') adjustment += 1
    if (provider !== 'direct_provider' && dimension === 'output_quality') adjustment -= 1
    if (provider !== 'direct_provider' && dimension === 'prompt_and_reference_fidelity') adjustment -= 1
    if (provider !== 'direct_provider' && dimension === 'workflow_fit') adjustment -= 1
  }

  if (input.currentDefaultProvider === provider && dimension === 'workflow_fit') adjustment += 1

  return adjustment
}

function scoreEvidence(
  provider: MediaGenerationProvider,
  dimension: ScoreDimension,
  score: number,
  input: MediaGenerationBakeoffInput
): string {
  if (dimension === 'speed_and_throughput') {
    const latency = input.maxAcceptableLatencySeconds
      ? `Target return time is ${input.maxAcceptableLatencySeconds}s or less.`
      : 'Measure p50 and p90 return time for every prompt.'
    return `${PROVIDER_LABELS[provider]} should be judged on real run timing, queue behavior, and retry cost. ${latency}`
  }

  if (dimension === 'cost_control') {
    const cost = input.maxAcceptableCostUsd
      ? `Target cost is $${input.maxAcceptableCostUsd.toFixed(2)} or less per accepted asset.`
      : 'Track cost per run and cost per accepted asset.'
    return `${PROVIDER_LABELS[provider]} needs run-level cost tracking. ${cost}`
  }

  if (dimension === 'prompt_and_reference_fidelity') {
    return `${PROVIDER_LABELS[provider]} is scored against whether it follows the same prompt, reference assets, aspect ratios, and negative constraints.`
  }

  if (dimension === 'observability_and_provenance') {
    return `${PROVIDER_LABELS[provider]} must return enough metadata to save provider, model id, prompt version, seed or settings when available, latency, cost, and output URLs.`
  }

  return score >= 4
    ? `${PROVIDER_LABELS[provider]} is a strong fit for ${DIMENSION_LABELS[dimension].toLowerCase()}.`
    : `${PROVIDER_LABELS[provider]} needs extra validation for ${DIMENSION_LABELS[dimension].toLowerCase()}.`
}

function buildScores(
  provider: MediaGenerationProvider,
  input: MediaGenerationBakeoffInput
): MediaGenerationScore[] {
  return (Object.keys(SCORE_WEIGHTS) as ScoreDimension[]).map((dimension) => {
    const score = bounded(baseScore(provider, dimension) + scoreAdjustment(provider, dimension, input))
    const weight = SCORE_WEIGHTS[dimension]
    return {
      dimension: DIMENSION_LABELS[dimension],
      score,
      weight,
      weightedScore: Number((score * weight).toFixed(2)),
      evidence: scoreEvidence(provider, dimension, score, input),
    }
  })
}

function decisionFor(totalScore: number, provider: MediaGenerationProvider, input: MediaGenerationBakeoffInput): MediaGenerationDecision {
  if (provider === 'openrouter' && (input.mode === 'text_to_video' || input.mode === 'image_to_video')) {
    return totalScore >= 3.6 ? 'keep_as_specialist' : 'sandbox_only'
  }
  if (totalScore >= 4.35) return 'promote_to_default'
  if (totalScore >= 3.8) return 'pilot_with_guardrails'
  if (totalScore >= 3.3) return 'keep_as_specialist'
  if (totalScore >= 2.7) return 'sandbox_only'
  return 'reject_for_current_workflow'
}

function buildPlaygroundPlan(provider: MediaGenerationProvider, input: MediaGenerationBakeoffInput): string[] {
  const prompts = cleanList(input.prompts)
  const promptCount = prompts.length > 0 ? prompts.length : 3
  const ratios = cleanList(input.requiredAspectRatios)

  return [
    `Run ${promptCount} shared ${modeLabel(input.mode)} prompt${promptCount === 1 ? '' : 's'} through the provider playground or API.`,
    ratios.length > 0
      ? `Test required aspect ratios: ${ratios.join(', ')}.`
      : 'Test 1:1, 16:9, and 9:16 unless the campaign has a narrower format need.',
    'Save every output with provider, model id, prompt version, settings, latency, cost, and reviewer notes.',
    input.needsHumanApproval
      ? 'Require human approval before any output becomes the selected production generator.'
      : 'Keep human review available even if the first run is automated.',
  ]
}

function buildModelDiscoveryPlan(provider: MediaGenerationProvider, input: MediaGenerationBakeoffInput): string[] {
  if (provider === 'fal') {
    return [
      'Use fal model gallery and Sandbox to compare current image, video, audio, and 3D models against the same prompt set.',
      'Prioritize models with visible pricing, average latency, API schema, and code examples.',
      input.needsVideoAudio ? 'Include video models with native audio support in the shortlist.' : 'Separate silent video quality from audio or voiceover needs.',
    ]
  }

  if (provider === 'replicate') {
    return [
      'Use Replicate playground and model pages to identify strong open or partner models for the use case.',
      'Check model license, run count, examples, expected latency, and input/output schema before scoring.',
      'Keep Replicate as a fallback or specialist path when a model is better there than on the primary aggregator.',
    ]
  }

  if (provider === 'openrouter') {
    return [
      'Query image-capable models through OpenRouter model discovery before running tests.',
      'Use it for image generation or edits where text and image routing should share one gateway.',
      'Avoid treating OpenRouter as the video default until the required video models are exposed with usable generation APIs.',
    ]
  }

  return [
    'Use first-party model documentation when the required capability is missing, newer, or stronger outside aggregators.',
    'Record any provider-specific settings that must be wrapped before Portfolio can switch models cleanly.',
    'Only promote direct integration if the quality lift justifies extra lock-in and maintenance.',
  ]
}

function buildInstallPlan(provider: MediaGenerationProvider): string[] {
  if (provider === 'fal') {
    return [
      'Add a FAL_API_KEY environment variable and a server-side provider adapter.',
      'Store selected model ids and per-run metadata in the media generation settings table.',
      'Expose the selected provider/model in the admin playground selector after the adapter smoke test passes.',
    ]
  }

  if (provider === 'replicate') {
    return [
      'Add a REPLICATE_API_TOKEN environment variable and a server-side provider adapter.',
      'Normalize prediction status, output URLs, cost estimates, and webhook callbacks into the shared run record.',
      'Expose Replicate models as specialist candidates unless they beat the default provider on the promotion gate.',
    ]
  }

  if (provider === 'openrouter') {
    return [
      'Add an OPENROUTER_API_KEY environment variable if one is not already available.',
      'Use model discovery to populate image-capable model choices and call the chat completions or responses endpoint with image modalities.',
      'Limit initial Portfolio selection to image generation or editing until video support matches the workflow requirements.',
    ]
  }

  return [
    'Add the provider-specific API key through the normal secret path.',
    'Wrap the first-party SDK behind the same Portfolio media provider interface.',
    'Require a bakeoff record and a clear first-party capability advantage before allowing the direct provider to become the default.',
  ]
}

function buildCandidate(
  provider: MediaGenerationProvider,
  input: MediaGenerationBakeoffInput
): MediaGenerationCandidate {
  const scores = buildScores(provider, input)
  const totalScore = Number(scores.reduce((sum, item) => sum + item.weightedScore, 0).toFixed(2))
  const decision = decisionFor(totalScore, provider, input)

  return {
    provider,
    label: PROVIDER_LABELS[provider],
    role: PROVIDER_ROLES[provider],
    bestFor: PROVIDER_STRENGTHS[provider],
    watchOutFor: PROVIDER_RISKS[provider],
    playgroundPlan: buildPlaygroundPlan(provider, input),
    modelDiscoveryPlan: buildModelDiscoveryPlan(provider, input),
    installPlan: buildInstallPlan(provider),
    scores,
    totalScore,
    decision,
    decisionLabel: DECISION_LABELS[decision],
  }
}

function buildBenchmarkRunbook(input: MediaGenerationBakeoffInput): string[] {
  const prompts = cleanList(input.prompts)
  const references = cleanList(input.referenceAssets)

  return [
    'Freeze one benchmark packet before testing: prompt text, references, aspect ratios, negative constraints, output count, and acceptance criteria.',
    prompts.length > 0
      ? `Use the supplied prompts as the initial benchmark set: ${prompts.join(' | ')}.`
      : 'Start with three prompts: one brand/social image, one product proof image, and one motion/video prompt.',
    references.length > 0
      ? `Use the same reference assets for every provider: ${references.join(', ')}.`
      : 'Use the same logo, brand palette, screenshot, or character reference for every provider when references are needed.',
    'Run each candidate at least three times per prompt so quality and latency are not judged from a lucky or unlucky single output.',
    'Score the accepted output, not the best-looking thumbnail alone: check prompt fidelity, format fit, usable text, artifacts, motion coherence, and edit burden.',
    'Record cost per run, cost per accepted asset, p50 latency, p90 latency, reviewer score, failure rate, and notes.',
  ]
}

function buildPromotionGate(input: MediaGenerationBakeoffInput): string[] {
  return [
    'A provider can become the selected Portfolio generator only if it scores at least 4.0 weighted total and does not fail output rights, privacy, or safety review.',
    'A model can become the default only after it beats the current default on the highest-priority dimension and stays within latency and cost limits.',
    input.needsHumanApproval
      ? 'Human approval remains required before generated media is published or attached to a client-facing artifact.'
      : 'Human review can be sampled for low-risk internal drafts, but client-facing publication still needs an approval path.',
    'If a new model wins, install it behind the provider adapter and keep the old default as a fallback until two successful production runs complete.',
    'Every production run must save provider, model id, prompt version, input asset ids, output URLs, latency, estimated cost, reviewer, and final status.',
  ]
}

function buildPortfolioIntegrationPlan(input: MediaGenerationBakeoffInput): string[] {
  return [
    'Add a shared media provider adapter with a common request shape for image, image edit, text-to-video, image-to-video, and avatar/video workflows.',
    'Add an admin playground that lets Portfolio run the same benchmark packet across installed providers and compare results side by side.',
    'Persist provider settings separately from run history so a winning model can be selected without losing prior bakeoff evidence.',
    'Expose the selected generator in the existing video/content admin workflow only after the adapter smoke test and promotion gate pass.',
    input.currentDefaultProvider
      ? `Keep ${PROVIDER_LABELS[input.currentDefaultProvider]} as the fallback until the new selected model proves itself.`
      : 'Keep the first integration as a pilot default with a manual fallback path.',
  ]
}

export function buildMediaGenerationBakeoffPlan(
  input: MediaGenerationBakeoffInput
): MediaGenerationBakeoffPlan {
  const candidates = MEDIA_GENERATION_PROVIDERS
    .map((provider) => buildCandidate(provider, input))
    .sort((a, b) => b.totalScore - a.totalScore)
  const winner = candidates[0]

  return {
    generatedAt: new Date().toISOString(),
    title: input.title,
    useCase: input.useCase,
    mode: input.mode,
    recommendedProvider: winner.provider,
    recommendedLabel: winner.label,
    recommendation: `${winner.label} is the strongest starting point for this ${modeLabel(input.mode)} workflow because it scores highest across quality, speed, workflow fit, installability, and provenance. Use the bakeoff result to select a model, then install it behind a Portfolio adapter instead of hard-coding the tool directly into the UI.`,
    scoringMethodology: [
      'Score every provider on a 1-5 scale, multiply by fixed weights, and rank by weighted total.',
      'Judge quality from repeated runs against the same benchmark packet, not from marketing samples or one lucky output.',
      'Separate provider selection from model selection: the provider may win the workflow while a specific model wins the creative job.',
      'Treat speed, cost, failure rate, and reviewer acceptance as first-class signals beside visual quality.',
      'Require provenance before promotion so the selected generator can be audited, replaced, or rolled back.',
    ],
    benchmarkRunbook: buildBenchmarkRunbook(input),
    promotionGate: buildPromotionGate(input),
    portfolioIntegrationPlan: buildPortfolioIntegrationPlan(input),
    candidates,
  }
}
