import { describe, expect, it, vi } from 'vitest'
import {
  TIKTOK_RECONNECT_LOGIN_PATH,
  startTikTokReconnect,
} from './tiktok-reconnect-client'

describe('startTikTokReconnect', () => {
  it('sends unauthenticated users through the login redirect loopback', async () => {
    const redirect = vi.fn()
    const fetchAuthUrl = vi.fn()

    const result = await startTikTokReconnect({
      getSession: async () => ({ data: { session: null } }),
      fetchAuthUrl,
      redirect,
    })

    expect(result).toEqual({ status: 'redirecting' })
    expect(fetchAuthUrl).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith(TIKTOK_RECONNECT_LOGIN_PATH)
  })

  it('requests the authenticated TikTok API with the active browser token', async () => {
    const redirect = vi.fn()
    const fetchAuthUrl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ auth_url: 'https://www.tiktok.com/v2/auth/authorize/?scope=user.info.basic%2Cvideo.publish' }),
    })

    const result = await startTikTokReconnect({
      getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }),
      fetchAuthUrl,
      redirect,
    })

    expect(result).toEqual({ status: 'redirecting' })
    expect(fetchAuthUrl).toHaveBeenCalledWith('admin-token')
    expect(redirect).toHaveBeenCalledWith('https://www.tiktok.com/v2/auth/authorize/?scope=user.info.basic%2Cvideo.publish')
  })

  it('reports API failures without redirecting away from the operator page', async () => {
    const redirect = vi.fn()

    const result = await startTikTokReconnect({
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
