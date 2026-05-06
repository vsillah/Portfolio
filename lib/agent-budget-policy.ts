import type { AgentRuntime } from '@/lib/agent-run'
import { computeAnthropicCost, computeOpenAICost, type Usage } from '@/lib/cost-calculator'
import { inferProvider } from '@/lib/constants/llm-models'

export type AgentBudgetDecisionStatus = 'allowed' | 'warning' | 'blocked'
export type AgentBudgetScope = 'per_call' | 'per_run' | 'daily'
export type AgentBudgetRuntime = AgentRuntime | 'any'

export interface AgentBudgetRule {
  key: string
  label: string
  runtime: AgentBudgetRuntime
  scope: AgentBudgetScope
  warningUsd: number
  limitUsd: number
  appliesTo?: string[]
  notes: string
}

export interface AgentBudgetEstimateInput {
  runtime: AgentRuntime
  model: string
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  maxTokens?: number
  metadata?: Record<string, unknown>
}

export interface AgentBudgetDecision {
  status: AgentBudgetDecisionStatus
  estimatedCostUsd: number
  limitUsd: number
  warningUsd: number
  rule: AgentBudgetRule
  reason: string
}

export const DEFAULT_AGENT_BUDGET_RULES: AgentBudgetRule[] = [
  {
    key: 'llm_codex_per_call',
    label: 'Codex LLM call',
    runtime: 'codex',
    scope: 'per_call',
    warningUsd: 0.25,
    limitUsd: 1,
    notes: 'Engineering operator calls can be larger, but should still surface cost risk before dispatch.',
  },
  {
    key: 'llm_n8n_per_call',
    label: 'n8n LLM call',
    runtime: 'n8n',
    scope: 'per_call',
    warningUsd: 0.1,
    limitUsd: 0.5,
    notes: 'Production automation calls should remain tightly bounded unless an approved workflow overrides the cap.',
  },
  {
    key: 'llm_hermes_per_call',
    label: 'Hermes LLM call',
    runtime: 'hermes',
    scope: 'per_call',
    warningUsd: 0.02,
    limitUsd: 0.1,
    notes: 'Hermes remains a secondary read-only runtime in v1; larger work should route through approval.',
  },
  {
    key: 'llm_opencode_per_call',
    label: 'OpenCode evaluation LLM call',
    runtime: 'opencode',
    scope: 'per_call',
    warningUsd: 0.02,
    limitUsd: 0.1,
    notes: 'OpenCode/OpenClaw evaluation calls stay small until runtime audit behavior is proven.',
  },
  {
    key: 'llm_manual_per_call',
    label: 'Manual admin LLM call',
    runtime: 'manual',
    scope: 'per_call',
    warningUsd: 0.05,
    limitUsd: 0.25,
    notes: 'Human-triggered admin calls should show cost risk before creating expensive one-off work.',
  },
  {
    key: 'llm_default_per_call',
    label: 'Default LLM call',
    runtime: 'any',
    scope: 'per_call',
    warningUsd: 0.1,
    limitUsd: 0.5,
    notes: 'Fallback rule for unknown or future runtimes until a runtime-specific policy is defined.',
  },
]

export function getAgentBudgetRule(
  runtime: AgentRuntime,
  rules: AgentBudgetRule[] = DEFAULT_AGENT_BUDGET_RULES,
): AgentBudgetRule {
  return (
    rules.find((rule) => rule.runtime === runtime && rule.scope === 'per_call') ??
    rules.find((rule) => rule.runtime === 'any' && rule.scope === 'per_call') ??
    DEFAULT_AGENT_BUDGET_RULES[DEFAULT_AGENT_BUDGET_RULES.length - 1]
  )
}

export function estimateAgentLlmCost(input: AgentBudgetEstimateInput): number {
  const outputTokens = input.estimatedOutputTokens ?? input.maxTokens ?? 0
  const usage: Usage = {
    prompt_tokens: input.estimatedInputTokens ?? 0,
    completion_tokens: outputTokens,
    input_tokens: input.estimatedInputTokens ?? 0,
    output_tokens: outputTokens,
  }

  const provider = inferProvider(input.model)
  const cost = provider === 'anthropic'
    ? computeAnthropicCost(usage, input.model)
    : computeOpenAICost(usage, input.model)

  return Math.round(cost * 1_000_000) / 1_000_000
}

export function evaluateAgentBudget(
  input: AgentBudgetEstimateInput,
  rules: AgentBudgetRule[] = DEFAULT_AGENT_BUDGET_RULES,
): AgentBudgetDecision {
  const rule = getAgentBudgetRule(input.runtime, rules)
  const estimatedCostUsd = estimateAgentLlmCost(input)

  if (estimatedCostUsd > rule.limitUsd) {
    return {
      status: 'blocked',
      estimatedCostUsd,
      warningUsd: rule.warningUsd,
      limitUsd: rule.limitUsd,
      rule,
      reason: `Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds ${rule.label} cap $${rule.limitUsd.toFixed(4)}.`,
    }
  }

  if (estimatedCostUsd > rule.warningUsd) {
    return {
      status: 'warning',
      estimatedCostUsd,
      warningUsd: rule.warningUsd,
      limitUsd: rule.limitUsd,
      rule,
      reason: `Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds ${rule.label} warning $${rule.warningUsd.toFixed(4)}.`,
    }
  }

  return {
    status: 'allowed',
    estimatedCostUsd,
    warningUsd: rule.warningUsd,
    limitUsd: rule.limitUsd,
    rule,
    reason: `Estimated cost $${estimatedCostUsd.toFixed(4)} is within ${rule.label} budget.`,
  }
}

export function assertAgentBudgetAllowed(
  input: AgentBudgetEstimateInput,
  rules: AgentBudgetRule[] = DEFAULT_AGENT_BUDGET_RULES,
): AgentBudgetDecision {
  const decision = evaluateAgentBudget(input, rules)
  if (decision.status === 'blocked') {
    throw new Error(decision.reason)
  }
  return decision
}
