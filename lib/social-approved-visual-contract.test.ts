import { describe, expect, it } from 'vitest'
import { approvedVisualReviewContract, approvedVisualStorageUrl, inspectApprovedVisualReviewContract, DARK_CASTLE_SOCIAL_CONTENT_ID, DARK_CASTLE_VISUAL_PATH, DARK_CASTLE_VISUAL_SHA256 } from './social-approved-visual-contract'
import { darkCastleVisualQaFixture, darkCastleVisualQaFixtureEnabled } from './social-dark-castle-visual-qa-fixture'
import { socialCopyVersion } from './social-copy-revision'
import { projectDeterministicVisualRender } from './social-deterministic-visual'

describe('Dark Castle approved visual review contract', () => {
  it('keeps the fixture off hosted deployments', () => {
    const previous = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = 'preview'
    expect(darkCastleVisualQaFixtureEnabled()).toBe(false)
    if (previous === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previous
  })
  it('gives approved copy with no contract a bounded recovery action and no legacy asset', () => {
    const item = darkCastleVisualQaFixture('missing')
    expect(item.image_url).toBeNull()
    expect(item.deterministic_visual_render).toMatchObject({ state: 'blocked', code: 'candidate_missing', can_render: false, provider_calls_enabled: false })
    expect(item.deterministic_visual_render?.recovery_action).toContain('Bind a reviewed contract')
  })

  it('keeps the exact production record blocked until a contract is reviewed and bound', () => {
    const item = darkCastleVisualQaFixture('missing')
    item.id = DARK_CASTLE_SOCIAL_CONTENT_ID
    item.image_url = 'https://legacy.example/image.png'
    const projection = projectDeterministicVisualRender({ item, copyVersion: socialCopyVersion(item), storageAvailable: true })
    expect(projection).toMatchObject({ state: 'blocked', code: 'candidate_missing', can_render: false })
    expect(projection.recovery_action).toContain('Bind a reviewed contract')
  })

  it('accepts only the exact future internal-storage URL for a bound production record', () => {
    const item = darkCastleVisualQaFixture('current')
    item.id = DARK_CASTLE_SOCIAL_CONTENT_ID
    const version = socialCopyVersion(item)
    const assetUrl = approvedVisualStorageUrl(version, 'https://portfolio.supabase.co')!
    item.image_url = assetUrl
    item.rag_context = { ...item.rag_context, deterministic_visual_review_contract: approvedVisualReviewContract(version, assetUrl) }
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://portfolio.supabase.co'
    try {
      expect(inspectApprovedVisualReviewContract(item, version).state).toBe('current')
      item.image_url = 'https://other.example/image.png'
      expect(inspectApprovedVisualReviewContract(item, version).state).toBe('blocked')
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })

  it('renders the exact approved composition as a current review-only visual', () => {
    const item = darkCastleVisualQaFixture('current')
    const projection = item.deterministic_visual_render!
    expect(item.image_url).toBe(DARK_CASTLE_VISUAL_PATH)
    expect(projection).toMatchObject({ state: 'current', can_render: false, provider: 'none', provider_calls_enabled: false })
    expect(projection.copy_version).toBe(socialCopyVersion(item))
    expect(projection.review_contract?.asset_sha256).toBe(DARK_CASTLE_VISUAL_SHA256)
    expect(projection.review_contract?.sources).toHaveLength(3)
    expect(Object.values(projection.review_contract!.external_actions)).toEqual([false, false, false, false, false])
  })

  it.each(['stale', 'mismatch'] as const)('fails closed for %s binding', (state) => {
    const item = darkCastleVisualQaFixture(state)
    expect(item.deterministic_visual_render).toMatchObject({ state: 'blocked', code: 'asset_stale', can_render: false, provider_calls_enabled: false })
    expect(item.deterministic_visual_render?.recovery_action).toContain('No provider or legacy visual fallback')
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
