import { createHash } from 'node:crypto'
import {
  mergeClientStack,
  type ClientStackSources,
  type ClientStackSource,
} from './implementation-feasibility'

export const AI_LAYER_DIMENSIONS = [
  'existing_tool_fit',
  'openness_and_buildability',
  'data_and_context_access',
  'ecosystem_and_durability',
  'stackability_and_routing',
] as const

export type AiLayerDimension = (typeof AI_LAYER_DIMENSIONS)[number]

export type AiLayerCategory =
  | 'embedded_platform_ai'
  | 'enterprise_data_layer'
  | 'workflow_agent'
  | 'direct_model_product'
  | 'coding_agent'
  | 'research_worker'
  | 'internal_orchestration'

export type AiLayerDecision =
  | 'prioritize_for_implementation_planning'
  | 'pilot_with_specific_workflow'
  | 'monitor_or_sandbox'
  | 'reject_for_current_context'
  | 'reserve_for_technical_team_evaluation'

export interface AiLayerFitScore {
  dimension: AiLayerDimension
  label: string
  score: number
  weight: number
  weightedScore: number
  evidence: string
}

export interface AiLayerCandidate {
  layer: AiLayerCategory
  label: string
  fitHypothesis: string
}

export interface AiLayerFitEvaluation {
  generated_at: string
  inputs_hash: string
  client_stack_source: ClientStackSource
  detected_stack: string[]
  workflow_signals: string[]
  recommended_layer: AiLayerCategory
  recommended_layer_label: string
  candidate_layers: AiLayerCandidate[]
  scores: AiLayerFitScore[]
  weighted_total: number
  decision: AiLayerDecision
  decision_label: string
  routing_summary: string
  pilot_recommendation: string
  open_questions: string[]
}

export interface BuildAiLayerFitInput {
  clientStack: ClientStackSources
  workflowSignals?: string[]
  dataSensitivity?: string[]
  governanceNotes?: string[]
}

const WEIGHTS: Record<AiLayerDimension, number> = {
  existing_tool_fit: 0.2,
  openness_and_buildability: 0.2,
  data_and_context_access: 0.25,
  ecosystem_and_durability: 0.15,
  stackability_and_routing: 0.2,
}

const DIMENSION_LABELS: Record<AiLayerDimension, string> = {
  existing_tool_fit: 'Existing-tool fit',
  openness_and_buildability: 'Openness and buildability',
  data_and_context_access: 'Data and context access',
  ecosystem_and_durability: 'Ecosystem and durability',
  stackability_and_routing: 'Stackability and routing',
}

const LAYER_LABELS: Record<AiLayerCategory, string> = {
  embedded_platform_ai: 'Embedded platform AI',
  enterprise_data_layer: 'Enterprise data layer',
  workflow_agent: 'Workflow agent',
  direct_model_product: 'Direct model product',
  coding_agent: 'Coding agent',
  research_worker: 'Research worker',
  internal_orchestration: 'Internal orchestration',
}

const DECISION_LABELS: Record<AiLayerDecision, string> = {
  prioritize_for_implementation_planning: 'Prioritize for implementation planning',
  pilot_with_specific_workflow: 'Pilot with a specific workflow',
  monitor_or_sandbox: 'Monitor or sandbox',
  reject_for_current_context: 'Reject for current context',
  reserve_for_technical_team_evaluation: 'Reserve for technical team evaluation',
}

function hasAny(haystack: string[], needles: string[]): boolean {
  return haystack.some((value) => needles.some((needle) => value.includes(needle)))
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function score(dimension: AiLayerDimension, value: number, evidence: string): AiLayerFitScore {
  const bounded = Math.max(1, Math.min(5, value))
  const weight = WEIGHTS[dimension]
  return {
    dimension,
    label: DIMENSION_LABELS[dimension],
    score: bounded,
    weight,
    weightedScore: Number((bounded * weight).toFixed(2)),
    evidence,
  }
}

function decisionFor(total: number, layer: AiLayerCategory): AiLayerDecision {
  if (layer === 'coding_agent') return 'reserve_for_technical_team_evaluation'
  if (total >= 4.2) return 'prioritize_for_implementation_planning'
  if (total >= 3.5) return 'pilot_with_specific_workflow'
  if (total >= 2.8) return 'monitor_or_sandbox'
  return 'reject_for_current_context'
}

function hashInput(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16)
}

function inferCandidates(stackNames: string[], workflowSignals: string[]): AiLayerCandidate[] {
  const lowerStack = stackNames.map((s) => s.toLowerCase())
  const lowerSignals = workflowSignals.map((s) => s.toLowerCase())
  const candidates: AiLayerCandidate[] = []

  if (hasAny(lowerStack, ['microsoft', 'office 365', 'sharepoint', 'teams', 'outlook', 'excel'])) {
    candidates.push({
      layer: 'embedded_platform_ai',
      label: LAYER_LABELS.embedded_platform_ai,
      fitHypothesis: 'Microsoft-native work should be tested where files, meetings, email, identity, and permissions already live.',
    })
  }

  if (hasAny(lowerStack, ['google workspace', 'gmail', 'google drive', 'google docs', 'google sheets'])) {
    candidates.push({
      layer: 'embedded_platform_ai',
      label: LAYER_LABELS.embedded_platform_ai,
      fitHypothesis: 'Google-native work should be tested inside the Google graph before moving work elsewhere.',
    })
  }

  if (hasAny(lowerStack, ['salesforce', 'hubspot', 'crm', 'service now', 'servicenow'])) {
    candidates.push({
      layer: 'enterprise_data_layer',
      label: LAYER_LABELS.enterprise_data_layer,
      fitHypothesis: 'The system of record should control customer, pipeline, service, or member workflows.',
    })
  }

  if (
    hasAny(lowerStack, ['slack', 'teams', 'notion', 'airtable', 'asana', 'jira']) ||
    hasAny(lowerSignals, ['approval', 'handoff', 'routing', 'intake', 'reporting', 'follow'])
  ) {
    candidates.push({
      layer: 'workflow_agent',
      label: LAYER_LABELS.workflow_agent,
      fitHypothesis: 'Recurring cross-tool work needs shared ownership, triggers, handoffs, and review.',
    })
  }

  if (hasAny(lowerSignals, ['research', 'market', 'competitive', 'policy', 'source'])) {
    candidates.push({
      layer: 'research_worker',
      label: LAYER_LABELS.research_worker,
      fitHypothesis: 'Source-backed research should be routed to a specialist layer with citation discipline.',
    })
  }

  if (hasAny(lowerSignals, ['code', 'repo', 'engineering', 'developer', 'cli'])) {
    candidates.push({
      layer: 'coding_agent',
      label: LAYER_LABELS.coding_agent,
      fitHypothesis: 'Production engineering work should be tested against repository outcomes, tests, and review burden.',
    })
  }

  if (hasAny(lowerSignals, ['sensitive', 'private', 'regulated', 'self-host', 'internal'])) {
    candidates.push({
      layer: 'internal_orchestration',
      label: LAYER_LABELS.internal_orchestration,
      fitHypothesis: 'Sensitive automation may need internal orchestration, stronger logging, and tighter data controls.',
    })
  }

  if (candidates.length === 0) {
    candidates.push({
      layer: 'direct_model_product',
      label: LAYER_LABELS.direct_model_product,
      fitHypothesis: 'When the stack is unclear, start with controlled reasoning and drafting before recommending workflow automation.',
    })
  }

  return candidates.filter((candidate, index, arr) => {
    return arr.findIndex((c) => c.layer === candidate.layer) === index
  })
}

function chooseRecommendedLayer(candidates: AiLayerCandidate[]): AiLayerCategory {
  const priority: AiLayerCategory[] = [
    'enterprise_data_layer',
    'embedded_platform_ai',
    'workflow_agent',
    'internal_orchestration',
    'coding_agent',
    'research_worker',
    'direct_model_product',
  ]
  return priority.find((layer) => candidates.some((c) => c.layer === layer)) ?? 'direct_model_product'
}

export function buildAiLayerFitEvaluation(input: BuildAiLayerFitInput): AiLayerFitEvaluation {
  const merged = mergeClientStack(input.clientStack)
  const stackNames = unique(merged.technologies.map((t) => t.name))
  const workflowSignals = unique([
    ...(input.workflowSignals ?? []),
    ...(input.dataSensitivity ?? []),
    ...(input.governanceNotes ?? []),
  ])
  const candidates = inferCandidates(stackNames, workflowSignals)
  const recommendedLayer = chooseRecommendedLayer(candidates)
  const lowerStack = stackNames.map((s) => s.toLowerCase())
  const lowerSignals = workflowSignals.map((s) => s.toLowerCase())
  const hasCorePlatform = hasAny(lowerStack, [
    'microsoft',
    'office 365',
    'google workspace',
    'salesforce',
    'hubspot',
    'sharepoint',
    'teams',
    'gmail',
    'slack',
  ])
  const hasSystemOfRecord = hasAny(lowerStack, ['salesforce', 'hubspot', 'crm', 'servicenow', 'quickbooks'])
  const hasGovernanceSignal = hasAny(lowerSignals, ['approval', 'permission', 'review', 'sensitive', 'confidential', 'regulated'])

  const scores = [
    score(
      'existing_tool_fit',
      hasCorePlatform ? 5 : stackNames.length > 0 ? 4 : 3,
      hasCorePlatform
        ? 'The client has identifiable work surfaces or platforms where an AI layer can meet existing habits.'
        : stackNames.length > 0
          ? 'The client stack is partially visible, but the primary work surface needs confirmation.'
          : 'The stack is not clear enough to recommend a deep embedded layer yet.'
    ),
    score(
      'openness_and_buildability',
      recommendedLayer === 'enterprise_data_layer' || recommendedLayer === 'internal_orchestration' ? 4
        : recommendedLayer === 'embedded_platform_ai' ? 3
          : 4,
      recommendedLayer === 'embedded_platform_ai'
        ? 'Embedded platform AI is strong inside its native suite but should be checked for external orchestration needs.'
        : 'This layer can be evaluated for APIs, automation hooks, agent access, and implementation ownership.'
    ),
    score(
      'data_and_context_access',
      hasSystemOfRecord || recommendedLayer === 'embedded_platform_ai' ? 5
        : merged.source === 'verified' || merged.source === 'merged' ? 4
          : merged.source === 'empty' ? 2
            : 3,
      hasSystemOfRecord || recommendedLayer === 'embedded_platform_ai'
        ? 'The recommended layer is close to the systems likely to own files, records, identity, or workflow context.'
        : merged.source === 'empty'
          ? 'Data proximity is still unproven because the client stack has not been captured.'
          : 'The stack is visible enough for a pilot, but the exact source-of-truth data path should be confirmed.'
    ),
    score(
      'ecosystem_and_durability',
      hasCorePlatform ? 5 : recommendedLayer === 'internal_orchestration' ? 3 : 4,
      hasCorePlatform
        ? 'The recommendation can build on mature platform, admin, support, and implementation ecosystems.'
        : 'Durability depends on vendor maturity, documentation, and the client owner assigned to maintain the workflow.'
    ),
    score(
      'stackability_and_routing',
      recommendedLayer === 'enterprise_data_layer' || recommendedLayer === 'workflow_agent' || recommendedLayer === 'internal_orchestration' ? 4 : 3,
      'The tool should be positioned as one route in the client stack, with human approval and specialist layers added only where they clearly win.'
    ),
  ]

  const total = Number(scores.reduce((sum, s) => sum + s.weightedScore, 0).toFixed(2))
  const decision = decisionFor(total, recommendedLayer)
  const label = LAYER_LABELS[recommendedLayer]

  const routingSummary =
    recommendedLayer === 'enterprise_data_layer'
      ? 'Route the first implementation through the system that owns customer, service, revenue, or member records.'
      : recommendedLayer === 'embedded_platform_ai'
        ? 'Start with the AI layer inside the platform where the team already works, then add specialists only where the workflow demands it.'
        : recommendedLayer === 'workflow_agent'
          ? 'Start with a narrow recurring workflow that has clear triggers, shared ownership, and human review.'
          : recommendedLayer === 'internal_orchestration'
            ? 'Start with a controlled internal automation path where logging, data boundaries, and rollback can be tested.'
            : recommendedLayer === 'coding_agent'
              ? 'Route this through technical evaluation with repo access, tests, and human code review.'
              : recommendedLayer === 'research_worker'
                ? 'Use a specialist research layer for source-backed synthesis, then move final decisions through the client workflow owner.'
                : 'Keep the default model product for reasoning and drafting until the client stack and workflow are clearer.'

  const pilotRecommendation =
    `Pilot ${label.toLowerCase()} against one workflow with scoped data access, named human approval points, and stop conditions.`

  const openQuestions: string[] = []
  if (merged.source !== 'verified') openQuestions.push('Which parts of the client stack have been verified by an admin or workflow owner?')
  if (!hasGovernanceSignal) openQuestions.push('Which outputs require human approval before they reach clients, funders, customers, or staff?')
  if (!hasSystemOfRecord && recommendedLayer !== 'embedded_platform_ai') openQuestions.push('Which system owns the records that determine whether the output is correct?')

  return {
    generated_at: new Date().toISOString(),
    inputs_hash: hashInput({ input, merged }),
    client_stack_source: merged.source,
    detected_stack: stackNames,
    workflow_signals: workflowSignals,
    recommended_layer: recommendedLayer,
    recommended_layer_label: label,
    candidate_layers: candidates,
    scores,
    weighted_total: total,
    decision,
    decision_label: DECISION_LABELS[decision],
    routing_summary: routingSummary,
    pilot_recommendation: pilotRecommendation,
    open_questions: openQuestions,
  }
}
