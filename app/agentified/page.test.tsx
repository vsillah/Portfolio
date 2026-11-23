import { render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { agentifiedPublication } from '@/lib/agentified-publication'
import AgentifiedPage, { metadata } from './page'

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { src: string; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={typeof src === 'string' ? src : ''} {...props} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/Navigation', () => ({
  default: () => <nav aria-label="Primary">Navigation</nav>,
}))

describe('Agentified public page purchase links', () => {
  it('states the public workshop format and access model', () => {
    render(<AgentifiedPage />)
    expect(screen.getByRole('heading', { name: 'Public open learning' })).toBeInTheDocument()
    expect(screen.getByText(/Start as a guest/)).toBeInTheDocument()
    expect(screen.getByText(/thirteen guided-video lessons and three transcript-led lessons/)).toBeInTheDocument()
    expect(screen.getByText(/Sign in only if you want to save progress across devices/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start the free workshop/i })).toHaveAttribute('href', '/agentified/learningplan')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy')
    expect(screen.getByRole('link', { name: 'workshop terms' })).toHaveAttribute('href', '/legal/terms')
  })

  it('publishes Agentified-specific canonical and social metadata', () => {
    expect(metadata.title).toBe('Agentified: Open Learning Workshop | AmaduTown')
    expect(metadata.description).toMatch(/thirteen guided-video lessons and three transcript-led lessons/)
    expect(metadata.alternates).toEqual({ canonical: 'https://amadutown.com/agentified' })
    expect(metadata.openGraph).toMatchObject({
      title: metadata.title,
      description: metadata.description,
      url: 'https://amadutown.com/agentified',
      images: [{ url: 'https://amadutown.com/agentified-cover.jpg', alt: 'Agentified book cover' }],
    })
  })

  it('renders published purchase CTAs with safe external link attributes', () => {
    render(<AgentifiedPage />)

    expect(screen.getByRole('heading', { level: 1, name: agentifiedPublication.title })).toBeInTheDocument()
    expect(screen.getByText(agentifiedPublication.statusLabel)).toBeInTheDocument()
    expect(screen.getByAltText(`${agentifiedPublication.title} cover`)).toHaveAttribute(
      'src',
      agentifiedPublication.coverImage,
    )

    for (const link of agentifiedPublication.purchaseLinks) {
      const anchor = screen.getByRole('link', { name: new RegExp(link.label, 'i') })
      expect(anchor).toHaveAttribute('href', link.href)
      expect(anchor).toHaveAttribute('target', '_blank')
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
      expect(within(anchor).getByText(link.status)).toBeInTheDocument()
    }

    expect(screen.getByText(/Wide distribution/i)).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(agentifiedPublication.wideRetailers.join(', '))),
    ).toBeInTheDocument()
  })
})
