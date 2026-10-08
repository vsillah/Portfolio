import { afterEach, expect, it, vi } from 'vitest'
import { resolveVideoRenderInputs } from './video-render-inputs'
import { createVideo } from './heygen'
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
it('resolves explicit and environment-default template and brand-voice inputs together', () => {
  vi.stubEnv('HEYGEN_TEMPLATE_ID', ' environment-template ')
  vi.stubEnv('HEYGEN_BRAND_VOICE_ID', ' environment-brand ')
  expect(resolveVideoRenderInputs()).toEqual({ templateId: 'environment-template', brandVoiceId: 'environment-brand' })
  expect(resolveVideoRenderInputs({ templateId: ' explicit ', brandVoiceId: ' brand ' })).toEqual({ templateId: 'explicit', brandVoiceId: 'brand' })
})
it('uses the qualified no-template snapshot even if environment defaults change before provider dispatch', async () => {
  vi.stubEnv('HEYGEN_TEMPLATE_ID', ''); vi.stubEnv('HEYGEN_BRAND_VOICE_ID', '')
  const effectiveRenderInputs = resolveVideoRenderInputs()
  vi.stubEnv('HEYGEN_TEMPLATE_ID', 'late-unqualified-template'); vi.stubEnv('HEYGEN_BRAND_VOICE_ID', 'late-unqualified-brand')
  vi.stubEnv('HEYGEN_API_KEY', 'synthetic-test-only')
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { video_id: 'synthetic-video' } })))
  await createVideo({ effectiveRenderInputs, avatarId: 'a', voiceId: 'v', avatarCharacterKind: 'avatar', script: 'The problem is a slow handoff. I put the evidence beside the decision so the team can act. Which decision slows your team down?' })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][0]).toBe('https://api.heygen.com/v2/video/generate')
  expect(String(fetch.mock.calls[0][1]?.body)).not.toContain('late-unqualified')
})
