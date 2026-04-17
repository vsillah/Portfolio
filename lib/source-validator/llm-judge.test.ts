import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { judgeBatch, PROMPT_VERSION, JUDGE_VERSION, __internal } from './llm-judge'
import type { ExcerptFaithfulnessClaim } from './llm-judge'

const base: ExcerptFaithfulnessClaim = {
  id: 'row-1',
  excerpt:
    'We run payroll three times per week because our outdated system requires double-entry, costing roughly $12,000/month in staff time.',
  painCategory: 'Payroll inefficiency',
  monetaryIndicator: 12000,
  monetaryContext: 'Weekly payroll run overhead',
}

describe('judgeBatch — dryRun mode', () => {
  it('returns deterministic verdicts with no network call', async () => {
    const out = await judgeBatch([base], { dryRun: true })
    expect(out.dry_run).toBe(true)
    expect(out.cost_usd).toBe(0)
    expect(out.verdicts).toHaveLength(1)
    expect(out.verdicts[0].id).toBe('row-1')
    expect(out.verdicts[0].verdict).toBe('faithful')
    expect(out.prompt_version).toBe(PROMPT_VERSION)
    expect(out.judge_version).toBe(JUDGE_VERSION)
  })

  it('flags short excerpts as insufficient', async () => {
    const short = { ...base, id: 'row-2', excerpt: 'too short' }
    const out = await judgeBatch([short], { dryRun: true })
    expect(out.verdicts[0].verdict).toBe('insufficient')
  })

  it('marks quantified=not_applicable when monetaryIndicator is null', async () => {
    const qualOnly = { ...base, id: 'row-3', monetaryIndicator: null, monetaryContext: null }
    const out = await judgeBatch([qualOnly], { dryRun: true })
    expect(out.verdicts[0].quantified).toBe('not_applicable')
  })

  it('marks supported=no when excerpt has no overlap with pain category', async () => {
    const mismatch = {
      ...base,
      id: 'row-4',
      excerpt: 'Lovely weather today, nothing about work at all, quite sunny outside in Toronto.',
      painCategory: 'Payroll inefficiency',
    }
    const out = await judgeBatch([mismatch], { dryRun: true })
    expect(out.verdicts[0].supported).toBe('no')
    expect(out.verdicts[0].verdict).toBe('unfaithful')
  })

  it('handles zero input', async () => {
    const out = await judgeBatch([], { dryRun: true })
    expect(out.verdicts).toEqual([])
    expect(out.cost_usd).toBe(0)
  })

  it('rejects batches over 20 items', async () => {
    const big = Array.from({ length: 21 }, (_, i) => ({ ...base, id: `row-${i}` }))
    await expect(judgeBatch(big, { dryRun: true })).rejects.toThrow(/max batch size is 20/)
  })
})

describe('judgeBatch — live mode (fetch mocked)', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-abc'
  })
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
    vi.restoreAllMocks()
  })

  it('calls Anthropic with prompt + system and parses verdicts', async () => {
    const fakeResponse = {
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify([
              {
                id: 'row-1',
                supported: 'yes',
                quantified: 'yes',
                verdict: 'faithful',
                reason: 'Explicit $12k monthly figure matches claim.',
                confidence: 0.93,
              },
            ]),
          },
        ],
        usage: { input_tokens: 500, output_tokens: 80 },
      }),
      text: async () => '',
    }
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse) as unknown as typeof fetch

    const out = await judgeBatch([base], { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toMatch(/haiku/i)
    expect(body.temperature).toBe(0)
    expect(body.system).toContain('strict evidence auditor')
    expect(body.system).toContain('shorter than 20 characters')

    expect(out.verdicts).toHaveLength(1)
    expect(out.verdicts[0].verdict).toBe('faithful')
    expect(out.usage.input_tokens).toBe(500)
    expect(out.cost_usd).toBeGreaterThan(0)
  })

  it('retries on transient failure and eventually succeeds', async () => {
    let calls = 0
    const fetchImpl = vi.fn().mockImplementation(async () => {
      calls += 1
      if (calls < 2) throw new Error('network flake')
      return {
        ok: true,
        json: async () => ({
          content: [{ text: '[{"id":"row-1","supported":"yes","quantified":"yes","verdict":"faithful","reason":"ok","confidence":0.9}]' }],
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
        text: async () => '',
      }
    }) as unknown as typeof fetch
    const out = await judgeBatch([base], { fetchImpl, maxAttempts: 3 })
    expect(calls).toBe(2)
    expect(out.verdicts[0].verdict).toBe('faithful')
  })

  it('throws after exhausting retries', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch
    await expect(judgeBatch([base], { fetchImpl, maxAttempts: 2 })).rejects.toThrow(/after 2 attempts/)
  })

  it('fails fast if ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(judgeBatch([base], {})).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })

  it('fills in "insufficient" placeholders for omitted ids', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify([
              { id: 'row-1', supported: 'yes', quantified: 'yes', verdict: 'faithful', reason: 'ok', confidence: 0.9 },
              // row-2 omitted by the judge
            ]),
          },
        ],
        usage: { input_tokens: 200, output_tokens: 40 },
      }),
      text: async () => '',
    }) as unknown as typeof fetch
    const items = [
      { ...base, id: 'row-1' },
      { ...base, id: 'row-2' },
    ]
    const out = await judgeBatch(items, { fetchImpl })
    expect(out.verdicts).toHaveLength(2)
    expect(out.verdicts[1].id).toBe('row-2')
    expect(out.verdicts[1].verdict).toBe('insufficient')
    expect(out.verdicts[1].confidence).toBe(0)
  })
})

describe('parseBatchResponse', () => {
  it('strips ```json fences', () => {
    const raw = '```json\n[{"id":"a","supported":"yes","quantified":"yes","verdict":"faithful","reason":"x","confidence":0.8}]\n```'
    const out = __internal.parseBatchResponse(raw, [
      { id: 'a', excerpt: 'long enough excerpt here for the test to be valid', painCategory: 'Pain', monetaryIndicator: null, monetaryContext: null },
    ])
    expect(out[0].verdict).toBe('faithful')
  })

  it('extracts array embedded in prose', () => {
    const raw = 'Here is the answer: [{"id":"a","supported":"no","quantified":"no","verdict":"unfaithful","reason":"no match","confidence":0.4}] done.'
    const out = __internal.parseBatchResponse(raw, [
      { id: 'a', excerpt: 'long enough excerpt here for the test to be valid', painCategory: 'Pain', monetaryIndicator: null, monetaryContext: null },
    ])
    expect(out[0].verdict).toBe('unfaithful')
  })
})
