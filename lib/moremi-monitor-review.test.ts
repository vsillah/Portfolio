import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

import {
  createMoremiWarningWorkItems,
  getLatestMoremiMonitorReview,
} from './moremi-monitor-review'

function queryReturning(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => result),
  }
  return query
}

const runRow = {
  id: 'run-moremi-1',
  title: 'Run Moremi AI risk signal monitor',
  status: 'completed',
  current_step: 'Moremi AI risk signal monitor ready',
  error_message: null,
  started_at: '2026-05-12T12:00:00.000Z',
  completed_at: '2026-05-12T12:01:00.000Z',
  outcome: {
    overall: 'warning',
    warning_count: 1,
    enabled_source_feed_count: 5,
    disabled_source_feed_count: 1,
    generated_at: '2026-05-12T12:00:00.000Z',
  },
  metadata: {},
}

const artifactRow = {
  id: 'artifact-1',
  title: 'Moremi AI Risk Signal Monitor - warning',
  artifact_type: 'ai_risk_signal_monitor',
  created_at: '2026-05-12T12:01:00.000Z',
  metadata: {
    summary_markdown: '# Moremi AI Risk Signal Monitor',
    warnings: ['OWASP AIVSS is disabled pending policy approval.'],
    source_feeds: [
      { key: 'owasp-agent-security-initiative', enabled: true },
      { key: 'owasp-aivss', enabled: false },
    ],
    coverage_by_category: { prompt_injection: 2 },
    coverage_by_priority: { standards: 2 },
    safety_boundary: 'Read-only source-feed coverage review.',
  },
}

describe('Moremi monitor review helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty state when no monitor exists', async () => {
    mocks.from.mockReturnValueOnce(queryReturning({ data: [], error: null }))

    const review = await getLatestMoremiMonitorReview()

    expect(review).toMatchObject({
      has_monitor: false,
      run: null,
      warnings: [],
      linked_work_items: [],
      side_effects: {
        work_items_created: false,
        production_mutation_allowed: false,
        live_external_fetch: false,
        client_data_access: false,
      },
    })
  })

  it('returns the latest monitor artifact and linked work items', async () => {
    mocks.from
      .mockReturnValueOnce(queryReturning({ data: [runRow], error: null }))
      .mockReturnValueOnce(queryReturning({ data: [artifactRow], error: null }))
      .mockReturnValueOnce(queryReturning({
        data: [
          {
            id: 'work-1',
            title: 'Review Moremi warning',
            status: 'proposed',
            source_run_id: 'run-moremi-1',
          },
        ],
        error: null,
      }))

    const review = await getLatestMoremiMonitorReview()

    expect(review).toMatchObject({
      has_monitor: true,
      run: {
        id: 'run-moremi-1',
        href: '/admin/agents/runs/run-moremi-1',
        overall: 'warning',
      },
      artifact: {
        id: 'artifact-1',
        summary_markdown: '# Moremi AI Risk Signal Monitor',
      },
      warnings: ['OWASP AIVSS is disabled pending policy approval.'],
      warning_count: 1,
      enabled_source_feed_count: 5,
      disabled_source_feed_count: 1,
      linked_work_items: [
        expect.objectContaining({ id: 'work-1', status: 'proposed' }),
      ],
    })
  })

  it('creates idempotent proposed work items for monitor warnings', async () => {
    mocks.from
      .mockReturnValueOnce(queryReturning({ data: [runRow], error: null }))
      .mockReturnValueOnce(queryReturning({ data: [artifactRow], error: null }))
      .mockReturnValueOnce(queryReturning({ data: [], error: null }))
      .mockReturnValueOnce(queryReturning({ data: [runRow], error: null }))
      .mockReturnValueOnce(queryReturning({ data: [artifactRow], error: null }))
      .mockReturnValueOnce(queryReturning({
        data: [{ id: 'work-1', title: 'Review Moremi warning', status: 'proposed' }],
        error: null,
      }))

    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Review Moremi warning: OWASP AIVSS is disabled pending policy approval.',
      status: 'proposed',
    })

    const result = await createMoremiWarningWorkItems()

    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Review Moremi warning: OWASP AIVSS is disabled pending policy approval.',
      status: 'proposed',
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerRuntime: 'manual',
      sourceRunId: 'run-moremi-1',
      overlapGroup: 'ai-risk-compliance',
      idempotencyKey: expect.stringMatching(/^moremi-warning:run-moremi-1:/),
      metadata: expect.objectContaining({
        moremi_warning_work_item: true,
        warning: 'OWASP AIVSS is disabled pending policy approval.',
        production_mutation_allowed: false,
        live_external_fetch: false,
        client_data_access: false,
      }),
    }))
    expect(result.work_items).toEqual([
      expect.objectContaining({ id: 'work-1', status: 'proposed' }),
    ])
    expect(result.review.linked_work_items).toEqual([
      expect.objectContaining({ id: 'work-1', status: 'proposed' }),
    ])
  })
})
