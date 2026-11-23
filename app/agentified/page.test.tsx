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

  it('explains guest access and the current lesson formats beside the workshop action', () => {
    render(<AgentifiedPage />)

    expect(screen.getByRole('heading', { name: 'Public open learning' })).toBeInTheDocument()
    expect(screen.getByText(/Begin as a guest/)).toBeInTheDocument()
    expect(screen.getByText(/Sign-in is optional/)).toBeInTheDocument()
    expect(screen.getByText(/thirteen guided-video lessons and three transcript-led lessons/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start the free workshop/i })).toHaveAttribute('href', '/agentified/learningplan')
  })

  it('uses Agentified-specific search and sharing metadata', () => {
    expect(metadata.title).toBe('Agentified Workshop | AmaduTown')
    expect(metadata.description).toContain('Thirteen guided-video lessons and three transcript-led lessons')
    expect(metadata.alternates?.canonical).toBe('https://amadutown.com/agentified')
    expect(metadata.openGraph).toMatchObject({
      title: 'Agentified Workshop | AmaduTown',
      url: 'https://amadutown.com/agentified',
      images: [{ url: 'https://amadutown.com/agentified-cover.jpg' }],
    })
  })
})
