import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runChiefOfStaffChat: vi.fn(),
}))

vi.mock('@/lib/chief-of-staff-chat', () => ({
  runChiefOfStaffChat: mocks.runChiefOfStaffChat,
}))

import {
  formatChiefOfStaffSlackReply,
  handleSlackAgentEvent,
  normalizeSlackAgentMessage,
  shouldHandleSlackAgentEvent,
} from './agent-slack-events'

const ORIGINAL_ENV = process.env

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
