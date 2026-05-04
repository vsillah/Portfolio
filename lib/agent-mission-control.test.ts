import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import { buildAgentInbox, buildDailyOperatingBrief } from '@/lib/agent-mission-control'

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
})
