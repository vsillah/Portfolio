import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.getCurrentSession }))

import SocialSourceCoverageEvidence from './SocialSourceCoverageEvidence'

const priorityProducts = [
  { product_identity: 'dark_castle_chess', label: 'Dark Castle Chess', current_stage: 'preview_deployed', stages: ['insight', 'preview_deployed'], receipt_count: 2, source_groups: ['codex_insights', 'vercel_deployments'], latest_evidence_at: '2026-10-10T14:00:00.000Z', gaps: [], historical_gaps: ['No recorded in development evidence'], priority: true, priority_order: 1, priority_source: 'approved_metadata' },
  { product_identity: 'accelerated', label: 'Accelerated', current_stage: 'publicly_cataloged', stages: ['publicly_cataloged'], receipt_count: 1, source_groups: ['public_catalog'], latest_evidence_at: '2026-10-09T14:00:00.000Z', gaps: [], historical_gaps: ['No recorded insight evidence'], priority: true, priority_order: 2, priority_source: 'approved_metadata' },
  { product_identity: 'agentified', label: 'Agentified', current_stage: null, stages: [], receipt_count: 0, source_groups: [], latest_evidence_at: null, gaps: ['No approved privacy-safe source receipt'], historical_gaps: [], priority: true, priority_order: 3, priority_source: 'approved_metadata' },
  ...Array.from({ length: 4 }, (_, index) => ({ product_identity: `dynamic_priority_${index + 1}`, label: `Dynamic Priority ${index + 1}`, current_stage: 'insight', stages: ['insight'], receipt_count: 1, source_groups: ['codex_insights'], latest_evidence_at: '2026-10-08T14:00:00.000Z', gaps: [], historical_gaps: ['No public catalog/site release evidence'], priority: true, priority_order: index + 4, priority_source: 'approved_metadata' })),
]
const directoryProducts = Array.from({ length: 12 }, (_, index) => ({
  product_identity: `directory_product_${index + 1}`,
  label: `Directory Product ${index + 1}`,
  current_stage: 'publicly_cataloged', stages: ['publicly_cataloged'], receipt_count: 1, source_groups: ['public_catalog'], latest_evidence_at: '2026-10-08T14:00:00.000Z', gaps: [], historical_gaps: [], priority: false, priority_order: null, priority_source: null,
}))

const coverage = {
  version: 'social_topic_live_coverage_v1', generated_at: '2026-10-10T14:00:00.000Z', status: 'blocked', review_only: true,
  source_policy: 'approved_privacy_safe_summaries_and_operational_receipts_only',
  sources: [{ key: 'codex_insights', label: 'Codex insights + approved Open Brain', status: 'ready', freshness: 'fresh', last_successful_scan: '2026-10-10T14:00:00.000Z', scanned_at: '2026-10-10T14:00:00.000Z', receipt_count: 1, product_count: 1, collector_failure: null, recovery_action: 'Approve a privacy-safe Open Brain proposal.' }, { key: 'vercel_deployments', label: 'Vercel deployments', status: 'blocked', freshness: 'never', last_successful_scan: null, scanned_at: '2026-10-10T14:00:00.000Z', receipt_count: 0, product_count: 0, collector_failure: 'deployment receipt missing', recovery_action: 'Record an approved deployment receipt.' }],
  products: [...priorityProducts, ...directoryProducts],
  receipts: [{ receipt_id: 'receipt-1' }], gaps: ['Agentified: No approved privacy-safe source receipt'], historical_gaps: ['Dark Castle Chess: No recorded in development evidence'], blockers: ['Vercel deployments: deployment receipt missing'],
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
    const priorityList = screen.getByTestId('priority-coverage-list')
    expect(within(priorityList).getAllByTestId('coverage-product-row')).toHaveLength(3)
    expect(within(priorityList).getAllByTestId('coverage-product-row').map((row) => row.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Dark Castle Chess'), expect.stringContaining('Accelerated'), expect.stringContaining('Agentified'),
    ]))
    expect(screen.getByText('Priority gaps').parentElement).toHaveTextContent('1')
    expect([...priorityList.querySelectorAll('summary')].every((summary) => !summary.textContent?.includes('dark_castle_chess'))).toBe(true)
    expect(screen.getByText('Collector freshness, failures, and recovery')).toBeInTheDocument()
  })

  it('bounds recurring priorities and supports priority pagination and search', async () => {
    render(<SocialSourceCoverageEvidence active />)
    const priorityList = await screen.findByTestId('priority-coverage-list')
    expect(within(priorityList).getAllByTestId('coverage-product-row')).toHaveLength(3)
    expect(screen.getByText('Priority page 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('7 visible · 7 recurring · 3 per page')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next priorities' }))
    expect(screen.getByText('Priority page 2 of 3')).toBeInTheDocument()
    expect(within(priorityList).getAllByTestId('coverage-product-row')).toHaveLength(3)
    fireEvent.change(screen.getByPlaceholderText('Search recurring priorities'), { target: { value: 'Dynamic Priority 4' } })
    expect(within(priorityList).getAllByTestId('coverage-product-row')).toHaveLength(1)
    expect(within(priorityList).getByText('Dynamic Priority 4')).toBeInTheDocument()
    expect(screen.getByText('Priority page 1 of 1')).toBeInTheDocument()
  })

  it('uses semantic theme surfaces for inputs, rows, states, and controls', async () => {
    render(<SocialSourceCoverageEvidence active />)
    const section = await screen.findByTestId('source-coverage-section')
    expect(section).toHaveClass('border-border', 'bg-card', 'text-card-foreground')
    const priorityInput = screen.getByPlaceholderText('Search recurring priorities')
    expect(priorityInput).toHaveClass('input-brand', 'bg-background', 'text-foreground', 'placeholder:text-muted-foreground')
    const priorityRow = within(screen.getByTestId('priority-coverage-list')).getAllByTestId('coverage-product-row')[0]
    expect(priorityRow).toHaveClass('border-border', 'bg-muted/30', 'text-card-foreground')
    const previous = screen.getByRole('button', { name: 'Previous priorities' })
    expect(previous).toHaveClass('focus-visible:ring-accent', 'focus-visible:ring-offset-background', 'disabled:cursor-not-allowed', 'disabled:opacity-50')
    fireEvent.change(priorityInput, { target: { value: 'no-such-priority' } })
    expect(screen.getByText('No matching recurring priorities.')).toHaveClass('border-border', 'bg-muted/20', 'text-muted-foreground')
    expect(section.innerHTML).not.toMatch(/(?:bg-imperial-navy|border-silicon-slate|text-(?:red|amber|emerald|sky)-)/)
  })

  it('keeps the additional directory bounded to five rows and supports paging and search', async () => {
    render(<SocialSourceCoverageEvidence active />)
    await screen.findByText('Additional product directory')
    fireEvent.click(screen.getByText('Additional product directory'))
    const page = screen.getByTestId('additional-product-page')
    expect(within(page).getAllByTestId('coverage-product-row')).toHaveLength(5)
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(within(page).getAllByTestId('coverage-product-row')).toHaveLength(5)
    fireEvent.change(screen.getByPlaceholderText('Search product directory'), { target: { value: 'Product 12' } })
    expect(within(page).getAllByTestId('coverage-product-row')).toHaveLength(1)
    expect(within(page).getByText('Directory Product 12')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('shows Reading instead of a false fail-closed state before the first response resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<SocialSourceCoverageEvidence active />)
    expect(screen.getByText('Reading')).toBeInTheDocument()
    expect(screen.queryByText('Fail closed')).not.toBeInTheDocument()
    expect(screen.getByText('Reading approved source receipts…')).toHaveClass('border-border', 'bg-muted/40', 'text-muted-foreground')
  })

  it('fails visibly when the approved read path is unavailable', async () => {
    mocks.getCurrentSession.mockResolvedValue(null)
    render(<SocialSourceCoverageEvidence active />)
    await waitFor(() => expect(screen.getByText('Coverage read is blocked')).toBeInTheDocument())
    expect(screen.getByText('Admin session is unavailable.')).toBeInTheDocument()
    expect(screen.getByText('Coverage read is blocked').parentElement).toHaveClass('border-accent/40', 'bg-muted/50', 'text-foreground')
  })
})
