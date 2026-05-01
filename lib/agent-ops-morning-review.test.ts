import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/agent-run', () => ({
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
  startAgentRun: vi.fn(),
}))

vi.mock('@/lib/agent-stale-runs', () => ({
  sweepStaleAgentRuns: vi.fn(),
}))

vi.mock('@/lib/hermes-system-health', () => ({
  buildHermesSystemHealthSummary: vi.fn(),
}))

import { buildAgentOpsMorningReviewMarkdown } from './agent-ops-morning-review'

describe('buildAgentOpsMorningReviewMarkdown', () => {
  it('summarizes stale sweep, agent runs, costs, and warnings', () => {
    const markdown = buildAgentOpsMorningReviewMarkdown({
      generatedAt: '2026-05-01T09:00:00.000Z',
      overall: 'warning',
      runId: 'run-1',
      staleSweep: { checked: 4, marked: 1, runIds: ['stale-1'] },
      health: {
        generatedAt: '2026-05-01T09:00:00.000Z',
        overall: 'warning',
        summaryMarkdown: '',
        warnings: ['1 agent run(s) failed in the last 24 hours'],
        signals: {
          database: 'connected',
          n8n: { deploymentTier: 'production', mockEnabled: false, outboundDisabled: false },
          agentRuns24h: { total: 8, failed: 1, stale: 0, running: 2, byRuntime: { n8n: 3 } },
          costs24h: { totalUsd: 0.1234, events: 2 },
          workflows: {
            socialContent: { ok: true, data: [] },
            valueEvidence: { ok: true, data: [] },
            warmLeads: { ok: true, data: [] },
          },
        },
      },
    })

    expect(markdown).toContain('# Agent Ops Morning Review')
    expect(markdown).toContain('Overall: warning')
    expect(markdown).toContain('- Active runs checked: 4')
    expect(markdown).toContain('- Runs marked stale: 1')
    expect(markdown).toContain('- Agent runs: 8')
    expect(markdown).toContain('- Cost total: $0.1234')
    expect(markdown).toContain('- 1 agent run(s) failed in the last 24 hours')
  })
})
