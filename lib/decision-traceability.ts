export const TRACE_SOURCE = 'dark_castle_decision_traceability_v1'
export const TRACE_CONSENT_VERSION = '2026-10-31.v1'

export const TRACE_DIMENSIONS = [
  { id: 'reason', label: 'Reasoning', question: 'Can someone explain why this choice was made?', low: 'The answer is recorded without its reasoning.', mid: 'The reasoning lives in a meeting or a person’s memory.', high: 'A short rationale is attached to the decision.', fix: 'Write the tradeoff that mattered most in one sentence.' },
  { id: 'owner', label: 'Ownership', question: 'Who can revisit or reverse the choice?', low: 'No owner is named.', mid: 'The team knows who to ask, but the record does not.', high: 'One owner and a review date are named.', fix: 'Name one accountable owner and a date to review the choice.' },
  { id: 'threshold', label: 'Thresholds', question: 'What would change the decision?', low: 'There is no trigger for reconsideration.', mid: 'A trigger exists, but it is vague.', high: 'A measurable trigger and response are written down.', fix: 'Write the signal that would make you change course and what you would do.' },
  { id: 'evidence', label: 'Evidence', question: 'Can the next person see what was known then?', low: 'Sources and assumptions are missing.', mid: 'Some sources are linked, but assumptions are hidden.', high: 'Evidence, assumptions, and gaps travel with the choice.', fix: 'Attach the source you used and name one assumption still untested.' },
] as const

export type TraceAnswers = Record<(typeof TRACE_DIMENSIONS)[number]['id'], number>
export const TRACE_IDS = TRACE_DIMENSIONS.map((item) => item.id)

export function scoreTrace(answers: unknown) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null
  const value = answers as Record<string, unknown>
  if (Object.keys(value).sort().join(',') !== [...TRACE_IDS].sort().join(',')) return null
  if (!TRACE_IDS.every((id) => Number.isInteger(value[id]) && Number(value[id]) >= 0 && Number(value[id]) <= 2)) return null
  const typed = value as TraceAnswers
  const total = TRACE_IDS.reduce((sum, id) => sum + typed[id], 0)
  const weakest = TRACE_DIMENSIONS.find((item) => typed[item.id] === Math.min(...TRACE_IDS.map((id) => typed[id])))!
  return { total, weakest: weakest.id, answers: typed }
}

export function normalizeAttribution(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
  if (Object.keys(raw).some((key) => !allowed.includes(key as typeof allowed[number]))) return null
  const result: Record<string, string | null> = {}
  for (const key of allowed) {
    const field = raw[key]
    if (field !== undefined && (typeof field !== 'string' || field.length > 120 || !/^[a-zA-Z0-9 _.-]*$/.test(field))) return null
    result[key] = typeof field === 'string' && field.trim() ? field.trim() : null
  }
  return result
}
