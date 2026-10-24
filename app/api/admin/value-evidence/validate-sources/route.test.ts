import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  runBenchmarkValidation: vi.fn(),
  runPainPointEvidenceValidation: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/source-validator', () => ({
  runBenchmarkValidation: mocks.runBenchmarkValidation,
  runPainPointEvidenceValidation: mocks.runPainPointEvidenceValidation,
  PPE_MAX_ROWS: 500,
  PROMPT_VERSION: 'ppe-faithfulness-v1',
  JUDGE_VERSION: '2a.0.0',
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { GET, POST } from './route'

function post(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/validate-sources', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function get(query = '') {
  return new NextRequest(`http://localhost/api/admin/value-evidence/validate-sources${query}`)
}

describe('value-evidence validate-sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(post({}))

    expect(response.status).toBe(401)
    expect(mocks.runBenchmarkValidation).not.toHaveBeenCalled()
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('rejects an unsupported table, an unknown mode, and sample-audit on benchmarks', async () => {
    const table = await POST(post({ table: 'orders' }))
    expect(table.status).toBe(400)
    await expect(table.json()).resolves.toEqual({
      error: 'Unsupported table "orders". Supported: industry_benchmarks, pain_point_evidence',
    })

    const mode = await POST(post({ mode: 'all' }))
    expect(mode.status).toBe(400)
    await expect(mode.json()).resolves.toEqual({
      error: 'Invalid mode "all". Expected one of: stale, pending, forced, sample-audit',
    })

    const sample = await POST(post({ table: 'industry_benchmarks', mode: 'sample-audit' }))
    expect(sample.status).toBe(400)
    await expect(sample.json()).resolves.toEqual({
      error: 'mode="sample-audit" is only supported for pain_point_evidence.',
    })
    expect(mocks.runBenchmarkValidation).not.toHaveBeenCalled()
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('defaults an empty body and clamps benchmark limits before validation', async () => {
    mocks.runBenchmarkValidation.mockResolvedValue({
      summary: { table: 'industry_benchmarks', mode: 'stale', attempted: 1, validated: 1 },
      items: [{ id: 'b-1' }],
    })

    const response = await POST(post('{'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      summary: { table: 'industry_benchmarks', mode: 'stale', attempted: 1, validated: 1 },
      items: [{ id: 'b-1' }],
    })
    expect(mocks.runBenchmarkValidation).toHaveBeenCalledWith({
      mode: 'stale',
      limit: 100,
      staleDays: 30,
    })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.from).toHaveBeenCalledWith('source_validation_runs')
  })

  it('clamps out-of-range limits and stale days for benchmark runs', async () => {
    mocks.runBenchmarkValidation.mockResolvedValue({ summary: { attempted: 0 }, items: [] })

    await POST(post({ limit: 9000, staleDays: 0 }))
    expect(mocks.runBenchmarkValidation).toHaveBeenCalledWith({
      mode: 'stale',
      limit: 500,
      staleDays: 1,
    })

    await POST(post({ limit: 'nope', staleDays: -4 }))
    expect(mocks.runBenchmarkValidation).toHaveBeenLastCalledWith({
      mode: 'stale',
      limit: 100,
      staleDays: 1,
    })
  })

  it('forces sample-audit dry-run, a 20-row cap, and the Haiku judge', async () => {
    mocks.runPainPointEvidenceValidation.mockResolvedValue({
      summary: { attempted: 2, validated: 1, llm_cost_usd: 0.01, table: 'pain_point_evidence' },
      items: [{ id: 'ppe-1' }],
    })

    const response = await POST(post({
      table: 'pain_point_evidence',
      mode: 'sample-audit',
      limit: 100,
      dryRun: false,
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.model).toBe('claude-3-5-haiku-20241022')
    expect(body.items).toEqual([{ id: 'ppe-1', prompt_version: 'ppe-faithfulness-v1' }])
    expect(body.prompt_version).toBe('ppe-faithfulness-v1')
    expect(body.cost_usd).toBe(0.01)
    expect(mocks.runPainPointEvidenceValidation).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'sample-audit',
      limit: 20,
      dryRun: true,
      triggeredBy: 'admin:admin-1',
      judge: expect.objectContaining({
        model: 'claude-3-5-haiku-20241022',
        agentRunId: 'run-1',
        runtime: 'manual',
      }),
    }))
    expect(mocks.from).not.toHaveBeenCalledWith('source_validation_runs')
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      status: 'completed',
    }))
  })

  it('persists a non-sample pain-point run and still returns success if logging fails', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'log table missing' } })
    mocks.from.mockReturnValue({ insert })
    mocks.runPainPointEvidenceValidation.mockResolvedValue({
      summary: {
        table: 'pain_point_evidence',
        mode: 'pending',
        attempted: 1,
        validated: 0,
        rejected: 1,
        quarantined: 0,
        errors: 0,
        faithful: 0,
        unfaithful: 1,
        insufficient: 0,
        llm_tokens_in: 10,
        llm_tokens_out: 4,
        llm_cost_usd: 0.02,
        duration_ms: 15,
        dry_run: true,
        triggered_by: 'admin:admin-1',
      },
      items: [],
    })

    const response = await POST(post({
      table: 'pain_point_evidence',
      mode: 'pending',
      limit: 1.5,
      dryRun: true,
      staleDays: 2.5,
    }))

    expect(response.status).toBe(200)
    expect(mocks.runPainPointEvidenceValidation).toHaveBeenCalledWith(expect.objectContaining({
      limit: 1.5,
      staleDays: 2.5,
      dryRun: true,
    }))
    expect(mocks.runPainPointEvidenceValidation.mock.calls[0][0].judge.model).toBeUndefined()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      table_name: 'pain_point_evidence',
      mode: 'pending',
      dry_run: true,
      faithful: 0,
      unfaithful: 1,
      llm_cost_usd: 0.02,
      triggered_by: 'admin:admin-1',
    }))
  })

  it('turns a budget overrun into a curated 400 and hides other run failures', async () => {
    mocks.runPainPointEvidenceValidation.mockRejectedValueOnce(new Error('Estimated cost $4 exceeds the cap'))
    const budget = await POST(post({ table: 'pain_point_evidence' }))
    expect(budget.status).toBe(400)
    await expect(budget.json()).resolves.toEqual({
      error: 'This source validation request is over the current Agent Ops budget limit. Lower the row limit or use sample-audit before retrying.',
      agentRunId: 'run-1',
    })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith('run-1', 'Estimated cost $4 exceeds the cap', {
      table: 'pain_point_evidence',
      mode: 'stale',
      operation: 'source_validator_llm_judge',
    })

    mocks.runPainPointEvidenceValidation.mockRejectedValueOnce('boom')
    const failed = await POST(post({ table: 'pain_point_evidence', mode: 'forced' }))
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({
      error: 'Source validation run failed. See server logs for details.',
    })
    expect(mocks.markAgentRunFailed).toHaveBeenLastCalledWith('run-1', 'unknown error', expect.objectContaining({
      mode: 'forced',
    }))
  })

  it('summarizes pain-point validation counts and exposes benchmark read errors', async () => {
    mocks.from.mockImplementation((table: string) => ({
      select: vi.fn().mockResolvedValue(table === 'pain_point_evidence'
        ? {
            data: [
              { source_validation_status: 'validated', excerpt_faithfulness_status: 'faithful', last_validated_at: '2026-01-01T00:00:00.000Z' },
              { source_validation_status: 'quarantined', excerpt_faithfulness_status: 'faithful', last_validated_at: '2026-02-01T00:00:00.000Z' },
              { source_validation_status: 'validated', excerpt_faithfulness_status: 'unfaithful', last_validated_at: null },
              { source_validation_status: 'rejected', excerpt_faithfulness_status: 'faithful', last_validated_at: '2026-03-01T00:00:00.000Z' },
              { source_validation_status: null, excerpt_faithfulness_status: null, last_validated_at: null },
              { source_validation_status: 'custom', excerpt_faithfulness_status: 'insufficient', last_validated_at: '2025-12-01T00:00:00.000Z' },
            ],
            error: null,
          }
        : {
            data: null,
            error: { message: 'permission denied for industry_benchmarks' },
          }),
    }))

    const pain = await GET(get('?table=pain_point_evidence'))
    expect(pain.status).toBe(200)
    await expect(pain.json()).resolves.toEqual({
      table: 'pain_point_evidence',
      total: 6,
      by_source: { pending: 1, validated: 2, quarantined: 1, rejected: 1, custom: 1 },
      by_excerpt: { pending: 1, faithful: 3, unfaithful: 1, insufficient: 1 },
      usable: 2,
      blocked: 2,
      last_validated_at: '2026-03-01T00:00:00.000Z',
      prompt_version: 'ppe-faithfulness-v1',
      validator_version: '2a.0.0',
    })

    const benchmarks = await GET(get())
    expect(benchmarks.status).toBe(500)
    await expect(benchmarks.json()).resolves.toEqual({
      error: 'permission denied for industry_benchmarks',
    })
  })

  it('buckets benchmark trust tiers and rejects an unknown status table', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { validation_status: null, trust_tier: null, last_validated_at: '2026-01-02T00:00:00.000Z' },
          { validation_status: 'validated', trust_tier: 3, last_validated_at: '2026-01-03T00:00:00.000Z' },
          { validation_status: 'quarantined', trust_tier: 0, last_validated_at: null },
        ],
        error: null,
      }),
    })

    const response = await GET(get('?table=industry_benchmarks'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      table: 'industry_benchmarks',
      total: 3,
      by_status: { pending: 1, validated: 1, rejected: 0, quarantined: 1 },
      by_tier: { unknown: 1, t1: 0, t2: 0, t3: 1, t4: 0, t5: 0, t0: 1 },
      last_validated_at: '2026-01-03T00:00:00.000Z',
    })

    const unknown = await GET(get('?table=orders'))
    expect(unknown.status).toBe(400)
    await expect(unknown.json()).resolves.toEqual({ error: 'Unsupported table "orders"' })
  })
})
