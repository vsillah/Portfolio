import { describe, expect, it } from 'vitest'
import { prepareManualCopyUpdate, socialCopyRevisionView, socialCopyVersion } from './social-copy-revision'
const original = { id: 'social-fixture', status: 'draft', post_text: 'An operator reviewed the first draft.', updated_at: '2026-09-06T12:00:00.000Z', rag_context: { source: 'social_content_calendar_authorization' } }
const now = '2026-09-06T13:00:00.000Z'
function apply(current: typeof original, patch: Record<string, unknown>, expectedVersion = socialCopyVersion(current)) {
  return { ...current, ...prepareManualCopyUpdate({ current, patch, expectedVersion, actor: 'fixture-admin', now }) } as typeof original
}
describe('calendar copy manual revision contract', () => {
  it('persists rejection without feedback, reloads as blocked, and does not invent worker evidence', () => {
    const rejected = apply(original, { status: 'rejected' })
    expect(socialCopyRevisionView(JSON.parse(JSON.stringify(rejected)))).toMatchObject({ state: 'blocked', feedback: null, received_at: now, worker: 'not_configured' })
    const again = apply(rejected, { status: 'rejected' })
    expect(again.rag_context).toEqual(rejected.rag_context)
  })
  it('accepts optional feedback and returns only a changed manual version to review', () => {
    const rejected = apply(original, { status: 'rejected', rag_context: { content_calibration: { approval_rejection: { reason: 'Old hook' }, operator_feedback: { revision_request: 'Use the concrete meeting example.' } } } })
    expect(socialCopyRevisionView(rejected).feedback).toBe('Use the concrete meeting example.')
    expect(() => apply(rejected, { status: 'draft' })).toThrow('Save changed copy')
    const revised = apply(rejected, { post_text: 'At the meeting, one operator showed the missed handoff.', status: 'draft' })
    expect(socialCopyRevisionView(revised)).toMatchObject({ state: 'ready', feedback: 'Use the concrete meeting example.', worker: 'not_configured' })
    expect(socialCopyVersion(revised)).not.toBe(socialCopyVersion(original))
    expect(revised.rag_context).toMatchObject({ copy_revision: { completion_source: 'manual_edit', completed_version: socialCopyVersion(revised) }, content_calibration: { status: 'returned_to_copy_review' } })
    expect(revised.rag_context).not.toHaveProperty('content_calibration.approval_rejection')
  })
  it('supports edit-save-reload followed by returning the same saved revision to review', () => {
    const rejected = apply(original, { status: 'rejected' })
    const saved = apply(rejected, { post_text: 'Changed copy saved while rejected.' })
    expect(socialCopyRevisionView(saved).state).toBe('blocked')
    const ready = apply(saved, { status: 'draft' })
    expect(socialCopyRevisionView(ready).state).toBe('ready')
    expect(apply(ready, { status: 'draft' }).rag_context).toEqual(ready.rag_context)
  })
  it('rejects stale version writes and invalidates copy and downstream approvals on edits', () => {
    const approved = { ...original, status: 'approved', reviewed_by: 'fixture-admin', rag_context: { ...original.rag_context, section_gate_reviews: { linkedin_draft: { status: 'approved' } } } }
    const changed = apply(approved, { post_text: 'A newer version needs its own review.' })
    expect(changed).toMatchObject({ status: 'draft', reviewed_by: null, scheduled_for: null, rag_context: { section_gate_reviews: { linkedin_draft: { status: 'pending' } } } })
    expect(() => apply(changed, { status: 'approved' }, socialCopyVersion(original))).toThrow('Copy changed')
  })
  it('ignores fabricated worker/completion evidence in client metadata', () => {
    const rejected = apply(original, { status: 'rejected' })
    const forged = apply(rejected, { rag_context: { copy_revision: { state: 'ready', worker: 'claimed', completed_version: socialCopyVersion(rejected) } } })
    expect(socialCopyRevisionView(forged)).toMatchObject({ state: 'blocked', worker: 'not_configured' })
  })
  it('invalidates approved sections on a draft-row edit and cannot restore them from client metadata', () => {
    const draft = { ...original, rag_context: { ...original.rag_context, section_gate_reviews: { linkedin_draft: { status: 'approved' } }, platform_draft_handoff: { status: 'pending' } } }
    const edited = apply(draft, { post_text: 'Changed copy.', rag_context: { section_gate_reviews: { linkedin_draft: { status: 'approved' }, privacy: { status: 'approved' } }, platform_draft_handoff: { status: 'approved' } } })
    expect(edited).toMatchObject({ status: 'draft', reviewed_by: null, rag_context: { section_gate_reviews: { linkedin_draft: { status: 'pending' }, privacy: { status: 'pending' } }, platform_draft_handoff: { status: 'pending' } } })
  })
  it.each([{ post_text: 'Tokenless edit' }, { status: 'rejected' }, { rag_context: { section_gate_reviews: { linkedin_draft: { status: 'approved' } } } }])('requires a current token for calendar copy writes: %j', (patch) => {
    expect(() => prepareManualCopyUpdate({ current: original, patch, actor: 'admin', now })).toThrow('current copy version is required')
  })
  it('keeps unrelated note saves compatible and allows a current-version explicit section decision', () => {
    expect(prepareManualCopyUpdate({ current: original, patch: { admin_notes: 'An internal note.' }, actor: 'admin', now })).toMatchObject({ admin_notes: 'An internal note.' })
    expect(apply(original, { rag_context: { section_gate_reviews: { linkedin_draft: { status: 'approved' } } } })).toMatchObject({ rag_context: { section_gate_reviews: { linkedin_draft: { status: 'approved' } } } })
  })

  it('rejects an approved version without accidentally reopening it and clears stale section approvals', () => {
    const approved = { ...original, status: 'approved', rag_context: { ...original.rag_context, section_gate_reviews: { linkedin_draft: { status: 'approved' } } } }
    const rejected = apply(approved, { status: 'rejected', rag_context: approved.rag_context })
    expect(rejected).toMatchObject({ status: 'rejected', rag_context: { section_gate_reviews: { linkedin_draft: { status: 'pending' } } } })
    const revised = apply(rejected, { status: 'draft', post_text: 'Changed manual copy.', rag_context: rejected.rag_context })
    expect(socialCopyRevisionView(revised).state).toBe('ready')
  })

  it.each(['scheduled', 'publishing', 'published'])('preserves historical publication evidence for %s copy', (status) => {
    expect(() => apply({ ...original, status }, { post_text: 'A replacement version.' })).toThrow('recovery gate')
  })

})
