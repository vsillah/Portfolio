import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import LongFormScriptIntelligenceReview from './LongFormScriptIntelligenceReview'
import { evaluateLongFormScriptIntelligence, longFormScriptQaFixture } from '@/lib/long-form-script-intelligence'

const review = (state: 'ready' | 'stale' | 'originality_blocked') => (
  evaluateLongFormScriptIntelligence(longFormScriptQaFixture(state))
)

describe('LongFormScriptIntelligenceReview', () => {
  it('keeps the review compact, responsive, and progressively discloses evidence', async () => {
    const user = userEvent.setup()
    render(<LongFormScriptIntelligenceReview review={review('ready')} subjectLabel="Selected draft" />)

    expect(screen.getByRole('heading', { name: 'Can this script earn render readiness?' })).toBeVisible()
    expect(screen.getByText('Approval-ready')).toBeVisible()
    expect(screen.getByRole('list', { name: 'Long-form script dimensions' })).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-3')
    expect(screen.getByText('Framework receipts and public-source boundaries').closest('details')).not.toHaveAttribute('open')

    await user.click(screen.getByText('Framework receipts and public-source boundaries'))
    expect(screen.getByText('Live topic demand before approval')).toBeVisible()
    expect(screen.getAllByText(/Originality boundary:/)).not.toHaveLength(0)
  })

  it('renders the exact server-returned blocked state without opening an external gate', () => {
    const { rerender } = render(<LongFormScriptIntelligenceReview review={review('stale')} />)

    expect(screen.getByText('Approval closed')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Evidence remains Unscored')
    expect(screen.getByRole('link', { name: 'Refresh topic evidence in Content Intelligence' })).toHaveAttribute('href', expect.stringContaining('content-intelligence'))

    rerender(<LongFormScriptIntelligenceReview review={review('originality_blocked')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Creator-distance receipt has not passed')
    expect(screen.getByText('Still closed:').parentElement).toHaveTextContent('Provider')
    expect(screen.getByText('Still closed:').parentElement).toHaveTextContent('Publish')
  })

  it('shows an inspectable formula and deterministic inputs for the selected decision', async () => {
    const user = userEvent.setup()
    render(<LongFormScriptIntelligenceReview review={review('ready')} />)

    const decisions = screen.getByRole('list', { name: 'Long-form script dimensions' })
    await user.click(within(decisions).getByRole('button', { name: /Proof placement/ }))

    expect(screen.getByText(/First proof starts at/)).toBeVisible()
    expect(screen.getByText(/earlier of 180s or 30%/)).toBeVisible()
    expect(screen.getByText(/Inputs: beat-proof/)).toBeVisible()
    expect(screen.getByText(/Rules: rule-proof-near-claim/)).toBeVisible()
  })
})
