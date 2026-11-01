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
  it('shows six packet identities, switches evidence, and blocks recording until all are reviewed', async () => {
    vi.mocked(fetchWithSessionRecovery).mockResolvedValueOnce({ ok: true, json: async () => ({ packets, fixture: false, record_verified: true, can_record: true, recorded: false, external_execution: false }) } as Response)
    render(<Page />)
    expect(await screen.findByText('Evidence source')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(7)
    expect(screen.getByText(/Planned receipt ID:/)).toHaveTextContent('packet-source:approved')
    const recordButton = screen.getByRole('button', { name: /Record six approved/i })
    expect(recordButton).toBeDisabled()
    for (const kind of ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`${kind} packet`, 'i') }))
      fireEvent.click(screen.getByRole('checkbox'))
    }
    expect(recordButton).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /voice packet/i }))
    expect(screen.getByText('Evidence voice')).toBeInTheDocument()
    expect(screen.queryByText('Evidence source')).not.toBeInTheDocument()
    expect(screen.getByText(/No receipt ID, decision, approval/i)).toBeInTheDocument()
  })

  it('shows an access failure without stale packet data', async () => {
    vi.mocked(fetchWithSessionRecovery).mockResolvedValueOnce(null)
    render(<Page />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sign in to inspect the canonical record.'))
    expect(screen.queryByText('Evidence source')).not.toBeInTheDocument()
  })

  it('keeps an unavailable canonical record blocked without claiming receipt absence', async () => {
    vi.mocked(fetchWithSessionRecovery).mockResolvedValueOnce({ ok: true, json: async () => ({ packets, fixture: false, record_verified: false, can_record: false, recorded: false, external_execution: false }) } as Response)
    render(<Page />)
    expect(await screen.findByText('Canonical record unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record six approved/i })).toBeDisabled()
    expect(screen.queryByText(/All six prerequisite reviewer decisions/)).not.toBeInTheDocument()
  })
})
