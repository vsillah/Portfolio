import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PortfolioVisualMockup from './PortfolioVisualMockup'

describe('PortfolioVisualMockup', () => {
  it('renders a dense product visual fallback from artifact metadata', () => {
    render(
      <PortfolioVisualMockup
        kind="product"
        title="AI Implementation Playbook"
        eyebrow="Template"
        primaryLabel="Digital asset"
        secondaryLabel="$29"
        items={['Install instructions', 'Repo link', 'Operator guide']}
        focusCodes={['weak_feature_signal', 'high_blank_space_ratio']}
      />,
    )

    expect(screen.getByText('AI Implementation Playbook')).toBeInTheDocument()
    expect(screen.getByText('Feature proof')).toBeInTheDocument()
    expect(screen.getByText('Dense frame')).toBeInTheDocument()
    expect(screen.getByText('Implementation board')).toBeInTheDocument()
    expect(screen.getAllByText('Install instructions').length).toBeGreaterThan(0)
  })

  it('renders a service visual fallback with delivery labels', () => {
    render(
      <PortfolioVisualMockup
        kind="service"
        title="AI Strategy Workshop"
        eyebrow="Workshop"
        primaryLabel="Hybrid"
        secondaryLabel="Half day"
        items={['Discovery', 'Action plan', 'Implementation guidance']}
      />,
    )

    expect(screen.getByText('AI Strategy Workshop')).toBeInTheDocument()
    expect(screen.getByText('Workshop')).toBeInTheDocument()
    expect(screen.getByText('Hybrid')).toBeInTheDocument()
    expect(screen.getByText('Handoff checklist')).toBeInTheDocument()
  })
})
