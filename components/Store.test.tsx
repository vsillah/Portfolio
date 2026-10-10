import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Store from './Store'

vi.mock('next/image', () => ({
  default: ({ fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

const challenge = {
  id: 'challenge-1',
  name: 'Agentic Operating System Readiness Challenge',
  slug: 'agentic-operating-system-readiness-challenge',
  description: 'Find the gaps between your agent ambition and operating reality.',
  campaign_type: 'free_challenge',
  hero_image_url: null,
  promo_copy: null,
  enrollment_deadline: null,
  completion_window_days: 7,
  payout_type: 'none',
  campaign_eligible_bundles: [],
  campaign_criteria_templates: [],
}

function mockCatalogRequests(campaigns = [challenge]) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(input)

    if (url.includes('/api/campaigns/active')) {
      return { ok: true, json: async () => ({ data: campaigns }) }
    }

    if (url.includes('/api/products')) {
      return { ok: true, json: async () => [] }
    }

    throw new Error(`Unexpected request: ${url}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('homepage product catalog', () => {
  it('places the active readiness challenge inside the established Products section', async () => {
    mockCatalogRequests()
    const { container } = render(<Store section="products" />)

    const challengeLink = await screen.findByRole('link', {
      name: /Agentic Operating System Readiness Challenge/i,
    })
    const productsSection = container.querySelector('section#products')

    expect(productsSection).not.toBeNull()
    expect(within(productsSection as HTMLElement).getByRole('heading', { name: 'Products' })).toBeInTheDocument()
    expect(productsSection).toContainElement(challengeLink)
    expect(challengeLink).toHaveAttribute(
      'href',
      '/campaigns/agentic-operating-system-readiness-challenge',
    )
    expect(screen.getByText('Free Challenge')).toBeInTheDocument()
    expect(screen.getByText('7 day challenge')).toBeInTheDocument()
    expect(screen.getByText('View Challenge')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Special Campaigns' })).not.toBeInTheDocument()
  })

  it('uses the same responsive catalog grid and light/dark card surface for the challenge', async () => {
    mockCatalogRequests()
    const { container } = render(<Store section="products" />)

    const challengeLink = await screen.findByRole('link', {
      name: /Agentic Operating System Readiness Challenge/i,
    })
    const grid = challengeLink.parentElement

    await waitFor(() => expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3'))
    expect(challengeLink).toHaveClass('bg-white/[0.88]')
    expect(challengeLink).toHaveClass('dark:bg-silicon-slate/40')
    expect(challengeLink).toHaveClass('h-full')
  })
})
