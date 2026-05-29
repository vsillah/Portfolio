import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))

import type { AgentSwarmBoardSnapshot, SwarmBoardCard } from './agent-swarm-board'
import type { ClientConnectorReadiness } from './client-connector-readiness'
import type { RoadmapClientProjectionStatus, RoadmapClientView } from './client-ai-ops-roadmap'
import { buildClientAiOpsReadinessContract } from './client-ai-ops-readiness-contract'
import { buildSyntheticClientAiOpsPilot } from './client-ai-ops-synthetic-pilot'

describe('buildClientAiOpsReadinessContract', () => {
  it('summarizes the synthetic pilot into a stable approval-gated contract', () => {
    const pilot = buildSyntheticClientAiOpsPilot()
    const contract = buildClientAiOpsReadinessContract(pilot.clientView, {
      swarmSnapshot: pilot.swarmSnapshot,
      clientProjectId: 'synthetic-client-ai-ops-project',
    })

    expect(contract).toMatchObject({
      status: 'waiting_approval',
      sideEffectsEnabled: false,
      connector: {
        required: expect.any(Number),
        approvalBlocked: 0,
        missingCritical: 0,
      },
      projection: {
        approvals: expect.any(Number),
        monitorFlags: 0,
      },
      swarm: {
        moduleHealth: 'green',
        approvalState: 'none',
        autonomousReady: true,
      },
      approvalBoundaries: {
        credentialSync: 'waiting_approval',
        providerSetup: 'waiting_approval',
        outboundSend: 'waiting_approval',
        productionDeploy: 'waiting_approval',
        clientDataMutation: 'waiting_approval',
      },
    })
    expect(contract.projection.approvals).toBeGreaterThan(0)
    expect(contract.connector.required).toBeGreaterThanOrEqual(6)
  })

  it('routes approval-heavy roadmap state to waiting approval', () => {
    const pilot = buildSyntheticClientAiOpsPilot()
    const contract = buildClientAiOpsReadinessContract({
      ...pilot.clientView,
      projectionStatus: {
        ...pilot.clientView.projectionStatus,
        approvalNeededCount: 2,
      },
    })

    expect(contract).toMatchObject({
      status: 'waiting_approval',
      nextAction: 'Review approval-gated AI Ops work before any live setup or outbound action.',
      sideEffectsEnabled: false,
    })
  })

  it('handles missing roadmap state without inventing setup readiness', () => {
    const contract = buildClientAiOpsReadinessContract(null)

    expect(contract).toMatchObject({
      status: 'needs_roadmap',
      sideEffectsEnabled: false,
      connector: {
        required: 0,
        nextAction: 'Create the Client AI Ops roadmap first.',
      },
      swarm: {
        column: null,
        autonomousReady: false,
      },
    })
  })

  it('prioritizes blocked swarm health over approvals and connector decisions', () => {
    const contract = buildClientAiOpsReadinessContract(readinessView({
      connectorReadiness: connectorReadiness({
        approvalBlockedConnectorCount: 2,
        missingCriticalConnectorCount: 1,
      }),
      projectionStatus: projectionStatus({
        approvalNeededCount: 3,
      }),
    }), {
      clientProjectId: 'client-1',
      swarmSnapshot: swarmSnapshot(swarmCard({
        moduleHealth: 'red',
        approvalState: 'pending',
        nextAction: 'Escalate failed runtime before proceeding.',
      })),
    })

    expect(contract).toMatchObject({
      status: 'blocked',
      nextAction: 'Escalate failed runtime before proceeding.',
      sideEffectsEnabled: false,
      connector: {
        approvalBlocked: 2,
        missingCritical: 1,
      },
      projection: {
        approvals: 3,
      },
      swarm: {
        moduleHealth: 'red',
        approvalState: 'pending',
        autonomousReady: false,
      },
    })
  })

  it('treats pending swarm approval as approval-gated even without projection approvals', () => {
    const contract = buildClientAiOpsReadinessContract(readinessView(), {
      clientProjectId: 'client-1',
      swarmSnapshot: swarmSnapshot(swarmCard({
        approvalState: 'pending',
        moduleHealth: 'green',
      })),
    })

    expect(contract).toMatchObject({
      status: 'waiting_approval',
      nextAction: 'Review approval-gated AI Ops work before any live setup or outbound action.',
      sideEffectsEnabled: false,
      swarm: {
        approvalState: 'pending',
        autonomousReady: false,
      },
    })
  })

  it('routes missing critical connectors to connector decisions when no approvals are pending', () => {
    const contract = buildClientAiOpsReadinessContract(readinessView({
      connectorReadiness: connectorReadiness({
        readyConnectorCount: 4,
        missingCriticalConnectorCount: 2,
        connectorNextAction: 'Choose the critical CRM and auth connector path.',
      }),
    }))

    expect(contract).toMatchObject({
      status: 'needs_connector_decision',
      nextAction: 'Choose the critical CRM and auth connector path.',
      sideEffectsEnabled: false,
      connector: {
        ready: 4,
        missingCritical: 2,
      },
    })
  })

  it('keeps monitor-only flags out of readiness status decisions', () => {
    const contract = buildClientAiOpsReadinessContract(readinessView({
      projectionStatus: projectionStatus({
        overdueTasks: 1,
        staleCostItems: 1,
        reportMissing: true,
        nextReportingAction: 'Refresh the monitor report.',
      }),
    }))

    expect(contract).toMatchObject({
      status: 'ready_for_planning',
      nextAction: 'Refresh the monitor report.',
      sideEffectsEnabled: false,
      projection: {
        monitorFlags: 3,
        approvals: 0,
      },
    })
  })
})

function readinessView(overrides: Partial<RoadmapClientView> = {}): RoadmapClientView {
  return {
    title: 'Client AI Ops roadmap',
    status: 'active',
    clientSummary: 'Client is preparing AI Ops setup.',
    runtimePlacementOptions: [],
    connectorReadiness: connectorReadiness(),
    phases: [],
    costSummary: {
      oneTimeClientOwned: 0,
      monthlyClientOwned: 0,
      amadutownSetup: 0,
      quoteRequiredCount: 0,
      byCategory: {},
    },
    projectionStatus: projectionStatus(),
    nextActions: [],
    latestReport: null,
    ...overrides,
  }
}

function connectorReadiness(overrides: Partial<ClientConnectorReadiness> = {}): ClientConnectorReadiness {
  return {
    summary: 'Connectors are ready for planning.',
    requiredConnectorCount: 6,
    readyConnectorCount: 6,
    approvalBlockedConnectorCount: 0,
    missingCriticalConnectorCount: 0,
    connectorNextAction: 'Confirm connector decisions.',
    items: [],
    conflicts: [],
    ...overrides,
  }
}

function projectionStatus(overrides: Partial<RoadmapClientProjectionStatus> = {}): RoadmapClientProjectionStatus {
  return {
    tasksTotal: 0,
    tasksComplete: 0,
    blockedTasks: 0,
    clientActionCount: 0,
    amadutownActionCount: 0,
    sharedActionCount: 0,
    approvalNeededCount: 0,
    isolationRequiredCount: 0,
    overdueTasks: 0,
    staleCostItems: 0,
    reportMissing: false,
    nextReportingAction: 'Continue readiness planning.',
    ...overrides,
  }
}

function swarmSnapshot(card: SwarmBoardCard): AgentSwarmBoardSnapshot {
  return {
    generated_at: '2026-05-29T10:00:00.000Z',
    summary: {
      clients: 1,
      active: 1,
      failed_or_stale: 0,
      pending_approvals: card.approvalState === 'pending' ? 1 : 0,
      isolation_failures: 0,
      autonomous_ready: card.approvalState === 'none' && card.moduleHealth !== 'red' ? 1 : 0,
    },
    columns: [{
      key: card.column,
      label: 'Active monitoring',
      description: 'Cards in active monitoring.',
      cards: [card],
    }],
  }
}

function swarmCard(overrides: Partial<SwarmBoardCard> = {}): SwarmBoardCard {
  const connector = connectorReadiness()
  return {
    id: 'card-1',
    clientProjectId: 'client-1',
    clientName: 'Client',
    projectName: 'AI Ops setup',
    column: 'active_monitoring',
    priority: 'high',
    currentAgentKey: 'ops',
    currentAgentLabel: 'Ops',
    nextAction: 'Continue monitoring.',
    statusLabel: 'Active',
    riskLabel: 'Low',
    approvalState: 'none',
    isolationStatus: 'passed',
    moduleHealth: 'green',
    latestRunId: null,
    latestRunStatus: null,
    failedOrStaleRuns: 0,
    pendingApprovals: 0,
    activeRuns: 0,
    roadmapStatus: 'active',
    dueDate: null,
    connectorReadiness: connector,
    connectorSummary: connector.summary,
    requiredConnectorCount: connector.requiredConnectorCount,
    readyConnectorCount: connector.readyConnectorCount,
    approvalBlockedConnectorCount: connector.approvalBlockedConnectorCount,
    missingCriticalConnectorCount: connector.missingCriticalConnectorCount,
    connectorNextAction: connector.connectorNextAction,
    href: '/admin/client-projects/client-1',
    ...overrides,
  }
}
