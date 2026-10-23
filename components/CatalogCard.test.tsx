import { render, screen, within } from '@testing-library/react'
import { ShoppingCart } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import CatalogCard from './CatalogCard'

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

const card = {
  title: 'Lead Generation Template',
  description: 'A workflow template',
  href: '/store/18',
  imageUrl: '/showcases/product-leadgen-workflow-v2.png',
  imageAlt: 'Illustrative lead workflow',
  badges: ['Template'],
  cornerLabel: 'Free',
  ctaLabel: 'View Product',
  icon: ShoppingCart,
  index: 0,
}

describe('catalog showcase presentation', () => {
  it('keeps a complete showcase image clear of metadata overlays', () => {
    render(<CatalogCard {...card} showcasePresentation />)
    const link = screen.getByRole('link', { name: /Lead Generation Template/i })
    const image = within(link).getByAltText('Illustrative lead workflow')
    const media = image.parentElement as HTMLElement
    expect(media).toHaveClass('aspect-[5/3]')
    expect(image).toHaveClass('object-contain')
    expect(image).not.toHaveClass('group-hover:scale-105')
    expect(media).not.toContainElement(within(link).getByText('Template'))
    expect(media).not.toContainElement(within(link).getByText('Free'))
  })

  it('preserves the existing crop and badges for ordinary cards', () => {
    render(<CatalogCard {...card} imageUrl="/merchandise.png" />)
    const image = screen.getByAltText('Illustrative lead workflow')
    const media = image.parentElement as HTMLElement
    expect(media).toHaveClass('h-64')
    expect(image).toHaveClass('object-cover')
    expect(media).toContainElement(screen.getByText('Template'))
    expect(media).toContainElement(screen.getByText('Free'))
  })
})
