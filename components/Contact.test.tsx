import { render, screen } from '@testing-library/react'
import type { ImgHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Contact from './Contact'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      animate,
      children,
      exit,
      initial,
      transition,
      ...props
    }: {
      animate?: unknown
      children?: ReactNode
      exit?: unknown
      initial?: unknown
      transition?: unknown
    }) => <div {...props}>{children}</div>,
    form: ({
      animate,
      children,
      exit,
      initial,
      transition,
      ...props
    }: {
      animate?: unknown
      children?: ReactNode
      exit?: unknown
      initial?: unknown
      transition?: unknown
    }) => <form {...props}>{children}</form>,
  },
}))

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

vi.mock('@/lib/analytics', () => ({
  analytics: {
    contactFormSubmit: vi.fn(),
    contactFormView: vi.fn(),
  },
}))

vi.mock('./chat', () => ({
  Chat: () => <div data-testid="mock-chat" />,
}))

describe('Contact light-mode controls', () => {
  it('uses light aligned fills for inactive tab and social controls', () => {
    const { container } = render(<Contact />)

    expect(screen.getByRole('button', { name: /chat now/i })).toHaveClass('from-radiant-gold')
    expect(screen.getByRole('button', { name: /send message/i })).toHaveClass('bg-white/[0.78]')

    const linkedIn = container.querySelector('a[href^="https://www.linkedin.com"]')
    expect(linkedIn).toHaveClass('bg-white/[0.76]')
    expect(linkedIn).toHaveClass('dark:bg-silicon-slate/30')
  })
})
