import { describe, expect, it } from 'vitest'
import { getSocialCampaignReviewPacket, SOCIAL_CAMPAIGN_REVIEW_IDS } from './social-campaign-review-assets'

const NOW = new Date('2026-10-25T12:00:00.000Z')
const DARK_CASTLE = SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn
const STATIC_CONTENT_VERSION = 'sha256:585addaef15349ec135a57dd67308492110f6e97aecac2585e5936737d21918b'
const CURRENT_CONTENT_VERSION = 'sha256:b4442c963c109c06c2983253917aca64b7e3a9bbbeccb0ffcdbe40c4f449515a'
const VISUAL_SHA = 'sha256:88f26176acb339f10373dc39637e91ca8235f5cc3075f39ff737b97672a86091'
const VISUAL_PATH = '/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png'

function currentContext(overrides: Record<string, unknown> = {}) {
  return {
    content_version: CURRENT_CONTENT_VERSION,
    jit_observed_at: '2026-10-25T10:22:00.000Z',
    jit_expires_at: '2026-10-27T10:22:00.000Z',
    jit_refresh_receipt_id: 'review-prep:dark-castle-linkedin:b4442c963c109c06',
    human_qa_status: 'pending_current_binding',
    visual_sha256: VISUAL_SHA,
    image_url: VISUAL_PATH,
    ...overrides,
  }
}

function darkCastlePacket(context?: Record<string, unknown> | null, now = NOW) {
  const packet = getSocialCampaignReviewPacket(DARK_CASTLE, context, now)
  expect(packet?.kind).toBe('linkedin_visual')
  if (!packet || packet.kind !== 'linkedin_visual') throw new Error('Expected the Dark Castle LinkedIn packet')
  return packet
}

describe('current campaign review receipt binding', () => {
  it('binds an approved receipt without changing the shared stale packet', () => {
    const bound = darkCastlePacket(currentContext({ human_qa_status: 'approved' }))

    expect(bound.externalGates).toBe('closed')
    expect(bound.jit).toMatchObject({
      status: 'ready_current_jit',
      contentVersion: CURRENT_CONTENT_VERSION,
      observedAt: '2026-10-25T10:22:00.000Z',
      expiresAt: '2026-10-27T10:22:00.000Z',
      receiptId: 'review-prep:dark-castle-linkedin:b4442c963c109c06',
      targetAt: '2026-10-22T11:30:20-04:00',
    })

    const shared = darkCastlePacket()
    expect(shared.jit).toMatchObject({
      status: 'blocked_stale_jit',
      contentVersion: STATIC_CONTENT_VERSION,
      expiresAt: '2026-10-20T15:08:19Z',
    })
    expect(shared.jit?.receiptId).toBeUndefined()
  })

  it('accepts a receipt that expires one millisecond after the evaluation instant', () => {
    const packet = darkCastlePacket(currentContext({
      jit_expires_at: '2026-10-25T12:00:00.001Z',
    }))

    expect(packet.jit?.status).toBe('ready_current_jit')
    expect(packet.jit?.expiresAt).toBe('2026-10-25T12:00:00.001Z')
    expect(packet.externalGates).toBe('closed')
  })

  it.each([
    ['expiry equal to the evaluation instant', { jit_expires_at: '2026-10-25T12:00:00.000Z' }],
    ['expiry one millisecond earlier', { jit_expires_at: '2026-10-25T11:59:59.999Z' }],
    ['an unparseable expiry', { jit_expires_at: 'not-a-time' }],
    ['a missing content version', { content_version: '' }],
    ['a missing observation time', { jit_observed_at: '' }],
    ['a missing receipt id', { jit_refresh_receipt_id: '' }],
    ['a visual hash that does not match the packet', { visual_sha256: VISUAL_SHA.replace('88f2', '88F2') }],
    ['an image path that does not match the packet', { image_url: `${VISUAL_PATH}?v=2` }],
    ['a rejected human QA status', { human_qa_status: 'rejected' }],
    ['a pending status outside the binding allowlist', { human_qa_status: 'pending' }],
    ['a non-string human QA status', { human_qa_status: 1 }],
  ])('keeps the stale JIT blocked for %s', (_label, overrides) => {
    const packet = darkCastlePacket(currentContext(overrides))

    expect(packet.jit).toMatchObject({
      status: 'blocked_stale_jit',
      contentVersion: STATIC_CONTENT_VERSION,
    })
    expect(packet.jit?.receiptId).toBeUndefined()
    expect(packet.externalGates).toBe('closed')
  })

  it.each([
    ['missing context', undefined],
    ['null context', null],
    ['an array context', []],
  ])('does not promote the static packet for %s', (_label, context) => {
    const packet = darkCastlePacket(context as Record<string, unknown> | null | undefined)

    expect(packet.jit?.status).toBe('blocked_stale_jit')
    expect(packet.jit?.contentVersion).toBe(STATIC_CONTENT_VERSION)
  })

  it('does not invent a current JIT receipt for a LinkedIn packet that has none', () => {
    const packet = getSocialCampaignReviewPacket(
      SOCIAL_CAMPAIGN_REVIEW_IDS.jevLinkedIn,
      currentContext(),
      NOW,
    )

    expect(packet?.kind).toBe('linkedin_visual')
    if (!packet || packet.kind !== 'linkedin_visual') return
    expect(packet.jit).toBeUndefined()
    expect(packet.externalGates).toBe('closed')
  })

  it('does not apply a LinkedIn receipt context to a YouTube package', () => {
    const packet = getSocialCampaignReviewPacket(
      SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube,
      currentContext(),
      NOW,
    )

    expect(packet).toMatchObject({
      kind: 'youtube_packaging',
      status: 'blocked_missing_description_evidence',
      externalGates: 'closed',
    })
  })

  it('returns no packet for an unknown id even when the context is complete', () => {
    expect(getSocialCampaignReviewPacket('not-a-campaign', currentContext(), NOW)).toBeNull()
    expect(getSocialCampaignReviewPacket(null, currentContext(), NOW)).toBeNull()
  })
})
