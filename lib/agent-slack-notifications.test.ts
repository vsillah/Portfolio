import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listAgentWorkItems: vi.fn(),
  buildAgentMissionControlSnapshot: vi.fn(),
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

vi.mock('@/lib/agent-mission-control', () => ({
  buildAgentMissionControlSnapshot: mocks.buildAgentMissionControlSnapshot,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentEvent: mocks.recordAgentEvent,
  endAgentRun: mocks.endAgentRun,
}))

import { buildAgentSlackNotificationPayload, sendAgentSlackNotification } from '@/lib/agent-slack-notifications'

const ORIGINAL_ENV = process.env

function queryResult(result: unknown, promiseMethods: Array<'select' | 'in' | 'limit' | 'maybeSingle'> = ['limit', 'maybeSingle']) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => (promiseMethods.includes('select') ? Promise.resolve(result) : query)),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    in: vi.fn(() => (promiseMethods.includes('in') ? Promise.resolve(result) : query)),
    order: vi.fn(() => query),
    limit: vi.fn(() => (promiseMethods.includes('limit') ? Promise.resolve(result) : query)),
    maybeSingle: vi.fn(() => (promiseMethods.includes('maybeSingle') ? Promise.resolve(result) : query)),
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
    mocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      high_signal_ai_insights: [],
    })
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
    vi.useRealTimers()
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

  it('includes goal tasks that require approval even when they are assigned', async () => {
    mocks.listAgentWorkItems.mockResolvedValue([
      {
        id: 'goal-task-1',
        title: 'Draft n8n workflow proposal',
        objective: 'Create the workflow proposal packet',
        status: 'assigned',
        priority: 'high',
        owner_agent_key: 'automation-systems',
        active_run_id: 'trace-goal-1',
        source_run_id: null,
        blocker_summary: null,
        validation_summary: 'Needs operator approval before activation',
        metadata: {
          goal_id: 'automation:meeting-intake-follow-up-drafts',
          goal_title: 'Automate meeting intake to follow-up drafts',
          requires_approval: true,
        },
        updated_at: '2026-05-23T10:00:00.000Z',
      },
      {
        id: 'goal-task-2',
        title: 'Unrelated goal task',
        objective: 'No decision needed',
        status: 'assigned',
        priority: 'medium',
        owner_agent_key: 'chief-of-staff',
        active_run_id: null,
        source_run_id: null,
        blocker_summary: null,
        validation_summary: null,
        metadata: {
          goal_id: 'automation:other-goal',
          requires_approval: true,
        },
        updated_at: '2026-05-23T10:00:00.000Z',
      },
    ])

    const payload = await sendAgentSlackNotification({
      kind: 'goal_decisions',
      goalId: 'automation:meeting-intake-follow-up-drafts',
    })

    expect(payload).toMatchObject({
      itemCount: 1,
      text: 'Goal tasks needing a decision: 1 item(s).',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        notification_kind: 'goal_decisions',
        goal_id: 'automation:meeting-intake-follow-up-drafts',
        item_count: 1,
      }),
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

  it('allows Slack approval only for low-risk deployment research proposals', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: [
          {
            id: 'approval-low-risk',
            run_id: 'run-low-risk',
            approval_type: 'vercel_deployment_research_proposal',
            status: 'pending',
            metadata: {},
          },
        ],
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: [
          {
            id: 'run-low-risk',
            title: 'Research Vercel deployment risk',
            current_step: 'Review packet evidence',
            status: 'waiting_for_approval',
          },
        ],
        error: null,
      }, ['in']))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'pending_approvals' })

    expect(payload).toMatchObject({
      itemCount: 1,
      text: '1 pending Agent Ops approval(s) need review.',
    })
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('agent_approval_approve')
    expect(blocks).toContain('approval.approve')
    expect(blocks).toContain('Approve Research Vercel deployment risk?')
    expect(blocks).not.toContain('open_decision')
  })

  it('routes protected approval types to Portfolio instead of one-tap Slack approval', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: [
          {
            id: 'approval-protected',
            run_id: 'run-protected',
            approval_type: 'n8n_workflow_activation',
            status: 'pending',
            metadata: {},
          },
        ],
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: [
          {
            id: 'run-protected',
            title: 'Activate production workflow',
            current_step: 'Waiting for human approval',
            status: 'waiting_for_approval',
          },
        ],
        error: null,
      }, ['in']))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'pending_approvals' })

    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Primary action: open Portfolio because this approval crosses a protected boundary.')
    expect(blocks).toContain('open_decision')
    expect(blocks).toContain('/admin/agents/coordination?approvalRunId=run-protected#vercel-autoresearch-approval-gate')
    expect(blocks).toContain('Open gate')
    expect(blocks).toContain('approval.ask_shaka')
    expect(blocks).not.toContain('agent_approval_approve')
    expect(blocks).not.toContain('approval.approve')
  })

  it('builds Content Intelligence calendar approval due packets with Slack handoff decisions and exact gate links', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'))
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    mocks.from.mockReturnValueOnce(queryResult({
      data: [{
        id: 'calendar-approval-1',
        title: 'Agentified TikTok proof cutdown',
        campaign_id: 'campaign-1',
        agent_work_item_id: 'work-1',
        social_content_id: 'social-1',
        channel: 'tiktok',
        campaign_phase: 'proof',
        scheduled_for: '2026-08-15T13:00:00.000Z',
        authorization_status: 'pending',
        due_status: 'due_now',
        metadata: {
          provider_blocked: true,
          provider_boundary: 'TikTok direct post remains manual until app review is approved.',
        },
        social_content_queue: {
          id: 'social-1',
          status: 'draft',
          platform: 'tiktok',
          target_platforms: ['tiktok'],
          social_content_publishes: [],
        },
      }],
      error: null,
    }))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_calendar_approval_due' })

    expect(payload).toMatchObject({
      itemCount: 1,
      text: '1 Content Intelligence calendar approval(s) are stale or due soon.',
      dedupeKey: expect.stringMatching(/^social_calendar_approval_due:[a-f0-9]{16}$/),
    })
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Content calendar approvals are due')
    expect(blocks).toContain('Agentified TikTok proof cutdown')
    expect(blocks).toContain('Visual/media readiness')
    expect(blocks).toContain('Integration Captain / Vambah')
    expect(blocks).toContain('Provider/manual path is visible and fail-closed.')
    expect(blocks).toContain('social_calendar_draft_handoff.approve')
    expect(blocks).toContain('social-calendar-approval/v1')
    expect(blocks).toContain('calendar-approval-1')
    expect(blocks).toContain('Authorize handoff')
    expect(blocks).toContain('Reject')
    expect(blocks).toContain('do not publish, schedule externally, upload, or call providers')
    expect(blocks).toContain('/admin/social-content/social-1?step=visuals#social-visual-assets-gate')
    expect(blocks).not.toContain('approval.approve')
    expect(blocks).not.toContain('agent_approval_approve')
  })

  it('keeps stale calendar rows visible as recovery reminders without sending approvals', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'))
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    mocks.from.mockReturnValueOnce(queryResult({
      data: [{
        id: 'calendar-stale-1',
        title: 'Stale LinkedIn launch post',
        campaign_id: 'campaign-1',
        agent_work_item_id: 'work-1',
        social_content_id: null,
        channel: 'linkedin',
        campaign_phase: 'offer',
        scheduled_for: '2026-08-14T12:00:00.000Z',
        authorization_status: 'pending',
        due_status: 'past_due',
        metadata: {},
        social_content_queue: null,
      }],
      error: null,
    }))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_calendar_approval_due' })

    expect(payload.itemCount).toBe(1)
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Stale LinkedIn launch post')
    expect(blocks).toContain('Window: `stale`')
    expect(blocks).toContain('Release window elapsed before approval.')
    expect(blocks).toContain('/admin/agents/content-intelligence?section=calendar')
    expect(blocks).toContain('Review recovery')
    expect(blocks).not.toContain('social_calendar_draft_handoff.approve')
    expect(blocks).not.toContain('approval.approve')
  })

  it('surfaces overdue or near-due Social Content publish blockers without Slack approval controls', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: [
          {
            id: 'social-x-due',
            topic_extracted: { topic: 'Agentified X thread' },
            platform: 'x',
            target_platforms: ['x'],
            status: 'scheduled',
            scheduled_for: scheduledFor,
            post_text: 'Approved X copy',
            rag_context: null,
          },
        ],
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: [
          {
            content_id: 'social-x-due',
            platform: 'x',
            status: 'pending',
            platform_post_url: null,
          },
        ],
        error: null,
      }, ['in']))
      .mockReturnValueOnce(queryResult({
        data: [
          {
            platform: 'x',
            is_active: true,
            credentials: { access_token: 'redacted-test-token' },
            settings: { profile_handle: 'amadutown' },
          },
        ],
        error: null,
      }, ['select']))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_publish_gate_due' })

    expect(payload).toMatchObject({
      itemCount: 1,
      text: '1 overdue or near-due Social Content item(s) need human QA before scheduled publishing.',
    })
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Scheduled Social Content needs human QA')
    expect(blocks).toContain('Agentified X thread')
    expect(blocks).toContain('Approve X platform submission as a separate gate.')
    expect(blocks).toContain('/admin/social-content/social-x-due?step=submit#social-platform-submission-gate')
    expect(blocks).toContain('Review gate')
    expect(blocks).not.toContain('approval.approve')
    expect(blocks).not.toContain('agent_approval_approve')
  })

  it('does not alert when the provider publish record is already complete', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: [
          {
            id: 'social-published-row',
            topic_extracted: { topic: 'Already posted item' },
            platform: 'x',
            target_platforms: ['x'],
            status: 'scheduled',
            scheduled_for: '2026-08-05T20:00:00.000Z',
            post_text: 'Approved X copy',
            rag_context: null,
          },
        ],
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: [
          {
            content_id: 'social-published-row',
            platform: 'x',
            status: 'published',
            platform_post_url: 'https://x.com/amadutown/status/1',
          },
        ],
        error: null,
      }, ['in']))
      .mockReturnValueOnce(queryResult({
        data: [
          {
            platform: 'x',
            is_active: true,
            credentials: { access_token: 'redacted-test-token' },
            settings: { profile_handle: 'amadutown' },
          },
        ],
        error: null,
      }, ['select']))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_publish_gate_due' })

    expect(payload).toMatchObject({
      itemCount: 0,
      text: 'No overdue or near-due Social Content publish gates need human QA.',
    })
    expect(JSON.stringify(payload.blocks)).not.toContain('Already posted item')
  })

  it('surfaces gate-approved stale X rows as recovery attention without approving or publishing', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    process.env.SOCIAL_CONTENT_SCHEDULED_PUBLISH_STALE_HOURS = '999'
    const scheduledFor = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: [{
          id: 'social-x-stale-approved',
          topic_extracted: { topic: 'Stale approved X post' },
          platform: 'x',
          target_platforms: ['x'],
          status: 'scheduled',
          scheduled_for: scheduledFor,
          post_text: 'Approved X copy ready for provider submission.',
          rag_context: {
            platform_submission_gate: {
              status: 'approved',
              approved_at: '2026-08-13T12:00:00.000Z',
              approved_by: 'admin-1',
              platforms: ['x'],
            },
          },
        }],
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: [{
          content_id: 'social-x-stale-approved',
          platform: 'x',
          status: 'pending',
          platform_post_url: null,
        }],
        error: null,
      }, ['in']))
      .mockReturnValueOnce(queryResult({
        data: [{
          platform: 'x',
          is_active: true,
          credentials: { access_token: 'redacted-test-token' },
          settings: { profile_handle: 'amadutown' },
        }],
        error: null,
      }, ['select']))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_publish_gate_due' })

    expect(payload.itemCount).toBe(1)
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Stale approved X post')
    expect(blocks).toContain('Stale X schedule')
    expect(blocks).toContain('Reschedule and reconfirm, or cancel, in Social Content.')
    expect(blocks).toContain('This reminder does not approve or publish the item.')
    expect(blocks).toContain('Review recovery')
    expect(blocks).toContain('/admin/social-content/social-x-stale-approved?step=status#social-publication-status-gate')
    expect(blocks).not.toContain('open_social_content_submission_gate')
    expect(blocks).not.toContain('approval.approve')
    expect(blocks).not.toContain('agent_approval_approve')
  })

  it('does not classify a near-due gate-approved ready X row as blocked', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: [{
          id: 'social-x-near-ready',
          topic_extracted: { topic: 'Near-due ready X post' },
          platform: 'x',
          target_platforms: ['x'],
          status: 'scheduled',
          scheduled_for: scheduledFor,
          post_text: 'Approved X copy ready for provider submission.',
          rag_context: {
            platform_submission_gate: {
              status: 'approved',
              approved_at: '2026-08-13T12:00:00.000Z',
              approved_by: 'admin-1',
              platforms: ['x'],
            },
          },
        }],
        error: null,
      }))
      .mockReturnValueOnce(queryResult({
        data: [{
          content_id: 'social-x-near-ready',
          platform: 'x',
          status: 'pending',
          platform_post_url: null,
        }],
        error: null,
      }, ['in']))
      .mockReturnValueOnce(queryResult({
        data: [{
          platform: 'x',
          is_active: true,
          credentials: { access_token: 'redacted-test-token' },
          settings: { profile_handle: 'amadutown' },
        }],
        error: null,
      }, ['select']))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_publish_gate_due' })

    expect(payload).toMatchObject({
      itemCount: 0,
      text: 'No overdue or near-due Social Content publish gates need human QA.',
    })
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).not.toContain('Near-due ready X post')
    expect(blocks).not.toContain('Stale X schedule')
  })

  it('uses a capped 30-day lookback, orders overdue blockers first, and dedupes queue rows', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    process.env.SOCIAL_CONTENT_GATE_REMINDER_LOOKBACK_HOURS = '9999'
    const now = Date.now()
    const overdueAt = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString()
    const upcomingAt = new Date(now + 2 * 60 * 60 * 1000).toISOString()
    const queueQuery = queryResult({
      data: [
        {
          id: 'social-upcoming',
          topic_extracted: { topic: 'Upcoming blocked item' },
          platform: 'x',
          target_platforms: ['x'],
          status: 'scheduled',
          scheduled_for: upcomingAt,
          post_text: 'Upcoming copy',
          rag_context: null,
        },
        {
          id: 'social-overdue',
          topic_extracted: { topic: 'Overdue blocked item' },
          platform: 'x',
          target_platforms: ['x'],
          status: 'scheduled',
          scheduled_for: overdueAt,
          post_text: 'Overdue copy',
          rag_context: null,
        },
        {
          id: 'social-overdue',
          topic_extracted: { topic: 'Duplicate overdue item' },
          platform: 'x',
          target_platforms: ['x'],
          status: 'scheduled',
          scheduled_for: overdueAt,
          post_text: 'Duplicate copy',
          rag_context: null,
        },
      ],
      error: null,
    })
    mocks.from
      .mockReturnValueOnce(queueQuery)
      .mockReturnValueOnce(queryResult({
        data: [
          { content_id: 'social-overdue', platform: 'x', status: 'pending', platform_post_url: null },
          { content_id: 'social-upcoming', platform: 'x', status: 'pending', platform_post_url: null },
        ],
        error: null,
      }, ['in']))
      .mockReturnValueOnce(queryResult({
        data: [{
          platform: 'x',
          is_active: true,
          credentials: { access_token: 'redacted-test-token' },
          settings: { profile_handle: 'amadutown' },
        }],
        error: null,
      }, ['select']))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_publish_gate_due' })
    const blocks = JSON.stringify(payload.blocks)
    const gteCalls = (queueQuery.gte as { mock: { calls: unknown[][] } }).mock.calls
    const lookbackStart = new Date(String(gteCalls[0][1])).getTime()

    expect(payload.itemCount).toBe(2)
    expect(now - lookbackStart).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 1000)
    expect(now - lookbackStart).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000)
    expect(blocks.indexOf('Overdue blocked item')).toBeLessThan(blocks.indexOf('Upcoming blocked item'))
    expect(blocks).not.toContain('Duplicate overdue item')
    expect(blocks).toContain('720-hour safety lookback')
  })

  it('surfaces high-priority comment attention with canonical Portfolio review links', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'
    mocks.from.mockReturnValueOnce(queryResult({
      data: [
        {
          id: 'comment-1',
          content_id: 'social-post-1',
          publish_id: 'publish-1',
          platform: 'linkedin',
          author_display_name: 'Community Builder',
          body: 'Can this help a small nonprofit respond faster?',
          classification_status: 'needs_response',
          priority: 'high',
          status: 'visible',
          response_approval_state: 'pending',
          reply_submission_state: 'draft',
          proposed_reply_text: 'Yes. Start with the intake map, then decide which replies deserve automation.',
          provider_capability: {
            supports_reply_submission: true,
            external_submission_enabled: true,
          },
          captured_at: '2026-08-06T14:00:00.000Z',
          metadata: {
            post_title: 'Agentified operating model',
            policy_decision: {
              classification: 'low_risk_acknowledgement',
              human_qa_required: false,
              auto_send: { eligible: true, can_send_now: true },
            },
          },
        },
      ],
      error: null,
    }))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_comment_attention_due' })

    expect(payload).toMatchObject({
      itemCount: 1,
      text: '1 Social Content comment(s) need attention.',
    })
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Social comments need attention')
    expect(blocks).toContain('Agentified operating model')
    expect(blocks).toContain('LinkedIn')
    expect(blocks).toContain('needs_response')
    expect(blocks).toContain('draft')
    expect(blocks).toContain('/admin/social-content/engagement-inbox?comment=comment-1&post=social-post-1&review=reply&source=slack#social-comment-review-gate')
    expect(blocks).toContain('Open gate')
    expect(blocks).toContain('social_comment_reply.approve')
    expect(blocks).toContain('social_comment_reply.reject')
    expect(blocks).toContain('15-minute hold')
  })

  it('routes unverified provider comment replies to Portfolio review instead of Slack approval', async () => {
    mocks.from.mockReturnValueOnce(queryResult({
      data: [
        {
          id: 'comment-manual',
          content_id: 'social-post-2',
          publish_id: 'publish-2',
          platform: 'instagram',
          body: 'Where do I sign up?',
          classification_status: 'needs_response',
          priority: 'high',
          status: 'visible',
          response_approval_state: 'pending',
          reply_submission_state: 'draft',
          proposed_reply_text: 'Open the intake form from the profile link.',
          provider_capability: {
            supports_reply_submission: true,
            external_submission_enabled: false,
          },
          metadata: {
            post_title: 'Instagram launch post',
            policy_decision: {
              classification: 'low_risk_acknowledgement',
              human_qa_required: false,
              auto_send: { eligible: true, can_send_now: true },
            },
          },
        },
      ],
      error: null,
    }))

    const payload = await buildAgentSlackNotificationPayload({ kind: 'social_comment_attention_due' })

    expect(payload.itemCount).toBe(1)
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Portfolio review required')
    expect(blocks).toContain('Open gate')
    expect(blocks).toContain('/admin/social-content/engagement-inbox?comment=comment-manual&post=social-post-2&review=reply&source=slack#social-comment-review-gate')
    expect(blocks).not.toContain('social_comment_reply.approve')
    expect(blocks).not.toContain('social_comment_reply.reject')
  })

  it('uses review-ready work item actions for owned cards waiting on inspection', async () => {
    mocks.listAgentWorkItems.mockResolvedValue([
      {
        id: 'work-review',
        title: 'Review deployment trace',
        objective: 'Inspect the trace before merge',
        status: 'ready_for_review',
        priority: 'high',
        owner_agent_key: 'chief-of-staff',
        active_run_id: 'run-review',
        source_run_id: null,
        blocker_summary: null,
        validation_summary: 'Tests passed',
        metadata: {},
        updated_at: '2026-05-23T11:00:00.000Z',
      },
      {
        id: 'work-merge',
        title: 'Merge approved automation branch',
        objective: 'Confirm branch can be merged',
        status: 'ready_for_merge',
        priority: 'medium',
        owner_agent_key: 'automation-systems',
        active_run_id: null,
        source_run_id: 'run-merge',
        blocker_summary: null,
        validation_summary: 'Approval checkpoint created',
        metadata: {},
        updated_at: '2026-05-23T10:00:00.000Z',
      },
      {
        id: 'work-blocked',
        title: 'Blocked card should not appear',
        objective: 'This is not ready for review',
        status: 'blocked',
        priority: 'urgent',
        owner_agent_key: 'integration-captain',
        active_run_id: 'run-blocked',
        source_run_id: null,
        blocker_summary: 'Waiting on env',
        validation_summary: null,
        metadata: {},
        updated_at: '2026-05-23T12:00:00.000Z',
      },
    ])

    const payload = await buildAgentSlackNotificationPayload({ kind: 'review_ready' })

    expect(payload).toMatchObject({
      itemCount: 2,
      text: 'Review-ready Agent Ops work: 2 item(s).',
    })
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Review-ready Agent Ops work')
    expect(blocks).toContain('work.revision')
    expect(blocks).toContain('agent_work_revision')
    expect(blocks).toContain('/admin/agents/runs/run-review')
    expect(blocks).toContain('/admin/agents/runs/run-merge')
    expect(blocks).not.toContain('work.acknowledge')
    expect(blocks).not.toContain('work.assign')
    expect(blocks).not.toContain('Blocked card should not appear')
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

  it('sends high-signal insight packets with mobile-safe research actions', async () => {
    process.env.SLACK_AGENT_OPS_WEBHOOK_URL = 'https://hooks.slack.test/agent'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    mocks.buildAgentMissionControlSnapshot.mockResolvedValueOnce({
      high_signal_ai_insights: [
        {
          contentId: 'content-1',
          title: 'Anyone can launch an agent now',
          theme: 'Agentic Operating System',
          score: 87,
          recommendation: 'expand',
          recommendationLabel: 'Expand with adjacent AutoResearch',
          ownerAgentKey: 'research-source-register',
          bestContentHref: '/admin/social-content/content-1',
          bestContentUrl: 'https://linkedin.com/posts/example',
          sourcePrdHref: '/docs/agentic-content-research-prds/01-agentic-operating-system-overview.md',
          capturedAt: '2026-06-04T10:00:00.000Z',
          metrics: {
            impressions: 1200,
            views: null,
            reactions: 42,
            likes: 40,
            comments: 9,
            shares: 3,
            reposts: 2,
            engagementRate: 0.0467,
          },
        },
      ],
    })

    const result = await sendAgentSlackNotification({ kind: 'high_signal_insights' })

    expect(result).toMatchObject({
      sent: true,
      itemCount: 1,
      text: expect.stringContaining('High-signal AI insights'),
    })
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    const blocks = JSON.stringify(payload.blocks)
    expect(blocks).toContain('Draft AutoResearch')
    expect(blocks).toContain('insight.draft_autoresearch')
    expect(blocks).toContain('Ask Shaka')
    expect(blocks).toContain('/admin/social-content/content-1')
  })
})
