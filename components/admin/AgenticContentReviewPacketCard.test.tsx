import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AgenticContentReviewPacketCard from './AgenticContentReviewPacketCard'
import { getAgenticContentReviewPacketByAssetId } from '@/lib/agentic-content-review-packets'

describe('AgenticContentReviewPacketCard', () => {
  it('renders inline evidence so reviewers do not have to leave the queue page first', () => {
    const packet = getAgenticContentReviewPacketByAssetId('p0-linkedin-flagship-agentic-operating-system')

    expect(packet).not.toBeNull()
    render(
      <AgenticContentReviewPacketCard
        packet={packet!}
        nextGateHref="#social-content-approval-queue"
        nextGateLabel="Open approval queue"
      />,
    )

    expect(screen.getByText('Evidence packet')).toBeInTheDocument()
    expect(screen.getByText(/The demo is no longer the hard part/)).toBeInTheDocument()
    expect(screen.getByText('Source basis')).toBeInTheDocument()
    expect(screen.getByText('Amina clearance')).toBeInTheDocument()
    expect(screen.getByText('Human checks')).toBeInTheDocument()
    expect(screen.getByText('Still gated')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open source packet/i })).toBeInTheDocument()
  })

  it('renders decision controls as compact actions and moves references to the header', () => {
    const packet = getAgenticContentReviewPacketByAssetId('p0-linkedin-flagship-agentic-operating-system')

    expect(packet).not.toBeNull()
    render(
      <AgenticContentReviewPacketCard
        packet={packet!}
        nextGateHref="#social-content-approval-queue"
        nextGateLabel="Open approval queue"
      />,
    )

    expect(screen.getByRole('link', { name: 'Approve next gate' })).toHaveAttribute(
      'title',
      'Creates a traceable planning step before any scheduling or publishing.',
    )
    expect(screen.queryByText('Creates a traceable planning step before any scheduling or publishing.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open source draft' })).toHaveTextContent('Draft')
    expect(screen.getByRole('link', { name: 'Open source packet' })).toHaveTextContent('Packet')
    expect(screen.getByRole('link', { name: 'Open approval queue' })).toHaveTextContent('Queue')
    expect(screen.queryByText('Human decision')).not.toBeInTheDocument()
    expect(screen.queryByText(/Approve path:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Send back:/i)).not.toBeInTheDocument()
  })

  it('can render as evidence-only when another approval control owns the workflow', () => {
    const packet = getAgenticContentReviewPacketByAssetId('p0-linkedin-flagship-agentic-operating-system')

    expect(packet).not.toBeNull()
    render(
      <AgenticContentReviewPacketCard
        packet={packet!}
        nextGateHref="#social-content-approval-queue"
        nextGateLabel="Open approval queue"
        showDecisionActions={false}
      />,
    )

    expect(screen.getByText('Evidence packet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open source draft' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open approval queue' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Approve next gate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Send back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Hold' })).not.toBeInTheDocument()
  })

  it('uses semantic surfaces and theme-aware status accents', () => {
    const packet = getAgenticContentReviewPacketByAssetId('p0-linkedin-flagship-agentic-operating-system')
    const { container } = render(<AgenticContentReviewPacketCard packet={packet!} />)

    expect(container.firstElementChild).toHaveClass('border-border', 'bg-card', 'text-card-foreground')
    expect(screen.getByText('Evidence packet').closest('div')?.parentElement).toHaveClass('bg-blue-500/10')

    const classNames = Array.from(container.querySelectorAll<HTMLElement>('[class]'))
      .map((element) => element.className)
      .join(' ')
    expect(classNames).not.toMatch(/bg-imperial-navy|border-silicon-slate|bg-gray-(700|800|900)|text-gray-(100|200|300|400|500|600)/)
  })
})
