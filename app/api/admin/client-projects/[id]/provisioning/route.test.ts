import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getProvisioningItems: vi.fn(),
  updateProvisioningItemStatus: vi.fn(),
  fireProvisioningReminder: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/kickoff-agenda', () => ({
  getProvisioningItems: mocks.getProvisioningItems,
  updateProvisioningItemStatus: mocks.updateProvisioningItemStatus,
  fireProvisioningReminder: mocks.fireProvisioningReminder,
}))

import { GET, PATCH, POST } from './route'

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost/api/admin/client-projects/proj-1/provisioning',
    {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  )
}

function params(id = 'proj-1') {
  return { params: Promise.resolve({ id }) }
}

describe('/api/admin/client-projects/[id]/provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  describe('GET', () => {
    it('rejects unauthenticated requests', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeRequest('GET'), params())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.getProvisioningItems).not.toHaveBeenCalled()
    })

    it('returns provisioning items for the project', async () => {
      const items = [{ id: 'item-1', status: 'pending', label: 'DNS access' }]
      mocks.getProvisioningItems.mockResolvedValue(items)

      const response = await GET(makeRequest('GET'), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ items })
      expect(mocks.getProvisioningItems).toHaveBeenCalledWith('proj-1')
    })
  })

  describe('POST', () => {
    it('rejects unauthenticated requests before firing reminders', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await POST(makeRequest('POST'), params())

      expect(response.status).toBe(401)
      expect(mocks.fireProvisioningReminder).not.toHaveBeenCalled()
    })

    it('returns 400 when the reminder cannot be triggered', async () => {
      mocks.fireProvisioningReminder.mockResolvedValue({
        triggered: false,
        message: 'No pending items',
      })

      const response = await POST(makeRequest('POST'), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'No pending items' })
      expect(mocks.fireProvisioningReminder).toHaveBeenCalledWith('proj-1')
    })

    it('sends a reminder and reports pending count', async () => {
      mocks.fireProvisioningReminder.mockResolvedValue({
        triggered: true,
        pendingCount: 3,
      })

      const response = await POST(makeRequest('POST'), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        success: true,
        pending_count: 3,
        message: 'Reminder sent for 3 pending items',
      })
    })
  })

  describe('PATCH', () => {
    it('rejects unauthenticated requests before updating items', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await PATCH(
        makeRequest('PATCH', { item_id: 'item-1', status: 'complete' }),
        params(),
      )

      expect(response.status).toBe(401)
      expect(mocks.updateProvisioningItemStatus).not.toHaveBeenCalled()
    })

    it('requires item_id and status', async () => {
      const response = await PATCH(makeRequest('PATCH', { status: 'complete' }), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'item_id and status are required',
      })
      expect(mocks.updateProvisioningItemStatus).not.toHaveBeenCalled()
    })

    it('rejects invalid status values', async () => {
      const response = await PATCH(
        makeRequest('PATCH', { item_id: 'item-1', status: 'done' }),
        params(),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error:
          'Invalid status. Must be one of: pending, in_progress, complete, blocked, skipped',
      })
      expect(mocks.updateProvisioningItemStatus).not.toHaveBeenCalled()
    })

    it('updates item status and returns success', async () => {
      mocks.updateProvisioningItemStatus.mockResolvedValue(true)

      const response = await PATCH(
        makeRequest('PATCH', {
          item_id: 'item-1',
          status: 'blocked',
          blocker_note: 'Waiting on DNS',
          completed_by: 'admin-1',
        }),
        params(),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ success: true })
      expect(mocks.updateProvisioningItemStatus).toHaveBeenCalledWith(
        'item-1',
        'blocked',
        'admin-1',
        'Waiting on DNS',
      )
    })

    it('returns 500 when the item update fails', async () => {
      mocks.updateProvisioningItemStatus.mockResolvedValue(false)

      const response = await PATCH(
        makeRequest('PATCH', { item_id: 'item-1', status: 'complete' }),
        params(),
      )

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: 'Failed to update item' })
    })
  })
})
