import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  rejectCalendarDraftHandoff: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/social-content-calendar-handoff', () => ({
  rejectCalendarDraftHandoff: mocks.rejectCalendarDraftHandoff,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/social-content/calendar/calendar-1/reject', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/social-content/calendar/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.rejectCalendarDraftHandoff.mockResolvedValue({
      calendarItem: { id: 'calendar-1', authorization_status: 'rejected' },
      revisionWorkItemId: 'work-revision-1',
    })
  })

  it('requires a decision note', async () => {
    const response = await POST(request({ decision_note: '   ' }) as never, {
      params: { id: 'calendar-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Decision note is required when rejecting a calendar item',
    })
    expect(mocks.rejectCalendarDraftHandoff).not.toHaveBeenCalled()
  })

  it('returns the item to Shaka for revision without external side effects', async () => {
    const response = await POST(request({ decision_note: 'Needs stronger campaign proof.' }) as never, {
      params: { id: 'calendar-1' },
    })

    expect(response.status).toBe(200)
    expect(mocks.rejectCalendarDraftHandoff).toHaveBeenCalledWith({
      id: 'calendar-1',
      decisionNote: 'Needs stronger campaign proof.',
      auth: { user: { id: 'admin-user' } },
    })
    expect(await response.json()).toMatchObject({
      ok: true,
      revision_work_item_id: 'work-revision-1',
      side_effects: {
        revision_work_item_created: true,
        publish: false,
        external_post: false,
      },
    })
  })
})
