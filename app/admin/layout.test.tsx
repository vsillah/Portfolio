import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminLayout from './layout'

const usePathnameMock = vi.fn(() => '/admin/social-content')

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

describe('AdminLayout theme-aware navigation shell', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/admin/social-content')
  })

  it('inherits the document theme instead of forcing dark mode', () => {
    render(<AdminLayout><div>Admin content</div></AdminLayout>)

    const layout = screen.getByTestId('admin-layout')
    expect(layout).toHaveClass('bg-background', 'text-foreground')
    expect(layout).not.toHaveClass('dark')
  })

  it('opens a semantic mobile drawer and preserves active navigation state', () => {
    render(<AdminLayout><div>Admin content</div></AdminLayout>)

    fireEvent.click(screen.getByRole('button', { name: 'Open admin menu' }))

    const drawer = screen.getByTestId('admin-mobile-drawer')
    expect(drawer).toBeVisible()
    expect(drawer).toHaveClass('bg-card', 'text-card-foreground', 'border-border', 'translate-x-0')
    expect(screen.getByTestId('admin-mobile-drawer-header')).toHaveClass('bg-card/95', 'border-border')
    expect(screen.getAllByRole('link', { name: 'Social Content' }).at(-1)).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(drawer).not.toBeVisible()
  })
})
