import { afterEach, describe, expect, it } from 'vitest'
import { socialCopyVersion } from './social-copy-revision'
import { projectDeterministicVisualRender } from './social-deterministic-visual'
import { socialVisualBacklogQaFixture, socialVisualBacklogQaFixtureEnabled } from './social-visual-backlog-qa-fixture'
import { SOCIAL_VISUAL_BACKLOG_QA_ID, needsSavedCopyVisualRecovery } from './social-visual-contract-recovery'
import { deriveSocialContentLifecycleProjection, validateSocialContentFinalCopyQuality } from './social-content-lifecycle'

const savedCopyRecovery = {
  summary: 'This saved copy has no current deterministic visual review contract.',
  recovery_action: 'Review this record’s saved Copy gate and evidence before a separate visual contract is prepared. Rendering and external actions remain blocked.',
}

const originalEnv = { VERCEL_ENV: process.env.VERCEL_ENV, NODE_ENV: process.env.NODE_ENV }

afterEach(() => {
  if (originalEnv.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalEnv.VERCEL_ENV
  if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalEnv.NODE_ENV
})

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
    expect(item.deterministic_visual_render).toMatchObject({
      state: 'blocked',
      code: 'candidate_missing',
      can_render: false,
      provider_calls_enabled: false,
      ...savedCopyRecovery,
    })
    expect(item.deterministic_visual_render?.review_contract).toBeUndefined()
  })

  it('keeps the local fixture off hosted and production runtimes', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.NODE_ENV = 'test'
    expect(socialVisualBacklogQaFixtureEnabled()).toBe(false)

    process.env.VERCEL_ENV = 'production'
    process.env.NODE_ENV = 'development'
    expect(socialVisualBacklogQaFixtureEnabled()).toBe(false)

    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'production'
    expect(socialVisualBacklogQaFixtureEnabled()).toBe(false)

    delete process.env.NODE_ENV
    expect(socialVisualBacklogQaFixtureEnabled()).toBe(false)

    process.env.NODE_ENV = 'development'
    expect(socialVisualBacklogQaFixtureEnabled()).toBe(true)
  })

  it('lets a release lock outrank the saved-copy recovery sentence', () => {
    const item = socialVisualBacklogQaFixture()
    const projection = projectDeterministicVisualRender({
      item,
      copyVersion: socialCopyVersion(item),
      storageAvailable: true,
      releaseLocked: true,
    })
    expect(projection).toMatchObject({
      state: 'blocked',
      code: 'release_locked',
      can_render: false,
      provider_calls_enabled: false,
      summary: 'Release evidence locks this content version.',
      recovery_action: 'Reconcile the schedule or publication evidence before replacing its reviewed asset.',
    })
    expect(projection.recovery_action).not.toContain('saved Copy gate')
  })

  it('does not offer saved-copy recovery when the copy itself is unapproved', () => {
    const item = socialVisualBacklogQaFixture()
    item.status = 'draft'
    const projection = projectDeterministicVisualRender({
      item,
      copyVersion: socialCopyVersion(item),
      storageAvailable: true,
      releaseLocked: false,
    })
    expect(projection).toMatchObject({
      state: 'blocked',
      code: 'copy_not_approved',
      can_render: false,
      summary: 'The current copy version is not approved.',
      recovery_action: 'Approve the current copy, then return to Visuals to render the version-bound review asset.',
    })
  })

  it('keeps the generic missing-candidate sentence outside the saved-copy gate', () => {
    const item = socialVisualBacklogQaFixture()
    item.rag_context = { ...item.rag_context, source_type: 'social_content_calendar_item' }
    const projection = projectDeterministicVisualRender({
      item,
      copyVersion: socialCopyVersion(item),
      storageAvailable: true,
      releaseLocked: false,
    })
    expect(needsSavedCopyVisualRecovery(item)).toBe(false)
    expect(projection).toMatchObject({
      state: 'blocked',
      code: 'candidate_missing',
      can_render: false,
      summary: 'The deterministic candidate uses an unsupported visual-system contract.',
      recovery_action: 'Restore the current AmaduTown deterministic system version, template, and aspect ratio before rendering.',
    })
  })
})
