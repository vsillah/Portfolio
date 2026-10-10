import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: vi.fn(),
}))
vi.mock('@/lib/llm-dispatch', () => ({
  generateJsonCompletion: vi.fn(),
}))
vi.mock('@/lib/open-brain', () => ({
  getOpenBrainSnapshot: vi.fn(),
}))
import {
  buildSocialTopicCoverageReport,
  candidateKey,
  type SocialTopicSourceReceipt,
  type SourceSignal,
  type TopicTriggerCandidate,
} from './social-topic-backlog'

function receipt(
  sourceId: string,
  productId: SocialTopicSourceReceipt['product_ids'][number],
): SocialTopicSourceReceipt {
  return {
    receipt_id: `receipt:${sourceId}`,
    source_id: sourceId,
    source_kind: 'amadutown_product',
    approval_status: 'approved',
    approved_at: '2026-10-09T12:00:00.000Z',
    approved_by: 'public_catalog_state',
    privacy_classification: 'public_safe',
    provenance: `public_catalog:products:${sourceId}`,
    summary_sha256: 'a'.repeat(64),
    product_ids: [productId],
    raw_content_included: false,
  }
}

function signal(sourceId: string, productId: SocialTopicSourceReceipt['product_ids'][number]): SourceSignal {
  const sourceReceipt = receipt(sourceId, productId)
  return {
    id: sourceId,
    type: 'portfolio_work',
    kind: 'amadutown_product',
    label: productId,
    summary: `Approved ${productId} summary.`,
    date: '2026-10-09T12:00:00.000Z',
    sensitivity: 'public_safe',
    receipt: sourceReceipt,
    product_ids: [productId],
  }
}

function candidate(overrides: Partial<TopicTriggerCandidate> = {}): TopicTriggerCandidate {
  const sourceReceipt = receipt('products:agentified', 'agentified')
  return {
    id: 'model-output-id',
    title: 'The operating lesson behind Agentified',
    triggering_event: 'An approved public product summary is ready.',
    source_type: 'portfolio_work',
    source_label: 'Agentified',
    source_ids: ['products:agentified'],
    why_vambah_can_speak: 'The product record is approved and public.',
    brand_goal: 'Keep product coverage recurring.',
    content_angle: 'Explain the operating choice.',
    suggested_hook: 'The product started with a constraint.',
    audience: 'Operators',
    sensitivity: 'public_safe',
    evidence_summary: 'Approved product summary.',
    claim_boundaries: ['Verify performance claims.'],
    source_receipts: [sourceReceipt],
    product_ids: ['agentified'],
    priority_score: 70,
    priority_tier: 'medium',
    priority_reasons: ['Required product coverage: Agentified'],
    dedupe_fingerprint: 'b'.repeat(64),
    ...overrides,
  }
}

describe('social topic source coverage', () => {
  it('fails closed with actionable blockers when a required product receipt is absent', () => {
    const report = buildSocialTopicCoverageReport([
      signal('prototype:dark-castle-chess', 'dark_castle_chess'),
      signal('service:accelerated', 'accelerated'),
    ], '2026-10-09T12:00:00.000Z')

    expect(report.status).toBe('blocked')
    expect(report.products).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: 'dark_castle_chess', status: 'ready' }),
      expect.objectContaining({ product_id: 'accelerated', status: 'ready' }),
      expect.objectContaining({
        product_id: 'agentified',
        status: 'blocked',
        blocker: expect.stringContaining('Approve at least one privacy-safe Agentified summary'),
      }),
    ]))
  })

  it('reports ready only when all recurring product receipts are present', () => {
    const report = buildSocialTopicCoverageReport([
      signal('prototype:dark-castle-chess', 'dark_castle_chess'),
      signal('service:accelerated', 'accelerated'),
      signal('publication:agentified', 'agentified'),
    ], '2026-10-09T12:00:00.000Z')

    expect(report.status).toBe('ready')
    expect(report.blockers).toEqual([])
    expect(report.source_receipt_count).toBe(3)
  })

  it('reports a source collector failure instead of silently treating the scan as complete', () => {
    const report = buildSocialTopicCoverageReport([
      signal('prototype:dark-castle-chess', 'dark_castle_chess'),
      signal('service:accelerated', 'accelerated'),
      signal('publication:agentified', 'agentified'),
    ], '2026-10-09T12:00:00.000Z', [{
      source_group: 'meeting_summaries',
      status: 'blocked',
      receipt_count: 0,
      blocker: '[source_collection_failed:meeting_summaries] Restore read access and retry.',
    }])

    expect(report.status).toBe('blocked')
    expect(report.blockers).toContain('[source_collection_failed:meeting_summaries] Restore read access and retry.')
    expect(report.products.every((product) => product.status === 'ready')).toBe(true)
  })

  it('uses the receipt-bound fingerprint instead of a model-generated candidate id', () => {
    const first = candidate({ id: 'first-model-id' })
    const second = candidate({ id: 'different-model-id' })

    expect(candidateKey(first)).toBe(candidateKey(second))
    expect(candidateKey(first)).toMatch(/^topic-[a-f0-9]{40}$/)
  })
})
