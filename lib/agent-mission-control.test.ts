import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import {
  buildAgentDeadLetterQueue,
  buildAgentCostSummary,
  buildAgentEngagementQueue,
  buildAgentInbox,
  buildAgentOperatingSignals,
  buildDailyOperatingBrief,
} from '@/lib/agent-mission-control'

type InboxInput = Parameters<typeof buildAgentInbox>[0]
type MissionRunRow = InboxInput['runs'][number]
type ApprovalRow = InboxInput['approvals'][number]

const now = '2026-05-04T12:00:00.000Z'

function run(overrides: Partial<MissionRunRow>): MissionRunRow {
  return {
    id: 'run-1',
    agent_key: 'chief-of-staff',
    runtime: 'manual',
    kind: 'agent_task',
    title: 'Agent task',
    status: 'completed',
    subject_label: null,
    current_step: null,
    error_message: null,
    started_at: now,
    completed_at: now,
    outcome: null,
    metadata: null,
    ...overrides,
  }
}

function approval(overrides: Partial<ApprovalRow>): ApprovalRow {
  return {
    id: 'approval-1',
    run_id: 'approval-run',
    approval_type: 'send_email',
    status: 'pending',
    requested_at: now,
    ...overrides,
  }
}

describe('Agent Mission Control helpers', () => {
  it('uses the latest standup synthesis as the daily operating brief', () => {
    const latestStandup = run({
      id: 'standup-run',
      kind: 'agent_war_room_standup',
      outcome: {
        synthesis: 'Standup complete. Automation is clear, but follow-up needs review.',
      },
    })

    const brief = buildDailyOperatingBrief({
      approvals: [],
      costToday: 0.1234,
      latestStandup,
      inbox: [],
      activeRunsCount: 0,
      failedRunsCount: 0,
    })

    expect(brief.generated_from).toBe('standup')
    expect(brief.run_id).toBe('standup-run')
    expect(brief.synthesis).toContain('Automation is clear')
    expect(brief.signals).toContain('$0.1234 cost today')
  })

  it('builds an actionable inbox from approvals, failed runs, stale runs, high-cost runs, and stale standups', () => {
    const failedRun = run({
      id: 'failed-run',
      agent_key: 'automation-systems',
      status: 'failed',
      title: 'Automation dispatch',
      error_message: 'Webhook returned 500.',
    })
    const staleRun = run({
      id: 'stale-run',
      agent_key: 'chief-of-staff',
      status: 'stale',
      title: 'Morning review',
      current_step: 'Waiting on runtime callback.',
    })
    const expensiveRun = run({
      id: 'expensive-run',
      agent_key: 'research-source-register',
      status: 'completed',
      title: 'Deep account research',
    })
    const approvalRun = run({
      id: 'approval-run',
      agent_key: 'inbox-follow-up',
      status: 'waiting_for_approval',
      title: 'Send follow-up email',
    })

    const inbox = buildAgentInbox({
      runs: [failedRun, staleRun, expensiveRun, approvalRun],
      approvals: [approval({ run_id: 'approval-run' })],
      costByRun: new Map([['expensive-run', 0.31]]),
      latestStandup: undefined,
    })

    expect(inbox.map((item) => item.title)).toEqual(expect.arrayContaining([
      'Approval checkpoint: Send follow-up email',
      'Failure needs triage: Automation dispatch',
      'Stale run needs owner: Morning review',
      'Cost review: Deep account research',
      'No War Room standup yet',
    ]))
    expect(inbox.filter((item) => item.source_run_id === 'approval-run')).toHaveLength(1)
    expect(inbox[0].priority).toBe('high')
  })

  it('builds a readable engagement queue from traced engagement requests', () => {
    const queue = buildAgentEngagementQueue([
      run({
        id: 'engagement-run',
        agent_key: 'manual',
        kind: 'agent_engagement_request',
        status: 'completed',
        current_step: 'Read-only dispatch ready',
        metadata: {
          requested_agent: 'automation-systems',
          route_action: 'agent_engagement',
          agent_inbox_item_id: 'failed-run:failed',
          source_run_id: 'failed-run',
          note: 'Triage the failed webhook.',
          suggested_next_action: 'Review mapped workflow health.',
          executes_action: false,
        },
      }),
      run({
        id: 'ordinary-run',
        kind: 'agent_task',
      }),
    ])

    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      run_id: 'engagement-run',
      agent_key: 'automation-systems',
      agent_name: 'Automation Systems Agent',
      owner_label: 'Automation Systems Agent',
      runtime: 'manual',
      status: 'completed',
      execution_mode: 'read_only',
      requested_from: 'agent_engagement',
      source_label: 'Agent Inbox',
      source_inbox_item_id: 'failed-run:failed',
      source_run_id: 'failed-run',
      next_action: 'Review mapped workflow health.',
    })
  })

  it('builds a dead-letter monitor from failed and stale runs with routing state', () => {
    const failedRun = run({
      id: 'failed-run',
      agent_key: 'automation-systems',
      runtime: 'n8n',
      status: 'failed',
      title: 'Warm lead sync',
      error_message: 'Webhook returned 500.',
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    })
    const routedEngagement = run({
      id: 'routed-engagement',
      kind: 'agent_engagement_request',
      status: 'queued',
      metadata: {
        requested_agent: 'automation-systems',
        source_run_id: 'failed-run',
      },
    })
    const staleRun = run({
      id: 'stale-run',
      agent_key: 'chief-of-staff',
      status: 'stale',
      title: 'Morning review',
      current_step: 'waiting',
    })

    const queue = buildAgentDeadLetterQueue([failedRun, routedEngagement, staleRun])

    expect(queue).toHaveLength(2)
    expect(queue.find((item) => item.run_id === 'failed-run')).toMatchObject({
      agent_name: 'Automation Systems Agent',
      routed: true,
      routed_run_id: 'routed-engagement',
      next_action: 'Review routed engagement request.',
    })
    expect(queue.find((item) => item.run_id === 'stale-run')).toMatchObject({
      routed: false,
      next_action: 'Route stale run owner from Agent Inbox.',
    })
  })

  it('groups trace-linked costs by runtime, agent, workflow, client project, and artifact type', () => {
    const linkedRun = run({
      id: 'cost-run',
      agent_key: 'automation-systems',
      runtime: 'n8n',
      kind: 'agent_workflow',
      subject_label: 'Anna Berin',
      metadata: {
        workflow_id: 'WF-WRM-003',
        client_project_name: 'ATAS Staging',
        artifact_type: 'warm_lead',
      },
    })

    const summary = buildAgentCostSummary({
      runsById: new Map([[linkedRun.id, linkedRun]]),
      costs: [
        {
          agent_run_id: 'cost-run',
          source: 'llm_openai',
          reference_type: 'llm_completion',
          amount: 0.2,
          occurred_at: now,
          metadata: {},
        },
        {
          agent_run_id: 'cost-run',
          source: 'llm_openai',
          reference_type: 'llm_completion',
          amount: '0.0555',
          occurred_at: now,
          metadata: {},
        },
        {
          agent_run_id: null,
          source: 'other',
          reference_type: 'manual_adjustment',
          amount: 0.01,
          occurred_at: now,
          metadata: { artifact_type: 'manual_note' },
        },
      ],
    })

    expect(summary.total).toBe(0.2655)
    expect(summary.linked_event_count).toBe(2)
    expect(summary.unlinked_event_count).toBe(1)
    expect(summary.by_runtime[0]).toMatchObject({ key: 'n8n', amount: 0.2555, run_count: 1 })
    expect(summary.by_agent[0]).toMatchObject({ key: 'automation-systems', label: 'Automation Systems Agent' })
    expect(summary.by_workflow[0]).toMatchObject({ key: 'WF-WRM-003', label: 'WF-WRM-003' })
    expect(summary.by_client_project[0]).toMatchObject({ key: 'ATAS Staging', label: 'ATAS Staging' })
    expect(summary.by_artifact_type[0]).toMatchObject({ key: 'warm_lead', label: 'warm lead' })
  })

  it('surfaces morning review and deployment watcher traces as operating signals', () => {
    const signals = buildAgentOperatingSignals([
      run({
        id: 'morning-run',
        kind: 'agent_ops_morning_review',
        status: 'completed',
        current_step: 'Agent Ops morning review ready',
        outcome: {
          overall: 'ok',
          warning_count: 0,
          stale_marked: 1,
          slack_notified: true,
        },
      }),
      run({
        id: 'deploy-run',
        kind: 'agent_ops_deployment_watch',
        status: 'completed',
        outcome: {
          deployment_state: 'success',
          ref: 'main',
          contexts: [
            { context: 'Vercel – portfolio', state: 'success' },
            { context: 'Vercel – portfolio-staging', state: 'success' },
          ],
          guidance: ['guidance=ready; both required Vercel contexts passed'],
        },
      }),
    ])

    expect(signals).toHaveLength(2)
    expect(signals[0]).toMatchObject({
      kind: 'morning_review',
      signal: 'Overall: ok',
      details: ['0 warning(s)', '1 stale run(s) marked', 'Slack notified'],
    })
    expect(signals[1]).toMatchObject({
      kind: 'deployment_watch',
      signal: 'Deployments: success',
      summary: 'Latest watcher snapshot for main.',
    })
    expect(signals[1].details).toContain('Vercel – portfolio-staging: success')
  })
})
