import { describe, expect, it, vi } from 'vitest'
import {
  X_RECONNECT_LOGIN_PATH,
  startXReconnect,
} from './x-reconnect-client'

describe('startXReconnect', () => {
  it('sends unauthenticated users through the login redirect loopback', async () => {
    const redirect = vi.fn()
    const fetchAuthUrl = vi.fn()

    const result = await startXReconnect({
      getSession: async () => ({ data: { session: null } }),
      fetchAuthUrl,
      redirect,
    })

    expect(result).toEqual({ status: 'redirecting' })
    expect(fetchAuthUrl).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith(X_RECONNECT_LOGIN_PATH)
  })

  it('requests the authenticated X API with the active browser token', async () => {
    const redirect = vi.fn()
    const fetchAuthUrl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ auth_url: 'https://twitter.com/i/oauth2/authorize?client_id=x' }),
    })

    const result = await startXReconnect({
      getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }),
      fetchAuthUrl,
      redirect,
    })

    expect(result).toEqual({ status: 'redirecting' })
    expect(fetchAuthUrl).toHaveBeenCalledWith('admin-token')
    expect(redirect).toHaveBeenCalledWith('https://twitter.com/i/oauth2/authorize?client_id=x')
  })

  it('reports API failures without redirecting away from the operator page', async () => {
    const redirect = vi.fn()

    const result = await startXReconnect({
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

  it('falls back to a generic error when the API body has no usable message', async () => {
    const redirect = vi.fn()

    const result = await startXReconnect({
      getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }),
      fetchAuthUrl: async () => ({
        ok: false,
        json: async () => ({}),
      }),
      redirect,
    })

    expect(result).toEqual({ status: 'error', message: 'X connection could not start.' })
    expect(redirect).not.toHaveBeenCalled()
  })
})
