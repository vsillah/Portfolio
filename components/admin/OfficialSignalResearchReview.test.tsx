// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.getCurrentSession }))
import OfficialSignalResearchReview from './OfficialSignalResearchReview'

const now = Date.now()
const date = (offset: number) => new Date(now + offset).toISOString()
const sourceUrl = 'https://developers.openai.com/api/docs/changelog'
const packet = { id: '11111111-1111-1111-1111-111111111111', status: 'review_ready',
  updated_at: date(-1000), pattern_status: 'needs_brand_translation', source_url: sourceUrl,
  actor_metadata: { official_signal: { coverage_identity: 'openai_agents_api', source_fingerprint: 'f'.repeat(64),
    published_at: date(-86400000), observed_at: date(-3600000), expires_at: date(86400000) } } }
const sources = [sourceUrl, 'https://example.org/public/a', 'https://example.net/public/b'].map((url, index) => ({
  receipt_id: `public-source:${'a'.repeat(30)}${index}`, source_url: url, observed_at: date(-3600000),
  observed_values: { public_attention: 8, relevance: 9 }, required_values: { public_attention: 10, relevance: 10 },
  public_attention_score: 0.8, relevance_score: 0.9,
}))
const receipt = { version: 'public_signal_measurement_v1', receipt_id: `public-signal-measurement:${'f'.repeat(64)}`,
  coverage_identity: 'openai_agents_api', observed_at: date(-3600000), fresh_until: date(86400000),
  sample_size: 3, formula: 'mean_normalized_public_observations_v1', public_attention_score: 0.8,
  public_attention_threshold: 0.65, relevance_score: 0.9, relevance_threshold: 0.65, source_receipts: sources }
const state = { id: packet.id, status: packet.status, updated_at: packet.updated_at, source_url: sourceUrl,
  coverage_identity: 'openai_agents_api', packet_identity: 'f'.repeat(64), attribution_valid: true,
  observed_at: date(-3600000), expires_at: date(86400000), measurement_status: 'Receipt ready',
  blocked_reason: null as string | null, observed_value: null as number | null, required_value: null as number | null, owner: 'social_content_research',
  attempt_count: 1, max_attempts: 3, measurement_receipt: receipt as typeof receipt | null, observations: [] }

describe('official signal review in Content Intelligence', () => {
  beforeEach(() => { mocks.getCurrentSession.mockResolvedValue({ access_token: 'admin-token' }) })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })
  function show(current: typeof state) {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ packets: [current] }) })))
    const onReview = vi.fn().mockResolvedValue(undefined)
    render(<OfficialSignalResearchReview packet={packet} onReview={onReview} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review official signal' }))
    return onReview
  }
  it('keeps missing and stale receipts visibly Unscored and approval disabled', async () => {
    show({ ...state, measurement_status: 'Unscored', blocked_reason: 'insufficient_attributable_public_sources',
      observed_value: 1, required_value: 3, measurement_receipt: null })
    expect((await screen.findAllByText(/1 of 3 required public sources verified so far/)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/What happened\?/)).toBeInTheDocument()
    expect(screen.getByText(/Why is it relevant to my work\?/)).toBeInTheDocument()
    expect(screen.getByText(/What is missing\?/)).toBeInTheDocument()
    expect(screen.getByText(/What should I do next\?/)).toBeInTheDocument()
    expect(screen.getByText(/At least 3 verified public sources from 2 or more websites/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add or review public evidence' })).toHaveAttribute('href', '/admin/social-content?workflow=evidence#official-public-signal-preparation')
    expect(screen.getByText('1. Review official announcement')).toBeInTheDocument()
    expect(screen.getByText('2. Add or verify independent coverage')).toBeInTheDocument()
    expect(screen.getByText('3. Approve only after evidence passes')).toBeInTheDocument()
    expect(screen.getByText('Technical evidence').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText('Technical evidence').closest('details')).toHaveTextContent('insufficient_attributable_public_sources')
    expect(screen.getByRole('button', { name: 'Approve official signal' })).toBeDisabled()
    cleanup()
    show({ ...state, measurement_status: 'Unscored', blocked_reason: 'measurement_receipt_stale_or_wrong_version',
      measurement_receipt: { ...receipt, fresh_until: date(-1000) } })
    expect(await screen.findByText(/The saved measurement no longer verifies/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve official signal' })).toBeDisabled()
  })
  it('submits the exact score, receipt and four review fields only after current evidence and review input', async () => {
    const onReview = show(state)
    await screen.findByText(/Evidence ready for review/)
    expect(screen.getByText('Technical evidence').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Technical evidence'))
    expect(screen.getByText('Technical evidence').closest('details')).toHaveAttribute('open')
    expect(screen.getByText(/Immutable measurement receipt/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve official signal' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Tone of public coverage'), { target: { value: 'positive' } })
    fireEvent.change(screen.getByLabelText('How well do the sources support this?'), { target: { value: 'corroborated' } })
    fireEvent.change(screen.getByLabelText('Public context summary'), { target: { value: 'The exact public release has measurable source coverage.' } })
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Checked exact public sources.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve official signal' }))
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('approved', 'Checked exact public sources.', {
      sentiment: 'positive', materiality: 'material', evidence_state: 'corroborated',
      context_summary: 'The exact public release has measurable source coverage.',
      public_attention_score: 0.8, relevance_score: 0.9, measurement_receipt: receipt,
    }))
  })
  it('blocks under-sampled and stale page versions', async () => {
    show({ ...state, measurement_receipt: { ...receipt, sample_size: 2, source_receipts: sources.slice(0, 2) },
      updated_at: date(1000) })
    expect(await screen.findByText(/Evidence ready for review/)).toBeInTheDocument()
    expect(screen.getByText(/Verify three distinct public sources/)).toBeInTheDocument()
    expect(screen.getByText(/Refresh this page to load the latest review record/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve official signal' })).toBeDisabled()
  })
})
