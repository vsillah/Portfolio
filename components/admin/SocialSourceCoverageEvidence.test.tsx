import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.getCurrentSession }))

import SocialSourceCoverageEvidence from './SocialSourceCoverageEvidence'

const coverage = {
  version: 'social_topic_live_coverage_v1', generated_at: '2026-10-10T14:00:00.000Z', status: 'blocked', review_only: true,
  source_policy: 'approved_privacy_safe_summaries_and_operational_receipts_only',
  sources: [{ key: 'codex_insights', label: 'Codex insights + approved Open Brain', status: 'ready', freshness: 'fresh', last_successful_scan: '2026-10-10T14:00:00.000Z', scanned_at: '2026-10-10T14:00:00.000Z', receipt_count: 1, product_count: 1, collector_failure: null, recovery_action: 'Approve a privacy-safe Open Brain proposal.' }, { key: 'vercel_deployments', label: 'Vercel deployments', status: 'blocked', freshness: 'never', last_successful_scan: null, scanned_at: '2026-10-10T14:00:00.000Z', receipt_count: 0, product_count: 0, collector_failure: 'deployment receipt missing', recovery_action: 'Record an approved deployment receipt.' }],
  products: [{ product_identity: 'dark_castle_chess', label: 'Dark Castle Chess', current_stage: 'preview_deployed', stages: ['insight', 'in_development', 'preview_deployed'], receipt_count: 3, source_groups: ['codex_insights', 'github_development', 'vercel_deployments'], latest_evidence_at: '2026-10-10T14:00:00.000Z', gaps: ['No public catalog/site release evidence'] }],
  receipts: [{ receipt_id: 'receipt-1' }], gaps: ['Dark Castle Chess: No public catalog/site release evidence'], blockers: ['Vercel deployments: deployment receipt missing'],
  boundaries: ['Raw Codex conversations are never collected.', 'A preview proves preview deployment, not production or public release.'],
}

describe('SocialSourceCoverageEvidence', () => {
  beforeEach(() => {
    mocks.getCurrentSession.mockResolvedValue({ access_token: 'token' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ coverage }) }))
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('loads only in the evidence mode and renders compact lifecycle evidence', async () => {
    const { rerender } = render(<SocialSourceCoverageEvidence active={false} />)
    expect(fetch).not.toHaveBeenCalled()
    rerender(<SocialSourceCoverageEvidence active />)
    expect(await screen.findByRole('heading', { name: 'Coverage before candidate creation' })).toBeInTheDocument()
    expect(screen.getByText('Dark Castle Chess')).toBeInTheDocument()
    expect(screen.getAllByText('preview deployed')).toHaveLength(2)
    expect(screen.getByText('Collector freshness, failures, and recovery')).toBeInTheDocument()
  })

  it('shows Reading instead of a false fail-closed state before the first response resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<SocialSourceCoverageEvidence active />)
    expect(screen.getByText('Reading')).toBeInTheDocument()
    expect(screen.queryByText('Fail closed')).not.toBeInTheDocument()
  })

  it('fails visibly when the approved read path is unavailable', async () => {
    mocks.getCurrentSession.mockResolvedValue(null)
    render(<SocialSourceCoverageEvidence active />)
    await waitFor(() => expect(screen.getByText('Coverage read is blocked')).toBeInTheDocument())
    expect(screen.getByText('Admin session is unavailable.')).toBeInTheDocument()
  })
})
