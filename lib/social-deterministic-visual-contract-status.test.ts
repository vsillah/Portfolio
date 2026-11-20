import { describe, expect, it } from 'vitest'
import { darkCastleVisualQaFixture } from './social-dark-castle-visual-qa-fixture'
import { socialCopyVersion } from './social-copy-revision'
import { projectDeterministicVisualRender } from './social-deterministic-visual'
import type { SocialContentItem } from './social-content'

function project(item: SocialContentItem, releaseLocked = false) {
  return projectDeterministicVisualRender({
    item,
    copyVersion: socialCopyVersion(item),
    storageAvailable: true,
    releaseLocked,
  })
}

describe('approved visual contract status', () => {
  it('keeps an approved queue row on the current contract without treating it as visual approval', () => {
    const item = darkCastleVisualQaFixture('current')
    item.status = 'approved'

    expect(project(item)).toMatchObject({
      state: 'current',
      code: 'already_current',
      can_render: false,
      provider: 'none',
      provider_calls_enabled: false,
      summary: 'Corrected provider-free gameplay candidate matches this copy and evidence; copy and visual approval remain pending.',
    })
    expect(project(item).review_contract).toMatchObject({
      copy_approved_at: null,
      copy_approval_state: 'pending_human_qa',
    })
  })

  it('lets a release lock block an approved current contract', () => {
    const item = darkCastleVisualQaFixture('current')
    item.status = 'approved'

    expect(project(item, true)).toMatchObject({
      state: 'blocked',
      code: 'release_locked',
      can_render: false,
      provider: 'none',
      provider_calls_enabled: false,
      summary: 'Release evidence locks this content version.',
    })
  })

  it.each(['Approved', 'approved '])('requires the exact approved status before a current contract can project current: %j', (status) => {
    const item = darkCastleVisualQaFixture('current')
    item.status = status

    expect(project(item)).toMatchObject({
      state: 'blocked',
      code: 'copy_not_approved',
      can_render: false,
      provider: 'none',
      provider_calls_enabled: false,
      summary: 'The current copy version is not approved.',
    })
  })

  it('does not render an approved fixture that still has no visual contract', () => {
    const item = darkCastleVisualQaFixture('missing')
    item.status = 'approved'

    const projection = project(item)
    expect(projection).toMatchObject({
      state: 'blocked',
      code: 'candidate_missing',
      can_render: false,
      provider_calls_enabled: false,
      summary: 'This saved copy has no current deterministic visual review contract.',
    })
    expect(projection.recovery_action).toContain('saved Copy gate')
    expect(projection.recovery_action).not.toContain('Bind a reviewed contract')
  })
})
