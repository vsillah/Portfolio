import { evaluateCommentInboxPolicy } from '../comment-inbox-policy'
import { FIXTURES, type Labels } from './fixtures'
import { createJevAdapter, JEV_MODEL } from './jev'
import { mockTransport } from './mock'
import { POLICY } from './policy'

const dimensions = ['intent', 'urgency', 'spam', 'replyRisk', 'humanReview'] as const
export type Observation = { id: string; family: string; expected: Labels; predicted: Labels | null;
  route: string; failure: string | null; latencyMs: number; inputTokens: number | null; outputTokens: number | null }
const highRisk = (j: Labels) => j.replyRisk || j.spam || j.urgency === 2
const fraction = (n: number, d: number) => d ? n / d : null
export function summarize(rows: Observation[]) {
  const high = rows.filter(r => highRisk(r.expected))
  const unsafe = rows.filter(r => highRisk(r.expected) || r.expected.humanReview)
  const durations = rows.map(r => r.latencyMs).sort((a, b) => a - b)
  const knownUsage = rows.every(r => r.inputTokens !== null && r.outputTokens !== null)
  const inputTokens = knownUsage ? rows.reduce((n, r) => n + r.inputTokens!, 0) : null
  const outputTokens = knownUsage ? rows.reduce((n, r) => n + r.outputTokens!, 0) : null
  return { cases: rows.length,
    accuracy: Object.fromEntries(dimensions.map(d => [d, fraction(rows.filter(r => r.predicted?.[d] === r.expected[d]).length, rows.length)])),
    falseSafeRate: fraction(unsafe.filter(r => r.route === 'shadow_safe').length, unsafe.length),
    highRiskRecall: fraction(high.filter(r => r.predicted && highRisk(r.predicted)).length, high.length),
    highRiskContainment: fraction(high.filter(r => r.route !== 'shadow_safe').length, high.length),
    escalationRate: fraction(rows.filter(r => r.route !== 'shadow_safe').length, rows.length),
    failureCount: rows.filter(r => r.failure).length,
    denominators: { unsafe: unsafe.length, highRisk: high.length },
    latencyMs: { mean: fraction(durations.reduce((a, b) => a + b, 0), rows.length), p95: durations[Math.max(0, Math.ceil(rows.length * 0.95) - 1)] ?? null },
    inputTokens, outputTokens, estimatedUsd: inputTokens === null || outputTokens === null ? null
      : (inputTokens * POLICY.inputUsdPerMillion + outputTokens * POLICY.outputUsdPerMillion) / 1_000_000,
  }
}
export async function runBenchmark() {
  const adapter = createJevAdapter(mockTransport)
  const current: Observation[] = []
  const candidate: Observation[] = []
  for (const f of FIXTURES) {
    const started = performance.now()
    const b = evaluateCommentInboxPolicy({ comment: { id: f.id, text: f.text, createdAt: '2026-09-01T00:00:00Z' },
      now: '2026-09-01T00:00:00Z', confidence: 0.95 })
    const baselineLatency = performance.now() - started
    // Baseline has no independent spam/reply-risk model: these are explicit proxies.
    const predicted: Labels = { intent: b.classification,
      urgency: b.workflowUpdateProposal.workflowOwnedPatch.priority === 'urgent' ? 2
        : b.workflowUpdateProposal.workflowOwnedPatch.priority === 'low' ? 0 : 1,
      spam: b.classification === 'spam',
      replyRisk: ['spam', 'criticism_negative', 'misinformation_unsupported_claim', 'sensitive_privacy_legal_financial'].includes(b.classification),
      humanReview: b.humanQaRequired }
    current.push({ id: f.id, family: f.family, expected: f.expected, predicted,
      route: b.humanQaRequired || predicted.spam ? 'review' : 'shadow_safe', failure: null,
      latencyMs: baselineLatency, inputTokens: 0, outputTokens: 0 })
    const result = await adapter.decide({ text: f.text })
    const j = result.judgments
    candidate.push({ id: f.id, family: f.family, expected: f.expected,
      predicted: j ? { intent: j.intent, urgency: Math.round(j.urgency) as 0 | 1 | 2,
        spam: j.spam >= POLICY.positive, replyRisk: j.replyRisk >= POLICY.positive, humanReview: j.humanReview > POLICY.negative } : null,
      route: result.route, failure: result.failure, latencyMs: result.latencyMs,
      inputTokens: result.usage?.inputTokens ?? null, outputTokens: result.usage?.outputTokens ?? null })
  }
  return { schemaVersion: 1, mode: 'offline-mock', model: JEV_MODEL, policy: POLICY,
    fixtureFamilies: new Set(FIXTURES.map(f => f.family)).size, externalActionsAllowed: false,
    verdict: 'HOLD live shadow: mock validates plumbing only; Jev quality is unmeasured. Requires approved credential reference, provider-call authority, and independently reviewed labels.',
    limitations: ['240 cases are 30 correlated seed families, not independent samples.',
      'Latency measures local CPU only; mock token use and cost are zero, not a live estimate.',
      'Baseline spam and reply-risk are classification proxies; urgency comes from priority; confidence fixed at 0.95.',
      'No routing, deterministic safeguards, or provider permissions are changed.'],
    baseline: summarize(current), mock: summarize(candidate),
    perFamily: Object.fromEntries([...new Set(FIXTURES.map(f => f.family))].map(family => [family, {
      baseline: summarize(current.filter(r => r.family === family)), mock: summarize(candidate.filter(r => r.family === family)),
    }])), rows: { baseline: current, mock: candidate } }
}
