import { describe, expect, it } from 'vitest'
import { socialVisualBacklogQaFixture } from './social-visual-backlog-qa-fixture'
import { SOCIAL_VISUAL_BACKLOG_QA_ID, needsSavedCopyVisualRecovery } from './social-visual-contract-recovery'
import { deriveSocialContentLifecycleProjection, validateSocialContentFinalCopyQuality } from './social-content-lifecycle'

describe('read-only backlog recovery projection', () => {
  it('projects a missing contract without an asset, render action, or external execution', () => {
    const item = socialVisualBacklogQaFixture()
    expect(item.id).toBe(SOCIAL_VISUAL_BACKLOG_QA_ID)
    expect(item.platform).toBe('youtube')
    expect(item.status).toBe('approved')
    expect(item.post_text).toBe('')
    expect(item.voiceover_text).toBe('')
    expect(item.rag_context?.qa_fixture).toMatchObject({ read_only: true, saved_copy_approved: true, source_context_present: true })
    expect(validateSocialContentFinalCopyQuality(item).status).toBe('passed')
    const lifecycle = deriveSocialContentLifecycleProjection({ item, rawStates: { context: 'approved', copy: 'approved', visuals: 'blocked' } })
    expect(lifecycle.steps.copy.state).toBe('approved')
    expect(lifecycle.steps.visuals.state).toBe('blocked')
    expect(needsSavedCopyVisualRecovery(item)).toBe(true)
    expect(item.image_url).toBeNull()
    expect(item.rag_context?.external_execution_enabled).toBe(false)
    expect(item.deterministic_visual_render).toMatchObject({ state: 'blocked', code: 'candidate_missing', can_render: false, provider_calls_enabled: false })
    expect(item.deterministic_visual_render?.review_contract).toBeUndefined()
  })
})
