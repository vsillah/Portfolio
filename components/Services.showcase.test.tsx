import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Services from './Services'

vi.mock('next/image', () => ({
  default: ({ fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

const course = {
  id: 'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2', title: 'AI Training Course — Self-Paced', description: 'Learn at your pace',
  service_type: 'training', delivery_method: 'virtual', duration_hours: null, duration_description: null, price: 0,
  is_quote_based: false, image_url: null, video_url: null, video_thumbnail_url: null, is_featured: false, display_order: 0,
}

afterEach(() => vi.unstubAllGlobals())

describe('self-paced course showcase', () => {
  it('shows a poster with an honest pending video action', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [course] })))
    render(<Services />)
    const gallery = await screen.findByRole('group', { name: 'AI Training Course — Self-Paced image gallery' })
    expect(within(gallery).getByAltText(/self-paced lessons/i)).toBeInTheDocument()
    expect(within(gallery).getByRole('button', { name: /Show course-preview poster/i })).toBeInTheDocument()
    const action = screen.getByRole('button', { name: 'Watch course preview' })
    expect(action).toBeDisabled()
    expect(screen.getByText(/Module 0 awaits script review, an approved render, and a bound video/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Watch course preview' })).not.toBeInTheDocument()
  })
})
