import {
  evaluateAgentBudget,
  type AgentBudgetDecision,
} from '@/lib/agent-budget-policy'
import { recordAgentEvent, recordAgentStep } from '@/lib/agent-run'

export const SOCIAL_CAROUSEL_GENERATION_OPERATION = 'social_carousel_generation'
export const SOCIAL_CAROUSEL_GENERATION_MODEL = 'gpt-4o'
export const SOCIAL_CAROUSEL_GENERATION_MAX_TOKENS = 4096

export class SocialCarouselGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: 'budget_blocked' | 'openai_not_configured' | 'openai_upstream' | 'invalid_response',
  ) {
    super(message)
    this.name = 'SocialCarouselGenerationError'
  }
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

export function evaluateSocialCarouselGenerationBudget(input: {
  systemPrompt: string
  userMessage: string
  model?: string
  maxTokens?: number
}): AgentBudgetDecision {
  return evaluateAgentBudget({
    runtime: 'manual',
    model: input.model ?? SOCIAL_CAROUSEL_GENERATION_MODEL,
    estimatedInputTokens: estimateTokensFromText(`${input.systemPrompt}\n${input.userMessage}`),
    maxTokens: input.maxTokens ?? SOCIAL_CAROUSEL_GENERATION_MAX_TOKENS,
    metadata: {
      operation: SOCIAL_CAROUSEL_GENERATION_OPERATION,
    },
  })
}

export async function recordSocialCarouselGenerationBudgetDecision(args: {
  agentRunId?: string | null
  socialContentId: string
  decision: AgentBudgetDecision
}) {
  if (!args.agentRunId) return

  const metadata = {
    operation: SOCIAL_CAROUSEL_GENERATION_OPERATION,
    social_content_id: args.socialContentId,
    budget_status: args.decision.status,
    budget_rule_key: args.decision.rule.key,
    estimated_cost_usd: args.decision.estimatedCostUsd,
    warning_usd: args.decision.warningUsd,
    limit_usd: args.decision.limitUsd,
  }

  await recordAgentStep({
    runId: args.agentRunId,
    stepKey: 'budget_check',
    name: 'Checked social carousel generation budget',
    status: args.decision.status === 'blocked' ? 'failed' : 'completed',
    outputSummary: args.decision.reason,
    costUsd: args.decision.estimatedCostUsd,
    metadata,
    idempotencyKey: `${args.agentRunId}:social_carousel_generation:budget_check`,
  }).catch((err) => console.warn('[convert-to-carousel] agent budget step failed:', err))

  if (args.decision.status !== 'allowed') {
    await recordAgentEvent({
      runId: args.agentRunId,
      eventType: 'budget_check',
      severity: args.decision.status === 'blocked' ? 'error' : 'warning',
      message: args.decision.reason,
      metadata,
      idempotencyKey: `${args.agentRunId}:social_carousel_generation:budget_check:${args.decision.status}`,
    }).catch((err) => console.warn('[convert-to-carousel] agent budget event failed:', err))
  }
}
