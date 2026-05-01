import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ADMIN_NAV } from '@/lib/admin-nav'
import TechnologyBakeoffsPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe('TechnologyBakeoffsContent', () => {
  it('renders the default media bakeoff plan', () => {
    render(<TechnologyBakeoffsPage />)

    expect(screen.getByRole('heading', { name: 'Technology Bakeoffs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Image and video generation' })).toBeInTheDocument()
    expect(screen.getByText(/Read-only planning mode/i)).toBeInTheDocument()
    expect(screen.getAllByText(/fal media model gallery/i).length).toBeGreaterThan(0)
  })

  it('updates the plan when another surface is selected', () => {
    render(<TechnologyBakeoffsPage />)

    fireEvent.change(screen.getByLabelText('Surface'), {
      target: { value: 'analytics' },
    })

    expect(screen.getByRole('heading', { name: 'Analytics and attribution' })).toBeInTheDocument()
    expect(screen.getAllByText(/Vercel analytics/i).length).toBeGreaterThan(0)
  })

  it('is linked from Quality & insights admin navigation', () => {
    const qualityCategory = ADMIN_NAV.categories.find((category) => category.label === 'Quality & insights')

    expect(qualityCategory?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Technology Bakeoffs',
          href: '/admin/technology-bakeoffs',
        }),
      ])
    )
  })
})
