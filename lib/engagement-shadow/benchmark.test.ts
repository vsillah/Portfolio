// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJevAdapter, buildRequest, JEV_MODEL, type Transport } from './jev'
import { mockTransport } from './mock'
import { FIXTURES } from './fixtures'
import { POLICY, routeJudgments } from './policy'
import { runBenchmark, summarize, type Observation } from './benchmark'

const safe = { intent: 'low_risk_acknowledgement', intentConfidence: 1, urgency: 0,
  urgencyConfidence: 1, spam: 0, replyRisk: 0, humanReview: 0 }
const input = { text: 'Thank you for sharing this.' }
async function payload() { return structuredClone((await mockTransport(buildRequest(input), new AbortController().signal)).body) as {
  model: string; answers: Record<string, Record<string, unknown>>; usage: Record<string, unknown>
} }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('Portfolio shadow policy', () => {
  it('validates judgments and keeps every route non-executing', () => {
    expect(routeJudgments(safe)).toBe('shadow_safe')
    expect(routeJudgments({ ...safe, extra: true })).toBe('block')
    expect(routeJudgments({ ...safe, spam: NaN })).toBe('block')
    expect(routeJudgments(null)).toBe('block')
  })
  it('applies boundary thresholds for confidence, review, spam, and reply risk', () => {
    for (const field of ['intentConfidence', 'urgencyConfidence']) {
      expect(routeJudgments({ ...safe, [field]: POLICY.confidence })).toBe('shadow_safe')
      expect(routeJudgments({ ...safe, [field]: POLICY.confidence - 0.001 })).toBe('review')
    }
    for (const field of ['spam', 'replyRisk', 'humanReview']) {
      expect(routeJudgments({ ...safe, [field]: POLICY.negative })).toBe('shadow_safe')
      expect(routeJudgments({ ...safe, [field]: POLICY.negative + 0.001 })).toBe('review')
    }
    expect(routeJudgments({ ...safe, spam: POLICY.positive })).toBe('block')
    expect(routeJudgments({ ...safe, replyRisk: POLICY.positive })).toBe('block')
    expect(routeJudgments({ ...safe, urgency: POLICY.urgent })).toBe('review')
    expect(routeJudgments({ ...safe, intent: 'substantive_question' })).toBe('review')
  })
})
describe('Jev contract', () => {
  it('pins model and sends only text with five atomic questions', () => {
    const request = buildRequest(input)
    expect(request.model).toBe(JEV_MODEL)
    expect(Object.keys(request.questions)).toHaveLength(5)
    expect(request.state).toEqual(input)
  })
  it('defaults to the provider gate without touching network', async () => {
    const fetch = vi.fn(() => { throw new Error('network forbidden') }); vi.stubGlobal('fetch', fetch)
    expect((await createJevAdapter().decide(input)).failure).toBe('provider_gate')
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([{ text: '' }, { text: 'x'.repeat(4001) }, { text: 'ok', contact: 'forbidden' }, null])('rejects invalid input before transport', async raw => {
    const transport = vi.fn(mockTransport)
    expect((await createJevAdapter(transport).decide(raw as typeof input)).failure).toBe('invalid_input')
    expect(transport).not.toHaveBeenCalled()
  })
  it.each([401, 422, 429, 529, 500])('blocks HTTP %s without retries or response-body leakage', async status => {
    const transport = vi.fn(async () => ({ status, body: { sensitive: 'must-not-escape' } }))
    const result = await createJevAdapter(transport).decide(input)
    expect(result).toMatchObject({ route: 'block', failure: 'provider_status', usage: null, externalActionsAllowed: false })
    expect(JSON.stringify(result)).not.toContain('must-not-escape')
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('times out even when transport ignores abort', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const pending = createJevAdapter(async (_, s) => { signal = s; return new Promise(() => {}) }).decide(input)
    await vi.advanceTimersByTimeAsync(POLICY.timeoutMs)
    expect(await pending).toMatchObject({ failure: 'timeout', route: 'block' })
    expect(signal?.aborted).toBe(true)
  })
  it('blocks rejected and synchronously thrown transport failures', async () => {
    for (const transport of [async () => { throw new Error('private error') }, () => { throw new Error('private error') }]) {
      const result = await createJevAdapter(transport as Transport).decide(input)
      expect(result.failure).toBe('transport_failure')
      expect(JSON.stringify(result)).not.toContain('private error')
    }
  })
  it('blocks malformed, out-of-range, extra-key, inconsistent, and wrong-model responses', async () => {
    const mutations: Array<(b: Awaited<ReturnType<typeof payload>>) => void> = [
      b => { b.model = 'jev-latest' }, b => { delete b.answers.spam },
      b => { b.answers.spam.noul = 2 }, b => { b.answers.spam.confidence = 1 },
      b => { b.answers.intent.choice = 'unknown' }, b => { b.answers.intent.confidence = NaN },
      b => { b.answers.intent.probabilities = { low_risk_acknowledgement: 1 } },
      b => { b.answers.intent.choice = 'spam' }, b => { b.answers.urgency.score = 2 },
      b => { b.answers.urgency.legend = {} }, b => { b.usage.input_tokens = -1 },
    ]
    for (const mutate of mutations) {
      const body = await payload(); mutate(body)
      expect((await createJevAdapter(async () => ({ status: 200, body })).decide(input)).failure).toBe('malformed_response')
    }
  })
  it('low confidence and ambiguous Noul always require review', async () => {
    const body = await payload(); body.answers.intent.confidence = 0.2
    expect((await createJevAdapter(async () => ({ status: 200, body })).decide(input)).route).toBe('review')
    body.answers.intent.confidence = 1; body.answers.humanReview.noul = 0.5
    expect((await createJevAdapter(async () => ({ status: 200, body })).decide(input)).route).toBe('review')
  })
})
describe('offline comparison', () => {
  it('runs 240 cases without fetch and produces deterministic decisions independent of latency', async () => {
    const fetch = vi.fn(() => { throw new Error('network forbidden') }); vi.stubGlobal('fetch', fetch)
    expect(FIXTURES).toHaveLength(240)
    expect(new Set(FIXTURES.map(f => f.id)).size).toBe(240)
    const first = await runBenchmark(); const second = await runBenchmark()
    expect(first.baseline.cases).toBe(240)
    expect(first.mock.failureCount).toBe(0)
    expect(first.mock.accuracy).toEqual(second.mock.accuracy)
    expect(first.rows.mock.map(r => r.predicted)).toEqual(second.rows.mock.map(r => r.predicted))
    expect(first.mock.inputTokens).toBe(0)
    expect(first.mock.estimatedUsd).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('counts failed predictions as incorrect, preserves unknown usage, and separates recall from containment', () => {
    const expected = { intent: 'spam' as const, urgency: 0 as const, spam: true, replyRisk: true, humanReview: true }
    const rows: Observation[] = [{ id: '1', family: 'metric', expected, predicted: null, route: 'block',
      failure: 'timeout', latencyMs: 10, inputTokens: null, outputTokens: null },
    { id: '2', family: 'metric', expected, predicted: { ...expected, spam: false, replyRisk: false }, route: 'shadow_safe',
      failure: null, latencyMs: 20, inputTokens: 100, outputTokens: 1 }]
    expect(summarize(rows)).toMatchObject({ falseSafeRate: 0.5, highRiskRecall: 0, highRiskContainment: 0.5,
      escalationRate: 0.5, failureCount: 1, estimatedUsd: null, accuracy: { intent: 0.5 }, latencyMs: { p95: 20 } })
    expect(summarize([]).falseSafeRate).toBeNull()
  })
})
