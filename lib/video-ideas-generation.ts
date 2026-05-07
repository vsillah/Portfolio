import {
  evaluateAgentBudget,
  type AgentBudgetDecision,
} from '@/lib/agent-budget-policy'
import { recordAgentEvent, recordAgentStep } from '@/lib/agent-run'

export const VIDEO_IDEAS_GENERATION_OPERATION = 'video_ideas_generation'
export const VIDEO_IDEAS_GENERATION_MODEL = 'gpt-4o'
export const VIDEO_IDEAS_GENERATION_MAX_TOKENS = 8000

export class VideoIdeasGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: 'budget_blocked' | 'openai_not_configured' | 'openai_upstream' | 'invalid_response',
  ) {
    super(message)
    this.name = 'VideoIdeasGenerationError'
  }
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

export function evaluateVideoIdeasGenerationBudget(input: {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
}): AgentBudgetDecision {
  return evaluateAgentBudget({
    runtime: 'manual',
    model: input.model ?? VIDEO_IDEAS_GENERATION_MODEL,
    estimatedInputTokens: estimateTokensFromText(`${input.systemPrompt}\n${input.userPrompt}`),
    maxTokens: input.maxTokens ?? VIDEO_IDEAS_GENERATION_MAX_TOKENS,
    metadata: {
      operation: VIDEO_IDEAS_GENERATION_OPERATION,
    },
  })
}

export async function recordVideoIdeasGenerationBudgetDecision(args: {
  agentRunId?: string | null
  mode: string
  limit: number
  decision: AgentBudgetDecision
}) {
  if (!args.agentRunId) return

  const metadata = {
    operation: VIDEO_IDEAS_GENERATION_OPERATION,
    mode: args.mode,
    limit: args.limit,
    budget_status: args.decision.status,
    budget_rule_key: args.decision.rule.key,
    estimated_cost_usd: args.decision.estimatedCostUsd,
    warning_usd: args.decision.warningUsd,
    limit_usd: args.decision.limitUsd,
  }

  await recordAgentStep({
    runId: args.agentRunId,
    stepKey: 'budget_check',
    name: 'Checked video ideas generation budget',
    status: args.decision.status === 'blocked' ? 'failed' : 'completed',
    outputSummary: args.decision.reason,
    costUsd: args.decision.estimatedCostUsd,
    metadata,
    idempotencyKey: `${args.agentRunId}:video_ideas_generation:budget_check`,
  }).catch((err) => console.warn('[generate-ideas] agent budget step failed:', err))

  if (args.decision.status !== 'allowed') {
    await recordAgentEvent({
      runId: args.agentRunId,
      eventType: 'budget_check',
      severity: args.decision.status === 'blocked' ? 'error' : 'warning',
      message: args.decision.reason,
      metadata,
      idempotencyKey: `${args.agentRunId}:video_ideas_generation:budget_check:${args.decision.status}`,
    }).catch((err) => console.warn('[generate-ideas] agent budget event failed:', err))
  }
}
