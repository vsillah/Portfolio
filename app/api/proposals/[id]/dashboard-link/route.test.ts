import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/proposals/${id}/dashboard-link`)
}

describe('GET /api/proposals/[id]/dashboard-link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
  })

  afterEach(() => {
    restoreEnv()
  })

  it('returns 400 when the proposal id is empty', async () => {
    const response = await GET(makeRequest(''), {
      params: Promise.resolve({ id: '' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Missing proposal ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a null dashboard url when no client project exists', async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    })

    const response = await GET(makeRequest('prop-1'), {
      params: Promise.resolve({ id: 'prop-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ dashboard_url: null })
  })

  it('returns a null dashboard url when no active access token exists', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: 'proj-1' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'client_dashboard_access') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(makeRequest('prop-1'), {
      params: Promise.resolve({ id: 'prop-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ dashboard_url: null })
  })

  it('builds the dashboard url from NEXT_PUBLIC_SITE_URL and the access token', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://preview.example.com'
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: 'proj-1' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'client_dashboard_access') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { access_token: 'tok_abc' },
                    error: null,
                  }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(makeRequest('prop-1'), {
      params: Promise.resolve({ id: 'prop-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      dashboard_url: 'https://preview.example.com/client/dashboard/tok_abc',
    })
  })

  it('falls back to the production site url when NEXT_PUBLIC_SITE_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: 'proj-1' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'client_dashboard_access') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { access_token: 'tok_abc' },
                    error: null,
                  }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(makeRequest('prop-1'), {
      params: Promise.resolve({ id: 'prop-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      dashboard_url: 'https://amadutown.com/client/dashboard/tok_abc',
    })
  })
})
