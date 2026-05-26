import type { AgentSwarmBoardSnapshot, SwarmBoardCard } from './agent-swarm-board'
import type { RoadmapClientView } from './client-ai-ops-roadmap'

export type ClientAiOpsReadinessStatus =
  | 'needs_roadmap'
  | 'waiting_approval'
  | 'needs_connector_decision'
  | 'blocked'
  | 'ready_for_planning'

export type ClientAiOpsReadinessContract = {
  status: ClientAiOpsReadinessStatus
  nextAction: string
  sideEffectsEnabled: false
  connector: {
    summary: string
    required: number
    ready: number
    approvalBlocked: number
    missingCritical: number
    nextAction: string
  }
  projection: {
    openActions: number
    approvals: number
    isolationChecks: number
    monitorFlags: number
    nextAction: string
  }
  swarm: {
    column: string | null
    moduleHealth: string | null
    approvalState: string | null
    autonomousReady: boolean
  }
  approvalBoundaries: {
    credentialSync: 'waiting_approval'
    providerSetup: 'waiting_approval'
    outboundSend: 'waiting_approval'
    productionDeploy: 'waiting_approval'
    clientDataMutation: 'waiting_approval'
  }
}

export function buildClientAiOpsReadinessContract(
  clientView: RoadmapClientView | null | undefined,
  options: {
    swarmSnapshot?: AgentSwarmBoardSnapshot | null
    clientProjectId?: string | null
  } = {},
): ClientAiOpsReadinessContract {
  const card = findSwarmCard(options.swarmSnapshot, options.clientProjectId)
  if (!clientView) {
    return {
      status: 'needs_roadmap',
      nextAction: 'Create the Client AI Ops roadmap before connector or agent-swarm planning.',
      sideEffectsEnabled: false,
      connector: {
        summary: 'No roadmap available',
        required: 0,
        ready: 0,
        approvalBlocked: 0,
        missingCritical: 0,
        nextAction: 'Create the Client AI Ops roadmap first.',
      },
      projection: {
        openActions: 0,
        approvals: 0,
        isolationChecks: 0,
        monitorFlags: 0,
        nextAction: 'Create the Client AI Ops roadmap first.',
      },
      swarm: swarmState(card),
      approvalBoundaries: approvalBoundaries(),
    }
  }

  const connector = clientView.connectorReadiness
  const projection = clientView.projectionStatus
  const monitorFlags = projection.overdueTasks + projection.staleCostItems + (projection.reportMissing ? 1 : 0)
  const openActions = projection.clientActionCount + projection.amadutownActionCount + projection.sharedActionCount
  const status = readinessStatus({
    connectorApprovals: connector.approvalBlockedConnectorCount,
    missingCritical: connector.missingCriticalConnectorCount,
    blockedTasks: projection.blockedTasks,
    approvals: projection.approvalNeededCount,
    monitorFlags,
    card,
  })

  return {
    status,
    nextAction: readinessNextAction({
      status,
      connectorNextAction: connector.connectorNextAction,
      projectionNextAction: projection.nextReportingAction,
      cardNextAction: card?.nextAction ?? null,
    }),
    sideEffectsEnabled: false,
    connector: {
      summary: connector.summary,
      required: connector.requiredConnectorCount,
      ready: connector.readyConnectorCount,
      approvalBlocked: connector.approvalBlockedConnectorCount,
      missingCritical: connector.missingCriticalConnectorCount,
      nextAction: connector.connectorNextAction,
    },
    projection: {
      openActions,
      approvals: projection.approvalNeededCount,
      isolationChecks: projection.isolationRequiredCount,
      monitorFlags,
      nextAction: projection.nextReportingAction,
    },
    swarm: swarmState(card),
    approvalBoundaries: approvalBoundaries(),
  }
}

function findSwarmCard(snapshot: AgentSwarmBoardSnapshot | null | undefined, clientProjectId: string | null | undefined): SwarmBoardCard | null {
  if (!snapshot || !clientProjectId) return null
  return snapshot.columns.flatMap((column) => column.cards).find((card) => card.clientProjectId === clientProjectId) ?? null
}

function readinessStatus(input: {
  connectorApprovals: number
  missingCritical: number
  blockedTasks: number
  approvals: number
  monitorFlags: number
  card: SwarmBoardCard | null
}): ClientAiOpsReadinessStatus {
  if (input.card?.moduleHealth === 'red' || input.blockedTasks > 0) return 'blocked'
  if (input.connectorApprovals > 0 || input.approvals > 0 || input.card?.approvalState === 'pending') return 'waiting_approval'
  if (input.missingCritical > 0) return 'needs_connector_decision'
  return 'ready_for_planning'
}

function readinessNextAction(input: {
  status: ClientAiOpsReadinessStatus
  connectorNextAction: string
  projectionNextAction: string
  cardNextAction: string | null
}) {
  if (input.status === 'blocked') return input.cardNextAction ?? input.projectionNextAction
  if (input.status === 'waiting_approval') return 'Review approval-gated AI Ops work before any live setup or outbound action.'
  if (input.status === 'needs_connector_decision') return input.connectorNextAction
  if (input.status === 'needs_roadmap') return 'Create the Client AI Ops roadmap first.'
  return input.cardNextAction ?? input.projectionNextAction
}

function swarmState(card: SwarmBoardCard | null) {
  return {
    column: card?.column ?? null,
    moduleHealth: card?.moduleHealth ?? null,
    approvalState: card?.approvalState ?? null,
    autonomousReady: Boolean(card && card.approvalState === 'none' && card.moduleHealth !== 'red'),
  }
}

function approvalBoundaries(): ClientAiOpsReadinessContract['approvalBoundaries'] {
  return {
    credentialSync: 'waiting_approval',
    providerSetup: 'waiting_approval',
    outboundSend: 'waiting_approval',
    productionDeploy: 'waiting_approval',
    clientDataMutation: 'waiting_approval',
  }
}
