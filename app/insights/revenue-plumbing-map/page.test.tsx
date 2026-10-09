import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RevenuePlumbingMapPage from './page'

vi.mock('@/components/Navigation', () => ({ default: () => null }))
vi.mock('@/components/insights/RevenuePlumbingMap', () => ({
  default: () => <div aria-label="Revenue map fixture" />,
}))

describe('RevenuePlumbingMapPage', () => {
  it('presents the AmaduTown model and both next actions', () => {
    render(<RevenuePlumbingMapPage />)

    expect(screen.getByRole('heading', { name: 'Technology can narrow the capacity gap' })).toBeInTheDocument()
    expect(screen.getByText(/AmaduTown operating model/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Take the audit' })).toHaveAttribute('href', '/tools/audit')
    expect(screen.getByRole('link', { name: 'Talk with us' })).toHaveAttribute('href', '/#contact')
  })
})
