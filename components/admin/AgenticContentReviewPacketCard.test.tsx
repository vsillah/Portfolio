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
})
