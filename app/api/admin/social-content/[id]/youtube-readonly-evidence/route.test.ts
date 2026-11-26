import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { YOUTUBE_EVIDENCE_CALENDAR_ID, YOUTUBE_EVIDENCE_COHORT_SHA256, YOUTUBE_EVIDENCE_CONTENT_ID } from '@/lib/youtube-readonly-evidence-acquisition'

const state = vi.hoisted(() => ({ auth: { user: { id: 'admin' } } as unknown, reads: [] as string[], writes: [] as string[], service: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: vi.fn(async () => state.auth), isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value) }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from(table: string) {
  state.reads.push(table)
  const row = table === 'social_content_queue' ? { id: YOUTUBE_EVIDENCE_CONTENT_ID, platform: 'youtube', updated_at: '2026-11-25T12:00:00.000Z' }
    : table === 'social_content_calendar_items' ? { id: YOUTUBE_EVIDENCE_CALENDAR_ID, social_content_id: YOUTUBE_EVIDENCE_CONTENT_ID }
    : { credentials: { access_token: 'secret', scope: 'https://www.googleapis.com/auth/youtube.readonly' }, is_active: true }
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: row, error: null }), insert: () => { state.writes.push(table); throw Error('write') }, update: () => { state.writes.push(table); throw Error('write') }, upsert: () => { state.writes.push(table); throw Error('write') }, delete: () => { state.writes.push(table); throw Error('write') } }
  return chain
} } }))
vi.mock('@/lib/youtube-readonly-evidence-acquisition', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/youtube-readonly-evidence-acquisition')>()
  return { ...original, acquireYouTubeReadOnlyEvidence: (...args: unknown[]) => state.service(...args) }
})
import { POST } from './route'
const url = `https://example.test/api/admin/social-content/${YOUTUBE_EVIDENCE_CONTENT_ID}/youtube-readonly-evidence`
const body = { content_id: YOUTUBE_EVIDENCE_CONTENT_ID, calendar_item_id: YOUTUBE_EVIDENCE_CALENDAR_ID, cohort_sha256: YOUTUBE_EVIDENCE_COHORT_SHA256, expected_content_updated_at: '2026-11-25T12:00:00.000Z' }
function request(payload: unknown = body) { return new NextRequest(url, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }) }
beforeEach(() => { state.auth = { user: { id: 'admin' } }; state.reads.length = 0; state.writes.length = 0; state.service.mockReset().mockResolvedValue({ status: 'acquired_unscored', records: [], persistence_enabled: false, external_actions_enabled: false }) })
describe('admin-only YouTube evidence route', () => {
  it('reads exactly the canonical content, calendar, and connection; never invokes a DB write', async () => {
    const response = await POST(request(), { params: { id: YOUTUBE_EVIDENCE_CONTENT_ID } })
    expect(response.status).toBe(200)
    expect(state.reads).toEqual(['social_content_queue', 'social_content_calendar_items', 'social_content_config'])
    expect(state.writes).toEqual([])
    expect(state.service).toHaveBeenCalledWith(expect.objectContaining({ content_updated_at: body.expected_content_updated_at, calendar_bound: true, is_active: true }))
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })
  it('denies non-admin before database or provider access', async () => {
    state.auth = { error: 'Forbidden', status: 403 }
    expect((await POST(request(), { params: { id: YOUTUBE_EVIDENCE_CONTENT_ID } })).status).toBe(403)
    expect(state.reads).toEqual([])
    expect(state.service).not.toHaveBeenCalled()
  })
  it('rejects another record and mismatched calendar binding before reads', async () => {
    expect((await POST(request(), { params: { id: 'other' } })).status).toBe(404)
    expect((await POST(request({ ...body, calendar_item_id: 'other' }), { params: { id: YOUTUBE_EVIDENCE_CONTENT_ID } })).status).toBe(400)
    expect(state.reads).toEqual([])
  })
})
