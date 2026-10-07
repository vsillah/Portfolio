import { editorialInputVersion } from '@/lib/video-editorial-quality'
import { socialCopyVersion } from '@/lib/social-copy-revision'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildVideoRenderApproval } from '@/lib/video-render-approval'
const mocks = vi.hoisted(() => ({ createVideo: vi.fn(), insert: vi.fn() }))
vi.mock('@/lib/auth-server', async () => import('@/scripts/qa/campaign-video-fixture'))
vi.mock('@/lib/heygen', () => ({ createVideo: mocks.createVideo }))
vi.mock('@/lib/heygen-config', () => ({ getHeyGenDefaults: async () => ({ avatarId: 'synthetic-avatar', voiceId: 'synthetic-voice' }), getHeyGenConfigByType: async () => [] }))
vi.mock('@/lib/supabase', async () => {
  const fixture = await import('@/scripts/qa/campaign-video-fixture')
  return { supabaseAdmin: { ...fixture.supabaseAdmin, from(table: string) {
    if (table === 'video_generation_jobs') {
      const q: any = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: [], error: null }), insert: mocks.insert }
      return q
    }
    const q = fixture.supabaseAdmin.from(table)
    q.neq = () => q; q.not = () => q
    return q
  } } }
})
import { POST } from './route'
import { reset, tables } from '@/scripts/qa/campaign-video-fixture'
const run = (body = {}) => POST(new NextRequest('http://localhost/api/prepare', { method: 'POST', body: JSON.stringify({ renderApproval: buildVideoRenderApproval(true), ...body }) }), { params: { id: 'video-review-qa' } })
beforeEach(() => {
  reset(); vi.clearAllMocks()
  vi.stubEnv('HEYGEN_TEMPLATE_ID', ''); vi.stubEnv('HEYGEN_BRAND_VOICE_ID', '')
  const item = tables.social_content_queue[0]
  delete item.rag_context.campaign_id
  item.platform = 'youtube'; item.target_platforms = ['youtube']
  item.rag_context.production_assets.video_redaction_manifest.items = []
  item.rag_context.campaign_review_handoff.copy_version = socialCopyVersion(item)
  item.rag_context.campaign_video_editorial.input_version = editorialInputVersion(item)
  // Keep the real synchronized LinkedIn handoff shape: this cannot authorize a YouTube render.
})
afterEach(() => vi.unstubAllEnvs())
it('blocks a canonically linked campaign with no top-level campaign_id instead of creating an unbound render', async () => {
  const result = await run()
  expect(result.status).toBe(409)
  expect((await result.json()).error).toMatch(/campaign|changed/i)
  expect(mocks.createVideo).not.toHaveBeenCalled()
  expect(mocks.insert).not.toHaveBeenCalled()
})
it('never falls back to rotating avatars when the canonical campaign has no editorial receipt', async () => {
  delete tables.social_content_queue[0].rag_context.campaign_video_editorial
  const result = await run()
  expect(result.status).toBe(409)
  expect((await result.json()).error).toContain('current campaign editorial')
  expect(mocks.createVideo).not.toHaveBeenCalled()
})
it.each(['explicit-template', 'environment-template', 'explicit-brand', 'environment-brand'])('rejects %s before the provider for the canonical campaign', async kind => {
  const body: Record<string, string> = {}
  if (kind === 'explicit-template') body.templateId = 'unqualified'
  if (kind === 'explicit-brand') body.brandVoiceId = 'unqualified'
  if (kind === 'environment-template') vi.stubEnv('HEYGEN_TEMPLATE_ID', 'unqualified')
  if (kind === 'environment-brand') vi.stubEnv('HEYGEN_BRAND_VOICE_ID', 'unqualified')
  const result = await run(body)
  expect(result.status).toBe(409)
  expect((await result.json()).error).toContain('overrides are unqualified')
  expect(mocks.createVideo).not.toHaveBeenCalled()
  expect(mocks.insert).not.toHaveBeenCalled()
})
