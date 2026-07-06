import { describe, expect, it } from 'vitest'
import {
  buildModelUsageSnapshotFromEvents,
  buildModelUsageImportPlan,
  clientSafeModelUsageSnapshot,
  computeModelUsageCost,
  inferModelUsageProvider,
  inferTaskCategory,
  modelUsageEventInputFromSourcePacket,
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

    expect(() => buildModelUsageImportPlan({
      events: [{
        provider: 'codex',
        model: 'gpt-5-codex',
        sourceMetadata: { nested: { messages: ['private chat'] } },
      }],
    })).toThrow(/not allowed/)
  })

  it('normalizes source-specific packets for Codex, Claude Code, Gemini, and local models', () => {
    const plan = buildModelUsageImportPlan({
      dryRun: true,
      sourcePackets: [
        {
          kind: 'codex_session',
          sourceId: 'codex-session-1',
          occurredAt: '2026-06-06T12:00:00.000Z',
          taskCategory: 'coding',
          inputTokens: 12_000,
          outputTokens: 1800,
          clientLabel: 'Portfolio',
        },
        {
          kind: 'claude_code_session',
          sourceId: 'claude-code-1',
          model: 'claude-sonnet-4-20250514',
          taskCategory: 'qa',
          inputTokens: 5000,
          outputTokens: 600,
          costUsd: 0,
        },
        {
          kind: 'gemini_usage_export',
          sourceId: 'gemini-row-1',
          model: 'gemini-2.5-flash',
          taskCategory: 'research',
          inputTokens: 1_000_000,
          outputTokens: 100_000,
          costUsd: 0.55,
          exportBatchId: 'batch-1',
        },
        {
          kind: 'local_model_run',
          sourceId: 'local-run-1',
          model: 'llama-3.1-8b',
          taskCategory: 'rag',
          inputTokens: 2000,
          outputTokens: 400,
          executionHost: 'mac-mini',
          deploymentTarget: 'local_device',
        },
      ],
    }, '2026-06-06T13:00:00.000Z')

    expect(plan.eventRows).toHaveLength(4)
    expect(plan.eventRows[0]).toMatchObject({
      provider: 'codex',
      runtime: 'codex',
      source_type: 'codex_session_import',
      source_id: 'codex-session-1',
      cost_basis: 'subscription_prorated',
      confidence: 'medium',
      scrubbed: true,
    })
    expect(plan.eventRows[1]).toMatchObject({
      provider: 'claude_code',
      runtime: 'claude_code',
      source_type: 'claude_code_session_import',
      task_category: 'qa',
    })
    expect(plan.eventRows[2]).toMatchObject({
      provider: 'google',
      runtime: 'api',
      source_type: 'gemini_usage_export',
      source_id: 'gemini-row-1',
      cost_usd: 0.55,
      cost_basis: 'metered',
      raw_metadata: expect.objectContaining({
        importSource: 'gemini_usage_export',
        exportBatchId: 'batch-1',
      }),
    })
    expect(plan.eventRows[3]).toMatchObject({
      provider: 'local',
      runtime: 'local',
      cost_basis: 'local_estimated',
      confidence: 'low',
      raw_metadata: expect.objectContaining({
        executionHost: 'mac-mini',
        deploymentTarget: 'local_device',
      }),
    })
  })

  it('treats OpenAI and Anthropic usage export packets as metered API spend', () => {
    const plan = buildModelUsageImportPlan({
      sourcePackets: [
        {
          kind: 'openai_usage_export',
          sourceId: 'openai-row-1',
          taskCategory: 'automation',
          inputTokens: 1_000_000,
          outputTokens: 100_000,
        },
        {
          kind: 'anthropic_usage_export',
          sourceId: 'anthropic-row-1',
          taskCategory: 'research',
          inputTokens: 200_000,
          outputTokens: 20_000,
          exportBatchId: 'anthropic-export-june',
        },
      ],
    }, '2026-06-06T13:00:00.000Z')

    expect(plan.eventRows).toHaveLength(2)
    expect(plan.eventRows[0]).toMatchObject({
      provider: 'openai',
      runtime: 'api',
      model: 'gpt-4o-mini',
      task_category: 'automation',
      input_tokens: 1_000_000,
      output_tokens: 100_000,
      total_tokens: 1_100_000,
      cost_usd: 0.21,
      source_type: 'openai_usage_export',
      source_id: 'openai-row-1',
      cost_basis: 'metered',
      confidence: 'medium',
      raw_metadata: expect.objectContaining({
        importSource: 'openai_usage_export',
      }),
      pricing_snapshot: expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o-mini',
        sourcePacketKind: 'openai_usage_export',
        importPacket: true,
      }),
    })

    expect(plan.eventRows[1]).toMatchObject({
      provider: 'anthropic',
      runtime: 'api',
      model: 'claude-3-5-sonnet-20241022',
      task_category: 'research',
      input_tokens: 200_000,
      output_tokens: 20_000,
      total_tokens: 220_000,
      cost_usd: 0.9,
      source_type: 'anthropic_usage_export',
      source_id: 'anthropic-row-1',
      cost_basis: 'metered',
      confidence: 'medium',
      raw_metadata: expect.objectContaining({
        importSource: 'anthropic_usage_export',
        exportBatchId: 'anthropic-export-june',
      }),
      pricing_snapshot: expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        sourcePacketKind: 'anthropic_usage_export',
        importPacket: true,
      }),
    })
    expect(plan.warnings).toEqual([])
  })

  it('builds a reviewed source packet without carrying raw private content', () => {
    const event = modelUsageEventInputFromSourcePacket({
      kind: 'open_weight_model_run',
      sourceId: 'local-cloud-run-1',
      model: 'mixtral-open-weight',
      taskCategory: 'planning',
      inputTokens: 3000,
      outputTokens: 500,
      deploymentTarget: 'private_cloud',
      sourceMetadata: { runner: 'ollama', quantization: 'q4' },
    })

    expect(event).toMatchObject({
      provider: 'open_source',
      runtime: 'local',
      model: 'mixtral-open-weight',
      costBasis: 'local_estimated',
      sourceTrace: {
        type: 'open_weight_model_usage_import',
        id: 'local-cloud-run-1',
      },
      sourceMetadata: expect.objectContaining({
        importSource: 'open_weight_model_run',
        deploymentTarget: 'private_cloud',
        runner: 'ollama',
      }),
    })
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

  it('keeps runtime-scoped subscription allocations out of unrelated provider usage', () => {
    const snapshot = buildModelUsageSnapshotFromEvents({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
      events: [
        event({ id: 'codex-session', provider: 'codex', runtime: 'codex', totalTokens: 1000, costUsd: 0, costBasis: 'inferred' }),
        event({ id: 'codex-api-import', provider: 'codex', runtime: 'api', totalTokens: 9000, costUsd: 0, costBasis: 'inferred' }),
      ],
      allocations: [{
        id: 'alloc-codex-runtime',
        provider: 'codex',
        runtime: 'codex',
        accountLabel: 'Codex Pro',
        monthlyCostUsd: 20,
        periodStart: '2026-06-01T00:00:00.000Z',
        periodEnd: '2026-06-30T23:59:59.999Z',
        allocationBasis: 'token_share',
        confidence: 'medium',
      }],
    })

    expect(snapshot.totals.costUsd).toBe(20)
    expect(snapshot.events.find((item) => item.id === 'codex-session')?.costUsd).toBe(20)
    expect(snapshot.events.find((item) => item.id === 'codex-api-import')?.costUsd).toBe(0)
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

    const clientSafe = clientSafeModelUsageSnapshot(snapshot)
    expect(clientSafe.events[0]).toMatchObject({
      actionLabel: 'Research transaction',
      sourceTrace: { id: 'redacted', href: null },
    })
    expect(clientSafe.topTransactions[0]).toMatchObject({
      actionLabel: 'Research transaction',
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
