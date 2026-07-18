import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ExecutiveSummary from './ExecutiveSummary'
import type { CategoryScores } from '@/lib/assessment-scoring'

const categoryScores: CategoryScores = {
  business_challenges: 72,
  tech_stack: 58,
  automation_needs: 44,
  ai_readiness: 61,
  budget_timeline: 49,
  decision_making: 67,
}

describe('ExecutiveSummary', () => {
  it('sets client context after the widgets and maps the dashboard visuals', () => {
    render(
      <ExecutiveSummary
        clientCompany="Keep Massachusetts Beautiful"
        overallScore={57}
        categoryScores={categoryScores}
        scoreDelta={{ absolute: 0, percentage: 0 }}
        tasksCompleted={0}
        tasksTotal={6}
        highPriorityRemaining={3}
        snapshotsCount={2}
        recommendationsCount={2}
        diagnosticSummary="The current operating picture shows strong community intent with gaps in workflow automation."
        recommendedActions={['Connect intake to follow-up.', 'Prioritize the highest-friction handoffs.']}
      />
    )

    expect(screen.getByRole('heading', { name: 'Executive Summary' })).toBeInTheDocument()
    expect(screen.getByText(/current operating picture/i)).toBeInTheDocument()
    expect(screen.getByText('Recommended focus')).toBeInTheDocument()
    expect(screen.getByText(/connect intake to follow-up/i)).toBeInTheDocument()
    expect(screen.getByText('Widgets')).toBeInTheDocument()
    expect(screen.getByText('Radar')).toBeInTheDocument()
    expect(screen.getByText('Trajectory')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByText('57/100')).toBeInTheDocument()
    expect(screen.getByText(/0\/6 tasks complete/i)).toBeInTheDocument()
  })

  it('falls back to a derived summary and action focus when assessment copy is absent', () => {
    render(
      <ExecutiveSummary
        clientCompany={null}
        overallScore={41}
        categoryScores={categoryScores}
        scoreDelta={{ absolute: 5, percentage: 12 }}
        tasksCompleted={1}
        tasksTotal={4}
        highPriorityRemaining={1}
        snapshotsCount={0}
        recommendationsCount={0}
        diagnosticSummary={null}
        recommendedActions={null}
      />
    )

    expect(screen.getByText(/translates the assessment into an operating view/i)).toBeInTheDocument()
    expect(screen.getByText(/start with the 1 high-priority action/i)).toBeInTheDocument()
    expect(screen.getByText('projected after milestones')).toBeInTheDocument()
    expect(screen.getByText('25% complete')).toBeInTheDocument()
  })
})
