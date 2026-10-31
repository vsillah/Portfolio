import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DecisionTraceability from './scorecard'

vi.mock('next/image', () => ({ default: ({ fill, priority, ...props }: Record<string, unknown>) => <img {...props} alt={String(props.alt || '')} /> }))
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

  it('shows the owned Dark Castle identity and six distinct capability flows', () => {
    render(<DecisionTraceability />)
    expect(screen.getByRole('img', { name: 'Dark Castle Chess castle logo' })).toHaveAttribute('src', '/lead-magnets/dark-castle-chess-logo.png')
    expect(screen.getByText('DARK CASTLE')).toBeVisible()
    expect(screen.getByText('Created by')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Dark Castle Drill lesson with a chess position and study controls' })).toBeVisible()
    const flows = screen.getByRole('region', { name: 'Keep the lesson close to the move.' })
    const gallery = screen.getByRole('region', { name: 'Dark Castle capability gallery' })
    const proofs = new Set<string>()
    for (const [index, heading] of ['A path through the ideas', 'See the reason behind a move', 'Keep a mistake worth studying', 'Turn a finding into a next step', 'Follow the pieces through a line', 'Compare the move in front of you'].entries()) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`0${index + 1}`) }))
      expect(screen.getByRole('heading', { name: heading })).toBeVisible()
      const media = gallery.querySelector('.galleryMedia') || gallery.querySelector('article')
      for (const image of Array.from(media!.querySelectorAll('img'))) proofs.add(image.getAttribute('src') || '')
    }
    expect(proofs.size).toBeGreaterThanOrEqual(6)
    expect(screen.getByText('6 of 6')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next capability' }))
    expect(screen.getByText('1 of 6')).toBeVisible()
    fireEvent.keyDown(gallery, { key: 'End' })
    expect(screen.getByText('6 of 6')).toBeVisible()
    fireEvent.keyDown(gallery, { key: 'ArrowRight' })
    expect(screen.getByText('1 of 6')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'A connected practice thread.' })).toBeVisible()
    expect(flows).toHaveTextContent('Chess.com')
    expect(flows).toHaveTextContent('Lichess')
    expect(flows.textContent).not.toMatch(/Synthetic QA|local learner|development build|production|preview|fixture/i)
  })

  it('covers every major section with product imagery and gives the clip a silent poster and fallback', () => {
    const { container } = render(<DecisionTraceability />)
    for (const name of ['Dark Castle Drill lesson with a chess position and study controls', 'Dark Castle Saved games with the Practice tab selected', "Dark Castle variation board showing a piece's prior position", 'Dark Castle Coach review showing a move to study', 'Dark Castle walk-through explaining the next move', 'Dark Castle My Mistakes practice filter']) expect(screen.getByRole('img', { name })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /04 COACH/ }))
    const video = screen.getByLabelText('Dark Castle Coach move review and board in motion')
    expect(video).toHaveAttribute('poster', '/lead-magnets/dark-castle-capabilities/coach-loop-poster.jpg')
    expect((video as HTMLVideoElement).muted).toBe(true)
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('playsinline')
    fireEvent.error(video)
    expect(screen.getByRole('img', { name: 'Dark Castle Coach move review and board' })).toBeVisible()
    expect(container.textContent).not.toMatch(/Synthetic QA|fixture|production build|internal note/i)
  })

  it('keeps both question groups, score, PDF, and consent together', () => {
    render(<DecisionTraceability />)
    const assessment = screen.getByRole('region', { name: 'Pick one decision worth revisiting.' })
    const pieces = Array.from(assessment.children)
    expect(pieces.map((element) => element.tagName)).toEqual(['DIV', 'DIV', 'DIV'])
    expect(pieces[1].querySelectorAll('fieldset')).toHaveLength(2)
    expect(pieces[2].querySelectorAll('fieldset')).toHaveLength(2)
    const payoff = screen.getByRole('region', { name: 'Your score and worksheet' })
    expect(payoff).toContainElement(screen.getByRole('heading', { name: 'See what needs attention.' }))
    expect(payoff).toContainElement(screen.getByRole('link', { name: /Download the free PDF/i }))
    expect(payoff).toContainElement(screen.getByRole('checkbox'))
  })

  it('uses visitor-facing copy and keeps the email field empty through scoring', () => {
    const { container } = render(<DecisionTraceability />)
    expect(screen.getByText('Choose a recent product, policy, or investment decision. Answer four questions about the record behind it.')).toBeVisible()
    expect(screen.getByText('If you request a follow-up, we will use your email and score to respond.', { exact: false })).toBeVisible()
    const email = screen.getByRole('textbox', { name: 'Work email' })
    expect(email).toHaveValue('')
    expect(email).not.toHaveAttribute('placeholder')
    completeScore()
    expect(email).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Make ownership visible.' })).toBeVisible()
    expect(container.textContent).not.toMatch(/in-product estimates|campaign attribution|individual answers|this browser|game screens stay beside|capture is temporarily unavailable/i)
  })

  it('shows a usable result and PDF before consent, then fails visibly on persistence error', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'We cannot take your follow-up request right now. Your score and worksheet are still available. Please try later.' }) })
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
    await waitFor(() => expect(screen.getByText(/We cannot take your follow-up request right now/)).toBeVisible())
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
