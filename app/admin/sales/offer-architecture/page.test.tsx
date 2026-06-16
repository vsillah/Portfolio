import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ADMIN_NAV } from '@/lib/admin-nav'
import OfferArchitecturePage from './page'
import OfferArchitectureClientBriefPage from './client-brief/page'

describe('OfferArchitecturePage', () => {
  it('renders the product asset offer ladder', () => {
    render(<OfferArchitecturePage />)

    expect(screen.getByRole('heading', { name: 'Offer Architecture' })).toBeInTheDocument()
    expect(screen.getByText('ReversR Product Asset Commercialization')).toBeInTheDocument()
    expect(screen.getByText('Product Asset License And Commercialization Sprint')).toBeInTheDocument()
    expect(screen.getByText('Rebuild Readiness Credit Campaign')).toBeInTheDocument()
    expect(screen.getByText('Rebuild Readiness Credit')).toBeInTheDocument()
    expect(screen.getAllByText('Attraction Campaigns').length).toBeGreaterThan(0)
    expect(screen.getByText('Commercial Stewardship Plan')).toBeInTheDocument()
    expect(screen.getByText('$100,000+')).toBeInTheDocument()
    expect(screen.getByText('Client Version')).toBeInTheDocument()
    expect(screen.getByText('10/100')).toBeInTheDocument()
    expect(screen.getByText('Evidence Trail')).toBeInTheDocument()
    expect(screen.getByText('Replacement-cost basis')).toBeInTheDocument()
    expect(screen.getAllByText(/Context sent:/).length).toBeGreaterThan(0)
  })

  it('renders the client-safe brief preview', () => {
    render(<OfferArchitectureClientBriefPage />)

    expect(screen.getByRole('heading', { name: 'ReversR Rebuild Product Asset Proposal' })).toBeInTheDocument()
    expect(screen.getByText('Evidence Summary')).toBeInTheDocument()
    expect(screen.getByText('Redaction Boundary')).toBeInTheDocument()
    expect(screen.getByText('Commercialization Sprint')).toBeInTheDocument()
  })

  it('is linked from Sales admin navigation', () => {
    const salesCategory = ADMIN_NAV.categories.find((category) => category.label === 'Sales')

    expect(salesCategory?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Offer Architecture',
          href: '/admin/sales/offer-architecture',
        }),
      ])
    )
  })
})
