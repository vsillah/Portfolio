import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listAgentWorkItems: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/agent-work-items', () => ({
  listAgentWorkItems: mocks.listAgentWorkItems,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentEvent: mocks.recordAgentEvent,
  endAgentRun: mocks.endAgentRun,
}))

import { sendAgentSlackNotification } from '@/lib/agent-slack-notifications'

const ORIGINAL_ENV = process.env

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }
  return query
}

describe('Agent Ops Slack notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    mocks.from.mockReturnValue(queryResult({ data: null, error: null }))
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.listAgentWorkItems.mockResolvedValue([
      {
        id: 'work-1',
        title: 'Blocked staging approval',
        objective: 'Resolve the blocker',
        status: 'blocked',
        priority: 'high',
        owner_agent_key: null,
        active_run_id: 'trace-1',
        source_run_id: null,
        blocker_summary: 'Needs owner decision',
        validation_summary: 'Assign owner',
        metadata: {},
        updated_at: '2026-05-23T10:00:00.000Z',
      },
    ])
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    vi.unstubAllGlobals()
  })

  it('builds a trace and skips delivery when the Slack webhook is not configured', async () => {
    const result = await sendAgentSlackNotification({ kind: 'blockers', actorLabel: 'admin' })

    expect(result).toMatchObject({
      ok: true,
      sent: false,
      skipped: true,
      deduped: false,
      itemCount: 1,
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'slack_mobile_notification',
      metadata: expect.objectContaining({ notification_kind: 'blockers', item_count: 1 }),
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'slack_mobile_notification_skipped',
    }))
  })

  it('dedupes repeated mobile notification packets in the same window', async () => {
    mocks.from.mockReturnValueOnce(queryResult({
      data: {
        id: 'existing-run',
        status: 'completed',
        metadata: { item_count: 2, text: 'Existing Slack packet' },
      },
      error: null,
    }))

    const result = await sendAgentSlackNotification({ kind: 'goal_decisions' })

    expect(result).toMatchObject({
      runId: 'existing-run',
      skipped: true,
      deduped: true,
      itemCount: 2,
      text: 'Existing Slack packet',
    })
    expect(mocks.listAgentWorkItems).not.toHaveBeenCalled()
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('posts Block Kit payloads when the Slack webhook is configured', async () => {
    process.env.SLACK_AGENT_OPS_WEBHOOK_URL = 'https://hooks.slack.test/agent'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendAgentSlackNotification({ kind: 'standup_blockers', targetAgentKeys: [] })

    expect(result.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.test/agent',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining("Today's standup blockers"),
      }),
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
    }))
  })
})
