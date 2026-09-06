import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  runChiefOfStaffChat: vi.fn(),
  recordAgentEvent: vi.fn(),
  claimAgentWorkItem: vi.fn(),
  getAgentWorkItem: vi.fn(),
  handoffAgentWorkItem: vi.fn(),
  createAgentWorkItem: vi.fn(),
  markAgentWorkItemReadyForKanban: vi.fn(),
  recordAgentWorkItemBlocker: vi.fn(),
  routeAgentInboxItem: vi.fn(),
  authorizeCalendarDraftHandoff: vi.fn(),
  rejectCalendarDraftHandoff: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/chief-of-staff-chat', () => ({
  runChiefOfStaffChat: mocks.runChiefOfStaffChat,
}))

vi.mock('@/lib/agent-run', () => ({
  recordAgentEvent: mocks.recordAgentEvent,
}))

vi.mock('@/lib/agent-work-items', () => ({
  claimAgentWorkItem: mocks.claimAgentWorkItem,
  createAgentWorkItem: mocks.createAgentWorkItem,
  getAgentWorkItem: mocks.getAgentWorkItem,
  handoffAgentWorkItem: mocks.handoffAgentWorkItem,
  markAgentWorkItemReadyForKanban: mocks.markAgentWorkItemReadyForKanban,
  recordAgentWorkItemBlocker: mocks.recordAgentWorkItemBlocker,
}))

vi.mock('@/lib/agent-inbox-routing', () => ({
  routeAgentInboxItem: mocks.routeAgentInboxItem,
}))

vi.mock('@/lib/social-content-calendar-handoff', () => ({
  authorizeCalendarDraftHandoff: mocks.authorizeCalendarDraftHandoff,
  rejectCalendarDraftHandoff: mocks.rejectCalendarDraftHandoff,
}))

import { handleSlackAgentAction, prepareSlackAgentAction } from '@/lib/agent-slack-actions'

const ORIGINAL_ENV = process.env

type QueryMock = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) => Promise<unknown>
}

function queryResult(result: unknown): QueryMock {
  const query = {} as QueryMock
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.maybeSingle = vi.fn(() => Promise.resolve(result))
  query.update = vi.fn(() => query)
  query.insert = vi.fn(() => Promise.resolve(result))
  query.limit = vi.fn(() => Promise.resolve(result))
  query.then = (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return query
}

function payload(value: Record<string, unknown>, userId = 'U123') {
  return {
    type: 'block_actions',
    user: { id: userId, username: 'vambah' },
    action_ts: '1716400000.000',
    container: { message_ts: '1716400000.000' },
    actions: [{ value: JSON.stringify(value) }],
  }
}

describe('Agent Ops Slack actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123',
      SLACK_AGENT_OPS_LOCAL_BASE_URL: 'https://amadutown.com',
    }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects unauthorized Slack users before mutation', async () => {
    const result = await handleSlackAgentAction(payload({ action: 'work.assign', workItemId: 'work-1', agentKey: 'chief-of-staff' }, 'U999'))

    expect(result.text).toContain('not configured')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('dedupes repeated Slack actions before applying work-item mutations', async () => {
    const recordedActionQuery = queryResult({
      data: { id: 'event-1' },
      error: null,
    })
    mocks.from.mockReturnValueOnce(recordedActionQuery)

    const result = await handleSlackAgentAction(payload({
      action: 'work.assign',
      workItemId: 'work-1',
      agentKey: 'integration-captain',
    }))

    expect(result.text).toContain('Already handled this Slack action')
    expect(mocks.from).toHaveBeenCalledWith('agent_run_events')
    expect(recordedActionQuery.select).toHaveBeenCalledWith('id')
    expect(recordedActionQuery.eq).toHaveBeenCalledWith(
      'idempotency_key',
      'slack-agent-action:local-team:local-channel:U123:1716400000.000:work.assign:work-1:integration-captain',
    )
    expect(recordedActionQuery.maybeSingle).toHaveBeenCalled()
    expect(mocks.claimAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.recordAgentEvent).not.toHaveBeenCalled()
  })

  it('uses content id in Slack action idempotency keys for insight buttons', async () => {
    const recordedActionQuery = queryResult({
      data: { id: 'event-1' },
      error: null,
    })
    mocks.from.mockReturnValueOnce(recordedActionQuery)

    const result = await handleSlackAgentAction(payload({
      action: 'insight.draft_autoresearch',
      contentId: 'content-1',
      note: 'Theme: Agentic Operating System',
    }))

    expect(result.text).toContain('Already handled this Slack action')
    expect(recordedActionQuery.eq).toHaveBeenCalledWith(
      'idempotency_key',
      'slack-agent-action:local-team:local-channel:U123:1716400000.000:insight.draft_autoresearch:content-1',
    )
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('uses comment id in Slack action idempotency keys for comment reply buttons', async () => {
    const recordedActionQuery = queryResult({
      data: { id: 'event-1' },
      error: null,
    })
    mocks.from.mockReturnValueOnce(recordedActionQuery)

    const result = await handleSlackAgentAction(payload({
      action: 'social_comment_reply.approve',
      commentId: 'comment-1',
      contentId: 'social-post-1',
    }))

    expect(result.text).toContain('Already handled this Slack action')
    expect(recordedActionQuery.eq).toHaveBeenCalledWith(
      'idempotency_key',
      'slack-agent-action:local-team:local-channel:U123:1716400000.000:social_comment_reply.approve:comment-1',
    )
  })

  it('uses calendar item id in Slack action idempotency keys for content calendar decisions', async () => {
    const recordedActionQuery = queryResult({
      data: { id: 'event-1' },
      error: null,
    })
    mocks.from.mockReturnValueOnce(recordedActionQuery)

    const result = await handleSlackAgentAction(payload({
      action: 'social_calendar_draft_handoff.approve',
      schemaVersion: 'social-calendar-approval/v1',
      calendarItemId: 'calendar-1',
      contentId: 'social-1',
    }))

    expect(result.text).toContain('Already handled this Slack action')
    expect(recordedActionQuery.eq).toHaveBeenCalledWith(
      'idempotency_key',
      'slack-agent-action:local-team:local-channel:U123:1716400000.000:social_calendar_draft_handoff.approve:calendar-1',
    )
    expect(mocks.authorizeCalendarDraftHandoff).not.toHaveBeenCalled()
  })

  it('uses warm Gmail send key in Slack action idempotency keys', async () => {
    const recordedActionQuery = queryResult({
      data: { id: 'event-1' },
      error: null,
    })
    mocks.from.mockReturnValueOnce(recordedActionQuery)

    const result = await handleSlackAgentAction(payload({
      action: 'warm_gmail_send.approve',
      contactId: 42,
      outreachQueueId: 'queue-1',
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
    }))

    expect(result.text).toContain('Already handled this Slack action')
    expect(recordedActionQuery.eq).toHaveBeenCalledWith(
      'idempotency_key',
      'slack-agent-action:local-team:local-channel:U123:1716400000.000:warm_gmail_send.approve:warm-outreach:email-send-queue:v1:message-1',
    )
  })

  it('acknowledges Portfolio-gate URL buttons without mutating state', async () => {
    const result = await handleSlackAgentAction({
      type: 'block_actions',
      user: { id: 'U123', username: 'vambah' },
      action_ts: '1716400000.000',
      actions: [{
        action_id: 'open_social_calendar_approval_gate',
        url: 'https://amadutown.com/admin/agents/content-intelligence?section=calendar&calendar_item=calendar-1',
      }],
    })

    expect(result).toEqual({
      responseType: 'ephemeral',
      actionStatus: 'blocked',
      text: 'Complete this decision in the current Portfolio review gate: https://amadutown.com/admin/agents/content-intelligence?section=calendar&calendar_item=calendar-1',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires Portfolio review for high-risk approvals', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'approval-1',
          run_id: 'run-1',
          approval_type: 'n8n_workflow_activation',
          status: 'pending',
          metadata: { work_item_id: 'work-1' },
        },
        error: null,
      }))

    const result = await handleSlackAgentAction(payload({
      action: 'approval.approve',
      approvalId: 'approval-1',
      runId: 'run-1',
    }))

    expect(result.text).toContain('Portfolio review required')
    expect(mocks.from).toHaveBeenCalledWith('agent_approvals')
  })

  it('approves low-risk proposal approvals and records a Slack trace event', async () => {
    const approvalUpdate = queryResult({ data: { id: 'approval-1', status: 'approved' }, error: null })
    const workItemUpdate = queryResult({ data: { id: 'work-1' }, error: null })
    const runUpdate = queryResult({ error: null })

    mocks.from
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'approval-1',
          run_id: 'run-1',
          approval_type: 'vercel_deployment_research_proposal',
          status: 'pending',
          metadata: { work_item_id: 'work-1' },
        },
        error: null,
      }))
      .mockReturnValueOnce(approvalUpdate)
      .mockReturnValueOnce(queryResult({ error: null }))
      .mockReturnValueOnce(workItemUpdate)
      .mockReturnValueOnce(runUpdate)

    const result = await handleSlackAgentAction(payload({
      action: 'approval.approve',
      approvalId: 'approval-1',
      runId: 'run-1',
      note: 'Looks good from mobile.',
    }))

    expect(result.text).toContain('Approval approved from Slack')
    expect(approvalUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      decision_notes: 'Looks good from mobile.',
    }))
    expect(workItemUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      validation_summary: 'Slack approval recorded. Execution has not been started by this decision.',
    }))
    expect(runUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      current_step: 'Approval recorded; governed continuation not started',
    }))
  })

  it('assigns Kanban work items through the shared work-item service', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.claimAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Unowned blocker',
      active_run_id: 'run-1',
    })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })

    const result = await handleSlackAgentAction(payload({
      action: 'work.assign',
      workItemId: 'work-1',
      agentKey: 'integration-captain',
    }))

    expect(mocks.claimAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      ownerAgentKey: 'integration-captain',
      actorLabel: 'vambah',
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      eventType: 'slack_work_item_assigned',
    }))
    expect(result.text).toContain('Assigned to integration-captain')
  })

  it('records blocker acknowledgement without mutating the work item', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.getAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Blocked mobile action',
      active_run_id: 'run-1',
      source_run_id: null,
    })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })

    const result = await handleSlackAgentAction(payload({
      action: 'work.acknowledge',
      workItemId: 'work-1',
      note: 'Seen on mobile.',
    }))

    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      eventType: 'slack_work_item_blocker_acknowledged',
      metadata: expect.objectContaining({
        work_item_id: 'work-1',
        note: 'Seen on mobile.',
      }),
    }))
    expect(mocks.recordAgentWorkItemBlocker).not.toHaveBeenCalled()
    expect(result.text).toContain('Blocker acknowledged')
  })

  it('asks Shaka for stale-run mobile recovery context', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.runChiefOfStaffChat.mockResolvedValue({
      reply: 'The run is stale because the heartbeat stopped. Open Portfolio before mutating recovery state.',
      runId: 'shaka-run',
    })

    const result = await handleSlackAgentAction(payload({
      action: 'run.ask_shaka',
      runId: 'run-stale',
    }))

    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith(expect.objectContaining({
      triggerSource: 'slack_agent_action',
      contextRef: { type: 'run', id: 'run-stale' },
    }))
    expect(result.text).toContain('heartbeat stopped')
    expect(result.text).toContain('/admin/agents/runs/shaka-run')
  })

  it('asks Shaka for a high-signal insight next-step recommendation without mutating work', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.runChiefOfStaffChat.mockResolvedValue({
      reply: 'Draft a research proposal first; do not publish from Slack.',
      runId: 'shaka-insight-run',
    })

    const result = await handleSlackAgentAction(payload({
      action: 'insight.ask_shaka',
      contentId: 'content-1',
      note: 'Theme: Agentic Operating System\nScore: 87\nRecommendation: Expand with adjacent AutoResearch',
    }))

    expect(mocks.runChiefOfStaffChat).toHaveBeenCalledWith(expect.objectContaining({
      triggerSource: 'slack_agent_insight_action',
      message: expect.stringContaining('Do not publish, schedule, send messages, activate workflows, or mutate customer data.'),
    }))
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(result.text).toContain('Draft a research proposal first')
    expect(result.text).toContain('/admin/agents/runs/shaka-insight-run')
  })

  it('approves prepared low-risk comment replies into a 15-minute hold without provider submission', async () => {
    const commentUpdate = queryResult({ error: null })
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'comment-1',
          content_id: 'social-post-1',
          publish_id: 'publish-1',
          platform: 'linkedin',
          provider: 'linkedin_organization',
          provider_comment_id: 'provider-comment-1',
          proposed_reply_text: 'Thanks for asking. The intake map is the best first step.',
          response_approval_state: 'pending',
          reply_submission_state: 'draft',
          provider_capability: {
            supports_reply_submission: true,
            external_submission_enabled: true,
          },
          metadata: {
            policy_decision: {
              classification: 'low_risk_acknowledgement',
              human_qa_required: false,
              auto_send: { eligible: true, can_send_now: true },
            },
          },
        },
        error: null,
      }))
      .mockReturnValueOnce(commentUpdate)

    const result = await handleSlackAgentAction(payload({
      action: 'social_comment_reply.approve',
      commentId: 'comment-1',
      contentId: 'social-post-1',
      note: 'Looks safe from mobile.',
    }))

    expect(result.text).toContain('Reply approved from Slack')
    expect(result.text).toContain('held for 15 minutes')
    expect(commentUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      response_approval_state: 'approved',
      reply_submission_state: 'approved',
      approved_reply_text: 'Thanks for asking. The intake map is the best first step.',
      metadata: expect.objectContaining({
        reply_hold_until: expect.any(String),
        ui_action_history: [
          expect.objectContaining({
            action: 'approve',
            by: 'slack:U123',
            note: 'Looks safe from mobile.',
          }),
        ],
        slack_reply_decision: expect.objectContaining({
          status: 'approved',
          decision_notes: 'Looks safe from mobile.',
          external_submission_performed: false,
        }),
      }),
    }))
  })

  it('treats duplicate Slack comment reply approvals as already handled from comment metadata', async () => {
    const idempotencyKey = 'slack-agent-action:local-team:local-channel:U123:1716400000.000:social_comment_reply.approve:comment-1'
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'comment-1',
          content_id: 'social-post-1',
          publish_id: 'publish-1',
          platform: 'youtube',
          provider: 'youtube_data_api',
          provider_comment_id: 'provider-comment-1',
          proposed_reply_text: 'Thanks for asking.',
          response_approval_state: 'approved',
          reply_submission_state: 'approved',
          provider_capability: {
            supports_reply_submission: true,
            external_submission_enabled: true,
          },
          metadata: {
            slack_reply_decision: {
              idempotency_key: idempotencyKey,
            },
            policy_decision: {
              classification: 'low_risk_acknowledgement',
              human_qa_required: false,
              auto_send: { eligible: true, can_send_now: true },
            },
          },
        },
        error: null,
      }))

    const result = await handleSlackAgentAction(payload({
      action: 'social_comment_reply.approve',
      commentId: 'comment-1',
      contentId: 'social-post-1',
    }))

    expect(result.text).toContain('Already handled this Slack comment reply action')
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('preserves submitted provider evidence when stale Slack reply buttons are clicked', async () => {
    const commentUpdate = queryResult({ error: null })
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'comment-1',
          content_id: 'social-post-1',
          publish_id: 'publish-1',
          platform: 'youtube',
          provider: 'youtube_data_api',
          provider_comment_id: 'provider-comment-1',
          proposed_reply_text: 'Thanks for asking.',
          approved_reply_text: 'Thanks for asking.',
          response_approval_state: 'rejected',
          reply_submission_state: 'draft',
          reply_provider_comment_id: 'provider-reply-1',
          reply_submitted_at: '2026-08-14T10:57:44.773Z',
          provider_capability: {
            supports_reply_submission: true,
            external_submission_enabled: true,
          },
          metadata: {
            policy_decision: {
              classification: 'low_risk_acknowledgement',
              human_qa_required: false,
              auto_send: { eligible: true, can_send_now: true },
            },
          },
        },
        error: null,
      }))
      .mockReturnValueOnce(commentUpdate)

    const result = await handleSlackAgentAction(payload({
      action: 'social_comment_reply.approve',
      commentId: 'comment-1',
      contentId: 'social-post-1',
      note: 'Approved from stale Slack alert.',
    }))

    expect(result.text).toContain('submitted provider evidence')
    expect(commentUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        ui_action_history: [
          expect.objectContaining({
            action: 'approve',
            by: 'slack:U123',
            note: expect.stringContaining('Existing provider reply evidence remained authoritative.'),
          }),
        ],
        slack_reply_decision: expect.objectContaining({
          status: 'approved',
          existing_submission_preserved: true,
          external_submission_performed: false,
        }),
      }),
    }))
    expect(commentUpdate.update.mock.calls[0][0]).not.toHaveProperty('response_approval_state')
    expect(commentUpdate.update.mock.calls[0][0]).not.toHaveProperty('reply_submission_state')
    expect(commentUpdate.update.mock.calls[0][0]).not.toHaveProperty('reply_provider_comment_id')
    expect(commentUpdate.update.mock.calls[0][0]).not.toHaveProperty('reply_submitted_at')
  })

  it('blocks Slack approval for unverified comment providers', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'comment-2',
          content_id: 'social-post-2',
          publish_id: 'publish-2',
          platform: 'instagram',
          provider: 'meta_graph',
          provider_comment_id: 'provider-comment-2',
          proposed_reply_text: 'Use the link in bio.',
          response_approval_state: 'pending',
          reply_submission_state: 'draft',
          provider_capability: {
            supports_reply_submission: true,
            external_submission_enabled: false,
          },
          metadata: {
            policy_decision: {
              classification: 'low_risk_acknowledgement',
              human_qa_required: false,
              auto_send: { eligible: true, can_send_now: true },
            },
          },
        },
        error: null,
      }))

    const result = await handleSlackAgentAction(payload({
      action: 'social_comment_reply.approve',
      commentId: 'comment-2',
      contentId: 'social-post-2',
    }))

    expect(result.text).toContain('Portfolio review required')
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('authorizes content calendar draft handoffs from Slack without external execution', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.authorizeCalendarDraftHandoff.mockResolvedValue({
      calendarItem: { id: 'calendar-1', authorization_status: 'authorized' },
      socialContentId: 'social-1',
      handoffWorkItemId: 'work-handoff-1',
      handoffKind: 'linkedin_social_content_draft',
    })

    const result = await handleSlackAgentAction(payload({
      action: 'social_calendar_draft_handoff.approve',
      schemaVersion: 'social-calendar-approval/v1',
      calendarItemId: 'calendar-1',
      contentId: 'social-1',
      note: 'Looks ready for internal handoff.',
    }))

    expect(mocks.authorizeCalendarDraftHandoff).toHaveBeenCalledWith(
      'calendar-1',
      { user: { id: 'slack:U123' } },
    )
    expect(result.text).toContain('Content calendar draft handoff authorized from Slack')
    expect(result.text).toContain('/admin/social-content/social-1')
    expect(result.text).toContain('External publishing, provider calls, uploads, scheduling, Gmail, and SMS remain disabled.')
  })

  it('reports already-authorized content calendar handoffs as idempotent from Slack', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.authorizeCalendarDraftHandoff.mockResolvedValue({
      calendarItem: { id: 'calendar-1', authorization_status: 'authorized' },
      socialContentId: 'social-1',
      handoffWorkItemId: 'work-handoff-1',
      handoffKind: 'linkedin_social_content_draft',
      alreadyAuthorized: true,
    })

    const result = await handleSlackAgentAction(payload({
      action: 'social_calendar.approve',
      calendarItemId: 'calendar-1',
    }))

    expect(result.text).toContain('already authorized')
    expect(mocks.authorizeCalendarDraftHandoff).toHaveBeenCalledTimes(1)
    expect(mocks.rejectCalendarDraftHandoff).not.toHaveBeenCalled()
  })

  it('rejects content calendar draft handoffs from Slack and leaves provider actions off', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.rejectCalendarDraftHandoff.mockResolvedValue({
      calendarItem: { id: 'calendar-1', authorization_status: 'rejected' },
      revisionWorkItemId: 'work-revision-1',
    })

    const result = await handleSlackAgentAction(payload({
      action: 'social_calendar_draft_handoff.reject',
      schemaVersion: 'social-calendar-approval/v1',
      calendarItemId: 'calendar-1',
      note: 'Needs stronger source boundary.',
    }))

    expect(mocks.rejectCalendarDraftHandoff).toHaveBeenCalledWith({
      id: 'calendar-1',
      decisionNote: 'Needs stronger source boundary.',
      auth: { user: { id: 'slack:U123' } },
    })
    expect(result.text).toContain('Content calendar draft handoff rejected from Slack')
    expect(result.text).toContain('No external action was taken.')
  })

  it('surfaces precise Portfolio recovery when a Slack calendar handoff is blocked', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.authorizeCalendarDraftHandoff.mockRejectedValue(new Error('Calendar item not found'))

    const result = await handleSlackAgentAction(payload({
      action: 'social_calendar_draft_handoff.approve',
      calendarItemId: 'missing-calendar',
    }))

    expect(result.text).toContain('Content calendar approval blocked: Calendar item not found')
    expect(result.text).toContain('/admin/agents/content-intelligence?section=calendar&calendar_item=missing-calendar')
  })

  it('rejects malformed Slack calendar decision payloads before mutation', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))

    const result = await handleSlackAgentAction(payload({
      action: 'social_calendar_draft_handoff.approve',
      contentId: 'social-1',
    }))

    expect(result.text).toContain('Missing content calendar item id')
    expect(mocks.authorizeCalendarDraftHandoff).not.toHaveBeenCalled()
    expect(mocks.rejectCalendarDraftHandoff).not.toHaveBeenCalled()
  })

  it('drafts a proposed AutoResearch work item from a high-signal insight Slack action', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-insight-1',
      title: 'AutoResearch follow-up for high-signal insight',
    })

    const result = await handleSlackAgentAction(payload({
      action: 'insight.draft_autoresearch',
      contentId: 'content-1',
      agentKey: 'research-source-register',
      note: 'Theme: Agentic Operating System\nScore: 87\nRecommendation: Expand with adjacent AutoResearch',
    }))

    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'AutoResearch follow-up for high-signal insight',
      status: 'proposed',
      priority: 'high',
      ownerAgentKey: 'research-source-register',
      source: expect.objectContaining({
        type: 'social_content_engagement_signal',
        id: 'content-1',
      }),
      metadata: expect.objectContaining({
        created_from_slack_action: true,
        social_content_id: 'content-1',
        approval_boundary: expect.stringContaining('No publishing, scheduling, outbound sends'),
      }),
      idempotencyKey: 'slack-insight-autoresearch:content-1',
    }))
    expect(mocks.runChiefOfStaffChat).not.toHaveBeenCalled()
    expect(result.text).toContain('Drafted proposed AutoResearch work item')
    expect(result.text).toContain('/admin/agents/swarm-board?work_item=work-insight-1')
  })
  it('prepares synchronously without database access and separates persisted identities', () => {
    const value = { action: 'work.assign', workItemId: 'work-1', agentKey: 'shaka' }
    const original = { ...payload(value), team: { id: 'T1' }, channel: { id: 'C1' } }
    const a = prepareSlackAgentAction(original)
    const retry = prepareSlackAgentAction({ ...original, action_ts: 'later' })
    expect(a.ok).toBe(true)
    expect(retry).toEqual(a)
    for (const changed of [
      { ...original, team: { id: 'T2' } },
      { ...original, channel: { id: 'C2' } },
      { ...original, actions: [{ value: JSON.stringify({ ...value, agentKey: 'moremi' }) }] },
    ]) {
      const next = prepareSlackAgentAction(changed)
      expect(next.ok && a.ok && next.key !== a.key).toBe(true)
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    { action: 'work.assign', workItemId: 'work-1' },
    { action: 'work.ready', workItemId: 42 },
    { action: 'unknown', workItemId: 'work-1' },
    { action: 'warm_gmail_send.approve', contactId: -1 },
  ])('blocks malformed actions before database access: %j', async (value) => {
    expect((await handleSlackAgentAction(payload(value))).actionStatus).toBe('blocked')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks missing persisted message identity and conflicting channel identity', () => {
    const original = payload({ action: 'work.ready', workItemId: 'work-1' })
    expect(prepareSlackAgentAction({ ...original, container: undefined }).ok).toBe(false)
    expect(prepareSlackAgentAction({ ...original, channel: { id: 'C1' }, container: { ...original.container, channel_id: 'C2' } }).ok).toBe(false)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('preserves a competing winning decision without any downstream mutation', async () => {
    const update = queryResult({ data: null, error: null })
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'approval-1', run_id: 'run-1', approval_type: 'vercel_deployment_research_proposal', status: 'pending' }, error: null }))
      .mockReturnValueOnce(update)
      .mockReturnValueOnce(queryResult({ data: { status: 'rejected' }, error: null }))
    const result = await handleSlackAgentAction(payload({ action: 'approval.approve', approvalId: 'approval-1' }))
    expect(result.actionStatus).toBe('already_recorded')
    expect(result.text).toContain('already rejected')
    expect(update.eq).toHaveBeenCalledWith('status', 'pending')
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(['agent_approvals', 'agent_approvals', 'agent_approvals'])
  })

  it.each(['approved', 'rejected'])('records %s without marking the run running or technically failed', async (status) => {
    const run = queryResult({ error: null })
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'approval-1', run_id: 'run-1', approval_type: 'vercel_deployment_research_proposal', status: 'pending' }, error: null }))
      .mockReturnValueOnce(queryResult({ data: { id: 'approval-1', status }, error: null }))
      .mockReturnValueOnce(queryResult({ error: null }))
      .mockReturnValueOnce(run)
    const result = await handleSlackAgentAction(payload({ action: status === 'approved' ? 'approval.approve' : 'approval.reject', approvalId: 'approval-1' }))
    expect(result.actionStatus).toBe('completed')
    expect(result.text).toContain('No execution was started')
    expect(run.update.mock.calls[0][0]).not.toHaveProperty('status')
  })

  it.each(['returned', 'thrown'])('keeps the recorded decision terminal while warning about downstream synchronization (%s)', async (mode) => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: { id: 'approval-1', run_id: 'run-1', approval_type: 'vercel_deployment_research_proposal', status: 'pending' }, error: null }))
      .mockReturnValueOnce(queryResult({ data: { id: 'approval-1', status: 'approved' }, error: null }))
    if (mode === 'thrown') mocks.from.mockImplementationOnce(() => { throw new Error('offline') })
    else mocks.from.mockReturnValueOnce(queryResult({ error: { message: 'offline' } })).mockReturnValueOnce(queryResult({ error: null }))
    const result = await handleSlackAgentAction(payload({ action: 'approval.approve', approvalId: 'approval-1' }))
    expect(result.actionStatus).toBe('completed')
    expect(result.text).toContain('Decision saved, but synchronization failed')
    expect(result.text).toContain('The decision is final')
    expect(result.text).toContain('without repeating the decision')
    expect(result.text).toContain('No execution was started')
  })

  it('reports uncertainty after work was assigned but trace recording failed', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.claimAgentWorkItem.mockResolvedValue({ id: 'work-1', title: 'Work', active_run_id: 'run-1' })
    mocks.recordAgentEvent.mockRejectedValue(new Error('offline'))
    const result = await handleSlackAgentAction(payload({ action: 'work.assign', workItemId: 'work-1', agentKey: 'shaka' }))
    expect(mocks.claimAgentWorkItem).toHaveBeenCalledOnce()
    expect(result.actionStatus).toBe('failed')
    expect(result.text).toContain('may already be saved')
  })

  it('keeps staging completion and recovery links off a misleading production base URL', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', VERCEL_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', NEXT_PUBLIC_BASE_URL: 'https://amadutown.com', SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.test', SLACK_AGENT_OPS_TEAM_ID: 'T1' }
    const card = (value: Record<string, unknown>) => ({ ...payload({ ...value, sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.test' }), team: { id: 'T1' }, channel: { id: 'C1' } })
    mocks.from.mockReturnValue(queryResult({ data: null, error: null }))
    mocks.markAgentWorkItemReadyForKanban.mockResolvedValue({ id: 'work-1', title: 'Fixture', active_run_id: 'run-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    const completed = await handleSlackAgentAction(card({ action: 'work.ready', workItemId: 'work-1' }))
    expect(completed.actionStatus).toBe('completed')
    expect(completed.text).toContain('https://staging.example.test/admin/agents/swarm-board')
    expect(completed.text).not.toContain('https://amadutown.com')
    const staleLink = prepareSlackAgentAction({ ...card({}), actions: [{ url: 'https://amadutown.com/admin/agents/runs/foreign-run' }] })
    expect(staleLink.ok).toBe(false)
    if (!staleLink.ok) {
      expect(staleLink.result.text).toContain('https://staging.example.test/admin/agents')
      expect(staleLink.result.text).not.toContain('foreign-run')
      expect(staleLink.result.text).not.toContain('https://amadutown.com')
    }
    mocks.authorizeCalendarDraftHandoff.mockRejectedValueOnce(new Error('Review required'))
    const blocked = await handleSlackAgentAction(card({ action: 'social_calendar_draft_handoff.approve', calendarItemId: 'calendar-1' }))
    expect(blocked.actionStatus).toBe('blocked')
    expect(blocked.text).toContain('https://staging.example.test/admin/agents/content-intelligence')
    expect(blocked.text).not.toContain('https://amadutown.com')
  })

  it('rejects missing staging source origin before database access instead of falling back to production', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', NEXT_PUBLIC_BASE_URL: 'https://amadutown.com', SLACK_AGENT_OPS_STAGING_BASE_URL: '', VERCEL_URL: '', SLACK_AGENT_OPS_TEAM_ID: 'T1' }
    const result = await handleSlackAgentAction({ ...payload({ action: 'work.ready', workItemId: 'work-1' }), team: { id: 'T1' }, channel: { id: 'C1' } })
    expect(result.actionStatus).toBe('blocked')
    expect(result.text).not.toContain('https://amadutown.com')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.markAgentWorkItemReadyForKanban).not.toHaveBeenCalled()
  })

})
