import {
  evaluateAgentBudget,
  type AgentBudgetDecision,
} from '@/lib/agent-budget-policy'
import { recordAgentEvent, recordAgentStep } from '@/lib/agent-run'

export const IN_PERSON_DIAGNOSTIC_INSIGHTS_OPERATION = 'in_person_diagnostic_insights'
export const IN_PERSON_DIAGNOSTIC_INSIGHTS_MODEL = 'gpt-4o-mini'
export const IN_PERSON_DIAGNOSTIC_INSIGHTS_MAX_TOKENS = 1000

export class InPersonDiagnosticInsightsError extends Error {
  constructor(
    message: string,
    public readonly code: 'budget_blocked' | 'openai_not_configured' | 'openai_upstream' | 'invalid_response',
  ) {
    super(message)
    this.name = 'InPersonDiagnosticInsightsError'
  }
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

export function evaluateInPersonDiagnosticInsightsBudget(input: {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
}): AgentBudgetDecision {
  return evaluateAgentBudget({
    runtime: 'manual',
    model: input.model ?? IN_PERSON_DIAGNOSTIC_INSIGHTS_MODEL,
    estimatedInputTokens: estimateTokensFromText(`${input.systemPrompt}\n${input.userPrompt}`),
    maxTokens: input.maxTokens ?? IN_PERSON_DIAGNOSTIC_INSIGHTS_MAX_TOKENS,
    metadata: {
      operation: IN_PERSON_DIAGNOSTIC_INSIGHTS_OPERATION,
    },
  })
}

export async function recordInPersonDiagnosticInsightsBudgetDecision(args: {
  agentRunId?: string | null
  auditId: string
  decision: AgentBudgetDecision
}) {
  if (!args.agentRunId) return

  const metadata = {
    operation: IN_PERSON_DIAGNOSTIC_INSIGHTS_OPERATION,
    audit_id: args.auditId,
    budget_status: args.decision.status,
    budget_rule_key: args.decision.rule.key,
    estimated_cost_usd: args.decision.estimatedCostUsd,
    warning_usd: args.decision.warningUsd,
    limit_usd: args.decision.limitUsd,
  }

  await recordAgentStep({
    runId: args.agentRunId,
    stepKey: 'budget_check',
    name: 'Checked in-person diagnostic insights budget',
    status: args.decision.status === 'blocked' ? 'failed' : 'completed',
    outputSummary: args.decision.reason,
    costUsd: args.decision.estimatedCostUsd,
    metadata,
    idempotencyKey: `${args.agentRunId}:in_person_diagnostic_insights:budget_check`,
  }).catch((err) => console.warn('[generate-insights] agent budget step failed:', err))

  if (args.decision.status !== 'allowed') {
    await recordAgentEvent({
      runId: args.agentRunId,
      eventType: 'budget_check',
      severity: args.decision.status === 'blocked' ? 'error' : 'warning',
      message: args.decision.reason,
      metadata,
      idempotencyKey: `${args.agentRunId}:in_person_diagnostic_insights:budget_check:${args.decision.status}`,
    }).catch((err) => console.warn('[generate-insights] agent budget event failed:', err))
  }
}
