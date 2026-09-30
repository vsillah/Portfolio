import { z } from 'zod'
import { COMMENT_CLASSIFICATIONS } from '../comment-inbox-policy'

// Portfolio owns all thresholds; this policy never grants execution authority.
export const POLICY = Object.freeze({ confidence: 0.85, negative: 0.15, positive: 0.85,
  urgent: 1.5, timeoutMs: 1000, inputUsdPerMillion: 0.042, outputUsdPerMillion: 0 })
export const inputSchema = z.object({ text: z.string().trim().min(1).max(4000) }).strict()
export const judgmentsSchema = z.object({
  intent: z.enum(COMMENT_CLASSIFICATIONS), intentConfidence: z.number().min(0).max(1),
  urgency: z.number().min(0).max(2), urgencyConfidence: z.number().min(0).max(1),
  spam: z.number().min(0).max(1), replyRisk: z.number().min(0).max(1),
  humanReview: z.number().min(0).max(1),
}).strict()
export type Input = z.infer<typeof inputSchema>
export type Judgments = z.infer<typeof judgmentsSchema>
export type Route = 'shadow_safe' | 'review' | 'block'
export function routeJudgments(raw: unknown): Route {
  const parsed = judgmentsSchema.safeParse(raw)
  if (!parsed.success) return 'block'
  const j = parsed.data
  if (j.spam >= POLICY.positive || j.replyRisk >= POLICY.positive) return 'block'
  if (j.intentConfidence < POLICY.confidence || j.urgencyConfidence < POLICY.confidence
    || j.urgency >= POLICY.urgent || j.intent !== 'low_risk_acknowledgement'
    || [j.spam, j.replyRisk, j.humanReview].some(p => p > POLICY.negative)) return 'review'
  return 'shadow_safe'
}
export type Decision = {
  judgments: Judgments | null
  route: Route
  failure: 'invalid_input' | 'provider_gate' | 'timeout' | 'provider_status' | 'malformed_response' | 'transport_failure' | null
  latencyMs: number
  usage: { inputTokens: number; outputTokens: number } | null
  externalActionsAllowed: false
}
export interface DecisionAdapter { name: string; decide(input: Input): Promise<Decision> }
