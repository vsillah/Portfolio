import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DARK_CASTLE_RECEIPT_CONTENT_VERSION } from '@/lib/dark-castle-receipt-review-packets'

vi.mock('@/lib/authenticated-fetch', () => ({ fetchWithSessionRecovery: vi.fn() }))
import { fetchWithSessionRecovery } from '@/lib/authenticated-fetch'
import Page from './page'

const packets = ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'].map((kind, index) => ({
  kind, title: `${kind} packet`, packet_id: `packet-${kind}`, content_version: DARK_CASTLE_RECEIPT_CONTENT_VERSION,
  content_updated_at: '2026-10-27T20:14:59.293829Z',
  evidence: [{ label: `Evidence ${kind}`, value: `value-${kind}` }],
  review_questions: [`Question ${kind}?`], blockers: [`${kind} receipt missing.`],
  receipt_id: null, decision_recorded: false, external_execution: false,
}))

describe('Dark Castle receipt review surface', () => {
  it('shows six distinct packets and switches the selected evidence without a decision action', async () => {
    vi.mocked(fetchWithSessionRecovery).mockResolvedValueOnce({ ok: true, json: async () => ({ packets, fixture: false, record_verified: true, external_execution: false }) } as Response)
    render(<Page />)
    expect(await screen.findByText('Evidence source')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: /voice packet/i }))
    expect(screen.getByText('Evidence voice')).toBeInTheDocument()
    expect(screen.queryByText('Evidence source')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve|record|prepare/i })).not.toBeInTheDocument()
    expect(screen.getByText(/No receipt ID, decision, approval/i)).toBeInTheDocument()
  })

  it('shows an access failure without stale packet data', async () => {
    vi.mocked(fetchWithSessionRecovery).mockResolvedValueOnce(null)
    render(<Page />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sign in to inspect the canonical record.'))
    expect(screen.queryByText('Evidence source')).not.toBeInTheDocument()
  })

  it('keeps an unavailable canonical record blocked without claiming receipt absence', async () => {
    vi.mocked(fetchWithSessionRecovery).mockResolvedValueOnce({ ok: true, json: async () => ({ packets, fixture: false, record_verified: false, external_execution: false }) } as Response)
    render(<Page />)
    expect(await screen.findByText('Canonical record unavailable')).toBeInTheDocument()
    expect(screen.getByText('Each packet lists its current blockers. No review decision is recorded here.')).toBeInTheDocument()
    expect(screen.queryByText(/All six prerequisite reviewer decisions/)).not.toBeInTheDocument()
  })
})
