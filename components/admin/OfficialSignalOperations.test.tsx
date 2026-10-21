import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.getCurrentSession }))
import OfficialSignalOperations from './OfficialSignalOperations'

const packet = { id: '11111111-1111-1111-1111-111111111111', title: 'OpenAI release',
  source_url: 'https://developers.openai.com/api/docs/changelog', status: 'review_ready',
  coverage_identity: 'openai_agents_api', published_at: '2026-10-20T12:00:00Z',
  expires_at: '2026-10-25T12:00:00Z', packet_identity: 'fingerprint', attribution_valid: true,
  measurement_status: 'Unscored', blocked_reason: 'insufficient_attributable_public_sources',
  owner: 'social_content_research', attempt_count: 1, max_attempts: 3,
  measurement_receipt: null, observations: [] }
const status = { packets: [packet], review_only: true, release_ready: false, exclusions: ['No packet approval'] }

describe('official signal operations in Social Content', () => {
  beforeEach(() => {
    mocks.getCurrentSession.mockResolvedValue({ access_token: 'admin-token' })
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true,
      json: async () => init?.method === 'POST'
        ? { packets_scanned: 1, receipts_ready: 0, review_only: true, release_ready: false }
        : status })))
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('loads only in the active Launch evidence view and explains the blocked owner path', async () => {
    const view = render(<OfficialSignalOperations active={false} />)
    expect(fetch).not.toHaveBeenCalled()
    view.rerender(<OfficialSignalOperations active />)
    expect(await screen.findByRole('heading', { name: 'Official public signal preparation' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pending official packet'), { target: { value: packet.id } })
    expect(screen.getByText(/insufficient_attributable_public_sources/)).toBeInTheDocument()
    expect(screen.getByText(/owner social_content_research/)).toBeInTheDocument()
    expect(screen.getByText(/aggregate release readiness is blocked/)).toBeInTheDocument()
  })

  it('uses the authenticated, selected measurement-only action', async () => {
    render(<OfficialSignalOperations active />)
    await screen.findByText('OpenAI release · openai_agents_api')
    fireEvent.change(screen.getByLabelText('Pending official packet'), { target: { value: packet.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Prepare measurement for this packet' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/admin/social-content/source-coverage/official-signals', expect.objectContaining({
        method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    ))
    const write = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ action: 'measure', packet_id: packet.id })
  })

  it('renders a synthetic localhost review with every write disabled', async () => {
    render(<OfficialSignalOperations active qaFixture />)
    expect(await screen.findByText(/Synthetic localhost QA fixture/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Pending official packet'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
    expect(screen.getByText(/insufficient_attributable_public_sources/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check official public sources' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Prepare measurement for this packet' })).toBeDisabled()
    fireEvent.click(screen.getByText(/Source observations and exact receipts/))
    expect(screen.getByText(/Attention 80\/100/)).toBeInTheDocument()
  })
  it('shows an actionable blocked state when the status response is incomplete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ coverage: {} }) })))
    render(<OfficialSignalOperations active />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Official signal status is incomplete')
    expect(screen.queryByRole('button', { name: 'Prepare measurement for this packet' })).not.toBeInTheDocument()
  })
})
