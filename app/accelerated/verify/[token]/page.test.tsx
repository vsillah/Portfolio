import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }) }) }) } }))
import VerifyCompletion, { metadata } from './page'

describe('public completion verification', () => {
  it('shows only the course, learner name and completion date for a valid token', async () => {
    mocks.lookup.mockResolvedValue({ data: { learner_name: 'Synthetic Learner', completed_at: '2026-11-06T00:00:00Z' }, error: null })
    render(await VerifyCompletion({ params: Promise.resolve({ token: 'a'.repeat(64) }) }))
    expect(screen.getByText(/Synthetic Learner completed all sixteen/)).toBeInTheDocument()
    expect(screen.getByText(/not a professional accreditation/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/worksheet|assessment|recommendation|client record/i)
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
  it('does not reveal whether a malformed or revoked token was ever valid', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null })
    render(await VerifyCompletion({ params: Promise.resolve({ token: 'b'.repeat(64) }) }))
    expect(screen.getByText('Verification link unavailable')).toBeInTheDocument()
  })
})
