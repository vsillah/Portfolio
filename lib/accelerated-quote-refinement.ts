export const QUOTE_RULES_VERSION = 'accelerated-quote-rules-v1'
export const QUOTE_QUESTION_SET_VERSION = 'accelerated-quote-questions-v1'

export const quoteQuestions = [
  { id: 'delivery', label: 'How should this be delivered?', options: [
    ['remote', 'Remote'], ['in_person', 'In person'], ['self_guided', 'Self guided'], ['flexible', 'Flexible'], ['unsure', 'Not sure'],
  ] },
  { id: 'timeline', label: 'When do you need to begin?', options: [
    ['urgent', 'Within two weeks'], ['soon', 'Within three months'], ['flexible', 'Timing is flexible'], ['unsure', 'Not sure'],
  ] },
  { id: 'audience', label: 'Who will use this?', options: [
    ['solo', 'Just me'], ['small_team', 'A small team'], ['large_team', 'A larger team'], ['unsure', 'Not sure'],
  ] },
  { id: 'implementation', label: 'Who will put the work into practice?', options: [
    ['self', 'I or my team will'], ['guided', 'We need guidance'], ['done_for_you', 'We need implementation help'], ['unsure', 'Not sure'],
  ] },
  { id: 'budget', label: 'What budget range should guide the review?', options: [
    ['under_500', 'Under $500'], ['up_to_2500', 'Up to $2,500'], ['above_2500', 'Over $2,500'], ['unsure', 'Not sure'],
  ] },
  { id: 'support', label: 'What level of direct support would help?', options: [
    ['none', 'Self guided'], ['group', 'Group support'], ['one_on_one', 'One on one'], ['unsure', 'Not sure'],
  ] },
] as const

export type QuoteDimension = typeof quoteQuestions[number]['id']
export type QuoteAnswers = Partial<Record<QuoteDimension, string>>
export type DerivedFact = { value: string; sourceField: string }
export type DerivedContext = { facts: Partial<Record<QuoteDimension, DerivedFact>>; summary: string[]; sourceFields: string[] }
export type QuoteOffer = {
  kind: 'service' | 'product'; id: string; title: string; price: number | null
  quoteBased: boolean; serviceType?: string | null; deliveryMethod?: string | null
  productType?: string | null; topics?: string[]; reviewedRecommendationId?: string | null
  catalog?: import('@/lib/types/store').Service | import('@/lib/types/store').Product
}
export type ProjectedOffer = QuoteOffer & {
  fit: 'fits' | 'needs_review' | 'excluded'; reasons: string[]; evidence: string[]
}
export type QuoteProjection = {
  remaining: ProjectedOffer[]; excluded: ProjectedOffer[]; needsOperatorReview: boolean
  unanswered: QuoteDimension[]; status: 'candidates' | 'insufficient' | 'no_match'
}

const lessonIds = new Set(Array.from({ length: 16 }, (_, index) => `L${String(index + 1).padStart(2, '0')}`))
const patterns: Record<QuoteDimension, Array<[string, RegExp]>> = {
  delivery: [
    ['remote', /\b(remote|virtual|online)\b/i],
    ['in_person', /\b(in[- ]person|on[- ]site)\b/i],
    ['self_guided', /\b(self[- ]paced|self[- ]guided|asynchronous)\b/i],
  ],
  timeline: [
    ['urgent', /\b(within (one|1|two|2) weeks?|this week|asap|immediately)\b/i],
    ['soon', /\b(within (one|1|two|2|three|3) months?|next month|this month|next quarter)\b/i],
    ['flexible', /\b(no rush|flexible timeline|later this year)\b/i],
  ],
  audience: [
    ['solo', /\b(just me|solo|individual)\b/i],
    ['small_team', /\b(team of [2-9]|[2-9] people|small team)\b/i],
    ['large_team', /\b(team of (1\d|[2-9]\d)|(?:1\d|[2-9]\d) people|organization[- ]wide)\b/i],
  ],
  implementation: [
    ['self', /\b(our team (will|can) (build|implement)|we (will|can) implement|do it ourselves)\b/i],
    ['guided', /\b(need guidance|coach us|work with us)\b/i],
    ['done_for_you', /\b(done for us|you implement|external team to implement)\b/i],
  ],
  budget: [
    ['under_500', /\b(budget\s*(under|below)|under)\s*\$?500\b/i],
    ['up_to_2500', /\b(budget\s*)?\$?500\s*(-|to)\s*\$?2,?500\b/i],
    ['above_2500', /\b(budget\s*(over|above)|over)\s*\$?2,?500\b/i],
  ],
  support: [
    ['none', /\b(no support|self service|self-serve)\b/i],
    ['group', /\b(group workshop|group coaching)\b/i],
    ['one_on_one', /\b(one[- ]on[- ]one|1:1|individual coaching)\b/i],
  ],
}

export function deriveQuoteContext(worksheetAnswers: Record<string, string>, workshop: 'accelerated' | 'agentified' = 'accelerated'): DerivedContext {
  const facts: DerivedContext['facts'] = {}
  const sourceFields = Object.entries(worksheetAnswers).filter(([field, answer]) =>
    lessonIds.has(field) && typeof answer === 'string' && answer.trim()).map(([field]) => field).sort()
  for (const question of quoteQuestions) {
    const matches: Array<DerivedFact> = []
    for (const field of sourceFields) {
      const answer = worksheetAnswers[field]
      for (const [value, expression] of patterns[question.id]) {
        const match = expression.exec(answer)
        if (!match) continue
        const sentence = answer.slice(Math.max(0, answer.lastIndexOf('.', match.index) + 1),
          answer.indexOf('.', match.index) < 0 ? answer.length : answer.indexOf('.', match.index))
        if (!/\b(i|we|our|my|need|prefer|want|budget|team size|delivery|timeline|support)\b/i.test(sentence)) continue
        const prefix = answer.slice(Math.max(0, match.index - 40), match.index).toLowerCase()
        if (/\b(do not|don't|does not|never|avoid|not|without|no)\b[^.!?]{0,20}$/.test(prefix)) continue
        matches.push({ value, sourceField: field })
      }
    }
    if (matches.length && matches.every((item) => item.value === matches[0].value)) facts[question.id] = matches[0]
  }
  const summaryFields = workshop === 'agentified' ? [
    ['L02', 'A decision card is documented'],
    ['L03', 'Source safety is documented'],
    ['L09', 'A review posture is documented'],
    ['L16', 'An accountability audit is documented'],
  ] : [
    ['L02', 'A priority decision is documented'],
    ['L03', 'An evidence gap is documented'],
    ['L09', 'Decision roles are documented'],
    ['L16', 'A next action is documented'],
  ]
  const summary = summaryFields.filter(([field]) => sourceFields.includes(field)).map(([field, label]) => `${label} (${field})`)
  return { facts, summary, sourceFields }
}

export function effectiveQuoteAnswers(derived: DerivedContext, answers: QuoteAnswers): QuoteAnswers {
  const result: QuoteAnswers = { ...answers }
  for (const question of quoteQuestions) if (derived.facts[question.id]) result[question.id] = derived.facts[question.id]!.value
  return result
}

function knownFacet(offer: QuoteOffer, dimension: QuoteDimension): string | null {
  if (dimension === 'delivery') {
    if (offer.kind === 'product') return /ebook|digital|course/i.test(offer.productType ?? '') ? 'self_guided' : null
    if (/virtual|online|remote/i.test(offer.deliveryMethod ?? '')) return 'remote'
    if (/in.person|on.site/i.test(offer.deliveryMethod ?? '')) return 'in_person'
    return null
  }
  if (dimension === 'implementation') {
    if (offer.kind === 'product') return 'self'
    return null
  }
  if (dimension === 'support') {
    if (offer.kind === 'product') return 'none'
    const topics = (offer.topics ?? []).join(' ').toLowerCase()
    if (/one[-_ ]on[-_ ]one|1:1/.test(topics)) return 'one_on_one'
    if (/group|workshop/.test(topics)) return 'group'
    return null
  }
  if (dimension === 'budget') {
    if (offer.quoteBased || offer.price === null) return null
    return offer.price < 500 ? 'under_500' : offer.price <= 2500 ? 'up_to_2500' : 'above_2500'
  }
  return null
}

function questionValue(dimension: QuoteDimension, value: string) {
  const question = quoteQuestions.find((item) => item.id === dimension)!
  return question.options.find(([id]) => id === value)?.[1] ?? value
}

export function chooseQuoteQuestions(derived: DerivedContext, offers: QuoteOffer[]): QuoteDimension[] {
  const selected: QuoteDimension[] = []
  const hasQuoteService = offers.some((offer) => offer.kind === 'service' && offer.quoteBased && offer.reviewedRecommendationId)
  for (const dimension of ['delivery', 'implementation', 'budget', 'support'] as QuoteDimension[]) {
    if (derived.facts[dimension]) continue
    const known = new Set(offers.map((offer) => knownFacet(offer, dimension)).filter(Boolean))
    if (hasQuoteService || known.size > 1 || (known.size === 1 && offers.some((offer) => knownFacet(offer, dimension) === null))) selected.push(dimension)
  }
  if (!derived.facts.timeline && hasQuoteService) selected.push('timeline')
  if (!derived.facts.audience && hasQuoteService) selected.push('audience')
  return selected
}

export function projectQuoteOffers(offers: QuoteOffer[], derived: DerivedContext, answers: QuoteAnswers,
  questions: QuoteDimension[]): QuoteProjection {
  const effective = effectiveQuoteAnswers(derived, answers)
  const evaluated = [...new Set([...questions, ...Object.keys(derived.facts) as QuoteDimension[]])]
  const projected: ProjectedOffer[] = offers.map((offer) => {
    const reasons: string[] = []
    const evidence: string[] = []
    let excluded = false
    let uncertain = false
    for (const dimension of evaluated) {
      const answer = effective[dimension]
      if (!answer || answer === 'unsure' || answer === 'flexible') { uncertain = true; continue }
      const known = knownFacet(offer, dimension)
      const source = derived.facts[dimension] ? `Decision File ${derived.facts[dimension]!.sourceField}` : 'your answer'
      if (!known) { uncertain = true; reasons.push(`${questionValue(dimension, answer)} needs operator confirmation`); evidence.push(source); continue }
      const incompatible = dimension === 'budget'
        ? (answer === 'under_500' && known !== 'under_500') || (answer === 'up_to_2500' && known === 'above_2500')
        : known !== answer
      if (incompatible) { excluded = true; reasons.push(`${questionValue(dimension, answer)} differs from this offer`); evidence.push(source) }
      else { reasons.push(`${questionValue(dimension, answer)} fits this offer`); evidence.push(source) }
    }
    if (offer.reviewedRecommendationId) reasons.unshift('Operator-reviewed recommendation')
    if (!reasons.length) reasons.push('Needs more evidence before an operator can confirm fit')
    return { ...offer, fit: excluded ? 'excluded' : uncertain ? 'needs_review' : 'fits', reasons, evidence }
  })
  const sort = (a: ProjectedOffer, b: ProjectedOffer) =>
    Number(Boolean(b.reviewedRecommendationId)) - Number(Boolean(a.reviewedRecommendationId)) || a.title.localeCompare(b.title)
  const remaining = projected.filter((offer) => offer.fit !== 'excluded').sort(sort)
  const excluded = projected.filter((offer) => offer.fit === 'excluded').sort(sort)
  const unanswered = questions.filter((dimension) => !effective[dimension] || effective[dimension] === 'unsure')
  return {
    remaining, excluded, unanswered,
    needsOperatorReview: unanswered.length > 0 || remaining.some((offer) => offer.fit === 'needs_review' || !offer.reviewedRecommendationId),
    status: !remaining.length ? 'no_match' : unanswered.length ? 'insufficient' : 'candidates',
  }
}
