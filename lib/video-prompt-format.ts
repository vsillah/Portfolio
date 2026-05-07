import {
  evaluateAgentBudget,
  type AgentBudgetDecision,
} from '@/lib/agent-budget-policy'
import { recordAgentEvent, recordAgentStep } from '@/lib/agent-run'

export const VIDEO_PROMPT_FORMAT_OPERATION = 'video_prompt_format'

export class VideoPromptFormatError extends Error {
  constructor(
    message: string,
    public readonly code: 'budget_blocked' | 'openai_not_configured' | 'openai_upstream' | 'invalid_response',
  ) {
    super(message)
    this.name = 'VideoPromptFormatError'
  }
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

export function buildVideoPromptFormatterUserMessage(input: {
  rawText: string
  audience?: string
  tone?: string
  angle?: string
}): string {
  const detailLines: string[] = []
  if (input.audience) detailLines.push(`TARGET AUDIENCE: ${input.audience}`)
  if (input.tone) detailLines.push(`TONE: ${input.tone}`)
  if (input.angle) detailLines.push(`ANGLE / HOOK: ${input.angle}`)

  return detailLines.length > 0
    ? `${input.rawText}\n\nAdditional details provided by the user:\n${detailLines.join('\n')}`
    : input.rawText
}

export function evaluateVideoPromptFormatterBudget(input: {
  systemPrompt: string
  userMessage: string
  model?: string
  maxTokens?: number
}): AgentBudgetDecision {
  return evaluateAgentBudget({
    runtime: 'manual',
    model: input.model ?? 'gpt-4o-mini',
    estimatedInputTokens: estimateTokensFromText(`${input.systemPrompt}\n${input.userMessage}`),
    maxTokens: input.maxTokens ?? 800,
    metadata: {
      operation: VIDEO_PROMPT_FORMAT_OPERATION,
    },
  })
}

export async function recordVideoPromptFormatterBudgetDecision(args: {
  agentRunId: string
  decision: AgentBudgetDecision
}) {
  const metadata = {
    operation: VIDEO_PROMPT_FORMAT_OPERATION,
    budget_status: args.decision.status,
    budget_rule_key: args.decision.rule.key,
    estimated_cost_usd: args.decision.estimatedCostUsd,
    warning_usd: args.decision.warningUsd,
    limit_usd: args.decision.limitUsd,
  }

  await recordAgentStep({
    runId: args.agentRunId,
    stepKey: 'budget_check',
    name: 'Checked video prompt formatter budget',
    status: args.decision.status === 'blocked' ? 'failed' : 'completed',
    outputSummary: args.decision.reason,
    costUsd: args.decision.estimatedCostUsd,
    metadata,
    idempotencyKey: `${args.agentRunId}:video_prompt_format:budget_check`,
  }).catch((err) => console.warn('[format-prompt] agent budget step failed:', err))

  if (args.decision.status !== 'allowed') {
    await recordAgentEvent({
      runId: args.agentRunId,
      eventType: 'budget_check',
      severity: args.decision.status === 'blocked' ? 'error' : 'warning',
      message: args.decision.reason,
      metadata,
      idempotencyKey: `${args.agentRunId}:video_prompt_format:budget_check:${args.decision.status}`,
    }).catch((err) => console.warn('[format-prompt] agent budget event failed:', err))
  }
}
