import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ShowcaseCarousel from './ShowcaseCarousel'
import type { ShowcaseFrame } from '@/lib/showcase-preview'

vi.mock('next/image', () => ({
  default: ({ fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

const frames: ShowcaseFrame[] = [
  { imageUrl: '/hero.svg', alt: 'Hero art', role: 'hero', status: 'illustrative concept' },
  { imageUrl: '/workflow.svg', alt: 'Workflow art', role: 'workflow', status: 'illustrative concept' },
]

describe('showcase carousel', () => {
  it('keeps card state isolated and wraps both directions', () => {
    render(<><ShowcaseCarousel frames={frames} title="First" /><ShowcaseCarousel frames={frames} title="Second" /></>)
    const first = screen.getByRole('group', { name: 'First image gallery' })
    const second = screen.getByRole('group', { name: 'Second image gallery' })
    fireEvent.click(within(first).getByRole('button', { name: 'Next image for First' }))
    expect(within(first).getByAltText('Workflow art')).toBeInTheDocument()
    expect(within(second).getByAltText('Hero art')).toBeInTheDocument()
    fireEvent.click(within(first).getByRole('button', { name: 'Next image for First' }))
    expect(within(first).getByAltText('Hero art')).toBeInTheDocument()
    fireEvent.click(within(first).getByRole('button', { name: 'Previous image for First' }))
    expect(within(first).getByAltText('Workflow art')).toBeInTheDocument()
  })

  it('supports keyboard and swipe while keeping image navigation separate', () => {
    render(<ShowcaseCarousel frames={frames} title="Course" imageHref="/services/course" />)
    const gallery = screen.getByRole('group', { name: 'Course image gallery' })
    expect(within(gallery).getByRole('link', { name: 'View Course' })).toHaveAttribute('href', '/services/course')
    fireEvent.keyDown(gallery, { key: 'ArrowRight' })
    expect(within(gallery).getByAltText('Workflow art')).toBeInTheDocument()
    fireEvent.touchStart(gallery, { touches: [{ clientX: 100 }] })
    fireEvent.touchEnd(gallery, { changedTouches: [{ clientX: 175 }] })
    expect(within(gallery).getByAltText('Hero art')).toBeInTheDocument()
    expect(within(gallery).getByRole('button', { name: 'Show hero image for Course' })).toHaveAttribute('aria-current', 'true')
  })

  it('uses the static image on error and hides controls for one frame', () => {
    render(<ShowcaseCarousel frames={[frames[0]]} title="Single" fallbackUrl="/fallback.png" />)
    expect(screen.queryByRole('button', { name: /Next image/ })).not.toBeInTheDocument()
    fireEvent.error(screen.getByAltText('Hero art'))
    expect(screen.getByAltText('Hero art')).toHaveAttribute('src', '/fallback.png')
    fireEvent.error(screen.getByAltText('Hero art'))
    expect(screen.getByRole('img', { name: 'Single image unavailable' })).toBeInTheDocument()
  })
})
