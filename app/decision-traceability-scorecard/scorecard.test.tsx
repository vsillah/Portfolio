import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DecisionTraceability from './scorecard'

vi.mock('next/image', () => ({ default: ({ fill, ...props }: Record<string, unknown>) => <img {...props} alt={String(props.alt || '')} /> }))
vi.mock('next/link', () => ({ default: (props: { href: string; children: React.ReactNode }) => <a href={props.href}>{props.children}</a> }))

function completeScore() {
  const radios = screen.getAllByRole('radio')
  for (const index of [2, 3, 7, 11]) fireEvent.click(radios[index])
}

describe('Decision Traceability Scorecard', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'b893d345-9d11-4fb2-a0e4-544067cc129e' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.history.replaceState({}, '', '/decision-traceability-scorecard?utm_source=linkedin&utm_campaign=dark-castle')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('shows a usable result and PDF before consent, then fails visibly on persistence error', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'We could not save your request.' }) })
    vi.stubGlobal('fetch', fetch)
    render(<DecisionTraceability />)
    expect(screen.getByRole('link', { name: /Download the free PDF/i })).toHaveAttribute('href', '/decision-traceability-worksheet.pdf')
    expect(screen.getByRole('button', { name: /Request follow-up/i })).toBeDisabled()
    completeScore()
    expect(screen.getByRole('heading', { name: 'Make ownership visible.' })).toBeVisible()
    expect(screen.getByText('YOUR TRACEABILITY SCORE').previousSibling).toHaveTextContent('5')
    fireEvent.change(screen.getByRole('textbox', { name: /Work email/i }), { target: { value: 'review@example.invalid' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Request follow-up/i }))
    await waitFor(() => expect(screen.getByText('We could not save your request.')).toBeVisible())
    expect(screen.getByRole('button', { name: /Request follow-up/i })).toBeEnabled()
    expect(fetch).toHaveBeenCalledWith('/api/decision-traceability', expect.objectContaining({ method: 'POST' }))
    const sent = JSON.parse(fetch.mock.calls[0][1].body)
    expect(sent.attribution).toMatchObject({ utm_source: 'linkedin', utm_campaign: 'dark-castle' })
  })

  it('distinguishes duplicate state from a saved request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'duplicate', message: 'This email already has a scorecard request.' }) }))
    render(<DecisionTraceability />)
    completeScore()
    fireEvent.change(screen.getByRole('textbox', { name: /Work email/i }), { target: { value: 'review@example.invalid' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Request follow-up/i }))
    await waitFor(() => expect(screen.getByText('This email already has a scorecard request.')).toBeVisible())
    expect(screen.getByRole('button', { name: /Already saved/i })).toBeDisabled()
  })

  it('shows saved state only after a successful response and resets when edited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'saved' }) }))
    render(<DecisionTraceability />)
    completeScore()
    fireEvent.change(screen.getByRole('textbox', { name: /Work email/i }), { target: { value: 'review@example.invalid' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Request follow-up/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Request saved/i })).toBeDisabled())
    fireEvent.change(screen.getByRole('textbox', { name: /Work email/i }), { target: { value: 'another@example.invalid' } })
    expect(screen.getByRole('button', { name: /Request follow-up/i })).toBeEnabled()
  })

  it('keeps submission closed while offline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<DecisionTraceability />)
    completeScore()
    fireEvent.change(screen.getByRole('textbox', { name: /Work email/i }), { target: { value: 'review@example.invalid' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Request follow-up/i }))
    expect(screen.getByText(/You are offline\. Your score stays on this page/)).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })
})
