import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  createRepository: vi.fn(() => ({ repository: true })),
  resolveRecovery: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/social-schedule-recovery', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/social-schedule-recovery')>()
  return {
    ...original,
    createSupabaseSocialScheduleRecoveryRepository: mocks.createRepository,
    resolveSocialScheduleRecovery: mocks.resolveRecovery,
  }
})

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/schedule-recovery', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/[id]/schedule-recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.resolveRecovery.mockResolvedValue({
      ok: true,
      side_effects: { provider_call: false, publish: false, external_schedule: false },
    })
  })

  it.each([
    { error: 'Authentication required', status: 401 },
    { error: 'Admin access required', status: 403 },
  ])('rejects unauthorized access with status $status', async (authError) => {
    mocks.verifyAdmin.mockResolvedValueOnce(authError)
    mocks.isAuthError.mockReturnValueOnce(true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await POST(request({
      action: 'cancel_scheduled_publication',
      work_item_id: 'recovery-1',
    }), { params: { id: 'social-1' } })

    expect(response.status).toBe(authError.status)
    expect(mocks.resolveRecovery).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('passes the explicit reschedule decision to the canonical recovery service', async () => {
    const response = await POST(request({
      action: 'reschedule_reconfirm',
      work_item_id: 'recovery-1',
      scheduled_for: '2026-08-20T14:00:00.000Z',
      reconfirm_publication_intent: true,
    }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    expect(mocks.resolveRecovery).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'reschedule_reconfirm',
      scheduledFor: '2026-08-20T14:00:00.000Z',
      reconfirmPublicationIntent: true,
      actorId: 'admin-1',
    }))
    expect(await response.json()).toMatchObject({
      side_effects: { provider_call: false, publish: false, external_schedule: false },
    })
  })

  it('rejects a missing canonical work-item link before any mutation', async () => {
    const response = await POST(request({ action: 'cancel_scheduled_publication' }), {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(400)
    expect(mocks.resolveRecovery).not.toHaveBeenCalled()
  })
})
