import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {} }))
import { buildRefinement, QuoteContextError } from './accelerated-quote-server'
import { deriveQuoteContext } from './accelerated-quote-refinement'

const reviewed = '11111111-1111-4111-8111-111111111111'
const alternative = '22222222-2222-4222-8222-222222222222'
const context = {
  rec: { id: 'rec', offer_id: reviewed, title: 'Reviewed plan', audit_id: 'audit', reviewed_at: '2026-11-05' },
  intake: { id: 'intake', worksheet_id: 'worksheet', payload_sha256: 'intake-hash' },
  derived: { facts: {}, summary: [], sourceFields: [] }, questions: ['delivery'],
  offers: [
    { kind: 'service', id: reviewed, title: 'Reviewed plan', price: null, quoteBased: true, deliveryMethod: 'virtual', reviewedRecommendationId: 'rec' },
    { kind: 'service', id: alternative, title: 'In-person custom workshop', price: null, quoteBased: true, deliveryMethod: 'in_person' },
    { kind: 'service', id: 'fixed', title: 'Fixed workshop', price: 300, quoteBased: false, deliveryMethod: 'virtual' },
  ],
  catalogSha: 'catalog-hash', worksheetSha: 'worksheet-hash', rulesVersion: 'rules', questionSetVersion: 'questions',
} as unknown as Parameters<typeof buildRefinement>[0]

describe('protected quote alternative selection', () => {
  it('keeps Agentified lesson meanings separate from Accelerated', () => {
    const answers = { L02: 'We documented the decision.', L03: 'We graded source safety.', L09: 'We chose a review posture.', L16: 'We audited accountability.' }
    expect(deriveQuoteContext(answers, 'agentified').summary).toEqual([
      'A decision card is documented (L02)', 'Source safety is documented (L03)',
      'A review posture is documented (L09)', 'An accountability audit is documented (L16)',
    ])
    expect(deriveQuoteContext(answers, 'agentified').summary).not.toContain('Decision roles are documented (L09)')
  })
  it('binds an active quote service to the operator package', () => {
    const result = buildRefinement(context, { delivery: 'in_person' }, alternative)
    expect(result.packageData.requestedOffer).toEqual({ kind: 'service', id: alternative, title: 'In-person custom workshop' })
    expect(result.packageData.projection.excluded.some((offer) => offer.id === reviewed)).toBe(true)
  })

  it('rejects fixed, unknown, and filtered-out quote selections', () => {
    expect(() => buildRefinement(context, {}, 'fixed')).toThrow(QuoteContextError)
    expect(() => buildRefinement(context, {}, 'missing')).toThrow(QuoteContextError)
    expect(() => buildRefinement(context, { delivery: 'remote' }, alternative)).toThrow(QuoteContextError)
  })

  it('keeps the reviewed recommendation available for operator review when answers differ', () => {
    const result = buildRefinement(context, { delivery: 'in_person' }, reviewed)
    expect(result.packageData.requestedOffer.id).toBe(reviewed)
  })
})
