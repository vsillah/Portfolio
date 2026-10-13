import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.getCurrentSession }))

import SocialSourceCoverageEvidence from './SocialSourceCoverageEvidence'
import { buildSocialCandidateProjectionQaFixture } from '@/lib/social-candidate-projection-qa-fixture'

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
  trend_work_relevance: {
    version: 'trend_work_relevance_v1', generated_at: '2026-10-10T14:00:00.000Z', status: 'ready', review_only: true,
    blockers: [], source_receipt_count: 5, fresh_momentum_count: 2, stale_momentum_count: 0, deduplicated_momentum_count: 1, privacy_rejected_count: 0,
    candidates: [{
      candidate_key: 'trend-work:jev', status: 'review_only', candidate_class: 'public_momentum_repository', product_identity: 'jev', product_label: 'Jev',
      topic_identities: ['governed_capability_analysis'], title: 'Jev: where current momentum meets demonstrated work',
      triggering_event: 'Approved public momentum around governed capability analysis.',
      why_vambah_can_speak: '2 approved firsthand Portfolio receipts connect this public signal to Jev.',
      content_angle: 'Connect the signal to demonstrated work.', suggested_hook: 'The signal is moving.', evidence_summary: 'Approved evidence.',
      source_receipt_ids: ['momentum-1', 'work-1', 'work-2'], external_receipt_ids: ['momentum-1'], work_receipt_ids: ['work-1', 'work-2'],
      freshness: 'fresh', priority_score: 94, priority_reasons: ['Current approved public momentum'], dedupe_fingerprint: 'jev-fingerprint',
      claim_boundaries: ['Review only.'], side_effects: { content_generation: false, approval: false, provider_call: false, draft_creation: false, schedule: false, publish: false },
    }, {
      candidate_key: 'thematic-opportunity:accelerated', status: 'review_only', candidate_class: 'public_theme_owned_capability', product_identity: 'accelerated', product_label: 'Accelerated',
      topic_identities: ['practical_cohort_courses'], title: 'Accelerated: a practical cohort courses opportunity to review',
      triggering_event: 'Approved public evidence shows stronger performance for practical cohort courses.',
      why_vambah_can_speak: '2 approved privacy-safe owned-capability receipts connect the practical cohort courses trend to Accelerated.',
      content_angle: 'Review the evidence-bound thematic opportunity.', suggested_hook: 'The course pattern is moving.', evidence_summary: 'Approved public and owned evidence.',
      source_receipt_ids: ['course-trend-1', 'accelerated-product-1', 'accelerated-corpus-1'], external_receipt_ids: ['course-trend-1'], work_receipt_ids: ['accelerated-product-1', 'accelerated-corpus-1'],
      freshness: 'fresh', priority_score: 90, priority_reasons: ['Exact shared topic identity'], dedupe_fingerprint: 'accelerated-theme-fingerprint',
      claim_boundaries: ['Review only.'], theme_identity: 'practical_cohort_courses',
      relevant_owned_capability: { product_identity: 'accelerated', label: 'Accelerated', source_receipt_ids: ['accelerated-product-1', 'accelerated-corpus-1'] },
      confidence: { score: 0.92, level: 'high', basis: ['Exact shared topic identity: practical_cohort_courses', 'Fresh approved public momentum receipt'] },
      actionable_next_step: 'Review the exact receipts and decide whether this should become a bounded Accelerated content brief. No copy or downstream action is created automatically.',
      public_signal: {
        signal_kind: 'social_trend', coverage_identity: 'practical_cohort_course_pattern', sentiment: 'positive',
        context_summary: 'Approved attributable social evidence shows material public attention around practical cohort courses.',
        entity_identities: ['course_industry'], topic_identities: ['practical_cohort_courses'], relevance_score: 0.9, public_attention_score: 0.85,
        materiality: 'material', evidence_state: 'corroborated', source_url: 'https://social.example.com/course-pattern',
        published_at: '2026-10-10T14:00:00.000Z', observed_at: '2026-10-10T14:00:00.000Z', expires_at: '2026-10-20T14:00:00.000Z', provenance: 'fixture:public-social-trend',
      },
      side_effects: { content_generation: false, approval: false, provider_call: false, draft_creation: false, schedule: false, publish: false },
    }],
  },
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
    expect(priorityInput).toHaveClass('input-brand', 'bg-background', '!pl-9', 'text-foreground', 'placeholder:text-muted-foreground')
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

  it('renders source-backed trend/work joins as review-only backlog candidates', async () => {
    render(<SocialSourceCoverageEvidence active />)
    const section = await screen.findByTestId('trend-work-relevance')
    expect(within(section).getByText('Trend-to-work and capability relevance')).toBeInTheDocument()
    expect(within(section).getByText('2 joined candidates')).toBeInTheDocument()
    const candidates = within(section).getAllByTestId('trend-work-candidate')
    expect(candidates[0]).toHaveTextContent('Jev')
    expect(candidates[0]).toHaveTextContent('Approved public momentum around governed capability analysis.')
    expect(candidates[0]).toHaveTextContent('Source lineage · 3 exact receipts')
    expect(candidates[1]).toHaveTextContent('Accelerated')
    expect(candidates[1]).toHaveTextContent('Confidence: high (92%)')
    expect(candidates[1]).toHaveTextContent('positive')
    expect(candidates[1]).toHaveTextContent('attention 85%')
    expect(candidates[1]).toHaveTextContent('relevance 90%')
    expect(candidates[1]).toHaveTextContent('Approved attributable social evidence')
    expect(candidates[1]).toHaveTextContent('Angle: Review the evidence-bound thematic opportunity.')
    expect(within(candidates[1]).getByRole('link', { name: 'View attributable public source' })).toHaveAttribute('href', 'https://social.example.com/course-pattern')
    expect(candidates[1]).toHaveTextContent('Review the exact receipts')
    expect(candidates[1]).toHaveTextContent('Source lineage · 3 exact receipts')
    fireEvent.click(within(candidates[1]).getByText('Source lineage · 3 exact receipts'))
    expect(candidates[1]).toHaveTextContent('course-trend-1')
    expect(candidates[1]).toHaveTextContent('accelerated-product-1')
    expect(section).toHaveTextContent('no reconciliation, copy, approval, provider call, draft, render, upload, schedule, post, or external send is created here')
  })

  it('renders the isolated synthetic candidate acceptance fixture with a visible blocker', async () => {
    const fixture = buildSocialCandidateProjectionQaFixture()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ coverage: fixture }) }))

    render(<SocialSourceCoverageEvidence active qaFixture="durable-candidates" />)

    const banner = await screen.findByTestId('synthetic-candidate-qa-banner')
    expect(banner).toHaveTextContent('Synthetic QA fixture · preview only · read only')
    expect(banner).toHaveTextContent('No production data, reconciliation, model or provider call, render, upload, scheduling, publishing, external send, or candidate approval')
    expect(fetch).toHaveBeenCalledWith('/api/admin/social-content/source-coverage?qa_fixture=durable-candidates', expect.any(Object))
    const candidates = screen.getAllByTestId('trend-work-candidate')
    expect(candidates).toHaveLength(3)
    expect(candidates.some((candidate) => candidate.textContent?.includes('Jev') && candidate.textContent.includes('public momentum repository'))).toBe(true)
    expect(candidates.some((candidate) => candidate.textContent?.includes('Dark Castle Chess') && candidate.textContent.includes('active github product'))).toBe(true)
    expect(candidates.some((candidate) => candidate.textContent?.includes('Agentified') && candidate.textContent.includes('public theme owned capability'))).toBe(true)
    expect(candidates.every((candidate) => candidate.textContent?.includes('Review only'))).toBe(true)
    const jevLineageToggle = within(candidates[0]).getByText(/Source lineage · 2 exact receipts/i)
    fireEvent.click(jevLineageToggle)
    const jevLineage = within(candidates[0]).getByTestId('candidate-source-lineage')
    expect(jevLineage).toHaveTextContent('approved_public_momentum:public_news:example.com:qa:jev-public-momentum')
    expect(jevLineage).toHaveTextContent('synthetic_qa:repository:jev')
    expect(within(jevLineage).getAllByRole('link', { name: 'Open source evidence' })).toHaveLength(2)
    expect(screen.getByTestId('trend-work-blockers')).toHaveTextContent('candidate_receipt_policy_incomplete:public_momentum_repository_v1:policy_watch:repository_evidence')
    expect(screen.getByRole('button', { name: 'Reload fixture' })).toBeInTheDocument()
  })

  it('provides a mobile review inbox with run history, recovery deep links, and disabled Slack specification', async () => {
    render(<SocialSourceCoverageEvidence active />)

    const inbox = await screen.findByTestId('mobile-decision-inbox')
    expect(inbox).toHaveTextContent('Mobile decision inbox')
    expect(inbox).toHaveTextContent('Review only')
    expect(within(inbox).getByRole('link', { name: /Candidates/i })).toHaveAttribute('href', '#candidate-inbox')
    expect(within(inbox).getByRole('link', { name: /Run history/i })).toHaveAttribute('href', '#source-run-history')
    expect(within(inbox).getByRole('link', { name: /Blockers/i })).toHaveAttribute('href', '#source-blockers')

    const runHistory = screen.getByTestId('source-run-history')
    expect(runHistory).toHaveTextContent('Twice-weekly source review history')
    expect(runHistory).toHaveTextContent('Codex insights + approved Open Brain')
    expect(runHistory).toHaveTextContent('Vercel deployments')
    expect(runHistory).toHaveTextContent('Opening this inbox only reads the latest approved projection')

    const blockers = screen.getByTestId('source-blocker-inbox')
    expect(blockers).toHaveTextContent('1 review blocker')
    expect(blockers).toHaveTextContent('deployment receipt missing')
    expect(within(blockers).getByRole('link', { name: 'Open deployment evidence' })).toHaveAttribute('href', '/admin/agents/coordination')

    const slack = screen.getByTestId('slack-disabled-specification')
    expect(slack).toHaveTextContent('Disabled')
    expect(slack).toHaveTextContent('No Slack connection, credential, notification, interactive decision, or external send is configured')
    expect(within(slack).queryByRole('button')).not.toBeInTheDocument()
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
