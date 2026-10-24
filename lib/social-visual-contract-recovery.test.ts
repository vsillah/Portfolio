import { describe, expect, it } from 'vitest'
import { needsSavedCopyVisualRecovery, savedCopyRecoveryHref } from './social-visual-contract-recovery'

type RecoveryItem = Parameters<typeof needsSavedCopyVisualRecovery>[0]

const candidate: RecoveryItem = {
  id: 'backlog-a',
  status: 'approved',
  content_format: 'single_image',
  image_url: null,
  rag_context: { source_type: 'version_bound_provider_none_mp4', work_item_id: 'work-a' },
}

describe('saved-copy visual recovery eligibility', () => {
  it('includes an approved, version-bound backlog item with no visual binding', () => {
    expect(needsSavedCopyVisualRecovery(candidate)).toBe(true)
  })

  it.each([
    { status: 'draft' },
    { content_format: 'carousel' },
    { image_url: '/approved.png' },
    { rag_context: { source_type: 'social_content_calendar_item', work_item_id: 'work-a' } },
    { rag_context: { source_type: 'version_bound_provider_none_mp4' } },
    { rag_context: { source_type: 'version_bound_provider_none_mp4', work_item_id: 'work-a', deterministic_visual_review_contract: { version: 'bound' } } },
    { rag_context: { source_type: 'version_bound_provider_none_mp4', work_item_id: 'work-a', deterministic_visual_asset: { id: 'asset-a' } } },
  ])('excludes records outside the missing-contract path: %j', (change) => {
    expect(needsSavedCopyVisualRecovery({ ...candidate, ...change } as RecoveryItem)).toBe(false)
  })

  it('keeps the Copy link on the current record, with local fixture state only when supplied', () => {
    expect(savedCopyRecoveryHref('backlog-a')).toBe('/admin/social-content/backlog-a?step=copy#social-copy-gate')
    expect(savedCopyRecoveryHref('backlog-b', 'local-qa')).toBe('/admin/social-content/backlog-b?step=copy&qa_fixture=local-qa#social-copy-gate')
  })
})
