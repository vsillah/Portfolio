import { describe, expect, it } from 'vitest'
import {
  buildModelUsageSnapshotFromEvents,
  computeModelUsageCost,
  inferModelUsageProvider,
  inferTaskCategory,
  modelUsageEventFromCostEvent,
  type ModelUsageLedgerEvent,
} from './model-usage'

function event(overrides: Partial<ModelUsageLedgerEvent>): ModelUsageLedgerEvent {
  return {
    id: 'event-1',
    occurredAt: '2026-06-01T12:00:00.000Z',
    provider: 'openai',
    runtime: 'codex',
    model: 'gpt-4o-mini',
    taskCategory: 'research',
    agentKey: 'research-source-register',
    clientProjectId: 'client-1',
    clientLabel: 'Acme',
    actionLabel: 'Audit research',
    inputTokens: 1000,
    outputTokens: 500,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens: 1500,
    acceptedOutputCount: 1,
    resolvedWorkItemCount: 0,
    retryCount: 0,
    costUsd: 0.001,
    costBasis: 'metered',
    confidence: 'high',
    sourceTrace: { type: 'agent_run', id: 'run-1', href: '/admin/agents/runs/run-1' },
    scrubbed: false,
    ...overrides,
  }
}

describe('model usage cost and categorization', () => {
  it('keeps Claude Code separate from direct Anthropic API usage', () => {
    expect(inferModelUsageProvider('claude_code session import')).toBe('claude_code')
    expect(inferModelUsageProvider('claude-sonnet-4-20250514')).toBe('anthropic')
  })

  it('computes catalog cost for Gemini usage', () => {
    const result = computeModelUsageCost(
      { input_tokens: 1_000_000, output_tokens: 100_000 },
      'google',
      'gemini-2.5-flash',
    )

    expect(result.costUsd).toBeCloseTo(0.55, 6)
    expect(result.costBasis).toBe('catalog_priced')
    expect(result.pricingSnapshot?.sourceUrl).toContain('google')
  })

  it('infers action categories from audit and workflow metadata', () => {
    expect(inferTaskCategory({ operation: 'meeting_audit_enrichment' })).toBe('research')
    expect(inferTaskCategory({ workflow_key: 'video_generation_prompt_format' })).toBe('video')
    expect(inferTaskCategory({ artifact_type: 'linkedin_post' })).toBe('social')
    expect(inferTaskCategory({ operation: 'gmail_outreach_draft' })).toBe('outreach')
  })
})

describe('buildModelUsageSnapshotFromEvents', () => {
  it('rolls up usage by model, client, task, runtime, and provider', () => {
    const snapshot = buildModelUsageSnapshotFromEvents({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
      generatedAt: '2026-06-06T12:00:00.000Z',
      events: [
        event({ id: 'openai-research', totalTokens: 2000, costUsd: 0.01 }),
        event({
          id: 'claude-code',
          provider: 'claude_code',
          runtime: 'codex',
          model: 'claude-sonnet-4-20250514',
          taskCategory: 'coding',
          clientProjectId: null,
          clientLabel: 'Portfolio',
          totalTokens: 6000,
          costUsd: 0,
          costBasis: 'inferred',
          confidence: 'low',
        }),
      ],
    })

    expect(snapshot.totals).toMatchObject({
      eventCount: 2,
      totalTokens: 8000,
      acceptedOutputCount: 2,
      tokensPerAcceptedOutput: 4000,
    })
    expect(snapshot.byProvider.map((row) => row.key)).toEqual(['claude_code', 'openai'])
    expect(snapshot.byClientProject.find((row) => row.key === 'portfolio')?.totalTokens).toBe(6000)
    expect(snapshot.recommendations.find((item) => item.id === 'usage-source-confidence')).toBeTruthy()
  })

  it('prorates subscription allocations by token share with confidence labels', () => {
    const snapshot = buildModelUsageSnapshotFromEvents({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
      events: [
        event({ id: 'codex-a', provider: 'codex', totalTokens: 1000, costUsd: 0, costBasis: 'inferred', confidence: 'medium' }),
        event({ id: 'codex-b', provider: 'codex', totalTokens: 3000, costUsd: 0, costBasis: 'inferred', confidence: 'medium' }),
      ],
      allocations: [{
        id: 'alloc-1',
        provider: 'codex',
        runtime: 'any',
        accountLabel: 'Codex Pro',
        monthlyCostUsd: 40,
        periodStart: '2026-06-01T00:00:00.000Z',
        periodEnd: '2026-06-30T23:59:59.999Z',
        allocationBasis: 'token_share',
        confidence: 'medium',
      }],
    })

    expect(snapshot.totals.costUsd).toBe(40)
    expect(snapshot.events.find((item) => item.id === 'codex-a')?.costUsd).toBe(10)
    expect(snapshot.events.find((item) => item.id === 'codex-b')?.costUsd).toBe(30)
  })

  it('recommends context slimming for high input-output imbalance', () => {
    const snapshot = buildModelUsageSnapshotFromEvents({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
      events: [event({ id: 'heavy-context', inputTokens: 150_000, outputTokens: 1000, totalTokens: 151_000 })],
    })

    expect(snapshot.recommendations.find((item) => item.id === 'context-slimming')).toMatchObject({
      approvalRequired: false,
    })
  })
})

describe('modelUsageEventFromCostEvent', () => {
  it('converts legacy cost events into auditable usage rows', () => {
    const converted = modelUsageEventFromCostEvent({
      id: 'cost-1',
      occurred_at: '2026-06-01T12:00:00.000Z',
      source: 'llm_openai',
      amount: 0.42,
      reference_type: 'video_prompt',
      reference_id: 'video-1',
      agent_run_id: 'run-1',
      metadata: {
        model: 'gpt-4o-mini',
        prompt_tokens: 100,
        completion_tokens: 50,
        operation: 'video_generation_prompt_format',
      },
    })

    expect(converted).toMatchObject({
      provider: 'openai',
      taskCategory: 'video',
      totalTokens: 150,
      costUsd: 0.42,
      confidence: 'high',
      sourceTrace: { href: '/admin/agents/runs/run-1' },
    })
  })
})
