import { describe, expect, it, vi } from 'vitest'
import {
  startYouTubeReconnect,
  YOUTUBE_RECONNECT_LOGIN_PATH,
} from './youtube-reconnect-client'

describe('startYouTubeReconnect', () => {
  it('sends unauthenticated users through the login redirect loopback', async () => {
    const redirect = vi.fn()
    const fetchAuthUrl = vi.fn()

    const result = await startYouTubeReconnect({
      getSession: async () => ({ data: { session: null } }),
      fetchAuthUrl,
      redirect,
    })

    expect(result).toEqual({ status: 'redirecting' })
    expect(fetchAuthUrl).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith(YOUTUBE_RECONNECT_LOGIN_PATH)
  })

  it('requests the existing authenticated YouTube API with the active browser token', async () => {
    const redirect = vi.fn()
    const fetchAuthUrl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ auth_url: 'https://accounts.google.com/o/oauth2/v2/auth?scope=youtube.force-ssl' }),
    })

    const result = await startYouTubeReconnect({
      getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }),
      fetchAuthUrl,
      redirect,
    })

    expect(result).toEqual({ status: 'redirecting' })
    expect(fetchAuthUrl).toHaveBeenCalledWith('admin-token')
    expect(redirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?scope=youtube.force-ssl')
  })

  it('reports API failures without redirecting away from the operator page', async () => {
    const redirect = vi.fn()

    const result = await startYouTubeReconnect({
      getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }),
      fetchAuthUrl: async () => ({
        ok: false,
        json: async () => ({ error: 'Admin access required' }),
      }),
      redirect,
    })

    expect(result).toEqual({ status: 'error', message: 'Admin access required' })
    expect(redirect).not.toHaveBeenCalled()
  })
})
