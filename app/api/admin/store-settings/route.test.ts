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

import { GET, PUT } from './route'

function makeGetRequest() {
  return new NextRequest('http://localhost/api/admin/store-settings', { method: 'GET' })
}

function makePutRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/store-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSettingsSelect(rows: Array<{ key: string; value: unknown; updated_at?: string }>) {
  const select = vi.fn().mockResolvedValue({ data: rows, error: null })
  return { select }
}

function mockUpsertAndSelect(rows: Array<{ key: string; value: unknown; updated_at?: string }>) {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const select = vi.fn().mockResolvedValue({ data: rows, error: null })
  return { upsert, select }
}

describe('/api/admin/store-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  describe('GET', () => {
    it('rejects unauthenticated requests before reading store settings', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeGetRequest())
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('Unauthorized')
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns keyed settings for admins', async () => {
      const settingsSelect = mockSettingsSelect([
        { key: 'social_share_discount', value: { type: 'fixed', value: 5 }, updated_at: '2026-08-01T00:00:00Z' },
        { key: 'other', value: { enabled: true }, updated_at: '2026-08-01T00:00:00Z' },
      ])
      mocks.from.mockReturnValueOnce(settingsSelect)

      const response = await GET(makeGetRequest())
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.settings).toEqual({
        social_share_discount: { type: 'fixed', value: 5 },
        other: { enabled: true },
      })
      expect(mocks.from).toHaveBeenCalledWith('store_settings')
      expect(settingsSelect.select).toHaveBeenCalledWith('key, value, updated_at')
    })
  })

  describe('PUT', () => {
    it('rejects unauthenticated requests before writing store settings', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await PUT(makePutRequest({ social_share_discount: { type: 'fixed', value: 10 } }))
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('Unauthorized')
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('upserts percentage social share discount and returns updated settings', async () => {
      const chain = mockUpsertAndSelect([
        { key: 'social_share_discount', value: { type: 'percentage', value: 12 }, updated_at: '2026-08-07T00:00:00Z' },
      ])
      mocks.from
        .mockReturnValueOnce({ upsert: chain.upsert })
        .mockReturnValueOnce({ select: chain.select })

      const response = await PUT(makePutRequest({
        social_share_discount: { type: 'percentage', value: 12 },
      }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'social_share_discount',
          value: { type: 'percentage', value: 12 },
        }),
        { onConflict: 'key' },
      )
      expect(body.settings).toEqual({
        social_share_discount: { type: 'percentage', value: 12 },
      })
    })

    it('coerces invalid discount type/value to fixed $5 defaults', async () => {
      const chain = mockUpsertAndSelect([
        { key: 'social_share_discount', value: { type: 'fixed', value: 5 } },
      ])
      mocks.from
        .mockReturnValueOnce({ upsert: chain.upsert })
        .mockReturnValueOnce({ select: chain.select })

      const response = await PUT(makePutRequest({
        social_share_discount: { type: 'weird', value: -3 },
      }))

      expect(response.status).toBe(200)
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'social_share_discount',
          value: { type: 'fixed', value: 5 },
        }),
        { onConflict: 'key' },
      )
    })

    it('skips upsert when social_share_discount is omitted and still returns settings', async () => {
      const settingsSelect = mockSettingsSelect([
        { key: 'social_share_discount', value: { type: 'fixed', value: 5 } },
      ])
      mocks.from.mockReturnValueOnce(settingsSelect)

      const response = await PUT(makePutRequest({}))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.settings).toEqual({
        social_share_discount: { type: 'fixed', value: 5 },
      })
      expect(mocks.from).toHaveBeenCalledTimes(1)
      expect(settingsSelect.select).toHaveBeenCalledWith('key, value, updated_at')
    })
  })
})
