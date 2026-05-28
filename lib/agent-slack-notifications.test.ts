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
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
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

  it('prefers bot-token delivery so Slack threads can be traced back to Portfolio', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test'
    process.env.SLACK_AGENT_OPS_CHANNEL_ID = 'CAGENTOPS'
    process.env.SLACK_AGENT_OPS_WEBHOOK_URL = 'https://hooks.slack.test/agent'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, channel: 'CAGENTOPS', ts: '1770000000.000001' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendAgentSlackNotification({ kind: 'blockers', actorLabel: 'admin' })

    expect(result.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer xoxb-test' }),
        body: expect.stringContaining('"channel":"CAGENTOPS"'),
      }),
    )
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        delivery_mode: 'bot',
        slack_channel: 'CAGENTOPS',
        slack_message_ts: '1770000000.000001',
        slack_thread_ts: '1770000000.000001',
      }),
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      outcome: expect.objectContaining({
        delivery_mode: 'bot',
        slack_channel: 'CAGENTOPS',
        slack_thread_ts: '1770000000.000001',
      }),
    }))
  })

  it('limits work item notification cards to one primary action and one context action', async () => {
    process.env.SLACK_AGENT_OPS_WEBHOOK_URL = 'https://hooks.slack.test/agent'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await sendAgentSlackNotification({ kind: 'blockers' })

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    const actionBlock = payload.blocks.find((block: { type?: string; elements?: unknown[] }) => block.type === 'actions')
    expect(actionBlock.elements).toHaveLength(2)
    expect(JSON.stringify(actionBlock)).toContain('work.assign')
    expect(JSON.stringify(actionBlock)).toContain('Open trace')
  })

  it('builds stale-run Slack cards with mobile triage and trace links', async () => {
    process.env.SLACK_AGENT_OPS_WEBHOOK_URL = 'https://hooks.slack.test/agent'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: [
          {
            id: 'run-stale',
            title: 'Production smoke stale',
            runtime: 'codex',
            status: 'stale',
            current_step: 'Waiting on recovery',
            error_message: 'No heartbeat',
            started_at: '2026-05-25T10:00:00.000Z',
          },
        ],
        error: null,
      }))

    const result = await sendAgentSlackNotification({ kind: 'stale_runs', actorLabel: 'admin' })

    expect(result).toMatchObject({ sent: true, itemCount: 1 })
    const body = fetchMock.mock.calls[0][1].body as string
    expect(body).toContain('Stale or failed Agent Ops runs')
    expect(body).toContain('run.ask_shaka')
    expect(body).toContain('/admin/agents/runs/run-stale')
  })

  it('sends selected-agent standup questions even when no work cards match', async () => {
    process.env.SLACK_AGENT_OPS_WEBHOOK_URL = 'https://hooks.slack.test/agent'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    mocks.listAgentWorkItems.mockResolvedValue([])

    const result = await sendAgentSlackNotification({
      kind: 'selected_agent_question',
      message: 'What changed since the last standup?',
      targetAgentKeys: ['chief-of-staff', 'research-source-register'],
    })

    expect(result).toMatchObject({
      sent: true,
      itemCount: 0,
      text: 'Standup question for selected agents: 2 agent(s) asked.',
    })
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(JSON.stringify(payload.blocks)).toContain('What changed since the last standup?')
    expect(JSON.stringify(payload.blocks)).toContain('Shaka (Zulu) - Chief of Staff')
    expect(JSON.stringify(payload.blocks)).toContain('Askia Muhammad (Songhai) - Research Source Register')
    expect(JSON.stringify(payload.blocks)).toContain('No active Kanban cards are currently assigned')
    expect(JSON.stringify(payload.blocks)).toContain('/admin/agents/standup')
  })
})
