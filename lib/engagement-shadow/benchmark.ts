import { evaluateCommentInboxPolicy } from '../comment-inbox-policy'
import { FIXTURES, type Fixture, type Labels } from './fixtures'
import { createJevAdapter, JEV_MODEL } from './jev'
import { mockTransport } from './mock'
import { POLICY } from './policy'

const dimensions = ['intent', 'urgency', 'spam', 'replyRisk', 'humanReview'] as const
export type Observation = { id: string; family: string; expected: Labels; predicted: Labels | null;
  source?: Fixture['source']; localReviewReasons?: string[];
  route: string; failure: string | null; latencyMs: number; inputTokens: number | null; outputTokens: number | null }
const highRisk = (j: Labels) => j.replyRisk || j.spam || j.urgency === 2
const fraction = (n: number, d: number) => d ? n / d : null
export function summarize(rows: Observation[]) {
  const high = rows.filter(r => highRisk(r.expected))
  const unsafe = rows.filter(r => highRisk(r.expected) || r.expected.humanReview)
  const durations = rows.map(r => r.latencyMs).sort((a, b) => a - b)
  const knownUsage = rows.length > 0 && rows.every(r => r.inputTokens !== null && r.outputTokens !== null)
  const inputTokens = knownUsage ? rows.reduce((n, r) => n + r.inputTokens!, 0) : null
  const outputTokens = knownUsage ? rows.reduce((n, r) => n + r.outputTokens!, 0) : null
  return { cases: rows.length,
    accuracy: Object.fromEntries(dimensions.map(d => [d, fraction(rows.filter(r => r.predicted?.[d] === r.expected[d]).length, rows.length)])),
    falseSafeRate: fraction(unsafe.filter(r => r.route === 'shadow_safe').length, unsafe.length),
    highRiskRecall: fraction(high.filter(r => r.predicted && highRisk(r.predicted)).length, high.length),
    highRiskContainment: fraction(high.filter(r => r.route !== 'shadow_safe').length, high.length),
    escalationRate: fraction(rows.filter(r => r.route !== 'shadow_safe').length, rows.length),
    failureCount: rows.filter(r => r.failure).length,
    schemaFailureCount: rows.filter(r => r.failure === 'malformed_response').length,
    failuresByReason: Object.fromEntries([...new Set(rows.flatMap(r => r.failure ? [r.failure] : []))]
      .map(reason => [reason, rows.filter(r => r.failure === reason).length])),
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
    const b = evaluateCommentInboxPolicy({ comment: { id: f.id, text: f.text,
      provider: f.providerAmbiguity ? 'manual' : undefined, createdAt: '2026-09-01T00:00:00Z' },
      now: '2026-09-01T00:00:00Z', confidence: f.sourceConfidence ?? 0.95 })
    const baselineLatency = performance.now() - started
    // Baseline has no independent spam/reply-risk model: these are explicit proxies.
    const predicted: Labels = { intent: b.classification,
      urgency: b.workflowUpdateProposal.workflowOwnedPatch.priority === 'urgent' ? 2
        : b.workflowUpdateProposal.workflowOwnedPatch.priority === 'low' ? 0 : 1,
      spam: b.classification === 'spam',
      replyRisk: ['spam', 'criticism_negative', 'misinformation_unsupported_claim', 'sensitive_privacy_legal_financial'].includes(b.classification),
      humanReview: b.humanQaRequired }
    current.push({ id: f.id, family: f.family, source: f.source, expected: f.expected, predicted,
      route: b.humanQaRequired || predicted.spam ? 'review' : 'shadow_safe', failure: null,
      latencyMs: baselineLatency, inputTokens: 0, outputTokens: 0 })
    const result = await adapter.decide({ text: f.text, sourceConfidence: f.sourceConfidence,
      providerAmbiguity: f.providerAmbiguity })
    const j = result.judgments
    candidate.push({ id: f.id, family: f.family, source: f.source, expected: f.expected,
      predicted: j ? { intent: j.intent, urgency: Math.round(j.urgency) as 0 | 1 | 2,
        spam: j.spam >= POLICY.positive, replyRisk: j.replyRisk >= POLICY.positive, humanReview: j.humanReview > POLICY.negative } : null,
      route: result.route, failure: result.failure, latencyMs: result.latencyMs,
      localReviewReasons: result.localReviewReasons ?? [],
      inputTokens: result.usage?.inputTokens ?? null, outputTokens: result.usage?.outputTokens ?? null })
  }
  return { schemaVersion: 2, mode: 'offline-mock', model: JEV_MODEL, policy: POLICY,
    fixtureFamilies: new Set(FIXTURES.map(f => f.family)).size, externalActionsAllowed: false,
    verdict: 'HOLD live shadow: mock validates plumbing only; Jev quality is unmeasured. Requires approved credential reference, provider-call authority, and independently reviewed labels.',
    corpus: { policyRegression: FIXTURES.filter(f => f.source === 'policy-regression').length,
      synthetic: FIXTURES.filter(f => f.source === 'synthetic').length,
      redactedSynthetic: FIXTURES.filter(f => f.source === 'redacted-synthetic').length,
      independentlyHumanReviewed: false },
    limitations: ['The 240 formatting variants are 30 correlated seed families, not independent samples.',
      'Latency measures local CPU only; mock token use and cost are zero, not a live estimate.',
      'Baseline spam and reply-risk are classification proxies; urgency comes from priority; policy fixtures preserve original confidence/provider context; other confidence is 0.95.',
      'The model sees minimized text only. Local confidence/provider flags can require review but do not rewrite model judgments.',
      'No routing, deterministic safeguards, or provider permissions are changed.'],
    baseline: summarize(current), mock: summarize(candidate),
    agreementWithBaseline: Object.fromEntries(dimensions.map(d => [d, fraction(candidate.filter((r, i) =>
      r.predicted !== null && r.predicted[d] === current[i].predicted?.[d]).length, candidate.length)])),
    perFamily: Object.fromEntries([...new Set(FIXTURES.map(f => f.family))].map(family => [family, {
      baseline: summarize(current.filter(r => r.family === family)), mock: summarize(candidate.filter(r => r.family === family)),
    }])), rows: { baseline: current, mock: candidate } }
}
