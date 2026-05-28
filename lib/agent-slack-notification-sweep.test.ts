import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildAgentSlackNotificationPayload: vi.fn(),
  sendAgentSlackNotification: vi.fn(),
}))

vi.mock('@/lib/agent-slack-notifications', () => ({
  buildAgentSlackNotificationPayload: mocks.buildAgentSlackNotificationPayload,
  sendAgentSlackNotification: mocks.sendAgentSlackNotification,
}))

import { runAgentSlackNotificationSweep } from '@/lib/agent-slack-notification-sweep'

describe('Agent Ops proactive Slack notification sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buildAgentSlackNotificationPayload.mockResolvedValue({
      text: 'No work',
      blocks: [],
      itemCount: 0,
    })
    mocks.sendAgentSlackNotification.mockResolvedValue({
      ok: true,
      runId: 'run-1',
      sent: true,
      skipped: false,
      deduped: false,
      itemCount: 2,
      text: 'Sent packet',
    })
  })

  it('skips empty rules without creating Slack notification runs', async () => {
    const result = await runAgentSlackNotificationSweep({ kinds: ['blockers'] })

    expect(result).toMatchObject({
      ok: true,
      totalRules: 1,
      sentCount: 0,
      skippedCount: 1,
      itemCount: 0,
    })
    expect(mocks.sendAgentSlackNotification).not.toHaveBeenCalled()
    expect(result.results[0]).toMatchObject({
      kind: 'blockers',
      skipped: true,
      mode: 'scheduled',
      priority: 'high',
      reason: 'No matching Agent Ops work needs mobile attention.',
    })
  })

  it('evaluates dry runs without sending to Slack', async () => {
    mocks.buildAgentSlackNotificationPayload.mockResolvedValue({
      text: '2 stale runs',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Stale runs' } }],
      itemCount: 2,
    })

    const result = await runAgentSlackNotificationSweep({ kinds: ['stale_runs'], dryRun: true })

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      sentCount: 0,
      skippedCount: 1,
      itemCount: 2,
    })
    expect(mocks.sendAgentSlackNotification).not.toHaveBeenCalled()
    expect(result.results[0].reason).toBe('Dry run only.')
  })

  it('runs only immediate-push candidates when requested', async () => {
    mocks.buildAgentSlackNotificationPayload.mockResolvedValue({
      text: 'Mobile decision needed',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Decision' } }],
      itemCount: 1,
    })

    const result = await runAgentSlackNotificationSweep({ mode: 'immediate' })

    expect(result).toMatchObject({
      ok: true,
      mode: 'immediate',
      totalRules: 2,
      sentCount: 2,
      itemCount: 4,
    })
    expect(mocks.sendAgentSlackNotification).toHaveBeenCalledTimes(2)
    expect(mocks.sendAgentSlackNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({
      kind: 'pending_approvals',
      dedupeWindowHours: 1,
    }))
    expect(mocks.sendAgentSlackNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: 'goal_decisions',
      dedupeWindowHours: 4,
    }))
    expect(result.results.every((item) => item.triggerModes.includes('immediate'))).toBe(true)
  })

  it('scopes immediate goal-decision packets to a goal id', async () => {
    mocks.buildAgentSlackNotificationPayload.mockResolvedValue({
      text: 'Goal decision needed',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Goal decision' } }],
      itemCount: 1,
    })

    const result = await runAgentSlackNotificationSweep({
      mode: 'immediate',
      kinds: ['goal_decisions'],
      goalId: 'goal-1',
    })

    expect(result).toMatchObject({
      ok: true,
      mode: 'immediate',
      totalRules: 1,
      sentCount: 1,
    })
    expect(mocks.buildAgentSlackNotificationPayload).toHaveBeenCalledWith({
      kind: 'goal_decisions',
      goalId: 'goal-1',
    })
    expect(mocks.sendAgentSlackNotification).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'goal_decisions',
      goalId: 'goal-1',
    }))
  })

  it('sends non-empty packets with content-aware dedupe metadata', async () => {
    mocks.buildAgentSlackNotificationPayload.mockResolvedValue({
      text: '2 stale runs',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Stale runs' } }],
      itemCount: 2,
    })

    const result = await runAgentSlackNotificationSweep({
      kinds: ['stale_runs'],
      actorLabel: 'cron',
      triggerSource: 'test_sweep',
    })

    expect(result).toMatchObject({
      ok: true,
      sentCount: 1,
      itemCount: 2,
    })
    expect(mocks.sendAgentSlackNotification).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'stale_runs',
      actorLabel: 'cron',
      triggerSource: 'test_sweep',
      dedupeKey: expect.stringMatching(/^stale_runs:2:[a-f0-9]{16}$/),
      dedupeWindowHours: 4,
    }))
  })

  it('continues evaluating later rules when one rule fails', async () => {
    mocks.buildAgentSlackNotificationPayload
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({
        text: '1 review item',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Review' } }],
        itemCount: 1,
      })

    const result = await runAgentSlackNotificationSweep({ kinds: ['blockers', 'review_ready'] })

    expect(result.ok).toBe(false)
    expect(result.errorCount).toBe(1)
    expect(result.sentCount).toBe(1)
    expect(result.results[0]).toMatchObject({ kind: 'blockers', error: 'database unavailable' })
    expect(result.results[1]).toMatchObject({ kind: 'review_ready', sent: true })
  })
})
