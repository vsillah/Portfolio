import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  attachAgentArtifact: mocks.attachAgentArtifact,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import {
  buildMoremiRiskSignalMonitorMarkdown,
  runMoremiRiskSignalMonitor,
} from './moremi-risk-signal-monitor'

describe('Moremi risk signal monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-12T12:00:00.000Z'))
    mocks.startAgentRun.mockResolvedValue({ id: 'moremi-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
  })

  it('builds a read-only coverage markdown summary', () => {
    const markdown = buildMoremiRiskSignalMonitorMarkdown({
      generatedAt: '2026-05-12T12:00:00.000Z',
      overall: 'warning',
      enabledSourceFeedCount: 5,
      disabledSourceFeedCount: 1,
      coverageByCategory: {
        agent_autonomy: 2,
        prompt_injection: 2,
        privacy_data: 3,
        regulatory: 2,
        security: 2,
        bias_safety: 2,
        vendor_incident: 0,
        consumer_disclosure: 1,
      },
      coverageByPriority: {
        primary: 2,
        standards: 3,
        vendor: 0,
        news: 0,
        commentary: 0,
      },
      warnings: ['No enabled source feed currently covers vendor_incident.'],
      runId: 'run-1',
    })

    expect(markdown).toContain('Moremi AI Risk Signal Monitor')
    expect(markdown).toContain('Read-only source-feed coverage review.')
    expect(markdown).toContain('vendor_incident: 0 enabled feed(s)')
    expect(markdown).toContain('No enabled source feed currently covers vendor_incident.')
    expect(markdown).toContain('/admin/agents/runs/run-1')
  })

  it('records a read-only Agent Ops run with source-feed coverage artifact', async () => {
    const result = await runMoremiRiskSignalMonitor('test_moremi_risk_monitor')

    expect(result).toMatchObject({
      runId: 'moremi-run-1',
      generatedAt: '2026-05-12T12:00:00.000Z',
      overall: 'warning',
      enabledSourceFeedCount: 5,
      disabledSourceFeedCount: 1,
    })
    expect(result.warnings).toEqual(expect.arrayContaining([
      'No enabled source feed currently covers vendor_incident.',
      'Model Provider Security and Incident Notices is disabled pending policy approval.',
    ]))
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'risk-compliance-intelligence',
      runtime: 'manual',
      kind: 'ai_risk_signal_monitor',
      triggerSource: 'test_moremi_risk_monitor',
      metadata: expect.objectContaining({
        execution_mode: 'scheduled_read_only',
        production_mutation_allowed: false,
        creates_work_items: false,
        live_external_fetch: false,
        client_data_access: false,
      }),
      idempotencyKey: 'moremi-risk-signal-monitor:2026-05-12',
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'moremi-run-1',
      stepKey: 'source_feed_coverage',
      status: 'completed',
      metadata: expect.objectContaining({
        coverage_by_category: expect.objectContaining({ vendor_incident: 0 }),
        coverage_by_priority: expect.objectContaining({ standards: 3 }),
      }),
    }))
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'moremi-run-1',
      artifactType: 'ai_risk_signal_monitor',
      metadata: expect.objectContaining({
        summary_markdown: expect.stringContaining('Moremi AI Risk Signal Monitor'),
        warnings: expect.arrayContaining(['No enabled source feed currently covers vendor_incident.']),
      }),
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'moremi-run-1',
      status: 'completed',
      outcome: expect.objectContaining({
        overall: 'warning',
        production_mutation_allowed: false,
      }),
    }))
  })
})
