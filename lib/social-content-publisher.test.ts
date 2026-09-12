import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ publish: vi.fn(), sync: vi.fn() }))
vi.mock('@/lib/publishing/linkedin', () => ({ publishToLinkedIn: mocks.publish }))
vi.mock('@/lib/publishing/facebook', () => ({ publishToFacebook: mocks.publish }))
vi.mock('@/lib/publishing/instagram', () => ({ publishToInstagram: mocks.publish }))
vi.mock('@/lib/publishing/tiktok', () => ({ publishToTikTok: mocks.publish }))
vi.mock('@/lib/publishing/x', () => ({ publishToX: mocks.publish }))
vi.mock('@/lib/publishing/youtube', () => ({ publishToYouTube: mocks.publish }))
vi.mock('@/lib/social-content-calendar-linkage', () => ({ syncCampaignCalendarForSocialContent: mocks.sync }))
import { publishSocialContentItem } from './social-content-publisher'
import { releaseStore } from './social-release-safety.test-fixtures'
import { hasCurrentSocialReleaseApproval, socialReleaseFingerprint } from './social-release-evidence'
import { isSocialReleaseLocked } from './social-release-safety'

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network') })) })
afterEach(() => vi.unstubAllGlobals())
const run = (store: ReturnType<typeof releaseStore>) => publishSocialContentItem({ admin: store.admin, id: 'social-1' })
describe('atomic release safety', () => {
  it('rejects a stale displayed version even when the current content has a valid final approval', async () => {
    const store = releaseStore()
    expect(hasCurrentSocialReleaseApproval(store.item())).toBe(true)
    const result = await publishSocialContentItem({ admin: store.admin, id: 'social-1', expectedUpdatedAt: 'older-reviewed-version' })
    expect(result.status).toBe(409)
    expect(store.writes).toHaveLength(0)
    expect(mocks.publish).not.toHaveBeenCalled()
  })
  it('rejects a final gate after content changes', async () => {
    const store = releaseStore(); store.item().post_text = 'Changed after approval'
    expect((await run(store)).status).toBe(409)
    expect(mocks.publish).not.toHaveBeenCalled(); expect(store.writes).toHaveLength(0)
  })
  it('allows exactly one concurrent dispatcher and uses the server returned claim version', async () => {
    const store = releaseStore()
    let finish!: () => void
    const wait = new Promise<void>(resolve => { finish = resolve })
    mocks.publish.mockImplementation(async () => {
      expect(isSocialReleaseLocked(store.item().rag_context)).toBe(true)
      await wait
      Object.assign(store.publish(), { status: 'published', platform_post_id: 'remote-1' })
      return { success: true, platformPostId: 'remote-1' }
    })
    const first = run(store), second = run(store)
    await vi.waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1))
    finish()
    const results = await Promise.all([first, second])
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    expect(store.item().status).toBe('published')
    expect(store.item().rag_context.platform_submission_gate.status).toBe('submitted')
  })
  it.each(['throw', 'empty', 'failed', 'async'])('locks %s provider outcomes without retry', async mode => {
    const store = releaseStore()
    mocks.publish.mockImplementation(async () => {
      if (mode === 'throw') throw new Error('network timeout')
      return mode === 'empty' ? {} : { success: mode === 'async', status: mode === 'async' ? 'publishing' : 'failed' }
    })
    expect((await run(store)).status).toBe(409)
    expect(store.item().rag_context.platform_submission_gate.status).toBe('uncertain')
    expect((await run(store)).status).toBe(409)
    expect(mocks.publish).toHaveBeenCalledTimes(1)
  })
  it.each(['disabled', 'missing'])('blocks %s config before a claim or provider call', async mode => {
    const store = releaseStore()
    if (mode === 'disabled') store.tables.social_content_config[0].is_active = false
    else store.tables.social_content_config = []
    expect((await run(store)).status).toBe(409)
    expect(store.writes).toHaveLength(0); expect(mocks.publish).not.toHaveBeenCalled()
  })
  it('does not dispatch when an edit/reject wins the queue CAS', async () => {
    const store = releaseStore()
    store.controls.beforeWrite = (table, patch) => {
      if (table === 'social_content_queue' && patch.rag_context?.platform_submission_gate.status === 'submitting') {
        store.item().status = 'rejected'; store.item().updated_at = 'changed'
      }
    }
    expect((await run(store)).status).toBe(409)
    expect(mocks.publish).not.toHaveBeenCalled()
  })
  it('an edit using the displayed pre-claim version loses after release claim', async () => {
    const store = releaseStore(), before = store.item().updated_at
    mocks.publish.mockImplementation(async () => {
      expect(isSocialReleaseLocked(store.item().rag_context)).toBe(true)
      const update = await store.admin.from('social_content_queue').update({ post_text: 'raced edit' })
        .eq('id', 'social-1').eq('updated_at', before).select('*').maybeSingle()
      expect(update.data).toBeNull()
      return { success: false }
    })
    await run(store); expect(store.item().post_text).toBe('Reviewed content')
  })
  it('approval fingerprint survives timestamp triggers but detects changed evidence', () => {
    const store = releaseStore()
    store.item().updated_at = 'server generated timestamp'
    expect(hasCurrentSocialReleaseApproval(store.item())).toBe(true)
    const old = socialReleaseFingerprint(store.item())
    store.item().rag_context.section_gate_reviews.privacy.status = 'pending'
    expect(socialReleaseFingerprint(store.item())).not.toBe(old)
    expect(hasCurrentSocialReleaseApproval(store.item())).toBe(false)
  })
  it('retains the claim after remote success and failed queue persistence', async () => {
    const store = releaseStore()
    store.controls.fail = (table, patch) => table === 'social_content_queue' && patch.rag_context?.platform_submission_gate.status === 'submitted'
    mocks.publish.mockImplementation(async () => {
      Object.assign(store.publish(), { status: 'published', platform_post_id: 'remote-1' })
      return { success: true }
    })
    expect((await run(store)).body.reconciliation_required).toBe(true)
    expect(store.item().rag_context.platform_submission_gate.status).toBe('submitting')
    await run(store); expect(mocks.publish).toHaveBeenCalledTimes(1)
  })
})
