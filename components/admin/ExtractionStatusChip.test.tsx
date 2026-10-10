import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExtractionStatusChip } from './ExtractionStatusChip'

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => null),
}))

describe('ExtractionStatusChip theme surfaces', () => {
  const baseProps = {
    state: 'idle' as const,
    currentRun: null,
    recentRuns: [],
    elapsedMs: 0,
    toggleDrawer: vi.fn(),
    toggleHistory: vi.fn(),
    markRunFailed: vi.fn(),
  }

  it('uses semantic tokens for its chip, detail drawer, and history dialog', () => {
    const { container, rerender } = render(
      <ExtractionStatusChip {...baseProps} isDrawerOpen isHistoryOpen={false} />,
    )

    expect(screen.getByRole('button', { name: /Status:/i })).toHaveClass('border-border', 'bg-card', 'text-card-foreground')
    expect(screen.getByText('No runs yet. Use Run to start the first sync.').closest('.bg-popover')).toHaveClass('text-popover-foreground')

    rerender(<ExtractionStatusChip {...baseProps} isDrawerOpen={false} isHistoryOpen />)
    expect(screen.getByRole('dialog', { name: 'Extraction run history' })).toHaveClass('border-border', 'bg-card', 'text-card-foreground')
    expect(screen.getByText('No extraction runs yet.')).toHaveClass('text-muted-foreground')

    const classNames = Array.from(container.querySelectorAll<HTMLElement>('[class]'))
      .map((element) => element.className)
      .join(' ')
    expect(classNames).not.toMatch(/bg-gray-(700|800|900)|border-gray-(600|700|800|900)|text-gray-(100|200|300|400|500|600)/)
  })
})
