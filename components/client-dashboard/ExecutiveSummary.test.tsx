import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ExecutiveSummary, {
  ActionFocusCommentary,
  AssessmentScoresCommentary,
  TrajectoryCommentary,
} from './ExecutiveSummary'
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
  it('keeps the top executive summary focused on dashboard-level context', () => {
    render(
      <ExecutiveSummary
        clientCompany="Keep Massachusetts Beautiful"
        highPriorityRemaining={3}
        diagnosticSummary="The current operating picture shows strong community intent with gaps in workflow automation."
        recommendedActions={['Connect intake to follow-up.', 'Prioritize the highest-friction handoffs.']}
      />
    )

    expect(screen.getByRole('heading', { name: 'Executive Summary' })).toBeInTheDocument()
    expect(screen.getByText(/current operating picture/i)).toBeInTheDocument()
    expect(screen.getByText('Recommended focus')).toBeInTheDocument()
    expect(screen.getByText(/connect intake to follow-up/i)).toBeInTheDocument()
    expect(screen.queryByText('Widgets')).not.toBeInTheDocument()
    expect(screen.queryByText('Radar')).not.toBeInTheDocument()
  })

  it('falls back to a derived summary and action focus when assessment copy is absent', () => {
    render(
      <ExecutiveSummary
        clientCompany={null}
        highPriorityRemaining={1}
        diagnosticSummary={null}
        recommendedActions={null}
      />
    )

    expect(screen.getByText(/translates the assessment into an operating view/i)).toBeInTheDocument()
    expect(screen.getByText(/start with the 1 high-priority action/i)).toBeInTheDocument()
  })

  it('renders chart and action commentary as separate section-level notes', () => {
    render(
      <>
        <AssessmentScoresCommentary categoryScores={categoryScores} />
        <TrajectoryCommentary scoreDelta={{ absolute: 5, percentage: 12 }} snapshotsCount={2} />
        <ActionFocusCommentary
          tasksCompleted={1}
          tasksTotal={4}
          highPriorityRemaining={1}
          recommendationsCount={2}
        />
      </>
    )

    expect(screen.getByText('How to read this chart')).toBeInTheDocument()
    expect(screen.getByText(/Business is the strongest area/i)).toBeInTheDocument()
    expect(screen.getByText('What the trajectory means')).toBeInTheDocument()
    expect(screen.getByText(/current path is up 5 points/i)).toBeInTheDocument()
    expect(screen.getByText('How to use this list')).toBeInTheDocument()
    expect(screen.getByText(/1\/4 tasks are complete/i)).toBeInTheDocument()
  })
})
