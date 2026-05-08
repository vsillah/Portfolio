import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
}))

import {
  buildAgentRunRecoveryPlan,
  createAgentRunRecoveryRequest,
  findActiveAgentRunRecoveryBackoff,
  isRecoverableAgentRunStatus,
  type AgentRunRecoverySource,
} from '@/lib/agent-run-recovery'
import * as agentRun from '@/lib/agent-run'

function sourceRun(overrides: Partial<AgentRunRecoverySource> = {}): AgentRunRecoverySource {
  return {
    id: 'source-run-1',
    agent_key: 'automation-systems',
    runtime: 'n8n',
    kind: 'warm_lead_scrape',
    title: 'Warm lead scrape',
    status: 'failed',
    subject_type: 'workflow',
    subject_id: 'WF-WRM-003',
    subject_label: 'LinkedIn Warm Lead Scraper',
    current_step: 'Normalize webhook payload',
    error_message: 'Webhook returned 500.',
    metadata: {},
    ...overrides,
  }
}

describe('agent run recovery planning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(agentRun.startAgentRun).mockResolvedValue({ id: 'recovery-run-1' })
    vi.mocked(agentRun.recordAgentEvent).mockResolvedValue({ id: 'event-1' })
    vi.mocked(agentRun.attachAgentArtifact).mockResolvedValue({ id: 'artifact-1' })
    vi.mocked(agentRun.endAgentRun).mockResolvedValue(undefined)
  })

  it('only treats failed, stale, and cancelled runs as recoverable', () => {
    expect(isRecoverableAgentRunStatus('failed')).toBe(true)
    expect(isRecoverableAgentRunStatus('stale')).toBe(true)
    expect(isRecoverableAgentRunStatus('cancelled')).toBe(true)
    expect(isRecoverableAgentRunStatus('completed')).toBe(false)
    expect(isRecoverableAgentRunStatus('running')).toBe(false)
  })

  it('builds a read-only retry packet with bounded backoff metadata', () => {
    const plan = buildAgentRunRecoveryPlan({
      sourceRun: sourceRun(),
      previousRecoveryCount: 2,
      now: new Date('2026-05-07T12:00:00.000Z'),
      note: 'Check webhook payload before retry.',
    })

    expect(plan).toMatchObject({
      source_run_id: 'source-run-1',
      source_status: 'failed',
      target_agent_key: 'automation-systems',
      target_agent_name: 'Automation Systems Agent',
      retry_attempt: 3,
      backoff_minutes: 60,
      earliest_retry_at: '2026-05-07T13:00:00.000Z',
      execution_mode: 'read_only_recovery_request',
    })
    expect(plan.summary_markdown).toContain('This request does not re-run production automation')
    expect(plan.summary_markdown).toContain('Check webhook payload before retry.')
  })

  it('uses requested_agent metadata when the original run was routed through another agent', () => {
    const plan = buildAgentRunRecoveryPlan({
      sourceRun: sourceRun({
        agent_key: 'manual-admin',
        metadata: { requested_agent: 'inbox-follow-up' },
        status: 'stale',
      }),
      now: new Date('2026-05-07T12:00:00.000Z'),
    })

    expect(plan.target_agent_key).toBe('inbox-follow-up')
    expect(plan.target_agent_name).toBe('Inbox & Follow-Up Agent')
    expect(plan.next_action).toContain('original runtime is still active')
  })

  it('rejects active or successful runs', () => {
    expect(() =>
      buildAgentRunRecoveryPlan({
        sourceRun: sourceRun({ status: 'completed' }),
      }),
    ).toThrow('Only failed, stale, or cancelled runs can be queued for recovery')
  })

  it('finds the active recovery backoff window for duplicate retry requests', () => {
    const activeBackoff = findActiveAgentRunRecoveryBackoff([
      {
        id: 'old-recovery',
        status: 'completed',
        metadata: {
          retry_attempt: 1,
          earliest_retry_at: '2026-05-07T11:45:00.000Z',
        },
      },
      {
        id: 'next-recovery',
        status: 'completed',
        metadata: {
          retry_attempt: 2,
          earliest_retry_at: '2026-05-07T12:15:00.000Z',
        },
      },
    ], new Date('2026-05-07T12:00:00.000Z'))

    expect(activeBackoff).toEqual({
      recovery_run_id: 'next-recovery',
      retry_attempt: 2,
      earliest_retry_at: '2026-05-07T12:15:00.000Z',
    })
  })

  it('ignores failed or expired recovery backoff windows', () => {
    const activeBackoff = findActiveAgentRunRecoveryBackoff([
      {
        id: 'failed-recovery',
        status: 'failed',
        metadata: {
          retry_attempt: 2,
          earliest_retry_at: '2026-05-07T12:15:00.000Z',
        },
      },
      {
        id: 'expired-recovery',
        status: 'completed',
        metadata: {
          retry_attempt: 1,
          earliest_retry_at: '2026-05-07T11:45:00.000Z',
        },
      },
    ], new Date('2026-05-07T12:00:00.000Z'))

    expect(activeBackoff).toBeNull()
  })

  it('creates recovery and source trace events without executing production work', async () => {
    const result = await createAgentRunRecoveryRequest({
      sourceRun: sourceRun(),
      previousRecoveryCount: 0,
      actor: {
        subjectType: 'agent_run',
        subjectId: 'source-run-1',
        subjectLabel: 'Recovery for Warm lead scrape',
        userId: 'admin-user',
      },
      note: 'Review source payload first.',
      now: new Date('2026-05-07T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      runId: 'recovery-run-1',
      recoveryPacketAttached: true,
      plan: {
        retry_attempt: 1,
        backoff_minutes: 5,
        execution_mode: 'read_only_recovery_request',
      },
    })
    expect(agentRun.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'agent_recovery_request',
      status: 'queued',
      metadata: expect.objectContaining({
        source_run_id: 'source-run-1',
        executes_action: false,
      }),
    }))
    expect(agentRun.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'recovery-run-1',
      eventType: 'agent_recovery_requested',
    }))
    expect(agentRun.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'source-run-1',
      eventType: 'agent_recovery_linked',
      metadata: expect.objectContaining({
        recovery_run_id: 'recovery-run-1',
      }),
    }))
    expect(agentRun.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      outcome: expect.objectContaining({
        executes_action: false,
      }),
    }))
  })
})
