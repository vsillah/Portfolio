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

type RoadmapViewInput = Parameters<typeof buildClientRoadmapView>[0]
type RoadmapViewTask = RoadmapViewInput['tasks'][number]
type RoadmapViewReport = NonNullable<RoadmapViewInput['reports']>[number]

const baseRoadmapViewInput: RoadmapViewInput = {
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
  tasks: [],
  costItems: [],
  reports: [],
}

function roadmapTask(overrides: Partial<RoadmapViewTask> = {}): RoadmapViewTask {
  return {
    phase_id: 'phase-1',
    title: 'Review next roadmap step',
    owner_type: 'client',
    priority: 'high',
    status: 'pending',
    due_date: null,
    client_visible: true,
    metadata: null,
    ...overrides,
  }
}

function roadmapReport(overrides: Partial<RoadmapViewReport> = {}): RoadmapViewReport {
  return {
    title: 'Monthly AI Ops report',
    report_type: 'monthly',
    status: 'published',
    generated_at: '2026-05-03T12:00:00.000Z',
    summary: 'Roadmap is progressing.',
    client_actions: [],
    amadutown_actions: [],
    approval_needed: [],
    monitoring_summary: {
      overdue_tasks: 0,
      stale_cost_items: 0,
      report_missing: false,
      checked_at: '2026-05-03T12:00:00.000Z',
    },
    ...overrides,
  }
}

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

  it('adds structured org-board projections to default roadmap tasks', () => {
    const roadmap = buildDefaultClientAiOpsRoadmap({ clientCompany: 'Acme Co' })

    expect(roadmap.tasks.find((task) => task.taskKey === 'hardware-decision')?.orgBoard).toMatchObject({
      column: 'decision_packet',
      stage: 'technology_decision',
      ownerAgentKey: 'technology-evaluator',
      approvalPosture: 'none',
      isolationRequired: false,
    })
    expect(roadmap.tasks.find((task) => task.taskKey === 'workflow-validation')?.orgBoard).toMatchObject({
      column: 'qa_isolation',
      stage: 'qa_isolation',
      ownerAgentKey: 'engineering-copilot',
      approvalPosture: 'none',
      isolationRequired: true,
      internalHandoffLabel: 'Run synthetic validation and escalation behavior checks.',
    })
    expect(roadmap.tasks.every((task) => task.orgBoard)).toBe(true)
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

  it('maps audit and stack signals into connector readiness without live setup', () => {
    const snapshot = buildProposalRoadmapSnapshot({
      clientCompany: 'Acme Co',
      verifiedStack: { technologies: [{ name: 'Webflow' }] },
      auditSignals: [
        {
          audit_type: 'standalone',
          tech_stack: {
            crm: 'hubspot',
            email: 'gmail',
            other_tools: ['Slack'],
          },
          automation_needs: { priority_areas: ['lead_follow_up'] },
          ai_readiness: { data_quality: 'integrated' },
          decision_making: { decision_maker: true, approval_process: 'solo' },
          enriched_tech_stack: { technologies: [{ name: 'Pinecone' }] },
        },
      ],
    })

    expect(snapshot.connectorReadiness.items.map((item) => item.key)).toEqual(expect.arrayContaining([
      'webflow',
      'hubspot',
      'google_workspace',
      'slack',
      'pinecone',
    ]))
    expect(snapshot.connectorReadiness.requiredConnectorCount).toBeGreaterThanOrEqual(5)
    expect(snapshot.connectorReadiness.connectorNextAction).toContain('setup packet')
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
        snapshot: {
          connector_readiness: {
            summary: '5 required, 0 ready, 4 need auth, 0 approval-blocked',
            requiredConnectorCount: 5,
            readyConnectorCount: 0,
            approvalBlockedConnectorCount: 0,
            missingCriticalConnectorCount: 0,
            connectorNextAction: 'Prepare oauth setup packet for HubSpot; do not connect until approved.',
            conflicts: [],
            items: [
              {
                key: 'hubspot',
                label: 'HubSpot',
                category: 'crm',
                status: 'needs_auth',
                source: 'audit',
                authMethod: 'oauth',
                setupOwner: 'shared',
                requiredScopes: [],
                approvalActions: [],
                healthChecks: [],
                fallbackPath: 'Use CSV exports until OAuth approval.',
                critical: true,
                evidence: 'Audit CRM: hubspot',
                nextAction: 'Prepare oauth setup packet for HubSpot; do not connect until approved.',
              },
            ],
          },
        },
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
          metadata: {
            org_board: {
              approval_posture: 'required',
              isolation_required: false,
            },
          },
        },
        {
          phase_id: 'phase-1',
          title: 'Run synthetic QA',
          owner_type: 'amadutown',
          priority: 'high',
          status: 'blocked',
          due_date: null,
          client_visible: true,
          metadata: {
            org_board: {
              approval_posture: 'none',
              isolation_required: true,
            },
          },
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
    expect(view.projectionStatus).toMatchObject({
      tasksTotal: 2,
      tasksComplete: 0,
      blockedTasks: 1,
      clientActionCount: 1,
      amadutownActionCount: 1,
      approvalNeededCount: 2,
      isolationRequiredCount: 1,
      overdueTasks: 1,
      staleCostItems: 2,
      reportMissing: false,
      nextReportingAction: 'Resolve blocked roadmap tasks',
    })
    expect(view.connectorReadiness).toMatchObject({
      requiredConnectorCount: 5,
      readyConnectorCount: 0,
      connectorNextAction: 'Prepare oauth setup packet for HubSpot; do not connect until approved.',
    })
    expect(JSON.stringify(view.latestReport)).not.toContain('Internal escalation note')
  })

  it.each([
    {
      label: 'missing report',
      tasks: [],
      reports: [],
      expected: 'Generate first roadmap report',
    },
    {
      label: 'blocked task',
      tasks: [roadmapTask({ status: 'blocked' })],
      reports: [roadmapReport()],
      expected: 'Resolve blocked roadmap tasks',
    },
    {
      label: 'approval-gated work',
      tasks: [
        roadmapTask({
          metadata: {
            org_board: {
              approval_posture: 'required',
              isolation_required: false,
            },
          },
        }),
      ],
      reports: [roadmapReport()],
      expected: 'Review approval-gated roadmap work',
    },
    {
      label: 'overdue monitoring flag',
      tasks: [],
      reports: [
        roadmapReport({
          monitoring_summary: {
            overdue_tasks: 2,
            stale_cost_items: 0,
            report_missing: false,
          },
        }),
      ],
      expected: 'Escalate overdue roadmap tasks',
    },
    {
      label: 'stale cost flag',
      tasks: [],
      reports: [
        roadmapReport({
          monitoring_summary: {
            overdue_tasks: 0,
            stale_cost_items: 3,
            report_missing: false,
          },
        }),
      ],
      expected: 'Refresh stale roadmap cost assumptions',
    },
    {
      label: 'client-owned pending action',
      tasks: [roadmapTask({ owner_type: 'client', status: 'pending' })],
      reports: [roadmapReport()],
      expected: 'Follow up on client-owned roadmap actions',
    },
    {
      label: 'healthy monitoring default',
      tasks: [roadmapTask({ owner_type: 'client', status: 'complete' })],
      reports: [roadmapReport()],
      expected: 'Continue scheduled roadmap monitoring',
    },
  ])('prioritizes the next reporting action for $label', ({ tasks, reports, expected }) => {
    const view = buildClientRoadmapView({
      ...baseRoadmapViewInput,
      tasks,
      reports,
    })

    expect(view.projectionStatus.nextReportingAction).toBe(expected)
  })
})
