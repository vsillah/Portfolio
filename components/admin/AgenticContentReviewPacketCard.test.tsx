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
})
