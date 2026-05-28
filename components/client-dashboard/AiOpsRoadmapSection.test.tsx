import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AiOpsRoadmapSection from './AiOpsRoadmapSection'
import type { RoadmapClientView } from '@/lib/client-ai-ops-roadmap'

const roadmap: RoadmapClientView = {
  title: 'Acme AI Ops Roadmap',
  status: 'active',
  clientSummary: 'Implementation is underway.',
  runtimePlacementOptions: [],
  phases: [
    {
      id: 'phase-1',
      title: 'Discovery',
      objective: 'Confirm ownership and access.',
      status: 'in_progress',
      phaseOrder: 1,
      acceptanceCriteria: [],
      tasksTotal: 2,
      tasksComplete: 1,
      estimatedClientStartupCost: 0,
      estimatedMonthlyOperatingCost: 0,
    },
  ],
  costSummary: {
    oneTimeClientOwned: 1200,
    monthlyClientOwned: 95,
    amadutownSetup: 0,
    quoteRequiredCount: 1,
    byCategory: {},
  },
  connectorReadiness: {
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
  projectionStatus: {
    tasksTotal: 2,
    tasksComplete: 1,
    blockedTasks: 1,
    clientActionCount: 1,
    amadutownActionCount: 1,
    sharedActionCount: 0,
    approvalNeededCount: 2,
    isolationRequiredCount: 1,
    overdueTasks: 1,
    staleCostItems: 1,
    reportMissing: false,
    nextReportingAction: 'Resolve blocked roadmap tasks',
  },
  nextActions: [
    {
      title: 'Approve secure access plan',
      ownerType: 'client',
      priority: 'high',
      dueDate: null,
    },
  ],
  latestReport: null,
}

describe('AiOpsRoadmapSection', () => {
  it('surfaces the read-only roadmap projection status', () => {
    render(<AiOpsRoadmapSection roadmap={roadmap} />)

    expect(screen.getByText('Roadmap projection')).toBeInTheDocument()
    expect(screen.getByText('Setup readiness')).toBeInTheDocument()
    expect(screen.getAllByText('Resolve blocked roadmap tasks')).toHaveLength(2)
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('Live setup locked until approved')).toBeInTheDocument()
    expect(screen.getByText('Side effects')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByText('Connector readiness')).toBeInTheDocument()
    expect(screen.getByText('Prepare oauth setup packet for HubSpot; do not connect until approved.')).toBeInTheDocument()
    expect(screen.getByText('HubSpot · needs auth')).toBeInTheDocument()
    expect(screen.getByText('Open actions')).toBeInTheDocument()
    expect(screen.getAllByText('Approvals')).toHaveLength(2)
    expect(screen.getAllByText('Isolation checks')).toHaveLength(2)
    expect(screen.getByText('Monitor flags')).toBeInTheDocument()
    expect(screen.getByText('Approve secure access plan')).toBeInTheDocument()
  })
})
