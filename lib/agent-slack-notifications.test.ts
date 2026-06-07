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

function queryResult(result: unknown, promiseMethods: Array<'in' | 'limit' | 'maybeSingle'> = ['limit', 'maybeSingle']) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
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
    expect(blocks).toContain('/admin/agents/coordination?approvalRunId=run-protected')
    expect(blocks).toContain('approval.ask_shaka')
    expect(blocks).not.toContain('agent_approval_approve')
    expect(blocks).not.toContain('approval.approve')
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
