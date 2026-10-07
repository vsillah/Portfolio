import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildVideoRenderApproval } from '@/lib/video-render-approval'
const mocks = vi.hoisted(() => ({ createVideo: vi.fn() }))
vi.mock('@/lib/auth-server', async () => import('@/scripts/qa/campaign-video-fixture'))
vi.mock('@/lib/supabase', async () => import('@/scripts/qa/campaign-video-fixture'))
vi.mock('@/lib/heygen', () => ({ createVideo: mocks.createVideo }))
vi.mock('@/lib/video-generation-rate-limit', () => ({ isOverVideoGenerationLimit: async () => false }))
import { POST } from './route'
import { reset, SCRIPT } from '@/scripts/qa/campaign-video-fixture'
beforeEach(() => { reset(); vi.clearAllMocks(); vi.stubEnv('HEYGEN_TEMPLATE_ID', ''); vi.stubEnv('HEYGEN_BRAND_VOICE_ID', '') })
afterEach(() => vi.unstubAllEnvs())
it.each(['explicit-template', 'environment-template', 'explicit-brand', 'environment-brand'])('blocks %s before creating a campaign video', async kind => {
  const body: Record<string, unknown> = { scriptSource: 'campaign', targetType: 'campaign', targetId: 'campaign-qa', socialContentId: 'video-review-qa', scriptText: SCRIPT, channel: 'linkedin_video', avatarId: 'synthetic-avatar', voiceId: 'synthetic-voice', renderApproval: buildVideoRenderApproval(true) }
  if (kind === 'explicit-template') body.templateId = 'unqualified'
  if (kind === 'explicit-brand') body.brandVoiceId = 'unqualified'
  if (kind === 'environment-template') vi.stubEnv('HEYGEN_TEMPLATE_ID', 'unqualified')
  if (kind === 'environment-brand') vi.stubEnv('HEYGEN_BRAND_VOICE_ID', 'unqualified')
  const result = await POST(new NextRequest('http://localhost/api/generate', { method: 'POST', body: JSON.stringify(body) }))
  expect(result.status).toBe(409)
  expect((await result.json()).error).toContain('overrides are unqualified')
  expect(mocks.createVideo).not.toHaveBeenCalled()
})
