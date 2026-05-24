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
    expect(screen.getByText('Resolve blocked roadmap tasks')).toBeInTheDocument()
    expect(screen.getByText('Open actions')).toBeInTheDocument()
    expect(screen.getByText('Approvals')).toBeInTheDocument()
    expect(screen.getByText('Isolation checks')).toBeInTheDocument()
    expect(screen.getByText('Monitor flags')).toBeInTheDocument()
    expect(screen.getByText('Approve secure access plan')).toBeInTheDocument()
  })
})
