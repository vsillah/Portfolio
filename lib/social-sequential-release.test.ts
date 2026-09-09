import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ from: vi.fn(), linkedin: vi.fn(), facebook: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: async () => ({ user: { id: 'admin' } }), isAuthError: () => false }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/social-content-calendar-linkage', () => ({ syncCampaignCalendarForSocialContent: vi.fn() }))
vi.mock('@/lib/publishing/linkedin', () => ({ publishToLinkedIn: mocks.linkedin }))
vi.mock('@/lib/publishing/facebook', () => ({ publishToFacebook: mocks.facebook }))
vi.mock('@/lib/publishing/instagram', () => ({ publishToInstagram: vi.fn() }))
vi.mock('@/lib/publishing/tiktok', () => ({ publishToTikTok: vi.fn() }))
vi.mock('@/lib/publishing/x', () => ({ publishToX: vi.fn() }))
vi.mock('@/lib/publishing/youtube', () => ({ publishToYouTube: vi.fn() }))
import { POST } from '@/app/api/admin/social-content/[id]/platform-submission/route'
import { publishSocialContentItem } from './social-content-publisher'
import { releaseStore } from './social-release-safety.test-fixtures'
import { socialReleaseFingerprint } from './social-release-evidence'
import { isSocialReleaseLocked } from './social-release-safety'
import { assertSocialQueueWritable } from './social-queue-write'

let store: ReturnType<typeof releaseStore>
const dispatch = (platform: 'linkedin' | 'facebook') => publishSocialContentItem({ admin: store.admin, id: 'social-1', targetPlatforms: [platform] })
const approve = (platforms = ['facebook'], version = store.item().updated_at) => POST(new NextRequest('http://localhost/api/admin/social-content/social-1/platform-submission', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ platforms, expected_updated_at: version, submit_after_approval: false }),
}), { params: { id: 'social-1' } })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network') }))
  store = releaseStore()
  store.item().target_platforms = ['linkedin', 'facebook']
  store.item().rag_context.platform_submission_gate.approved_fingerprint = socialReleaseFingerprint(store.item())
  store.tables.social_content_publishes.push({ id: 'publish-2', content_id: 'social-1', platform: 'facebook', status: 'pending' })
  store.tables.social_content_config.push({ platform: 'facebook', is_active: true, credentials: { access_token: 'fixture', page_id: 'fixture' } })
  mocks.from.mockImplementation(store.admin.from)
  mocks.linkedin.mockImplementation(async () => {
    Object.assign(store.publish(), { status: 'published', platform_post_id: 'linkedin-receipt' }); return { success: true }
  })
  mocks.facebook.mockImplementation(async () => {
    Object.assign(store.tables.social_content_publishes[1], { status: 'published', platform_post_id: 'facebook-receipt' }); return { success: true }
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('separately approved exact-platform continuation', () => {
  it('confirms first target, freezes copy, then approves and confirms the remaining target', async () => {
    const fingerprint = socialReleaseFingerprint(store.item())
    const first = await dispatch('linkedin')
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ published: false, selected_published: true, reconciliation_required: false, remaining_platforms: ['facebook'] })
    expect(store.item().rag_context.platform_submission_gate.status).toBe('partially_submitted')
    expect(isSocialReleaseLocked(store.item().rag_context)).toBe(true)
    expect(() => assertSocialQueueWritable(store.item())).toThrow()
    expect((await dispatch('facebook')).status).toBe(409)
    expect((await approve()).status).toBe(200)
    expect(isSocialReleaseLocked(store.item().rag_context)).toBe(true)
    expect(() => assertSocialQueueWritable(store.item())).toThrow()
    expect(socialReleaseFingerprint(store.item())).toBe(fingerprint)
    const second = await dispatch('facebook')
    expect(second.status).toBe(200)
    expect(second.body).toMatchObject({ published: true, selected_published: true, reconciliation_required: false, remaining_platforms: [] })
    expect(store.item().rag_context.platform_submission_gate.confirmed_platforms).toEqual({ linkedin: 'linkedin-receipt', facebook: 'facebook-receipt' })
    expect(mocks.linkedin).toHaveBeenCalledTimes(1); expect(mocks.facebook).toHaveBeenCalledTimes(1)
  })
  it.each(['copy', 'receipt', 'missing receipt', 'stale', 'repeat', 'implicit', 'ambiguous', 'failed elsewhere'])('rejects %s before next approval or dispatch', async mode => {
    const oldVersion = store.item().updated_at
    await dispatch('linkedin')
    if (mode === 'copy') store.item().post_text = 'Changed'
    if (mode === 'receipt') store.publish().platform_post_id = 'different'
    if (mode === 'missing receipt') store.publish().platform_post_id = null
    if (mode === 'failed elsewhere') store.tables.social_content_publishes[1].status = 'failed'
    if (mode === 'ambiguous') store.tables.social_content_publishes[1].status = 'publishing'
    expect((await approve(mode === 'repeat' ? ['linkedin'] : mode === 'implicit' ? [] : ['facebook'], mode === 'stale' ? oldVersion : store.item().updated_at)).status).toBe(409)
    expect(mocks.facebook).not.toHaveBeenCalled()
  })
  it('rejects changed content and repeated targets even after second approval', async () => {
    await dispatch('linkedin'); await approve()
    expect((await dispatch('linkedin')).status).toBe(409)
    store.item().post_text = 'Changed after approval'
    expect((await dispatch('facebook')).status).toBe(409)
    expect(mocks.facebook).not.toHaveBeenCalled()
  })
  it('allows one concurrent approval of the remaining target', async () => {
    await dispatch('linkedin')
    const outcomes = await Promise.all([approve(), approve()])
    expect(outcomes.map(result => result.status).sort()).toEqual([200, 409])
    expect(mocks.facebook).not.toHaveBeenCalled()
  })
  it('blocks all continuation after an unknown first selected outcome', async () => {
    mocks.linkedin.mockResolvedValue({})
    expect((await dispatch('linkedin')).status).toBe(409)
    expect(store.item().rag_context.platform_submission_gate.status).toBe('uncertain')
    expect((await approve()).status).toBe(409)
    expect(mocks.facebook).not.toHaveBeenCalled()
  })
  it('allows one concurrent remaining-target claim', async () => {
    await dispatch('linkedin'); await approve()
    const outcomes = await Promise.all([dispatch('facebook'), dispatch('facebook')])
    expect(outcomes.map(result => result.status).sort()).toEqual([200, 409])
    expect(mocks.facebook).toHaveBeenCalledTimes(1)
  })
  it.each(['failed', 'async', 'unknown'])('keeps a selected %s outcome locked despite earlier confirmed targets', async mode => {
    await dispatch('linkedin'); await approve()
    mocks.facebook.mockResolvedValue(mode === 'unknown' ? {} : { success: mode === 'async', status: mode === 'async' ? 'publishing' : 'failed' })
    const result = await dispatch('facebook')
    expect(result.status).toBe(409); expect(result.body.reconciliation_required).toBe(true)
    expect(store.item().rag_context.platform_submission_gate.status).toBe('uncertain')
    expect((await approve()).status).toBe(409)
    expect((await dispatch('facebook')).status).toBe(409)
    expect(mocks.facebook).toHaveBeenCalledTimes(1)
  })
})
