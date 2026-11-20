import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InsightsPage from './page'

vi.mock('@/components/Navigation', () => ({ default: () => <nav aria-label="Site navigation" /> }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('Insights index', () => {
  it('links the existing map and all three source dashboards', () => {
    render(<InsightsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Explore the systems' })).toBeInTheDocument()
    for (const path of [
      '/insights/revenue-plumbing-map',
      '/insights/compounding-graph',
      '/insights/home-front-ledger',
      '/insights/owning-the-block',
    ]) {
      expect(document.querySelector(`a[href="${path}"]`)).toBeInTheDocument()
    }
  })
})
