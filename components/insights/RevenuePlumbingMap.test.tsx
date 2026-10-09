import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RevenuePlumbingMap from './RevenuePlumbingMap'
import { PLUMBING_STEPS } from './revenue-plumbing-data'

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  disconnect() {}
})

function useMedia({ compact = false, reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : compact,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

describe('RevenuePlumbingMap', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts paused when reduced motion is preferred', async () => {
    useMedia({ reducedMotion: true })
    render(<RevenuePlumbingMap />)

    expect(await screen.findByRole('button', { name: 'Play walkthrough' })).toBeInTheDocument()
  })

  it('moves through the walkthrough with previous and next controls', async () => {
    useMedia()
    const user = userEvent.setup()
    render(<RevenuePlumbingMap />)

    await user.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByText(new RegExp(`Leak 02 of ${PLUMBING_STEPS.length}`))).toBeInTheDocument()
    expect(screen.getByText('Offer', { selector: 'p' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous step' }))
    expect(screen.getByText(new RegExp(`Leak 01 of ${PLUMBING_STEPS.length}`))).toBeInTheDocument()
    expect(screen.getByText('Hook', { selector: 'p' })).toBeInTheDocument()
  })

  it('exposes one accessible step path on compact screens', async () => {
    useMedia({ compact: true })
    render(<RevenuePlumbingMap />)

    await waitFor(() => expect(screen.getByTestId('revenue-map-overview')).toHaveAttribute('aria-hidden', 'true'))
    expect(screen.getByTestId('compact-step-list')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show where it leaks/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(PLUMBING_STEPS.length - 1)
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('keeps the large map interactive without rendering the compact list', () => {
    useMedia()
    render(<RevenuePlumbingMap />)

    expect(screen.queryByTestId('compact-step-list')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /show where it leaks/i })).toHaveLength(PLUMBING_STEPS.length)
  })
})
