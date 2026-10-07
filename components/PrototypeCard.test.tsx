import type { ImgHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PrototypeCard from './PrototypeCard'

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

vi.stubGlobal('IntersectionObserver', class {
  root = null
  rootMargin = ''
  thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
})

vi.mock('next/image', () => ({
  default: function MockImage({ fill: _fill, alt = '', ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...props} />
  },
}))

const prototype = {
  id: 'dark-castle',
  title: 'Dark Castle Chess',
  description: 'Play free in your browser.',
  purpose: 'A browser-based chess experience.',
  production_stage: 'Production',
  channel: 'Web',
  product_type: 'Experience',
  thumbnail_url: '/dark-castle.png',
  download_url: 'https://dark-castle-chess.vercel.app/welcome',
  app_repo_url: undefined,
  demos: [],
}

describe('PrototypeCard', () => {
  it('links a public app card to its approved landing page', () => {
    render(
      <PrototypeCard
        prototype={prototype}
        user={null}
        isAdmin={false}
        index={0}
        onEnrollmentSuccess={vi.fn()}
      />,
    )

    expect(screen.getByText('Dark Castle Chess')).toBeInTheDocument()
    expect(screen.getByText('Play free in your browser.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open App' })).toHaveAttribute(
      'href',
      'https://dark-castle-chess.vercel.app/welcome',
    )
    expect(screen.getByRole('button', { name: 'Feedback' }).parentElement).toHaveClass('grid-cols-1')
  })

  it('omits the external action when an app has no approved destination', () => {
    render(
      <PrototypeCard
        prototype={{ ...prototype, download_url: undefined }}
        user={null}
        isAdmin={false}
        index={0}
        onEnrollmentSuccess={vi.fn()}
      />,
    )

    expect(screen.queryByRole('link', { name: 'Open App' })).not.toBeInTheDocument()
  })
})
