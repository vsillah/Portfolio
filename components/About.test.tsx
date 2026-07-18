import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import About from './About'

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill,
    src,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} {...props} />
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

vi.mock('@/lib/useRevealOnScroll', () => ({
  useRevealOnScroll: () => null,
}))

describe('About light-mode background', () => {
  it('uses a light aligned section background with explicit dark fallback', () => {
    const { container } = render(<About />)

    const section = container.querySelector('#about')
    expect(section).toHaveClass('bg-[linear-gradient(180deg,#f8fafc_0%,#f4f7fb_48%,#fbfcfe_100%)]')
    expect(section).toHaveClass('dark:bg-none')
    expect(section).toHaveClass('dark:bg-silicon-slate/20')

    expect(screen.getByText('Story').parentElement).toHaveClass('bg-white/[0.78]')
    expect(screen.getByText('15+ Years').parentElement).toHaveClass('bg-white/[0.84]')
  })
})
