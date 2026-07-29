import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AgenticContentReviewPacketPager from './AgenticContentReviewPacketPager'
import { getAgenticContentReviewPacketsForSurface } from '@/lib/agentic-content-review-packets'

describe('AgenticContentReviewPacketPager', () => {
  it('shows one review packet at a time and pages through the packet set', () => {
    const packets = getAgenticContentReviewPacketsForSurface('social')

    render(
      <AgenticContentReviewPacketPager
        packets={packets}
        nextGateHref="#social-content-approval-queue"
        nextGateLabel="Open approval queue"
      />,
    )

    expect(screen.getByText(`Packet 1 of ${packets.length}`)).toBeInTheDocument()
    expect(screen.getAllByText(packets[0].title).length).toBeGreaterThan(0)
    expect(screen.queryByText(packets[1].title)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText(`Packet 2 of ${packets.length}`)).toBeInTheDocument()
    expect(screen.getAllByText(packets[1].title).length).toBeGreaterThan(0)
    expect(screen.queryByText(packets[2].title)).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Select review packet' }), {
      target: { value: String(packets.length - 1) },
    })

    expect(screen.getByText(`Packet ${packets.length} of ${packets.length}`)).toBeInTheDocument()
    expect(screen.getAllByText(packets[packets.length - 1].title).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('renders an empty ready-state when no packets are available', () => {
    render(<AgenticContentReviewPacketPager packets={[]} />)

    expect(screen.getByText('No review packets are ready yet.')).toBeInTheDocument()
  })
})
