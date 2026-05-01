import {
  buildMediaGenerationBakeoffPlan,
  type MediaGenerationBakeoffInput,
} from './media-generation-bakeoff'
import {
  buildPresentationBakeoffPlan,
  type PresentationBakeoffInput,
} from './presentation-bakeoff'

export const TECHNOLOGY_BAKEOFF_SURFACES = [
  'media_generation',
  'presentations',
  'chat_diagnostic_models',
  'rag_retrieval',
  'social_content',
  'voice_avatar',
  'workflow_automation',
  'agent_runtimes',
  'email_outbound',
  'lead_enrichment',
  'pricing_roi',
  'testing_qa',
  'commerce',
  'analytics',
  'content_assets',
] as const

export type TechnologyBakeoffSurface = (typeof TECHNOLOGY_BAKEOFF_SURFACES)[number]

export type TechnologyBakeoffPriority =
  | 'quality'
  | 'speed'
  | 'cost'
  | 'reliability'
  | 'governance'
  | 'brand_control'
  | 'conversion'

export type TechnologyBakeoffDecision =
  | 'promote_to_default'
  | 'pilot_with_guardrails'
  | 'keep_current_default'
  | 'monitor_or_sandbox'
  | 'reject_for_now'

export interface TechnologyBakeoffInput {
  surface: TechnologyBakeoffSurface
  objective: string
  priority: TechnologyBakeoffPriority
  currentDefault?: string
  knownFailure?: string
  candidateOverrides?: string[]
}

export interface TechnologyBakeoffCandidate {
  id: string
  label: string
  role: string
  bestFor: string
  watchOutFor: string
}

export interface TechnologyBakeoffScore {
  dimension: string
  score: number
  weight: number
  weightedScore: number
  evidence: string
}

export interface TechnologyBakeoffPlan {
  generatedAt: string
  surface: TechnologyBakeoffSurface
  surfaceLabel: string
  objective: string
  priority: TechnologyBakeoffPriority
  decision: TechnologyBakeoffDecision
  recommendedAction: string
  currentDefault: string
  fallback: string
  candidates: TechnologyBakeoffCandidate[]
  scores: TechnologyBakeoffScore[]
  benchmarkRunbook: string[]
  promotionGate: string[]
  rollbackPlan: string[]
  integrationNotes: string[]
  missingEvidence: string[]
  nextImplementationStep: string
  specialistSource?: 'media_generation' | 'presentation' | 'agent_runtime'
}

type ScoreDimensionSeed = {
  dimension: string
  weight: number
  evidence: string
}

type SurfaceProfile = {
  surface: TechnologyBakeoffSurface
  label: string
  adminArea: string
  candidates: TechnologyBakeoffCandidate[]
  scoring: ScoreDimensionSeed[]
  fallback: string
  benchmarkFocus: string[]
  promotionGate: string[]
  rollbackPlan: string[]
  integrationNotes: string[]
  missingEvidence: string[]
}

const COMMON_PROMOTION_GATE = [
  'Do not change production defaults from a plan alone.',
  'Save the current default and fallback path before promoting a winner.',
  'Require human approval for public-facing, client-facing, outbound, or production-write behavior.',
]

export const TECHNOLOGY_BAKEOFF_PROFILES: Record<TechnologyBakeoffSurface, SurfaceProfile> = {
  media_generation: {
    surface: 'media_generation',
    label: 'Image and video generation',
    adminArea: '/admin/content/video-generation, social content, Gamma reports, media uploads',
    fallback: 'Keep the current video/social media generator and manual asset upload path.',
    candidates: [
      candidate('fal', 'fal media model gallery', 'Primary media aggregator', 'Image/video model discovery and fast media experimentation.', 'Model schemas and availability vary by model.'),
      candidate('replicate', 'Replicate model API', 'Hosted model fallback', 'Open and partner models with simple API runs.', 'Latency, pricing, and licensing vary widely.'),
      candidate('openrouter', 'OpenRouter image gateway', 'Image routing specialist', 'Image-capable model routing beside text routing.', 'Not the default for full video workflows.'),
      candidate('direct_provider', 'Direct provider', 'Specialist path', 'First-party features, rights, or quality that beat aggregators.', 'Higher lock-in and adapter maintenance.'),
    ],
    scoring: mediaScoring(),
    benchmarkFocus: [
      'Run the same prompt packet across image, image edit, text-to-video, and image-to-video candidates.',
      'Capture cost, latency, output URLs, model id, settings, reviewer score, and failure notes.',
    ],
    promotionGate: [
      ...COMMON_PROMOTION_GATE,
      'The selected model must pass the media generation promotion gate and keep the old default as fallback.',
    ],
    rollbackPlan: [
      'Keep the previous provider/model id in settings until two successful production runs complete.',
      'If generation fails, route the workflow back to manual upload or the previous provider.',
    ],
    integrationNotes: [
      'Use the existing media evaluator as the specialist source.',
      'Future live playground execution should sit behind a shared server-side media provider adapter.',
    ],
    missingEvidence: ['Real provider run latency', 'Cost per accepted asset', 'Reviewer acceptance rate'],
  },
  presentations: {
    surface: 'presentations',
    label: 'Presentation and deck production',
    adminArea: '/admin/presentations, /admin/reports/gamma, course and deck packages',
    fallback: 'Keep Codex/PPTX as the editable final packaging path.',
    candidates: [
      candidate('codex_pptx', 'Codex / PPTX build', 'Final packaging', 'Editable decks, source control, speaker notes, and QA.', 'Needs more setup than a hosted prompt.'),
      candidate('claude_design', 'Claude Design prototype', 'Visual exploration', 'High-polish layout and direction finding.', 'May need translation into final editable assets.'),
      candidate('gamma', 'Gamma AI deck', 'Fast alternate direction', 'Quick structure and visual alternatives.', 'Can weaken proof, voice, and editability.'),
      candidate('paper_excalidraw', 'Paper or Excalidraw', 'Structure and diagrams', 'Workshop flow, diagrams, and visual thinking.', 'Usually not the final presentation package.'),
    ],
    scoring: [
      scoreSeed('Clarity and narrative arc', 0.18, 'Audience can understand the argument and decision path.'),
      scoreSeed('Voice and brand fit', 0.18, 'The output sounds like Vambah and preserves AmaduTown visual rules.'),
      scoreSeed('Proof and source quality', 0.18, 'Screenshots, demos, and source anchors remain visible and reviewable.'),
      scoreSeed('Editability and export quality', 0.16, 'The final artifact can be revised and exported without rebuilding from scratch.'),
      scoreSeed('Presentation readiness', 0.16, 'Notes, timing, density, contrast, and backup assets are ready.'),
      scoreSeed('Production repeatability', 0.14, 'The workflow can be repeated for future courses or decks.'),
    ],
    benchmarkFocus: [
      'Use the same brief, thesis, proof assets, demo routes, and source anchors across candidates.',
      'Score the final deliverable and the edit path, not just surface polish.',
    ],
    promotionGate: [
      ...COMMON_PROMOTION_GATE,
      'The winning base must keep source guide, notes, screenshots, QA exports, and editable source files.',
    ],
    rollbackPlan: [
      'Keep the previous deck source and exported PDF as the fallback package.',
      'If a hosted tool loses editability, translate only the useful visual ideas into the Codex/PPTX base.',
    ],
    integrationNotes: [
      'Use the existing presentation evaluator as the specialist source.',
      'Keep generated decks connected to source registers and proof screenshots.',
    ],
    missingEvidence: ['Candidate exports', 'Speaker-note quality', 'Visual QA screenshots'],
  },
  chat_diagnostic_models: genericProfile(
    'chat_diagnostic_models',
    'Chat and diagnostic models',
    '/api/chat, /admin/chat-eval, /tools/audit, /api/chat/diagnostic',
    ['Hosted LLMs', 'Local RAG', 'Open-weight models', 'Model routers'],
    ['answer accuracy', 'source use', 'escalation quality', 'latency', 'cost', 'safety'],
    'Keep the current chat model and diagnostic routing until shadow tests improve chat eval scores.'
  ),
  rag_retrieval: genericProfile(
    'rag_retrieval',
    'RAG and knowledge retrieval',
    '/api/knowledge, lib/rag-query.ts, local RAG shadow mode, chatbot knowledge build',
    ['Supabase/Postgres retrieval', 'Local vector stores', 'Hosted vector DBs', 'Rerankers'],
    ['recall', 'precision', 'freshness', 'privacy', 'query latency', 'maintenance burden'],
    'Keep the existing retrieval path and chatbot knowledge build until shadow results beat saved test questions.'
  ),
  social_content: genericProfile(
    'social_content',
    'Social content generation',
    '/admin/social-content, n8n social workflows, LinkedIn review queue',
    ['Copy models', 'Image models', 'TTS', 'Scheduling tools', 'Publishing tools'],
    ['voice fit', 'approval burden', 'image quality', 'platform fit', 'rights', 'publish reliability'],
    'Keep the human review queue and current publishing path.'
  ),
  voice_avatar: genericProfile(
    'voice_avatar',
    'Voice and avatar video',
    'video generation, HeyGen webhooks, VAPI webhook, meeting follow-up content',
    ['HeyGen', 'ElevenLabs', 'Vapi', 'Avatar alternatives', 'Direct TTS providers'],
    ['voice quality', 'likeness control', 'webhook reliability', 'cost per minute', 'consent', 'approval'],
    'Keep the current HeyGen/VAPI path and manual review for public or client-facing output.'
  ),
  workflow_automation: genericProfile(
    'workflow_automation',
    'Workflow automation runtime',
    'n8n exports, /admin/agents, webhook routes, cron routes',
    ['n8n Cloud', 'Codex automations', 'Vercel cron', 'Supabase scheduled jobs', 'Local scripts'],
    ['observability', 'retries', 'cost', 'deploy friction', 'audit trail', 'rollback'],
    'Keep n8n Cloud as the default automation runtime unless a traceable replacement wins.'
  ),
  agent_runtimes: {
    surface: 'agent_runtimes',
    label: 'Agent runtimes',
    adminArea: '/admin/agents, Hermes bridge, OpenCode/OpenClaw evaluation',
    fallback: 'Keep Codex as primary and keep Hermes/OpenCode-style runtimes read-only or sandboxed.',
    candidates: [
      candidate('codex', 'Codex', 'Primary repo-aware operator', 'Implementation, review, and local workspace execution.', 'Needs trace discipline for long-running work.'),
      candidate('hermes', 'Hermes', 'Secondary local runtime', 'Critique, research, local health checks, and parity experiments.', 'Should stay read-only until write gates are proven.'),
      candidate('opencode', 'OpenCode/OpenClaw', 'Coding worker candidate', 'Isolated review and worktree experiments.', 'Must prove install, auth, rollback, and audit behavior.'),
      candidate('future_agent', 'Future coding agents', 'Watchlist', 'New runtimes with better specialization or cost.', 'No production writes without Agent Operations coverage.'),
    ],
    scoring: [
      scoreSeed('Repository performance', 0.2, 'Completes scoped repo tasks with tests and low review burden.'),
      scoreSeed('Auditability', 0.2, 'Creates observable runs, steps, artifacts, and decisions.'),
      scoreSeed('Permission control', 0.18, 'Supports safe read/write boundaries and approval gates.'),
      scoreSeed('Rollback and handoff quality', 0.18, 'Leaves branches, PRs, artifacts, and recovery paths clear.'),
      scoreSeed('Runtime availability', 0.14, 'Can be installed, authenticated, and probed without exposing secrets.'),
      scoreSeed('Cost and speed', 0.1, 'Improves throughput without increasing hidden risk.'),
    ],
    benchmarkFocus: [
      'Use Agent Operations to create observable read-only probes before assigning work.',
      'Compare runtimes on the same bounded repo task, then review traces, diffs, tests, and handoff quality.',
    ],
    promotionGate: [
      ...COMMON_PROMOTION_GATE,
      'A runtime must stay read-only or sandboxed until trace and approval behavior is proven.',
      'Production writes require agent_approvals coverage.',
    ],
    rollbackPlan: [
      'Stop assigning work to the runtime and close any unmerged branches or sandbox worktrees.',
      'Keep Codex as the fallback runtime for repo-aware implementation.',
    ],
    integrationNotes: [
      'Reuse the Agent Operations and runtime evaluation framing.',
      'Do not import filesystem runtime probes into client-side bakeoff UI.',
    ],
    missingEvidence: ['Observable test run', 'Auth and install status', 'Rollback drill result'],
  },
  email_outbound: genericProfile(
    'email_outbound',
    'Email and outbound messaging',
    '/admin/email-center, Gmail helpers, Resend webhook, proposal/email drafts',
    ['Gmail API', 'Resend', 'SMTP', 'n8n email nodes', 'Copy models'],
    ['deliverability', 'personalization', 'auditability', 'reply handling', 'approval burden'],
    'Keep traceable drafts and approval state before outbound sends.'
  ),
  lead_enrichment: genericProfile(
    'lead_enrichment',
    'Lead discovery and enrichment',
    'outreach dashboard, tech-stack lookup, warm lead workflows',
    ['Apify actors', 'BuiltWith', 'LinkedIn/Google sources', 'Enrichment APIs', 'Browser agents'],
    ['data quality', 'source reliability', 'cost per useful lead', 'compliance', 'duplicate rate'],
    'Keep current enrichment sources until a candidate improves qualified-lead yield without privacy risk.'
  ),
  pricing_roi: genericProfile(
    'pricing_roi',
    'Pricing, bundles, and ROI tools',
    '/admin/sales, /admin/cost-revenue, /pricing, ROI tools',
    ['Pricing models', 'Market data sources', 'Proposal generators', 'Analytics providers'],
    ['margin accuracy', 'offer clarity', 'conversion', 'source quality', 'update effort'],
    'Keep current pricing rules until changes validate against cost/revenue and proposal acceptance data.'
  ),
  testing_qa: genericProfile(
    'testing_qa',
    'Testing and QA automation',
    '/admin/testing, Playwright, API route tests, regression docs',
    ['Playwright', 'Browser Use', 'Synthetic monitors', 'Visual diff tools', 'LLM judges'],
    ['bug catch rate', 'false positives', 'speed', 'maintenance', 'screenshot evidence'],
    'Keep the current focused tests and admin testing dashboard until new QA catches known regressions.'
  ),
  commerce: genericProfile(
    'commerce',
    'Payments, fulfillment, and commerce',
    'checkout, Stripe routes, Printful webhook, store/services/products',
    ['Stripe features', 'Checkout UX tools', 'Fulfillment tools', 'Tax/shipping providers'],
    ['payment reliability', 'fulfillment accuracy', 'support burden', 'reconciliation'],
    'Keep Stripe/Printful defaults until test transactions and webhook traces pass.'
  ),
  analytics: genericProfile(
    'analytics',
    'Analytics and attribution',
    '/admin/analytics, funnel analytics, cost events, campaign pages',
    ['Vercel analytics', 'Custom events', 'PostHog', 'Supabase events', 'Warehouse tools'],
    ['event accuracy', 'funnel visibility', 'privacy', 'cost', 'operational usefulness'],
    'Keep current analytics until the candidate answers a decision the dashboard cannot answer.'
  ),
  content_assets: genericProfile(
    'content_assets',
    'Content and asset management',
    'Content Hub, uploads, publications, products, projects, Google Drive sync',
    ['Supabase Storage', 'Google Drive', 'Local staged assets', 'CMS tools', 'Asset CDNs'],
    ['provenance', 'speed', 'permissions', 'migration cost', 'public URL stability'],
    'Keep current asset locations until source register and rollback path exist.'
  ),
}

function candidate(id: string, label: string, role: string, bestFor: string, watchOutFor: string): TechnologyBakeoffCandidate {
  return { id, label, role, bestFor, watchOutFor }
}

function scoreSeed(dimension: string, weight: number, evidence: string): ScoreDimensionSeed {
  return { dimension, weight, evidence }
}

function mediaScoring(): ScoreDimensionSeed[] {
  return [
    scoreSeed('Output quality', 0.22, 'Visual quality, artifacts, realism or illustration quality, and motion coherence.'),
    scoreSeed('Prompt and reference fidelity', 0.16, 'Follows prompt, reference assets, aspect ratios, and negative constraints.'),
    scoreSeed('Speed and throughput', 0.14, 'Measures p50/p90 latency, queue behavior, and batch behavior.'),
    scoreSeed('Cost control', 0.1, 'Tracks cost per run and cost per accepted output.'),
    scoreSeed('Brand and text control', 0.12, 'Handles logos, text, color discipline, and product consistency.'),
    scoreSeed('Workflow fit', 0.1, 'Fits Portfolio media, video, social, b-roll, and admin review flows.'),
    scoreSeed('API installability', 0.08, 'Has a clear server-side adapter path.'),
    scoreSeed('Observability and provenance', 0.08, 'Returns model id, settings, latency, cost, output URLs, and reviewer notes.'),
  ]
}

function genericProfile(
  surface: TechnologyBakeoffSurface,
  label: string,
  adminArea: string,
  candidates: string[],
  dimensions: string[],
  fallback: string
): SurfaceProfile {
  const weight = Number((1 / dimensions.length).toFixed(2))
  return {
    surface,
    label,
    adminArea,
    fallback,
    candidates: candidates.map((name, index) => {
      const id = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      return candidate(
        id,
        name,
        index === 0 ? 'Current or primary candidate class' : 'Comparison candidate class',
        `Evaluate ${name} against the same benchmark packet.`,
        'Do not promote without run evidence, rollback path, and approval where needed.'
      )
    }),
    scoring: dimensions.map((dimension) => {
      return scoreSeed(titleCase(dimension), weight, `Score candidate performance on ${dimension}.`)
    }),
    benchmarkFocus: [
      'Use the same test inputs, constraints, and acceptance criteria for every candidate.',
      'Capture evidence, reviewer notes, cost, latency, failure modes, and operational burden.',
    ],
    promotionGate: [
      ...COMMON_PROMOTION_GATE,
      'The candidate must beat the current default on the highest-priority dimension without adding unacceptable operational risk.',
    ],
    rollbackPlan: [
      'Keep the current default active until the new candidate completes a pilot run.',
      'Restore the prior setting, route, or provider if failure rate, cost, or review burden rises.',
    ],
    integrationNotes: [
      `Use ${adminArea} as the operational context for evidence gathering.`,
      'Add a specialist evaluator later if this surface needs domain-specific scoring.',
    ],
    missingEvidence: ['Current baseline score', 'Candidate run evidence', 'Cost and latency notes', 'Reviewer or operator notes'],
  }
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function scoreFromPriority(dimension: string, priority: TechnologyBakeoffPriority, knownFailure?: string): number {
  const lower = dimension.toLowerCase()
  let score = 3
  if (priority === 'quality' && (lower.includes('quality') || lower.includes('accuracy') || lower.includes('precision'))) score += 1
  if (priority === 'speed' && (lower.includes('speed') || lower.includes('latency') || lower.includes('throughput'))) score += 1
  if (priority === 'cost' && (lower.includes('cost') || lower.includes('margin'))) score += 1
  if (priority === 'reliability' && (lower.includes('reliability') || lower.includes('failure') || lower.includes('webhook'))) score += 1
  if (priority === 'governance' && (lower.includes('approval') || lower.includes('privacy') || lower.includes('audit') || lower.includes('provenance'))) score += 1
  if (priority === 'brand_control' && (lower.includes('brand') || lower.includes('voice') || lower.includes('text'))) score += 1
  if (priority === 'conversion' && (lower.includes('conversion') || lower.includes('offer') || lower.includes('funnel'))) score += 1
  if (knownFailure && lower.includes('reliability')) score -= 1
  return Math.max(1, Math.min(5, score))
}

function buildScores(profile: SurfaceProfile, input: TechnologyBakeoffInput): TechnologyBakeoffScore[] {
  return profile.scoring.map((seed) => {
    const score = scoreFromPriority(seed.dimension, input.priority, input.knownFailure)
    return {
      dimension: seed.dimension,
      score,
      weight: seed.weight,
      weightedScore: Number((score * seed.weight).toFixed(2)),
      evidence: seed.evidence,
    }
  })
}

function genericDecision(scores: TechnologyBakeoffScore[], knownFailure?: string): TechnologyBakeoffDecision {
  if (knownFailure) return 'pilot_with_guardrails'
  const total = scores.reduce((sum, score) => sum + score.weightedScore, 0)
  if (total >= 4.2) return 'promote_to_default'
  if (total >= 3.4) return 'pilot_with_guardrails'
  if (total >= 2.8) return 'monitor_or_sandbox'
  return 'keep_current_default'
}

function decisionLabel(decision: TechnologyBakeoffDecision): string {
  const labels: Record<TechnologyBakeoffDecision, string> = {
    promote_to_default: 'Promote only after evidence review',
    pilot_with_guardrails: 'Pilot with guardrails',
    keep_current_default: 'Keep current default',
    monitor_or_sandbox: 'Monitor or sandbox',
    reject_for_now: 'Reject for now',
  }
  return labels[decision]
}

function applyCandidateOverrides(
  profile: SurfaceProfile,
  overrides: string[] | undefined
): TechnologyBakeoffCandidate[] {
  const overrideCandidates = (overrides ?? []).map((name) => name.trim()).filter(Boolean)
  if (overrideCandidates.length === 0) return profile.candidates

  const generated = overrideCandidates.map((name) => {
    const id = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    return candidate(id, name, 'User-supplied candidate', `Evaluate ${name} for this specific bakeoff objective.`, 'Needs the same evidence packet as built-in candidates.')
  })
  return [...generated, ...profile.candidates]
}

function buildSpecialistMediaPlan(input: TechnologyBakeoffInput, profile: SurfaceProfile): Partial<TechnologyBakeoffPlan> {
  const mediaInput: MediaGenerationBakeoffInput = {
    title: input.objective,
    useCase: input.objective,
    mode: 'campaign_media',
    priority: input.priority === 'speed'
      ? 'speed'
      : input.priority === 'cost'
        ? 'cost'
        : input.priority === 'brand_control'
          ? 'brand_control'
          : input.priority === 'quality'
            ? 'quality'
            : 'production_reliability',
    currentDefaultProvider: undefined,
    needsBatchGeneration: true,
    needsApiInstallPath: true,
    needsHumanApproval: true,
    needsBrandConsistency: true,
    needsVideoAudio: true,
  }
  const plan = buildMediaGenerationBakeoffPlan(mediaInput)
  return {
    decision: plan.candidates[0]?.decision === 'promote_to_default' ? 'pilot_with_guardrails' : 'monitor_or_sandbox',
    recommendedAction: `${plan.recommendedLabel}: ${plan.recommendation}`,
    candidates: plan.candidates.map((item) => ({
      id: item.provider,
      label: item.label,
      role: item.role,
      bestFor: item.bestFor,
      watchOutFor: item.watchOutFor,
    })),
    scores: plan.candidates[0]?.scores.map((score) => ({
      dimension: score.dimension,
      score: score.score,
      weight: score.weight,
      weightedScore: score.weightedScore,
      evidence: score.evidence,
    })) ?? buildScores(profile, input),
    benchmarkRunbook: plan.benchmarkRunbook,
    promotionGate: plan.promotionGate,
    integrationNotes: plan.portfolioIntegrationPlan,
    specialistSource: 'media_generation',
  }
}

function buildSpecialistPresentationPlan(input: TechnologyBakeoffInput, profile: SurfaceProfile): Partial<TechnologyBakeoffPlan> {
  const presentationInput: PresentationBakeoffInput = {
    title: input.objective,
    thesis: input.objective,
    audience: 'clients',
    format: 'thought_leadership',
    durationMinutes: 30,
    brandSystem: 'amadutown',
    needsEditablePptx: true,
    needsLiveDemos: true,
    needsSourceValidation: true,
    needsFacilitatorNotes: true,
  }
  const plan = buildPresentationBakeoffPlan(presentationInput)
  return {
    decision: 'pilot_with_guardrails',
    recommendedAction: `${plan.recommendedLabel}: ${plan.recommendation}`,
    candidates: plan.candidates.map((item) => ({
      id: item.tool,
      label: item.label,
      role: item.role,
      bestFor: item.bestFor,
      watchOutFor: item.watchOutFor,
    })),
    scores: plan.candidates[0]?.scores.map((score) => ({
      dimension: score.dimension,
      score: score.score,
      weight: score.weight,
      weightedScore: score.weightedScore,
      evidence: score.rationale,
    })) ?? buildScores(profile, input),
    benchmarkRunbook: plan.coursePlan,
    promotionGate: plan.qaChecklist,
    integrationNotes: plan.requiredAssets,
    specialistSource: 'presentation',
  }
}

function specialistPlan(input: TechnologyBakeoffInput, profile: SurfaceProfile): Partial<TechnologyBakeoffPlan> {
  if (input.surface === 'media_generation') return buildSpecialistMediaPlan(input, profile)
  if (input.surface === 'presentations') return buildSpecialistPresentationPlan(input, profile)
  if (input.surface === 'agent_runtimes') {
    return {
      decision: 'monitor_or_sandbox',
      recommendedAction: 'Use Agent Operations to probe runtime availability, then run a read-only task before any production work.',
      specialistSource: 'agent_runtime',
    }
  }
  return {}
}

export function buildTechnologyBakeoffPlan(input: TechnologyBakeoffInput): TechnologyBakeoffPlan {
  const profile = TECHNOLOGY_BAKEOFF_PROFILES[input.surface]
  if (!profile) {
    throw new Error(`Unsupported technology bakeoff surface: ${String(input.surface)}`)
  }

  const scores = buildScores(profile, input)
  const decision = genericDecision(scores, input.knownFailure)
  const specialist = specialistPlan(input, profile)
  const candidates = specialist.candidates ?? applyCandidateOverrides(profile, input.candidateOverrides)
  const currentDefault = input.currentDefault?.trim() || 'Current Portfolio default'

  return {
    generatedAt: new Date().toISOString(),
    surface: input.surface,
    surfaceLabel: profile.label,
    objective: input.objective,
    priority: input.priority,
    decision: specialist.decision ?? decision,
    recommendedAction: specialist.recommendedAction
      ?? `${decisionLabel(decision)} for ${profile.label}. Run the bakeoff packet before changing ${currentDefault}.`,
    currentDefault,
    fallback: profile.fallback,
    candidates,
    scores: specialist.scores ?? scores,
    benchmarkRunbook: [
      `Decision question: ${input.objective}`,
      `Current default: ${currentDefault}`,
      ...(input.knownFailure ? [`Known failure to test against: ${input.knownFailure}`] : []),
      ...((specialist.benchmarkRunbook ?? profile.benchmarkFocus)),
    ],
    promotionGate: specialist.promotionGate ?? profile.promotionGate,
    rollbackPlan: profile.rollbackPlan,
    integrationNotes: specialist.integrationNotes ?? profile.integrationNotes,
    missingEvidence: profile.missingEvidence,
    nextImplementationStep: `Create a small evidence packet for ${profile.label} in ${profile.adminArea}, then compare candidates with the scoring plan.`,
    specialistSource: specialist.specialistSource,
  }
}
