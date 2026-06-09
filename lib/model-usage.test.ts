import { describe, expect, it } from 'vitest'
import {
  buildModelUsageSnapshotFromEvents,
  buildModelUsageImportPlan,
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

describe('buildModelUsageImportPlan', () => {
  it('normalizes reviewed usage events and subscription allocations', () => {
    const plan = buildModelUsageImportPlan({
      dryRun: true,
      events: [{
        occurredAt: '2026-06-06T12:00:00.000Z',
        provider: 'google',
        runtime: 'api',
        model: 'gemini-2.5-flash',
        taskCategory: 'research',
        clientLabel: 'Acme',
        actionLabel: 'Gemini research import',
        inputTokens: 1000,
        outputTokens: 200,
        sourceTrace: { type: 'gemini_usage_export', id: 'gemini-row-1' },
        sourceMetadata: { exportBatch: 'batch-1' },
      }],
      subscriptionAllocations: [{
        provider: 'codex',
        runtime: 'any',
        accountLabel: 'Codex subscription',
        monthlyCostUsd: 20,
        periodStart: '2026-06-01T00:00:00.000Z',
        periodEnd: '2026-06-30T23:59:59.999Z',
      }],
    }, '2026-06-06T13:00:00.000Z')

    expect(plan.dryRun).toBe(true)
    expect(plan.eventRows[0]).toMatchObject({
      provider: 'google',
      runtime: 'api',
      task_category: 'research',
      client_label: 'Acme',
      total_tokens: 1200,
      source_type: 'gemini_usage_export',
      source_id: 'gemini-row-1',
      scrubbed: true,
    })
    expect(plan.subscriptionAllocationRows[0]).toMatchObject({
      provider: 'codex',
      runtime: 'any',
      account_label: 'Codex subscription',
      monthly_cost_usd: 20,
      allocation_basis: 'token_share',
    })
  })

  it('preserves explicit metered costs while deriving token totals', () => {
    const plan = buildModelUsageImportPlan({
      events: [{
        occurredAt: '2026-06-06T12:00:00.000Z',
        provider: 'openai',
        runtime: 'api',
        model: 'gpt-4o-mini',
        taskCategory: 'automation',
        inputTokens: 1000,
        outputTokens: 200,
        cachedTokens: 50,
        reasoningTokens: 25,
        costUsd: 0.42,
        sourceTrace: { type: 'openai_usage_export', id: 'usage-row-1' },
      }],
    }, '2026-06-06T13:00:00.000Z')

    expect(plan.eventRows[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      input_tokens: 1000,
      output_tokens: 200,
      cached_tokens: 50,
      reasoning_tokens: 25,
      total_tokens: 1275,
      cost_usd: 0.42,
      cost_basis: 'metered',
      confidence: 'medium',
      source_type: 'openai_usage_export',
      source_id: 'usage-row-1',
    })
    expect(plan.eventRows[0].pricing_snapshot).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      importPacket: true,
    })
    expect(plan.warnings).toEqual([])
  })

  it('accepts allocation-only import packets', () => {
    const plan = buildModelUsageImportPlan({
      subscriptionAllocations: [{
        provider: 'codex',
        runtime: 'any',
        accountLabel: 'Codex subscription',
        monthlyCostUsd: 20,
        periodStart: '2026-06-01T00:00:00.000Z',
        periodEnd: '2026-06-30T23:59:59.999Z',
      }],
    })

    expect(plan.eventRows).toEqual([])
    expect(plan.subscriptionAllocationRows).toHaveLength(1)
    expect(plan.subscriptionAllocationRows[0]).toMatchObject({
      provider: 'codex',
      account_label: 'Codex subscription',
      active: true,
    })
  })

  it('rejects empty packets, oversized event batches, and invalid allocation windows', () => {
    expect(() => buildModelUsageImportPlan({})).toThrow(/at least one event or subscription allocation/)

    expect(() => buildModelUsageImportPlan({
      events: Array.from({ length: 101 }, (_, index) => ({
        provider: 'codex',
        model: `gpt-5-codex-${index}`,
      })),
    })).toThrow(/more than 100 usage events/)

    expect(() => buildModelUsageImportPlan({
      subscriptionAllocations: [{
        provider: 'codex',
        runtime: 'any',
        accountLabel: 'Codex subscription',
        monthlyCostUsd: 20,
        periodStart: '2026-06-30T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
      }],
    })).toThrow(/periodEnd must be after periodStart/)
  })

  it('rejects invalid event numerics and dates before building insert rows', () => {
    expect(() => buildModelUsageImportPlan({
      events: [{
        occurredAt: '2026-06-06T12:00:00.000Z',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: -1,
      }],
    })).toThrow(/events\[0\]\.inputTokens must be a non-negative number/)

    expect(() => buildModelUsageImportPlan({
      events: [{
        occurredAt: 'not-a-date',
        provider: 'openai',
        model: 'gpt-4o-mini',
      }],
    })).toThrow(/events\[0\]\.occurredAt must be a valid ISO date/)
  })

  it('warns when imported events omit source trace ids used for duplicate detection', () => {
    const plan = buildModelUsageImportPlan({
      events: [{
        provider: 'google',
        runtime: 'api',
        model: 'gemini-2.5-flash',
        sourceTrace: { type: 'gemini_usage_export' },
      }],
    }, '2026-06-06T13:00:00.000Z')

    expect(plan.eventRows[0]).toMatchObject({
      source_type: 'gemini_usage_export',
      source_id: null,
    })
    expect(plan.warnings).toContain('events[0] has no sourceTrace.id; duplicate detection will be weaker.')
  })

  it('rejects raw prompts, messages, transcripts, and secret-like metadata keys', () => {
    expect(() => buildModelUsageImportPlan({
      events: [{
        provider: 'codex',
        model: 'gpt-5-codex',
        sourceMetadata: { rawPrompt: 'do not store this' },
      }],
    })).toThrow(/not allowed/)

    expect(() => buildModelUsageImportPlan({
      events: [{
        provider: 'codex',
        model: 'gpt-5-codex',
        pricingSnapshot: { apiKey: 'secret' },
      }],
    })).toThrow(/not allowed/)
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

  it('scrubs client-safe events without mutating the internal ledger view', () => {
    const snapshot = buildModelUsageSnapshotFromEvents({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
      events: [event({
        id: 'private-research-run',
        actionLabel: 'Private Codex session for client launch memo',
        taskCategory: 'research',
        confidence: 'medium',
        costBasis: 'catalog_priced',
        pricingSnapshot: {
          sourceUrl: 'https://provider.example/pricing',
          inputUsdPer1MTokens: 3,
          outputUsdPer1MTokens: 15,
        },
        sourceTrace: {
          type: 'agent_run',
          id: 'run-private-1',
          href: '/admin/agents/runs/run-private-1',
        },
      })],
    })

    expect(snapshot.events[0]).toMatchObject({
      actionLabel: 'Private Codex session for client launch memo',
      scrubbed: false,
      sourceTrace: {
        id: 'run-private-1',
        href: '/admin/agents/runs/run-private-1',
      },
      pricingSnapshot: expect.objectContaining({
        sourceUrl: 'https://provider.example/pricing',
      }),
    })
    expect(snapshot.clientSafeEvents[0]).toMatchObject({
      actionLabel: 'Research transaction',
      scrubbed: true,
      sourceTrace: {
        type: 'agent_run',
        id: 'redacted',
        href: null,
      },
      pricingSnapshot: {
        confidence: 'medium',
        costBasis: 'catalog_priced',
      },
    })
  })

  it('requires approval before rerouting expensive research transactions', () => {
    const snapshot = buildModelUsageSnapshotFromEvents({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
      events: [event({
        id: 'expensive-research',
        taskCategory: 'research',
        costUsd: 2.5,
      })],
    })

    expect(snapshot.recommendations.find((item) => item.id === 'research-model-bakeoff')).toMatchObject({
      severity: 'warning',
      approvalRequired: true,
      affectedEventIds: ['expensive-research'],
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
