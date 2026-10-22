import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.getCurrentSession }))
import OfficialSignalOperations, { measurementBlockerCopy } from './OfficialSignalOperations'

const packet = { id: '11111111-1111-1111-1111-111111111111', title: 'OpenAI release',
  source_url: 'https://developers.openai.com/api/docs/changelog', status: 'review_ready',
  coverage_identity: 'openai_agents_api', published_at: '2026-10-20T12:00:00Z',
  expires_at: '2026-10-25T12:00:00Z', packet_identity: 'fingerprint', attribution_valid: true,
  measurement_status: 'Unscored', blocked_reason: 'insufficient_attributable_public_sources',
  observed_value: 1, required_value: 3,
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
    const guidance = screen.getByRole('status')
    expect(guidance).toHaveTextContent('1 source observation row passed initial checks; at least 3 are required')
    expect(guidance).toHaveTextContent('Add the missing exact-source observations below')
    expect(guidance).toHaveTextContent('approve them in Content Intelligence')
    expect(guidance).not.toHaveTextContent('insufficient_attributable_public_sources')
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
    expect(screen.getByRole('status')).toHaveTextContent('1 source observation row passed initial checks; at least 3 are required')
    expect(screen.getByRole('button', { name: 'Check official public sources' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Prepare measurement for this packet' })).toBeDisabled()
    fireEvent.click(screen.getByText(/Source observations and exact receipts/))
    expect(screen.getByText(/Attention 80\/100/)).toBeInTheDocument()
    expect(screen.getByText('Technical reason: insufficient_attributable_public_sources')).toBeInTheDocument()
  })
  it('shows an actionable blocked state when the status response is incomplete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ coverage: {} }) })))
    render(<OfficialSignalOperations active />)
    expect(await screen.findByText(/Official signal status is incomplete/)).toHaveTextContent('Official signal status is incomplete')
    expect(screen.queryByRole('button', { name: 'Prepare measurement for this packet' })).not.toBeInTheDocument()
  })

  it('shows the one-candidate campaign blocker on the existing synthetic evidence surface with writes closed', async () => {
    render(<OfficialSignalOperations active qaFixture />)
    const handoff = screen.getByTestId('official-campaign-handoff')
    expect(handoff).toHaveTextContent('topic-portfolio-agentic-operating-system-official-signals-v1')
    expect(handoff).toHaveTextContent('3 evidence gates to resolve')
    expect(handoff).toHaveTextContent('Measurement pending')
    expect(handoff).toHaveTextContent('Capture a redacted Portfolio route')
    expect(handoff).toHaveTextContent('state not yet saved')
    expect(screen.getByRole('button', { name: 'Prepare exact review handoff' })).toBeDisabled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('prepares only the exact review-only handoff action and shows persisted blockers', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, json: async () =>
      url.includes('campaign-handoff')
        ? { projection: { candidate_key: 'topic-portfolio-agentic-operating-system-official-signals-v1', status: 'blocked',
            input_version: 'sha256:fixture', source_lineage: [], channel_reviews: [], blockers: [{ code: 'official_review_pending', observed: 'pending', required: 'approved', owner: 'content_reviewer', next_action: 'Review source.', href: '/admin/agents/content-intelligence' }] },
          persistence: init?.method === 'POST' ? 'saved' : 'not_saved' }
        : status })))
    render(<OfficialSignalOperations active />)
    await screen.findByText(/state not yet saved/)
    fireEvent.click(screen.getByRole('button', { name: 'Prepare exact review handoff' }))
    await screen.findByText(/blocker or review state saved/)
    const write = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url).includes('campaign-handoff') && init?.method === 'POST')
    expect(JSON.parse(String(write?.[1]?.body))).toEqual({ action: 'prepare_review_only' })
    expect(screen.queryByText(/YouTube review/)).not.toBeInTheDocument()
  })

  it.each([
    ['measurement_not_attempted', 'No measurement has been prepared', 'Prepare measurement for this packet here'],
    ['insufficient_or_excluded_attributable_public_sources', 'excluded, stale, unapproved', 'Replace invalid evidence below'],
    ['measured_score_below_threshold', 'lowest measured score', 'leave this packet Unscored'],
    ['official_packet_stale_or_not_pending', 'official release packet is expired', 'Check official public sources'],
    ['official_packet_not_pending_or_outside_bounded_window', 'official release packet is expired', 'Check official public sources'],
    ['retry_limit_reached_owner_review_required', 'Three changed-evidence attempts', 'social_content_research'],
    ['existing_measurement_immutable_review_required', 'stored measurement receipt is missing', 'cannot overwrite it'],
    ['measurement_receipt_missing_or_mismatched', 'stored measurement receipt is missing', 'Content Intelligence'],
    ['measurement_receipt_identity_mismatched', 'stored measurement receipt is missing', 'Content Intelligence'],
    ['measurement_receipt_stale_or_wrong_version', 'stored measurement receipt is missing', 'Content Intelligence'],
    ['measurement_sample_insufficient', 'stored receipt lacks enough valid sources', 'Content Intelligence'],
    ['measurement_source_unattributable', 'stored receipt lacks enough valid sources', 'Content Intelligence'],
    ['measurement_source_values_mismatched', 'stored receipt lacks enough valid sources', 'Content Intelligence'],
    ['measurement_score_insufficient_or_mismatched', 'stored receipt lacks enough valid sources', 'Content Intelligence'],
  ])('turns %s into operator explanation and recovery', (reason, explanation, recovery) => {
    const copy = measurementBlockerCopy(reason, 0.4, 0.65)
    expect(copy.explanation).toContain(explanation)
    expect(copy.recovery).toContain(recovery)
    expect(copy.explanation).not.toContain(reason)
  })
})
