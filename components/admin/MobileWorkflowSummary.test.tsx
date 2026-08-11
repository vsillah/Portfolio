import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MobileWorkflowSummary from './MobileWorkflowSummary'

describe('MobileWorkflowSummary', () => {
  it('renders canonical mobile workflow state without owning workflow data', () => {
    render(
      <MobileWorkflowSummary
        title="Decision Queue"
        currentState="blocked"
        owner="Integration Captain"
        nextAction="Review the controller packet."
        waitingOnYou="Yes - controller decision"
        blocker="Missing recovery decision."
        canonicalHref="/admin/agents/coordination?proposal=work-1"
        canonicalLabel="Open proposal"
        tone="red"
      />,
    )

    expect(screen.getByLabelText('Decision Queue mobile workflow summary')).toBeInTheDocument()
    expect(screen.getByText('blocked')).toBeInTheDocument()
    expect(screen.getByText('Integration Captain')).toBeInTheDocument()
    expect(screen.getByText('Review the controller packet.')).toBeInTheDocument()
    expect(screen.getByText('Yes - controller decision')).toBeInTheDocument()
    expect(screen.getByText('Missing recovery decision.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open proposal' })).toHaveAttribute('href', '/admin/agents/coordination?proposal=work-1')
  })
})
