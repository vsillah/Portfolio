import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { DELETE } from './route'

function makeDeleteRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/contacts/42/assets', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/admin/contacts/[id]/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ id: 'admin-user' })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('detaches FK refs then hard-deletes value_report asset', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'gamma_reports') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        }
      }

      if (table === 'proposals') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        }
      }

      if (table === 'value_reports') {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => Promise.resolve({ data: [{ id: 'vr-1' }], error: null })),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(
      makeDeleteRequest({ assetType: 'value_report', assetId: 'vr-1' }),
      { params: { id: '42' } }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      assetType: 'value_report',
      assetId: 'vr-1',
    })
    expect(mocks.from.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'gamma_reports',
      'proposals',
      'value_reports',
    ])
  })

  it('returns 500 and skips hard-delete when gamma_report detach fails', async () => {
    const detachError = { message: 'detach failed' }

    mocks.from.mockImplementation((table: string) => {
      if (table === 'video_generation_jobs') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: detachError })),
            })),
          })),
        }
      }

      if (table === 'gamma_reports') {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => Promise.resolve({ data: [{ id: 'gr-1' }], error: null })),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(
      makeDeleteRequest({ assetType: 'gamma_report', assetId: 'gr-1' }),
      { params: { id: '42' } }
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to delete asset' })
    expect(mocks.from.mock.calls.map((call: unknown[]) => call[0])).toEqual(['video_generation_jobs'])
  })

  it('returns 404 when video soft-delete affects zero rows', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'video_generation_jobs') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(
      makeDeleteRequest({ assetType: 'video', assetId: 'vid-1' }),
      { params: { id: '42' } }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Asset not found for this contact' })
  })
})
