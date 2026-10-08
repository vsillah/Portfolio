import { afterEach, expect, it, vi } from 'vitest'
import { createVideo } from './heygen'
afterEach(() => vi.restoreAllMocks())
it('rejects checklist scripts before making any provider request, including template paths', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Provider must not be called'))
  for (const templateId of [undefined, 'template']) {
    const result = await createVideo({ script: 'Audience: business leaders\nRequirements: show the workflow\nCTA: join the challenge.', avatarId: 'a', voiceId: 'v', templateId })
    expect(result.error).toContain('Editorial screening blocked render')
    expect(result.videoId).toBeNull()
  }
  expect(fetch).not.toHaveBeenCalled()
})
