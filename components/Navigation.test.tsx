import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navigation from './Navigation'

const mocks = vi.hoisted(() => ({
  navClick: vi.fn(),
  pathname: vi.fn(() => '/'),
  push: vi.fn(),
  refresh: vi.fn(),
}))

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
    }: HTMLAttributes<HTMLDivElement> & {
      animate?: unknown
      children?: ReactNode
      exit?: unknown
      initial?: unknown
      transition?: unknown
    }) => <div {...props}>{children}</div>,
  },
}))

vi.mock('next/image', () => ({
  default: ({
    alt,
    priority,
    src,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; src: string }) => (
    <img alt={alt} data-priority={priority ? 'true' : undefined} src={src} {...props} />
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

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ isAdmin: false, user: null }),
}))

vi.mock('@/components/ThemeToggle', () => ({
  ThemePreferenceList: ({ onSelect }: { onSelect?: () => void }) => (
    <button onClick={onSelect} type="button">
      Theme preference
    </button>
  ),
}))

vi.mock('@/lib/analytics', () => ({
  analytics: {
    navClick: mocks.navClick,
  },
}))

vi.mock('@/lib/auth', () => ({
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname(),
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}))

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))
  return screen.getByRole('dialog', { name: 'Site navigation' })
}

describe('Navigation system-story link', () => {
  beforeEach(() => {
    mocks.navClick.mockClear()
    mocks.pathname.mockReturnValue('/')
    mocks.push.mockClear()
    mocks.refresh.mockClear()
  })

  it('links to the in-page System section from the homepage menu', () => {
    render(<Navigation />)

    const dialog = openMenu()
    const systemLink = within(dialog).getByRole('link', { name: 'System' })

    expect(systemLink).toHaveAttribute('href', '#system')

    fireEvent.click(systemLink)

    expect(mocks.navClick).toHaveBeenCalledWith('#system')
    expect(screen.queryByRole('dialog', { name: 'Site navigation' })).not.toBeInTheDocument()
  })

  it('prefixes the System hash link when opened from another route', () => {
    mocks.pathname.mockReturnValue('/pricing')
    render(<Navigation />)

    const dialog = openMenu()

    expect(within(dialog).getByRole('link', { name: 'System' })).toHaveAttribute('href', '/#system')
    expect(within(dialog).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/#home')
  })
})
