import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  authorizeCalendarDraftHandoff: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/social-content-calendar-handoff', () => ({
  authorizeCalendarDraftHandoff: mocks.authorizeCalendarDraftHandoff,
}))

import { POST } from './route'

function request() {
  return new Request('http://localhost/api/admin/social-content/calendar/calendar-1/authorize', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token' },
  })
}

describe('/api/admin/social-content/calendar/[id]/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.authorizeCalendarDraftHandoff.mockResolvedValue({
      calendarItem: { id: 'calendar-1', authorization_status: 'authorized' },
      socialContentId: 'social-1',
      handoffWorkItemId: 'work-handoff-1',
      handoffKind: 'linkedin_social_content_draft',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never, { params: { id: 'calendar-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.authorizeCalendarDraftHandoff).not.toHaveBeenCalled()
  })

  it('authorizes an internal draft handoff without external side effects', async () => {
    const response = await POST(request() as never, { params: { id: 'calendar-1' } })

    expect(response.status).toBe(200)
    expect(mocks.authorizeCalendarDraftHandoff).toHaveBeenCalledWith('calendar-1', {
      user: { id: 'admin-user' },
    })
    expect(await response.json()).toMatchObject({
      ok: true,
      handoff: {
        kind: 'linkedin_social_content_draft',
        work_item_id: 'work-handoff-1',
        social_content_id: 'social-1',
      },
      side_effects: {
        internal_draft_handoff_created: true,
        social_content_draft_created: true,
        publish: false,
        external_post: false,
      },
    })
  })
})
