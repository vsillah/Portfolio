import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RevenuePlumbingDiscoveryCard from './RevenuePlumbingDiscoveryCard'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('RevenuePlumbingDiscoveryCard', () => {
  it('introduces the interactive operating model and links to the live map', () => {
    render(<RevenuePlumbingDiscoveryCard />)

    expect(screen.getByRole('heading', { name: 'Revenue Plumbing Map' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'An interactive AmaduTown operating model for finding where revenue systems leak capacity.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Revenue Plumbing Map/i })).toHaveAttribute(
      'href',
      '/insights/revenue-plumbing-map',
    )
  })

  it('uses a restrained light surface while preserving the dark treatment', () => {
    render(<RevenuePlumbingDiscoveryCard />)

    const card = screen.getByRole('link', { name: /Revenue Plumbing Map/i })
    const action = screen.getByText('Explore the map')

    expect(card).toHaveClass('bg-[#E8EDF3]/[0.96]')
    expect(card).toHaveClass('border-[#A88A2D]/25')
    expect(card).toHaveClass('dark:bg-silicon-slate/45')
    expect(action).toHaveClass('bg-[#121E31]')
    expect(action).toHaveClass('dark:bg-transparent')
  })
})
