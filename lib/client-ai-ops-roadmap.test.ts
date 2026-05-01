import { describe, expect, it } from 'vitest'
import {
  buildDefaultClientAiOpsRoadmap,
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

  it('maps statuses between roadmap and projected task tables', () => {
    expect(dashboardStatusFromRoadmap('blocked')).toBe('in_progress')
    expect(meetingTaskStatusFromRoadmap('cancelled')).toBe('cancelled')
    expect(roadmapStatusFromProjectedTask('complete')).toBe('complete')
    expect(roadmapStatusFromProjectedTask('pending')).toBe('pending')
  })
})
