import { describe, expect, it } from 'vitest'
import { approvedVisualReviewContract, approvedVisualStorageUrl, inspectApprovedVisualReviewContract, DARK_CASTLE_SOCIAL_CONTENT_ID, DARK_CASTLE_VISUAL_PATH, DARK_CASTLE_VISUAL_QA_ID, DARK_CASTLE_VISUAL_SHA256 } from './social-approved-visual-contract'
import { darkCastleVisualQaFixture, darkCastleVisualQaFixtureEnabled } from './social-dark-castle-visual-qa-fixture'
import { socialCopyVersion } from './social-copy-revision'
import { projectDeterministicVisualRender } from './social-deterministic-visual'

describe('Dark Castle corrected visual review contract', () => {
  it('keeps the fixture off hosted deployments', () => {
    const previous = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = 'preview'
    expect(darkCastleVisualQaFixtureEnabled()).toBe(false)
    if (previous === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previous
  })
  it('gives a corrected candidate with no contract a bounded recovery action and no legacy asset', () => {
    const item = darkCastleVisualQaFixture('missing')
    expect(item.image_url).toBeNull()
    expect(item.deterministic_visual_render).toMatchObject({ state: 'blocked', code: 'candidate_missing', can_render: false, provider_calls_enabled: false })
    expect(item.deterministic_visual_render?.recovery_action).toBe('The current copy has no reviewed visual contract. Keep rendering blocked until the corrected copy and visual decisions are recorded.')
  })

  it('keeps the exact production record blocked until a contract is reviewed and bound', () => {
    const item = darkCastleVisualQaFixture('missing')
    item.id = DARK_CASTLE_SOCIAL_CONTENT_ID
    item.status = 'approved'
    item.image_url = 'https://legacy.example/image.png'
    const projection = projectDeterministicVisualRender({ item, copyVersion: socialCopyVersion(item), storageAvailable: true })
    expect(projection).toMatchObject({ state: 'blocked', code: 'candidate_missing', can_render: false })
    expect(projection.recovery_action).toBe('The current copy has no reviewed visual contract. Keep rendering blocked until the corrected copy and visual decisions are recorded.')
  })

  it('keeps production blocked while the corrected copy still needs approval', () => {
    const item = darkCastleVisualQaFixture('current')
    item.id = DARK_CASTLE_SOCIAL_CONTENT_ID
    const version = socialCopyVersion(item)
    const assetUrl = approvedVisualStorageUrl(version, 'https://portfolio.supabase.co')!
    item.image_url = assetUrl
    item.rag_context = { ...item.rag_context, deterministic_visual_review_contract: approvedVisualReviewContract(version, assetUrl) }
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://portfolio.supabase.co'
    try {
      expect(inspectApprovedVisualReviewContract(item, version).state).toBe('blocked')
      item.image_url = 'https://other.example/image.png'
      expect(inspectApprovedVisualReviewContract(item, version).state).toBe('blocked')
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })

  it('renders the corrected candidate only in the read-only local fixture', () => {
    const item = darkCastleVisualQaFixture('current')
    const projection = item.deterministic_visual_render!
    expect(item.image_url).toBe(DARK_CASTLE_VISUAL_PATH)
    expect(projection).toMatchObject({ state: 'current', can_render: false, provider: 'none', provider_calls_enabled: false })
    expect(projection.copy_version).toBe(socialCopyVersion(item))
    expect(projection.review_contract?.asset_sha256).toBe(DARK_CASTLE_VISUAL_SHA256)
    expect(projection.review_contract?.copy_approved_at).toBeNull()
    expect(projection.review_contract?.copy_approval_state).toBe('pending_human_qa')
    expect(item.status).toBe('draft')
    expect(item.post_text).toContain('Try vs computer')
    expect(item.post_text).toContain('Move guidance')
    expect(item.post_text).not.toMatch(/Transfer:|Meet the response:/)
    expect(item.youtube_description).not.toMatch(/explore, transfer, and respond/i)
    expect(projection.review_contract?.sources).toHaveLength(3)
    expect(Object.values(projection.review_contract!.external_actions)).toEqual([false, false, false, false, false])
  })

  it.each(['stale', 'mismatch'] as const)('fails closed for %s binding', (state) => {
    const item = darkCastleVisualQaFixture(state)
    expect(item.deterministic_visual_render).toMatchObject({ state: 'blocked', code: 'asset_stale', can_render: false, provider_calls_enabled: false })
    expect(item.deterministic_visual_render?.recovery_action).toContain('No provider or legacy visual fallback')
  })

  it('builds only an https storage URL for a 64-character copy version', () => {
    const version = 'ab'.repeat(32)
    const assetUrl = `https://portfolio.supabase.co/storage/v1/object/public/social-content/approved-review/${DARK_CASTLE_SOCIAL_CONTENT_ID}/${version}/${DARK_CASTLE_VISUAL_SHA256}.png`
    expect(approvedVisualStorageUrl(version, 'https://portfolio.supabase.co')).toBe(assetUrl)
    expect(approvedVisualStorageUrl(version, 'https://user:pass@portfolio.supabase.co/storage/v1')).toBe(assetUrl)
    for (const [copyVersion, base] of [
      ['ab'.repeat(31), 'https://portfolio.supabase.co'],
      ['AB'.repeat(32), 'https://portfolio.supabase.co'],
      ['gg'.repeat(32), 'https://portfolio.supabase.co'],
      [`${'a'.repeat(61)}../`, 'https://portfolio.supabase.co'],
      [version, 'http://portfolio.supabase.co'],
      [version, ''],
      [version, 'not a url'],
      [version, 'javascript:alert(1)'],
    ] as const) {
      expect(approvedVisualStorageUrl(copyVersion, base)).toBeNull()
    }
  })

  it('treats a missing or non-object contract as unbound', () => {
    const version = 'a'.repeat(64)
    for (const ragContext of [null, 'contract', [], { deterministic_visual_review_contract: [] }]) {
      expect(inspectApprovedVisualReviewContract({
        id: DARK_CASTLE_VISUAL_QA_ID,
        image_url: null,
        rag_context: ragContext,
      }, version)).toMatchObject({ state: 'missing', contract: null })
    }
  })

  it('blocks a corrected candidate whose identity, provider, approval, or release gate does not match', () => {
    const foreign = darkCastleVisualQaFixture('current')
    foreign.id = 'not-dark-castle'
    expect(inspectApprovedVisualReviewContract(foreign, socialCopyVersion(foreign)).state).toBe('blocked')

    const provider = darkCastleVisualQaFixture('current')
    ;(provider.rag_context as Record<string, any>).deterministic_visual_review_contract.provider = 'heygen'
    expect(inspectApprovedVisualReviewContract(provider, socialCopyVersion(provider)).state).toBe('blocked')

    const publishable = darkCastleVisualQaFixture('current')
    ;(publishable.rag_context as Record<string, any>).deterministic_visual_review_contract.external_actions.publish = true
    expect(inspectApprovedVisualReviewContract(publishable, socialCopyVersion(publishable)).state).toBe('blocked')

    const approvedCopy = darkCastleVisualQaFixture('current')
    ;(approvedCopy.rag_context as Record<string, any>).deterministic_visual_review_contract.copy_approved_at = '2026-10-23T23:07:32.922112+00:00'
    expect(inspectApprovedVisualReviewContract(approvedCopy, socialCopyVersion(approvedCopy)).state).toBe('blocked')

    const scheduled = darkCastleVisualQaFixture('current')
    scheduled.status = 'scheduled'
    expect(projectDeterministicVisualRender({
      item: scheduled,
      copyVersion: socialCopyVersion(scheduled),
      storageAvailable: true,
    })).toMatchObject({ state: 'blocked', code: 'copy_not_approved', can_render: false, provider: 'none', provider_calls_enabled: false })

    const locked = darkCastleVisualQaFixture('current')
    expect(projectDeterministicVisualRender({
      item: locked,
      copyVersion: socialCopyVersion(locked),
      storageAvailable: true,
      releaseLocked: true,
    })).toMatchObject({ state: 'blocked', code: 'release_locked', can_render: false, summary: 'Release evidence locks this content version.' })

    const staleLocked = darkCastleVisualQaFixture('stale')
    expect(projectDeterministicVisualRender({
      item: staleLocked,
      copyVersion: socialCopyVersion(staleLocked),
      storageAvailable: true,
      releaseLocked: true,
    }).code).toBe('release_locked')

    const production = darkCastleVisualQaFixture('missing')
    production.id = DARK_CASTLE_SOCIAL_CONTENT_ID
    production.status = 'approved'
    const productionLocked = projectDeterministicVisualRender({
      item: production,
      copyVersion: socialCopyVersion(production),
      storageAvailable: true,
      releaseLocked: true,
    })
    expect(productionLocked).toMatchObject({ state: 'blocked', code: 'release_locked', can_render: false, provider_calls_enabled: false })
    expect(productionLocked.recovery_action).toContain('Reconcile the schedule')
  })

  it('rejects an incomplete source, changed approval, or changed copy version', () => {
    const item = darkCastleVisualQaFixture('current')
    const version = socialCopyVersion(item)
    const rag = item.rag_context as Record<string, any>
    rag.deterministic_visual_review_contract.sources.pop()
    expect(inspectApprovedVisualReviewContract(item, version).state).toBe('blocked')
    rag.deterministic_visual_review_contract.sources.push({ url: 'https://wrong.example/image.jpg', sha256: '0'.repeat(64) })
    expect(inspectApprovedVisualReviewContract(item, version).state).toBe('blocked')
    const restored = darkCastleVisualQaFixture('current')
    ;(restored.rag_context as Record<string, any>).deterministic_visual_review_approval.evidence_fingerprint = 'fnv1a:wrong'
    expect(inspectApprovedVisualReviewContract(restored, socialCopyVersion(restored)).state).toBe('blocked')
    const revised = darkCastleVisualQaFixture('current')
    revised.post_text += ' Revised copy.'
    expect(inspectApprovedVisualReviewContract(revised, socialCopyVersion(revised)).state).toBe('blocked')
  })
})
