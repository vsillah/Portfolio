import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminLayout from './layout'

const usePathnameMock = vi.fn(() => '/admin/social-content')
const setThemeMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', resolvedTheme: 'light', setTheme: setThemeMock }),
}))

describe('AdminLayout theme-aware navigation shell', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/admin/social-content')
    setThemeMock.mockClear()
  })

  it('inherits the document theme instead of forcing dark mode', () => {
    render(<AdminLayout><div>Admin content</div></AdminLayout>)

    const layout = screen.getByTestId('admin-layout')
    expect(layout).toHaveClass('bg-background', 'text-foreground')
    expect(layout).not.toHaveClass('dark')
  })

  it('exposes the shared compact theme control in the desktop header', async () => {
    render(<AdminLayout><div>Admin content</div></AdminLayout>)

    const control = screen.getByTestId('admin-desktop-theme-control')
    const trigger = await within(control).findByRole('button', { name: 'Theme: System (light). Change theme' })

    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveClass('h-9', 'w-9', 'rounded-lg')
  })

  it('opens a semantic mobile drawer and preserves active navigation state', () => {
    render(<AdminLayout><div>Admin content</div></AdminLayout>)

    fireEvent.click(screen.getByRole('button', { name: 'Open admin menu' }))

    const drawer = screen.getByTestId('admin-mobile-drawer')
    expect(drawer).toBeVisible()
    expect(drawer).toHaveClass('bg-card', 'text-card-foreground', 'border-border', 'translate-x-0')
    expect(screen.getByTestId('admin-mobile-drawer-header')).toHaveClass('bg-card', 'border-border')
    expect(screen.getAllByRole('link', { name: 'Social Content' }).at(-1)).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(drawer).not.toBeVisible()
  })

  it('exposes accessible Light, Dark, and System choices inside the mobile drawer', async () => {
    const user = userEvent.setup()
    render(<AdminLayout><div>Admin content</div></AdminLayout>)

    await user.click(screen.getByRole('button', { name: 'Open admin menu' }))
    const drawer = screen.getByTestId('admin-mobile-drawer')
    const themeControl = within(drawer).getByTestId('admin-mobile-theme-control')
    const light = await within(themeControl).findByRole('button', { name: 'Light theme' })
    const dark = within(themeControl).getByRole('button', { name: 'Dark theme' })
    const system = within(themeControl).getByRole('button', { name: 'System theme' })

    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(system).toHaveAttribute('aria-pressed', 'true')
    await user.click(dark)
    expect(setThemeMock).toHaveBeenCalledWith('dark')

    within(drawer).getByRole('button', { name: 'Close menu' }).focus()
    await user.tab()
    await waitFor(() => expect(light).toHaveFocus())
  })
})
