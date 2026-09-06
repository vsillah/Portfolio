import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runChiefOfStaffChat: vi.fn(),
  handleSlackAgentAction: vi.fn(),
  sendUserGmailDraft: vi.fn(),
  decryptRefreshToken: vi.fn(),
  resolveBusinessEmailConfig: vi.fn(),
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

vi.mock('@/lib/gmail-user-api', () => ({
  sendUserGmailDraft: mocks.sendUserGmailDraft,
}))

vi.mock('@/lib/gmail-user-oauth-crypto', () => ({
  decryptRefreshToken: mocks.decryptRefreshToken,
}))

vi.mock('@/lib/business-email-config', () => ({
  resolveBusinessEmailConfig: mocks.resolveBusinessEmailConfig,
}))

import {
  formatChiefOfStaffSlackReply,
  handleSlackAgentEvent,
  normalizeSlackAgentMessage,
  parseRevenueReplyApprovalCommand,
  shouldHandleSlackAgentEvent,
} from './agent-slack-events'

const ORIGINAL_ENV = process.env

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    filter: vi.fn(() => query),
    ilike: vi.fn(() => query),
    update: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }
  return query
}

function slackNotificationEvent(actions: Array<Record<string, unknown>>) {
  return queryResult({
    data: {
      metadata: {
        blocks: [
          {
            type: 'actions',
            elements: actions.map((action) => ({
              type: 'button',
              value: JSON.stringify(action),
            })),
          },
        ],
      },
    },
    error: null,
  })
}

describe('agent Slack events', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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
      SLACK_AGENT_OPS_LOCAL_BASE_URL: 'https://amadutown.test',
      SLACK_BOT_TOKEN: 'xoxb-production-fixture',
      SLACK_AGENT_OPS_LOCAL_BOT_TOKEN: 'xoxb-test',
    }
    mocks.from.mockReturnValue(queryResult({ data: null, error: null }))
    mocks.handleSlackAgentAction.mockResolvedValue({
      responseType: 'ephemeral',
      text: 'Blocker acknowledged. Ask Shaka for a next-step recommendation.',
    })
    mocks.decryptRefreshToken.mockReturnValue('refresh-token')
    mocks.resolveBusinessEmailConfig.mockReturnValue({ fromEmail: 'vambah@amadutown.com' })
    mocks.sendUserGmailDraft.mockResolvedValue({ id: 'message-1', threadId: 'thread-1' })
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
      type: 'message',
      channel_type: 'channel',
      user: 'U123',
      channel: 'C123',
      text: 'safe to send *Sent using* ChatGPT',
      ts: '1700000000.000002',
      thread_ts: '1700000000.000001',
    })).toBe(true)

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

  it('parses revenue reply approval phrases conservatively', () => {
    expect(parseRevenueReplyApprovalCommand('safe to send')).toEqual({ action: 'safe_to_send' })
    expect(parseRevenueReplyApprovalCommand('Safe to send.')).toEqual({ action: 'safe_to_send' })
    expect(parseRevenueReplyApprovalCommand('safe to send *Sent using* ChatGPT')).toEqual({ action: 'safe_to_send' })
    expect(parseRevenueReplyApprovalCommand('Safe to send. *Sent using* ChatGPT')).toEqual({ action: 'safe_to_send' })
    expect(parseRevenueReplyApprovalCommand('hold')).toEqual({ action: 'hold', note: 'hold' })
    expect(parseRevenueReplyApprovalCommand('hold *Sent using* ChatGPT')).toEqual({ action: 'hold', note: 'hold' })
    expect(parseRevenueReplyApprovalCommand('modify: tighten the opening')).toEqual({
      action: 'modify',
      note: 'tighten the opening',
    })
    expect(parseRevenueReplyApprovalCommand('modify: tighten the opening *Sent using* ChatGPT')).toEqual({
      action: 'modify',
      note: 'tighten the opening',
    })
    expect(parseRevenueReplyApprovalCommand('send it')).toBeNull()
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
      .mockReturnValueOnce(slackNotificationEvent([
        {
          action: 'work.acknowledge',
          workItemId: 'work-1',
          runId: 'run-1',
        },
      ]))

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
      team: { id: undefined },
      channel: { id: 'C123' },
      user: { id: 'U123' },
      action_ts: '1700000000.000003',
      container: { message_ts: '1700000000.000001', channel_id: 'C123' },
      actions: [
        {
          value: JSON.stringify({
            action: 'work.acknowledge',
            workItemId: 'work-1',
            runId: 'run-1',
            note: 'I saw this blocker',
          }),
        },
      ],
    })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body).toContain('Blocker acknowledged')
  })

  it('turns approval thread replies into governed approve actions with notes', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'notification-run' }, error: null }))
      .mockReturnValueOnce(slackNotificationEvent([
        {
          action: 'approval.approve',
          approvalId: 'approval-1',
          runId: 'run-1',
        },
        {
          action: 'approval.reject',
          approvalId: 'approval-1',
          runId: 'run-1',
        },
      ]))

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'EvApprove',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> approve: looks good',
        ts: '1700000000.000004',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, reason: 'thread_reply_action' })
    expect(mocks.handleSlackAgentAction).toHaveBeenCalledWith({
      type: 'block_actions',
      team: { id: undefined },
      channel: { id: 'C123' },
      user: { id: 'U123' },
      action_ts: '1700000000.000004',
      container: { message_ts: '1700000000.000001', channel_id: 'C123' },
      actions: [
        {
          value: JSON.stringify({
            action: 'approval.approve',
            approvalId: 'approval-1',
            runId: 'run-1',
            note: 'looks good',
          }),
        },
      ],
    })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
  })

  it('blocks free-text Gmail send even when a parent message names a draft', async () => {
    const appDraftId = '9abee71a-930d-49e9-a2b5-d929021ec9cb'
    const gmailDraftId = 'r5747226337828186444'
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: appDraftId,
          status: 'draft',
          subject: 'Re: controlled smoke',
          client_email: 'lead@example.com',
        },
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: {
          google_email: 'vambah@amadutown.com',
          refresh_token_cipher: 'cipher',
          refresh_token_iv: 'iv',
          refresh_token_tag: 'tag',
        },
        error: null,
      }))
      .mockReturnValueOnce(queryResult({ data: { id: appDraftId }, error: null }))

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            {
              ts: '1700000000.000001',
              text: [
                ':incoming_envelope: *Revenue reply ready for approval*',
                `*App draft ID:* ${appDraftId}`,
                `*Gmail draft ID:* ${gmailDraftId}`,
                'Reply in Codex or Slack with: `safe to send`, `modify: ...`, or `hold`.',
              ].join('\n'),
            },
          ],
        }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1700000000.000010' }),
      } as never)

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'EvRevenueSend',
      event: {
        type: 'message',
        channel_type: 'channel',
        user: 'U123',
        channel: 'C123',
        text: 'safe to send *Sent using* ChatGPT',
        ts: '1700000000.000009',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, reason: 'revenue_reply_approval_action' })
    expect(mocks.decryptRefreshToken).not.toHaveBeenCalled()
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body).toContain('No send, hold, or revision was recorded')
  })

  it('does not reach Gmail credentials or sender from revenue text', async () => {
    const appDraftId = '9abee71a-930d-49e9-a2b5-d929021ec9cb'
    const gmailDraftId = 'r5747226337828186444'
    mocks.sendUserGmailDraft.mockRejectedValueOnce(new Error('Recipient address required'))
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: appDraftId,
          status: 'draft',
          subject: 'Re: controlled smoke',
          client_email: 'lead@example.com',
        },
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: {
          google_email: 'vambah@amadutown.com',
          refresh_token_cipher: 'cipher',
          refresh_token_iv: 'iv',
          refresh_token_tag: 'tag',
        },
        error: null,
      }))

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            {
              ts: '1700000000.000001',
              text: [
                ':incoming_envelope: *Revenue reply ready for approval*',
                `*App draft ID:* ${appDraftId}`,
                `*Gmail draft ID:* ${gmailDraftId}`,
              ].join('\n'),
            },
          ],
        }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1700000000.000010' }),
      } as never)

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'EvRevenueSendFailure',
      event: {
        type: 'message',
        channel_type: 'channel',
        user: 'U123',
        channel: 'C123',
        text: 'safe to send *Sent using* ChatGPT',
        ts: '1700000000.000009',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, reason: 'revenue_reply_approval_action' })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body).toContain('No send, hold, or revision was recorded')
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body).toContain('No send, hold, or revision was recorded')
  })

  it('does not claim a revenue hold was persisted', async () => {
    const appDraftId = '9abee71a-930d-49e9-a2b5-d929021ec9cb'
    const gmailDraftId = 'r5747226337828186444'
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: appDraftId,
          status: 'draft',
          subject: 'Re: controlled smoke',
          client_email: 'lead@example.com',
        },
        error: null,
      }))

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            {
              ts: '1700000000.000001',
              text: `*Revenue reply ready for approval*\n*App draft ID:* ${appDraftId}\n*Gmail draft ID:* ${gmailDraftId}`,
            },
          ],
        }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1700000000.000010' }),
      } as never)

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'EvRevenueHold',
      event: {
        type: 'message',
        channel_type: 'channel',
        user: 'U123',
        channel: 'C123',
        text: 'hold',
        ts: '1700000000.000009',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, reason: 'revenue_reply_approval_action' })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1]?.body).toContain('No send, hold, or revision was recorded')
  })

  it('turns rejection thread replies into governed approval rejection actions', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'notification-run' }, error: null }))
      .mockReturnValueOnce(slackNotificationEvent([
        {
          action: 'approval.approve',
          approvalId: 'approval-1',
          runId: 'run-1',
        },
        {
          action: 'approval.reject',
          approvalId: 'approval-1',
          runId: 'run-1',
        },
      ]))

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'EvReject',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> reject: needs changes',
        ts: '1700000000.000005',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, reason: 'thread_reply_action' })
    expect(mocks.handleSlackAgentAction).toHaveBeenCalledWith({
      type: 'block_actions',
      team: { id: undefined },
      channel: { id: 'C123' },
      user: { id: 'U123' },
      action_ts: '1700000000.000005',
      container: { message_ts: '1700000000.000001', channel_id: 'C123' },
      actions: [
        {
          value: JSON.stringify({
            action: 'approval.reject',
            approvalId: 'approval-1',
            runId: 'run-1',
            note: 'needs changes',
          }),
        },
      ],
    })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
  })

  it('turns assignment thread replies into governed work assignment actions', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'notification-run' }, error: null }))
      .mockReturnValueOnce(slackNotificationEvent([
        {
          action: 'work.acknowledge',
          workItemId: 'work-1',
          runId: 'run-1',
        },
        {
          action: 'work.ready',
          workItemId: 'work-1',
          runId: 'run-1',
        },
      ]))

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'EvAssign',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> assign shaka',
        ts: '1700000000.000005',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, reason: 'thread_reply_action' })
    expect(mocks.handleSlackAgentAction).toHaveBeenCalledWith({
      type: 'block_actions',
      team: { id: undefined },
      channel: { id: 'C123' },
      user: { id: 'U123' },
      action_ts: '1700000000.000005',
      container: { message_ts: '1700000000.000001', channel_id: 'C123' },
      actions: [
        {
          value: JSON.stringify({
            action: 'work.assign',
            workItemId: 'work-1',
            runId: 'run-1',
            agentKey: 'shaka',
          }),
        },
      ],
    })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
  })

  it('falls back to Chief of Staff chat when a thread reply targets multiple work items', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'notification-run' }, error: null }))
      .mockReturnValueOnce(slackNotificationEvent([
        {
          action: 'work.acknowledge',
          workItemId: 'work-1',
          runId: 'run-1',
        },
        {
          action: 'work.acknowledge',
          workItemId: 'work-2',
          runId: 'run-1',
        },
      ]))

    const result = await handleSlackAgentEvent({
      type: 'event_callback',
      event_id: 'EvAmbiguous',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> acknowledge',
        ts: '1700000000.000006',
        thread_ts: '1700000000.000001',
      },
    })

    expect(result).toEqual({ handled: true, runId: 'run-123' })
    expect(mocks.handleSlackAgentAction).not.toHaveBeenCalled()
    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith({
      message: 'acknowledge',
      userId: 'slack:U123',
      triggerSource: 'slack_agent_thread_reply',
      contextRef: { type: 'run', id: 'notification-run' },
    })
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
  it.each(['app_mention', 'dm', 'thread'])('rejects an unlisted %s actor before DB, model, or Slack access', async (kind) => {
    process.env.SLACK_AGENT_OPS_ALLOWED_USER_IDS = 'U_ALLOWED'
    const result = await handleSlackAgentEvent({ event: {
      type: kind === 'app_mention' ? 'app_mention' : 'message',
      user: 'U_OTHER', channel: 'C1', channel_type: 'im',
      text: kind === 'thread' ? 'safe to send' : 'status',
      ...(kind === 'thread' ? { thread_ts: '1.0' } : {}),
    } })
    expect(result).toMatchObject({ handled: false, reason: 'unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
  })

  it('rejects a valid operator from a different workspace before reads', async () => {
    process.env.SLACK_AGENT_OPS_TEAM_ID = 'T_ALLOWED'
    const result = await handleSlackAgentEvent({ team_id: 'T_OTHER', event: { type: 'app_mention', user: 'U123', channel: 'C1', text: 'status' } })
    expect(result).toMatchObject({ handled: false, reason: 'unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['http', 'transport'])('reports failed Slack delivery after a successful chat result (%s)', async (failure) => {
    if (failure === 'http') vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ ok: false }) } as never)
    else vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    const result = await handleSlackAgentEvent({ event: { type: 'app_mention', user: 'U123', channel: 'C1', text: 'status' } })
    expect(result).toMatchObject({ handled: true, runId: 'run-123', deliveryStatus: 'failed' })
    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledOnce()
  })

  it('blocks modify text even when no trustworthy draft context is available', async () => {
    const result = await handleSlackAgentEvent({ event: { type: 'message', user: 'U123', channel: 'C1', text: 'modify: change the greeting', thread_ts: '1.0' } })
    expect(result).toMatchObject({ handled: true, reason: 'revenue_reply_approval_action' })
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body).toContain('No send, hold, or revision was recorded')
  })

  it('uses the staging source origin for event trace links despite generic production URLs', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', VERCEL_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', NEXT_PUBLIC_BASE_URL: 'https://amadutown.com', NEXT_PUBLIC_APP_URL: 'https://amadutown.com', SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.test', SLACK_AGENT_OPS_STAGING_BOT_TOKEN: 'xoxb-staging-fixture', SLACK_AGENT_OPS_TEAM_ID: 'T1', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123' }
    const result = await handleSlackAgentEvent({ team_id: 'T1', event: { type: 'app_mention', user: 'U123', channel: 'C1', text: 'status' } })
    expect(result).toMatchObject({ handled: true, runId: 'run-123' })
    const reply = vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body
    expect(reply).toContain('https://staging.example.test/admin/agents/runs/run-123')
    expect(reply).not.toContain('https://amadutown.com')
  })

  it('rejects event processing with a missing staging origin before reads or delivery', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', NEXT_PUBLIC_BASE_URL: 'https://amadutown.com', SLACK_AGENT_OPS_STAGING_BASE_URL: '', VERCEL_URL: '', SLACK_AGENT_OPS_TEAM_ID: 'T1', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123' }
    expect(await handleSlackAgentEvent({ team_id: 'T1', event: { type: 'app_mention', user: 'U123', channel: 'C1', text: 'status' } })).toMatchObject({ handled: false, reason: 'invalid_source_configuration' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses only the scoped staging token for both thread reads and replies', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', VERCEL_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', NEXT_PUBLIC_BASE_URL: 'https://amadutown.com', SLACK_BOT_TOKEN: 'xoxb-production-fixture', SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.test', SLACK_AGENT_OPS_STAGING_BOT_TOKEN: 'xoxb-staging-fixture', SLACK_AGENT_OPS_TEAM_ID: 'T1', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123' }
    const result = await handleSlackAgentEvent({ team_id: 'T1', event: { type: 'message', user: 'U123', channel: 'C1', text: 'safe to send', thread_ts: '1.0' } })
    expect(result).toMatchObject({ handled: true, reason: 'revenue_reply_approval_action' })
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2)
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer xoxb-staging-fixture' })
      expect(JSON.stringify(init)).not.toContain('xoxb-production-fixture')
    }
  })

  it('rejects staging with only a generic production bot token before any work', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', NEXT_PUBLIC_BASE_URL: 'https://amadutown.com', SLACK_BOT_TOKEN: 'xoxb-production-fixture', SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.test', SLACK_AGENT_OPS_STAGING_BOT_TOKEN: '', SLACK_AGENT_OPS_TEAM_ID: 'T1', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123' }
    const result = await handleSlackAgentEvent({ team_id: 'T1', event: { type: 'app_mention', user: 'U123', channel: 'C1', text: 'status' } })
    expect(result).toEqual({ handled: false, reason: 'missing_source_bot_token' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

})
