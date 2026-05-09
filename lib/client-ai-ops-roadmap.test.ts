import { describe, expect, it } from 'vitest'
import {
  buildDefaultClientAiOpsRoadmap,
  buildClientRoadmapView,
  buildProposalRoadmapSnapshot,
  dashboardStatusFromRoadmap,
  meetingTaskStatusFromRoadmap,
  roadmapStatusFromProjectedTask,
  rollUpRoadmapCosts,
} from './client-ai-ops-roadmap'

describe('client AI ops roadmap', () => {
  it('generates a deterministic default roadmap', () => {
    const input = { clientName: 'Acme', stackSignals: ['Mac', 'Google Workspace'] }
    const a = buildDefaultClientAiOpsRoadmap(input)
    const b = buildDefaultClientAiOpsRoadmap(input)

    expect(a.inputHash).toBe(b.inputHash)
    expect(a.phases).toHaveLength(5)
    expect(a.tasks.map((task) => task.taskKey)).toContain('client-vault')
    expect(a.costItems.map((item) => item.category)).toContain('hardware')
    expect(a.runtimePlacementOptions.map((option) => option.key)).toEqual([
      'client_local_node',
      'cloud_runtime',
      'hybrid_local_cloud',
    ])
  })

  it('makes 24/7 data and local LLM repository placement explicit', () => {
    const roadmap = buildDefaultClientAiOpsRoadmap({ clientCompany: 'Acme Co' })

    expect(roadmap.clientSummary).toContain('24/7 data and local LLM repository placement')
    expect(roadmap.phases.find((phase) => phase.phaseKey === 'infrastructure_access')?.acceptanceCriteria)
      .toContain('Runtime placement selected')
    expect(roadmap.tasks.find((task) => task.taskKey === 'hardware-decision')).toMatchObject({
      title: 'Select data and local LLM repository placement',
      clientVisible: true,
      meetingTaskVisible: true,
    })
    expect(roadmap.costItems.map((item) => item.key)).toEqual(expect.arrayContaining([
      'local-node',
      'cloud-runtime-host',
    ]))
  })

  it('rolls up client-owned startup and monthly costs', () => {
    const rollup = rollUpRoadmapCosts([
      { payer: 'client', costType: 'one_time', amount: 1000, category: 'hardware' },
      { payer: 'client', costType: 'monthly', amount: 25, category: 'saas' },
      { payer: 'amadutown', costType: 'one_time', amount: 500, category: 'implementation_labor' },
      { payer: 'client', costType: 'quote_required', amount: null, category: 'optional_upgrade' },
    ])

    expect(rollup.oneTimeClientOwned).toBe(1000)
    expect(rollup.monthlyClientOwned).toBe(25)
    expect(rollup.amadutownSetup).toBe(500)
    expect(rollup.quoteRequiredCount).toBe(1)
  })

  it('creates immutable proposal snapshots with a cost summary', () => {
    const snapshot = buildProposalRoadmapSnapshot({ clientCompany: 'Acme Co' })

    expect(snapshot.title).toBe('Acme Co AI Ops Roadmap')
    expect(snapshot.costSummary.oneTimeClientOwned).toBeGreaterThan(0)
    expect(snapshot.costSummary.monthlyClientOwned).toBeGreaterThan(0)
  })

  it('uses agent readiness to shape roadmap recommendations when provided', () => {
    const snapshot = buildProposalRoadmapSnapshot({
      clientCompany: 'Acme Co',
      implementationRequirements: {
        agentReadinessAssessment: {
          systems: [],
          contextReadinessScore: 8,
          workflowReadinessScore: 8,
          agentReadinessScore: 5,
          overallLevel: 'workflow_copilot',
          recommendationTier: 3,
          clientSummary: 'Workflow systems can support AI recommendations and drafts.',
          roadmapRecommendation: 'Prioritize approval-gated copilots before autonomous action.',
        },
      },
    })

    expect(snapshot.clientSummary).toContain('approval-gated copilots')
    expect(snapshot.phases.find((phase) => phase.phaseKey === 'agent_automation_deployment')?.objective)
      .toContain('workflow copilots')
  })

  it('maps statuses between roadmap and projected task tables', () => {
    expect(dashboardStatusFromRoadmap('blocked')).toBe('in_progress')
    expect(meetingTaskStatusFromRoadmap('cancelled')).toBe('cancelled')
    expect(roadmapStatusFromProjectedTask('complete')).toBe('complete')
    expect(roadmapStatusFromProjectedTask('pending')).toBe('pending')
  })

  it('adds a client-safe latest report summary to the roadmap view', () => {
    const view = buildClientRoadmapView({
      roadmap: {
        title: 'Acme AI Ops Roadmap',
        status: 'active',
        client_summary: 'Implementation is underway.',
      },
      phases: [
        {
          id: 'phase-1',
          title: 'Launch and reporting',
          objective: 'Start reporting cadence.',
          status: 'in_progress',
          phase_order: 1,
        },
      ],
      tasks: [
        {
          phase_id: 'phase-1',
          title: 'Review report',
          owner_type: 'client',
          priority: 'high',
          status: 'pending',
          due_date: null,
          client_visible: true,
        },
      ],
      costItems: [],
      reports: [
        {
          title: 'Monthly AI Ops report',
          report_type: 'monthly',
          status: 'needs_review',
          generated_at: '2026-05-03T12:00:00.000Z',
          summary: 'Roadmap is progressing with one overdue task.',
          client_actions: ['Approve secure access plan'],
          amadutown_actions: ['Internal escalation note that should not be exposed'],
          approval_needed: ['Publish next client report'],
          monitoring_summary: {
            overdue_tasks: 1,
            stale_cost_items: 2,
            report_missing: false,
            checked_at: '2026-05-03T12:00:00.000Z',
          },
        },
      ],
    })

    expect(view.latestReport).toMatchObject({
      title: 'Monthly AI Ops report',
      status: 'needs_review',
      clientActions: ['Approve secure access plan'],
      amadutownActionsCount: 1,
      approvalNeededCount: 1,
      monitoringSummary: {
        overdueTasks: 1,
        staleCostItems: 2,
        reportMissing: false,
      },
    })
    expect(view.runtimePlacementOptions.map((option) => option.key)).toEqual([
      'client_local_node',
      'cloud_runtime',
      'hybrid_local_cloud',
    ])
    expect(JSON.stringify(view.latestReport)).not.toContain('Internal escalation note')
  })
})
