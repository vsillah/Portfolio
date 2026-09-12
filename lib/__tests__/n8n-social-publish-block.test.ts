import { afterEach, expect, it, vi } from 'vitest'
import { triggerSocialContentPublish } from '../n8n'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it.each(['true', 'false'])('never dispatches legacy SOC-002 even with MOCK_N8N=%s', async mock => {
  vi.stubEnv('MOCK_N8N', mock)
  vi.stubEnv('N8N_DISABLE_OUTBOUND', 'false')
  vi.stubEnv('N8N_SOC002_WEBHOOK_URL', 'https://fixture.invalid/legacy-publish')
  vi.stubGlobal('fetch', vi.fn())
  expect(await triggerSocialContentPublish({ content_id: 'fixture', platform: 'linkedin', post_text: 'Reviewed' }))
    .toMatchObject({ triggered: false, message: expect.stringContaining('native claimed publisher') })
  expect(fetch).not.toHaveBeenCalled()
})
