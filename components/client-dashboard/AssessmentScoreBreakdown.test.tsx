import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AssessmentScoreBreakdown from './AssessmentScoreBreakdown'

describe('AssessmentScoreBreakdown', () => {
  it('renders category scores with compact explanations and target gaps', () => {
    render(
      <AssessmentScoreBreakdown
        scores={{
          business_challenges: 78,
          tech_stack: 52,
          automation_needs: 44,
          ai_readiness: 36,
          budget_timeline: 62,
          decision_making: 68,
        }}
      />
    )

    expect(screen.getByText('Score breakdown')).toBeInTheDocument()
    expect(screen.getByText('AI readiness')).toBeInTheDocument()
    expect(screen.getByText('54 points below target')).toBeInTheDocument()
    expect(screen.getByText(/FireSpring can support the work/i)).toBeInTheDocument()
    expect(screen.getByText(/current contract should not absorb unlimited rebuild work/i)).toBeInTheDocument()
  })
})
