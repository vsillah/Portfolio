import { describe, expect, it } from 'vitest'
import { socialVisualBacklogQaFixture } from './social-visual-backlog-qa-fixture'
import { SOCIAL_VISUAL_BACKLOG_QA_ID, needsSavedCopyVisualRecovery } from './social-visual-contract-recovery'

describe('read-only backlog recovery projection', () => {
  it('projects a missing contract without an asset, render action, or external execution', () => {
    const item = socialVisualBacklogQaFixture()
    expect(item.id).toBe(SOCIAL_VISUAL_BACKLOG_QA_ID)
    expect(needsSavedCopyVisualRecovery(item)).toBe(true)
    expect(item.image_url).toBeNull()
    expect(item.rag_context?.external_execution_enabled).toBe(false)
    expect(item.deterministic_visual_render).toMatchObject({ state: 'blocked', code: 'candidate_missing', can_render: false, provider_calls_enabled: false })
    expect(item.deterministic_visual_render?.review_contract).toBeUndefined()
  })
})
