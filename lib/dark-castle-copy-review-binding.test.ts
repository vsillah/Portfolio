import { describe, expect, it } from 'vitest'
import { DARK_CASTLE_COPY_CALENDAR_ID, DARK_CASTLE_COPY_CONTENT_ID, inspectDarkCastleCopyReviewBinding } from './dark-castle-copy-review-binding'

const version = '2026-10-29T12:00:00.000Z'
const calendar = [{ id: DARK_CASTLE_COPY_CALENDAR_ID, social_content_id: DARK_CASTLE_COPY_CONTENT_ID, due_status: 'due_soon' }]
const keys = ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'] as const
const receipts = () => Object.fromEntries(keys.map(key => [key, { receipt_id: `${key}-approved-1`, status: 'approved', content_updated_at: version }]))
const item = () => ({ id: DARK_CASTLE_COPY_CONTENT_ID, updated_at: version, rag_context: {
  current_gate: 'copy_review', copy_review_evidence_receipts: receipts(), copy_review_candidate_projection: { title: 'Existing candidate' },
} })
const inspect = (value = item(), linked = calendar) => inspectDarkCastleCopyReviewBinding(value, linked, version)

describe('bounded Dark Castle copy-review operator binding', () => {
  it('passes only six distinct approved receipts bound to the exact content version and calendar', () => {
    expect(inspect()).toMatchObject({ ready: true, blockers: [], replay_candidate: false, external_execution: false })
  })

  it('fails closed on absent production receipt bundle and candidate projection', () => {
    const value = item()
    value.rag_context = { current_gate: 'copy_review' } as typeof value.rag_context
    expect(inspect(value)).toMatchObject({ ready: false, blockers: expect.arrayContaining([
      'The persisted copy-review evidence receipt bundle is missing.',
      'The persisted copy-review candidate projection is missing.',
    ]) })
  })

  it.each(keys)('blocks missing, pending, stale, expired, or duplicate %s receipt', key => {
    const missing = item(); delete (missing.rag_context.copy_review_evidence_receipts as Record<string, unknown>)[key]
    expect(inspect(missing).ready).toBe(false)
    const pending = item(); pending.rag_context.copy_review_evidence_receipts[key].status = 'pending'
    expect(inspect(pending).ready).toBe(false)
    const stale = item(); stale.rag_context.copy_review_evidence_receipts[key].content_updated_at = '2026-10-28T12:00:00Z'
    expect(inspect(stale).ready).toBe(false)
    const expired = item(); Object.assign(expired.rag_context.copy_review_evidence_receipts[key], { fresh_until: version })
    expect(inspect(expired).ready).toBe(false)
    const duplicate = item(); duplicate.rag_context.copy_review_evidence_receipts[key].receipt_id = 'source-approved-1'
    if (key !== 'source') expect(inspect(duplicate).ready).toBe(false)
  })

  it('rejects missing, extra, or mismatched calendar identities', () => {
    expect(inspect(item(), []).ready).toBe(false)
    expect(inspect(item(), [...calendar, ...calendar]).ready).toBe(false)
    expect(inspect(item(), [{ ...calendar[0], id: 'other' }]).ready).toBe(false)
  })

  it('allows an exact existing packet only as a candidate for RPC idempotent replay', () => {
    const value = item()
    Object.assign(value.rag_context, { mobile_decision_review: {
      version: 'social-content-decision-review/v1', content_id: DARK_CASTLE_COPY_CONTENT_ID,
      content_updated_at: version, current_gate: 'copy_review', work_item_id: 'work', approval_id: 'approval', run_id: 'run',
      source_receipts: receipts(), source_content_updated_at: version, candidate_projection: { title: 'Existing candidate' },
    } })
    expect(inspect(value)).toMatchObject({ ready: true, replay_candidate: true })
    value.updated_at = '2026-10-29T12:01:00Z'
    expect(inspect(value).ready).toBe(false)
  })
})
