import { it, expect, vi } from 'vitest'
const from = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from } }))
import { publishToLinkedIn } from './linkedin'
it('fails closed before database or network calls for a video payload', async () => {
  const network = vi.spyOn(globalThis, 'fetch')
  expect(await publishToLinkedIn({ contentId: 'id', postText: 'copy', videoUrl: 'https://example.invalid/video.mp4', releaseClaimId: 'claim' })).toMatchObject({ success: false, error: expect.stringContaining('Videos API') })
  expect(from).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled(); network.mockRestore()
})
it('does not publish text if the caller omits the attached canonical video', async () => {
  const q: any = { select: () => q, eq: () => q, single: async () => ({ data: { video_url: 'video.mp4' } }) }
  from.mockReturnValue(q)
  const network = vi.spyOn(globalThis, 'fetch')
  expect(await publishToLinkedIn({ contentId: 'id', postText: 'copy', releaseClaimId: 'claim' })).toMatchObject({ success: false, error: expect.stringContaining('do not fall back') })
  expect(network).not.toHaveBeenCalled(); network.mockRestore()
})
