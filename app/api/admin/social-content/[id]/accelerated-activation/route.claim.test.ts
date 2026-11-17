import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ACCELERATED_ACTIVATION_ITEMS, ACCELERATED_ACTIVATION_SCOPE, ACCELERATED_CAMPAIGN_ID, approvedMediaBinding, approvedRasterUrls } from '@/lib/accelerated-campaign-activation'

const mocks = vi.hoisted(() => ({ patches: [] as Record<string, unknown>[], inserts: [] as Record<string, unknown>[], id: '' }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: vi.fn(async () => ({ user: { id: 'admin-test' } })), isAuthError: () => false }))
vi.mock('@/lib/accelerated-campaign-activation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/accelerated-campaign-activation')>()
  return { ...actual, evaluateAcceleratedActivation: vi.fn(async ({ id }: { id: string }) => ({
    ready: true, blockers: [], copyHash: actual.ACCELERATED_ACTIVATION_ITEMS[id as keyof typeof actual.ACCELERATED_ACTIVATION_ITEMS].copyHash,
    assetHashes: actual.approvedRasterHashes(actual.ACCELERATED_ACTIVATION_ITEMS[id as keyof typeof actual.ACCELERATED_ACTIVATION_ITEMS].assetCount),
  })) }
})
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (table: string) => {
  let patch: Record<string, unknown> | null = null
  const query: Record<string, any> = {
    select: () => query, eq: () => query, is: () => query,
    update: (value: Record<string, unknown>) => { patch = value; mocks.patches.push(value); return query },
    insert: async (value: Record<string, unknown>) => { mocks.inserts.push(value); return { error: null } },
    maybeSingle: async () => ({ error: null, data: patch ? { id: mocks.id, status: 'scheduled' } : table === 'social_content_queue'
      ? { id: mocks.id, updated_at: 'version-1', status: 'draft', rag_context: {} }
      : { platform: 'fixture' } }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, data: table === 'social_content_calendar_items'
      ? [{ id: actualItems[mocks.id as keyof typeof actualItems].calendarId }] : [] }).then(resolve),
  }
  return query
} } }))
const actualItems = ACCELERATED_ACTIVATION_ITEMS
import { POST } from './route'

afterEach(() => { delete process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED; mocks.patches.length = 0; mocks.inserts.length = 0 })

describe('three-record schedule claim', () => {
  it.each(Object.keys(ACCELERATED_ACTIVATION_ITEMS))('saves exact media URLs with the schedule claim for %s', async id => {
    mocks.id = id
    process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED = 'true'
    const expected = ACCELERATED_ACTIVATION_ITEMS[id as keyof typeof ACCELERATED_ACTIVATION_ITEMS]
    const response = await POST(new NextRequest(`http://localhost/api/admin/social-content/${id}/accelerated-activation`, {
      method: 'POST', body: JSON.stringify({ scope: ACCELERATED_ACTIVATION_SCOPE, campaign_id: ACCELERATED_CAMPAIGN_ID,
        content_id: id, calendar_item_id: expected.calendarId, channel: expected.channel, scheduled_for: expected.scheduledFor,
        copy_sha256: expected.copyHash, expected_updated_at: 'version-1' }),
    }), { params: { id } })
    expect(response.status).toBe(200)
    expect(mocks.inserts).toHaveLength(1)
    expect(mocks.patches).toHaveLength(1)
    expect(mocks.patches[0]).toMatchObject({ ...approvedMediaBinding(expected.assetCount), status: 'scheduled', scheduled_for: expected.scheduledFor })
    expect((mocks.patches[0].rag_context as any).accelerated_campaign_activation.asset_urls).toEqual(approvedRasterUrls(expected.assetCount))
  })
})
