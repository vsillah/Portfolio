import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCELERATED_ACTIVATION_ITEMS, ACCELERATED_ACTIVATION_SCOPE, ACCELERATED_CAMPAIGN_ID, approvedRasterHashes, approvedRasterUrls } from './accelerated-campaign-activation'
import { socialReleaseFingerprint } from './social-release-evidence'
import { releaseStore } from './social-release-safety.test-fixtures'

const mocks = vi.hoisted(() => ({ provider: vi.fn(async () => ({ success: false, error: 'Stubbed provider boundary; no request made', noPostAttempted: true })) }))
const id = '20d09867-24ce-4849-b03d-f877d7114d6a'
vi.mock('@/lib/publishing/linkedin', () => ({ publishToLinkedIn: mocks.provider }))
vi.mock('@/lib/publishing/facebook', () => ({ publishToFacebook: mocks.provider }))
vi.mock('@/lib/publishing/instagram', () => ({ publishToInstagram: mocks.provider }))
vi.mock('@/lib/publishing/tiktok', () => ({ publishToTikTok: mocks.provider }))
vi.mock('@/lib/publishing/x', () => ({ publishToX: mocks.provider }))
vi.mock('@/lib/publishing/youtube', () => ({ publishToYouTube: mocks.provider }))
vi.mock('@/lib/social-content-calendar-linkage', () => ({ syncCampaignCalendarForSocialContent: vi.fn() }))
vi.mock('@/lib/accelerated-campaign-activation', async importOriginal => {
  const actual = await importOriginal<typeof import('./accelerated-campaign-activation')>()
  return { ...actual, acceleratedCopyHash: vi.fn((item: Record<string, any>) => item.id === id
    ? actual.ACCELERATED_ACTIVATION_ITEMS[id].copyHash : actual.acceleratedCopyHash(item)) }
})
import { publishSocialContentItem } from './social-content-publisher'

const expected = ACCELERATED_ACTIVATION_ITEMS[id]
const manifest = '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297'
const jit = '039488c2ef7fa22f6872617f70060893c49d03ee0936170379a44a2e1f9a18b8'

function storeForScheduledPost(scheduledFor = '2026-11-18T15:00:00+00:00') {
  const item: Record<string, any> = {
    id, status: 'scheduled', updated_at: '2026-11-17T13:00:00Z', platform: 'linkedin', target_platforms: ['linkedin'],
    post_text: 'Synthetic approved copy', cta_text: 'Explore Accelerated', cta_url: 'https://amadutown.com/accelerated',
    hashtags: [], scheduled_for: scheduledFor, image_url: approvedRasterUrls(1)[0], carousel_slide_urls: null,
    rag_context: {
      source_packet_path: 'synthetic/source', campaign_id: ACCELERATED_CAMPAIGN_ID, calendar_item_id: expected.calendarId,
      accelerated_campaign_activation: {
        scope: ACCELERATED_ACTIVATION_SCOPE, campaign_id: ACCELERATED_CAMPAIGN_ID,
        calendar_item_id: expected.calendarId, channel: expected.channel, scheduled_for: expected.scheduledFor,
        copy_sha256: expected.copyHash, asset_urls: approvedRasterUrls(1), asset_sha256: approvedRasterHashes(1),
        source_manifest_sha256: manifest, jit_packet_sha256: jit, fee_usd: 0, no_spend: true,
        activated_by: 'synthetic-admin', activated_at: '2026-11-17T12:00:00Z',
      },
      platform_submission_gate: { status: 'approved', platforms: ['linkedin'], submit_after_approval: false },
    },
  }
  item.rag_context.platform_submission_gate.approved_fingerprint = socialReleaseFingerprint({ ...item, scheduled_for: expected.scheduledFor })
  const store = releaseStore(item)
  store.tables.social_content_config[0].settings = {
    author_urn: 'urn:li:person:IXpDF_c4-m', campaign_zero_fee_verified: true, campaign_zero_fee_cap_usd: 0,
    post_visibility: 'PUBLIC',
  }
  store.tables.social_content_config[0].credentials.person_urn = 'urn:li:person:IXpDF_c4-m'
  return store
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-18T14:59:59.999Z'))
  process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED = 'true'
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request') }))
})
afterEach(() => { delete process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED; vi.unstubAllGlobals(); vi.useRealTimers() })

describe('scheduled Accelerated publisher boundary', () => {
  it('accepts the equivalent PostgREST instant but blocks release before due, then reaches only the stubbed provider at due', async () => {
    const store = storeForScheduledPost()
    expect(mocks.provider).not.toHaveBeenCalled()
    const early = await publishSocialContentItem({ admin: store.admin, id, expectedUpdatedAt: store.item().updated_at })
    expect(early.status).toBe(409)
    expect(early.body.error).toBe('Accelerated campaign publication is not due yet.')
    expect(store.writes).toHaveLength(0)
    expect(mocks.provider).not.toHaveBeenCalled()
    vi.setSystemTime(new Date(expected.scheduledFor))
    const result = await publishSocialContentItem({ admin: store.admin, id, expectedUpdatedAt: store.item().updated_at })
    expect(mocks.provider).toHaveBeenCalledTimes(1)
    expect(result.body.error).not.toBe('Accelerated campaign release binding is missing or changed.')
    expect(result.body.missing_prerequisite).not.toBe('visuals')
    expect(result.body.error).not.toBe('Final platform approval does not match the current content version. Reload and approve the release.')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('rejects a changed instant before any provider boundary', async () => {
    vi.setSystemTime(new Date(expected.scheduledFor))
    const store = storeForScheduledPost('2026-11-18T15:00:01+00:00')
    const result = await publishSocialContentItem({ admin: store.admin, id, expectedUpdatedAt: store.item().updated_at })
    expect(result.status).toBe(409)
    expect(result.body.error).toBe('Accelerated campaign release binding is missing or changed.')
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(store.writes).toHaveLength(0)
  })
})
