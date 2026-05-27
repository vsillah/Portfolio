import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runChiefOfStaffChat: vi.fn(),
  handleSlackAgentAction: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/chief-of-staff-chat', () => ({
  runChiefOfStaffChat: mocks.runChiefOfStaffChat,
}))

vi.mock('@/lib/agent-slack-actions', () => ({
  handleSlackAgentAction: mocks.handleSlackAgentAction,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import {
  formatChiefOfStaffSlackReply,
  handleSlackAgentEvent,
  normalizeSlackAgentMessage,
  shouldHandleSlackAgentEvent,
} from './agent-slack-events'

const ORIGINAL_ENV = process.env

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    filter: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }
  return query
}

describe('agent Slack events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1700000000.000001' }),
      }),
    )
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_APP_URL: 'https://amadutown.test',
      SLACK_BOT_TOKEN: 'xoxb-test',
    }
    mocks.from.mockReturnValue(queryResult({ data: null, error: null }))
    mocks.handleSlackAgentAction.mockResolvedValue({
      responseType: 'ephemeral',
      text: 'Blocker acknowledged. Ask Shaka for a next-step recommendation.',
    })
    mocks.runChiefOfStaffChat.mockResolvedValue({
      runId: 'run-123',
      reply: 'Two items need attention.',
      suggestedActions: ['Check blockers', 'Review PR queue'],
      agentEngagements: [
        {
          agentKey: 'chief-of-staff',
          rationale: 'Coordinate the next operating decision.',
        },
      ],
      actionProposals: [],
      model: 'gpt-4o-mini',
      budgetDecision: { status: 'allowed' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = ORIGINAL_ENV
  })

  it('handles app mentions and direct messages only', () => {
    expect(shouldHandleSlackAgentEvent({
      type: 'app_mention',
      user: 'U123',
      channel: 'C123',
      text: '<@BOT> status?',
    })).toBe(true)

    expect(shouldHandleSlackAgentEvent({
      type: 'message',
      channel_type: 'im',
      user: 'U123',
      channel: 'D123',
      text: 'status?',
    })).toBe(true)

    expect(shouldHandleSlackAgentEvent({
      type: 'message',
      channel_type: 'channel',
      user: 'U123',
      channel: 'C123',
      text: 'status?',
    })).toBe(false)

    expect(shouldHandleSlackAgentEvent({
      type: 'message',
      channel_type: 'channel',
      user: 'U123',
      channel: 'C123',
      text: '<@UAGENT> status?',
    })).toBe(false)

    expect(shouldHandleSlackAgentEvent({
      type: 'app_mention',
      bot_id: 'B123',
      user: 'U123',
      channel: 'C123',
      text: '<@BOT> status?',
    })).toBe(false)
  })

  it('normalizes mention text into a freeform Chief of Staff prompt', () => {
    expect(normalizeSlackAgentMessage({
      text: '<@UAGENT>   what is blocked right now?  <@UOTHER>',
    })).toBe('what is blocked right now?')
  })

  it('routes a Slack mention into Chief of Staff chat and replies in thread', async () => {
    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'Ev123',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> what needs attention?',
        ts: '1700000000.000000',
      },
    })

    expect(result).toEqual({ handled: true, runId: 'run-123' })
    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith({
      message: 'what needs attention?',
      userId: 'slack:U123',
      triggerSource: 'slack_agent_chat',
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer xoxb-test',
        }),
        body: expect.stringContaining('"channel":"C123"'),
      }),
    )
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body).toContain('"thread_ts":"1700000000.000000"')
  })

  it('uses matching Slack notification thread context for Shaka replies', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: { id: 'notification-run' }, error: null }))

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'Ev456',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> summarize this blocker',
        ts: '1700000000.000002',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, runId: 'run-123' })
    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith({
      message: 'summarize this blocker',
      userId: 'slack:U123',
      triggerSource: 'slack_agent_thread_reply',
      contextRef: { type: 'run', id: 'notification-run' },
    })
  })

  it('turns simple thread replies into governed Slack work-item actions', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'notification-run' }, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          metadata: {
            blocks: [
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    value: JSON.stringify({
                      action: 'work.acknowledge',
                      workItemId: 'work-1',
                      runId: 'run-1',
                    }),
                  },
                ],
              },
            ],
          },
        },
        error: null,
      }))

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'Ev789',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> acknowledge: I saw this blocker',
        ts: '1700000000.000003',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, reason: 'thread_reply_action' })
    expect(mocks.handleSlackAgentAction).toHaveBeenCalledWith({
      type: 'block_actions',
      user: { id: 'U123' },
      action_ts: '1700000000.000003',
      container: { message_ts: '1700000000.000001' },
      actions: [
        {
          value: JSON.stringify({
            action: 'work.acknowledge',
            workItemId: 'work-1',
            note: 'I saw this blocker',
          }),
        },
      ],
    })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body).toContain('Blocker acknowledged')
  })

  it('formats Chief of Staff replies with trace links', () => {
    const text = formatChiefOfStaffSlackReply({
      runId: 'run-123',
      reply: 'Check the queue.',
      suggestedActions: ['Review blockers'],
      agentEngagements: [
        {
          agentKey: 'automation-systems',
          rationale: 'Inspect workflow health.',
        },
      ],
      actionProposals: [],
      model: 'gpt-4o-mini',
      budgetDecision: { status: 'allowed' },
    } as never)

    expect(text).toContain('Check the queue.')
    expect(text).toContain('*Suggested next actions*')
    expect(text).toContain('`automation-systems` -')
    expect(text).toContain('https://amadutown.test/admin/agents/runs/run-123')
  })
})
