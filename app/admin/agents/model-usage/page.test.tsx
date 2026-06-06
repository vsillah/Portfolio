import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ModelUsagePage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const snapshot = {
  ok: true,
  generatedAt: '2026-06-06T12:00:00.000Z',
  window: { from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T23:59:59.999Z' },
  totals: {
    eventCount: 2,
    totalTokens: 8000,
    inputTokens: 7000,
    outputTokens: 1000,
    costUsd: 12.5,
    meteredCostUsd: 2.5,
    allocatedCostUsd: 10,
    inferredCostUsd: 0,
    acceptedOutputCount: 2,
    tokensPerAcceptedOutput: 4000,
    costPerAcceptedOutput: 6.25,
  },
  byProvider: [{ key: 'codex', label: 'Codex', totalTokens: 6000, costUsd: 10, eventCount: 1, acceptedOutputCount: 1, efficiencyScore: 85 }],
  byModel: [{ key: 'gpt-4o-mini', label: 'gpt-4o-mini', totalTokens: 2000, costUsd: 2.5, eventCount: 1, acceptedOutputCount: 1, efficiencyScore: 90 }],
  byRuntime: [{ key: 'codex', label: 'Codex', totalTokens: 8000, costUsd: 12.5, eventCount: 2, acceptedOutputCount: 2, efficiencyScore: 88 }],
  byTaskCategory: [{ key: 'research', label: 'Research', totalTokens: 8000, costUsd: 12.5, eventCount: 2, acceptedOutputCount: 2, efficiencyScore: 88 }],
  byClientProject: [{ key: 'portfolio', label: 'Portfolio', totalTokens: 8000, costUsd: 12.5, eventCount: 2, acceptedOutputCount: 2, efficiencyScore: 88 }],
  heatmap: [{ date: '2026-06-01', totalTokens: 8000, costUsd: 12.5, eventCount: 2, level: 4 }],
  trend: [{ date: '2026-06-01', totalTokens: 8000, costUsd: 12.5, eventCount: 2 }],
  topDays: [{ date: '2026-06-01', totalTokens: 8000, costUsd: 12.5, eventCount: 2, primaryActivity: 'Research' }],
  topTransactions: [],
  recommendations: [{
    id: 'context-slimming',
    severity: 'warning',
    title: 'Slim repeated context before the next run',
    action: 'Move reusable context into RAG.',
    rationale: 'One transaction used heavy context.',
    affectedEventIds: ['event-1'],
    approvalRequired: false,
  }],
  events: [{
    id: 'event-1',
    occurredAt: '2026-06-01T12:00:00.000Z',
    provider: 'codex',
    runtime: 'codex',
    model: 'gpt-5-codex',
    taskCategory: 'research',
    agentKey: 'research-source-register',
    clientProjectId: null,
    clientLabel: 'Portfolio',
    actionLabel: 'Research transaction',
    inputTokens: 7000,
    outputTokens: 1000,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens: 8000,
    acceptedOutputCount: 1,
    resolvedWorkItemCount: 0,
    retryCount: 0,
    costUsd: 12.5,
    costBasis: 'subscription_prorated',
    confidence: 'medium',
    sourceTrace: { type: 'codex_session', id: 'session-1', href: null },
    scrubbed: false,
  }],
  clientSafeEvents: [],
}

describe('ModelUsagePage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => snapshot,
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders model usage totals, heatmap, recommendations, and transactions', async () => {
    render(<ModelUsagePage />)

    await waitFor(() => expect(screen.getByText('Model Usage And Token Efficiency')).toBeInTheDocument())
    expect(screen.getAllByText('8,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0)
    expect(screen.getByText('Token burn calendar')).toBeInTheDocument()
    expect(screen.getByText('Slim repeated context before the next run')).toBeInTheDocument()
    expect(screen.getByText('Research transaction')).toBeInTheDocument()
  })
})
