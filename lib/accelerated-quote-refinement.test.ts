import { describe, expect, it } from 'vitest'
import { chooseQuoteQuestions, deriveQuoteContext, projectQuoteOffers, type QuoteOffer } from './accelerated-quote-refinement'

const offers: QuoteOffer[] = [
  { kind: 'service', id: 's1', title: 'Reviewed remote plan', price: null, quoteBased: true,
    deliveryMethod: 'virtual', reviewedRecommendationId: 'r1' },
  { kind: 'service', id: 's2', title: 'In-person workshop', price: 1800, quoteBased: false,
    deliveryMethod: 'in-person' },
  { kind: 'product', id: 'p1', title: 'Digital kit', price: 99, quoteBased: false, productType: 'digital' },
]

describe('Decision File quote refinement', () => {
  it('attributes an explicit answer, skips it, and does not echo raw workbook text', () => {
    const raw = 'Our delivery must be remote. Private client name should not leave this file.'
    const derived = deriveQuoteContext({ L02: raw, L03: 'Our evidence gap is documented.' })
    expect(derived.facts.delivery).toEqual({ value: 'remote', sourceField: 'L02' })
    expect(chooseQuoteQuestions(derived, offers)).not.toContain('delivery')
    expect(JSON.stringify(derived)).not.toContain('Private client name')
    const projection = projectQuoteOffers(offers, derived, {}, ['budget'])
    expect(projection.excluded.map((offer) => offer.id)).toContain('s2')
    expect(projection.remaining[0].reviewedRecommendationId).toBe('r1')
  })

  it('leaves ambiguous, negative, or unsupported statements unanswered', () => {
    const derived = deriveQuoteContext({ L02: 'We prefer remote or in-person.', L03: 'We do not want remote.',
      L04: 'Fictional personas might use online materials.' })
    expect(derived.facts.delivery).toBeUndefined()
    expect(chooseQuoteQuestions(derived, offers)).toContain('delivery')
    expect(deriveQuoteContext({ L02: 'We do not want remote.' }).facts.delivery).toBeUndefined()
  })

  it('shows fallaway evidence and an explicit no-match recovery state', () => {
    const derived = deriveQuoteContext({})
    const projected = projectQuoteOffers(offers, derived, { delivery: 'in_person', budget: 'under_500' }, ['delivery', 'budget'])
    expect(projected.excluded.find((offer) => offer.id === 's1')?.reasons).toContain('In person differs from this offer')
    expect(projected.excluded.find((offer) => offer.id === 's1')?.evidence).toContain('your answer')
    expect(projected.remaining.length).toBe(0)
    expect(projected.status).toBe('no_match')
  })
})
