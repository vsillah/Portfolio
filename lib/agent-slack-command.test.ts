import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

vi.mock('@/lib/agent-ops-morning-review', () => ({
  runAgentOpsMorningReview: vi.fn(),
}))

const agentRunMocks = vi.hoisted(() => ({
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: agentRunMocks.startAgentRun,
  recordAgentEvent: agentRunMocks.recordAgentEvent,
}))

import { agentSlackCommandInternals, createAgentEngagementSlackText } from '@/lib/agent-slack-command'

describe('agent Slack command parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps supported aliases to command handlers', () => {
    expect(agentSlackCommandInternals.commandFromText('status')).toBe('status')
    expect(agentSlackCommandInternals.commandFromText('failed')).toBe('failed')
    expect(agentSlackCommandInternals.commandFromText('failures')).toBe('failed')
    expect(agentSlackCommandInternals.commandFromText('approval')).toBe('approvals')
    expect(agentSlackCommandInternals.commandFromText('approvals')).toBe('approvals')
    expect(agentSlackCommandInternals.commandFromText('morning-review')).toBe('morning-review')
    expect(agentSlackCommandInternals.commandFromText('morning')).toBe('morning-review')
    expect(agentSlackCommandInternals.commandFromText('agents')).toBe('agents')
    expect(agentSlackCommandInternals.commandFromText('list')).toBe('agents')
    expect(agentSlackCommandInternals.commandFromText('run chief-of-staff')).toBe('run')
  })

  it('falls back to help for empty or unknown commands', () => {
    expect(agentSlackCommandInternals.commandFromText('')).toBe('help')
    expect(agentSlackCommandInternals.commandFromText('unknown')).toBe('help')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent status')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent run <agent-key>')
  })

  it('formats the mapped agent list for Slack', () => {
    const text = agentSlackCommandInternals.formatAgentListSlackText()

    expect(text).toContain('Agent organization')
    expect(text).toContain('chief-of-staff')
    expect(text).toContain('automation-systems')
    expect(text).toContain('/agent run <agent-key>')
  })

  it('creates a traceable engagement request for a known agent', async () => {
    agentRunMocks.startAgentRun.mockResolvedValue({ id: 'run-123' })
    agentRunMocks.recordAgentEvent.mockResolvedValue({ id: 'event-123' })

    const text = await createAgentEngagementSlackText({
      text: 'run chief-of-staff',
      userId: 'U123',
      userName: 'vambah',
    })

    expect(agentRunMocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'chief-of-staff',
        runtime: 'manual',
        kind: 'agent_engagement_request',
        status: 'queued',
      }),
    )
    expect(agentRunMocks.recordAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-123',
        eventType: 'agent_engagement_requested',
      }),
    )
    expect(text).toContain('Chief of Staff Agent engagement queued')
    expect(text).toContain('/admin/agents/runs/run-123')
  })

  it('rejects unknown agent engagement keys', async () => {
    const text = await createAgentEngagementSlackText({ text: 'run made-up-agent' })

    expect(text).toContain('Unknown agent key')
    expect(agentRunMocks.startAgentRun).not.toHaveBeenCalled()
  })
})
