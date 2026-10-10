import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle, { ThemePreferenceList } from './ThemeToggle'

const themeMocks = vi.hoisted(() => ({
  setTheme: vi.fn(),
  theme: 'system',
  resolvedTheme: 'light',
}))

vi.mock('next-themes', () => ({
  useTheme: () => themeMocks,
}))

describe('shared theme preference controls', () => {
  beforeEach(() => {
    themeMocks.setTheme.mockClear()
    themeMocks.theme = 'system'
    themeMocks.resolvedTheme = 'light'
  })

  it('uses the shared next-themes setter for Light, Dark, and System', async () => {
    const user = userEvent.setup()
    render(<ThemePreferenceList />)

    const light = await screen.findByRole('button', { name: 'Light theme' })
    const dark = screen.getByRole('button', { name: 'Dark theme' })
    const system = screen.getByRole('button', { name: 'System theme' })

    expect(system).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('aria-pressed', 'false')

    await user.click(light)
    await user.click(dark)
    await user.click(system)

    expect(themeMocks.setTheme.mock.calls).toEqual([['light'], ['dark'], ['system']])
  })

  it('keeps the compact trigger keyboard-focusable and labels its preference dialog', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle variant="compact" />)

    const trigger = await screen.findByRole('button', { name: 'Theme: System (light). Change theme' })
    trigger.focus()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{Enter}')

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Theme preferences' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Light theme' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Dark theme' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'System theme' })).toBeVisible()
  })
})
