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

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/client-projects${query}`)
}

function thenable<T extends Record<string, unknown>>(
  value: T,
  extra: Record<string, unknown> = {},
) {
  return {
    ...extra,
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(value).then(onFulfilled, onRejected)
    },
  }
}

describe('GET /api/admin/client-projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns payment_received projects with no onboarding email when pending_onboarding=1', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 'cp-1', project_status: 'payment_received', onboarding_email_sent_at: null }],
      error: null,
    })
    const isNull = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ limit }),
    })
    const statusEq = vi.fn().mockReturnValue({ is: isNull })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: statusEq }),
    })

    const response = await GET(request('?pending_onboarding=1'))

    expect(response.status).toBe(200)
    expect(statusEq).toHaveBeenCalledWith('project_status', 'payment_received')
    expect(isNull).toHaveBeenCalledWith('onboarding_email_sent_at', null)
    expect(await response.json()).toEqual({
      projects: [
        {
          id: 'cp-1',
          project_status: 'payment_received',
          onboarding_email_sent_at: null,
        },
      ],
      pending_onboarding: true,
    })
  })

  it('does not restrict project_status when the filter is all', async () => {
    // filter === 'all' → no restriction on client_projects.project_status
    const statusEq = vi.fn()
    const searchOr = vi.fn()
    const listResult = {
      data: [{ id: 'cp-2', project_name: 'Hold' }],
      error: null,
      count: 1,
    }
    const range = vi.fn().mockReturnValue(
      thenable(listResult, { eq: statusEq, or: searchOr }),
    )
    let clientProjectCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        clientProjectCalls += 1
        if (clientProjectCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ range }),
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ project_status: 'active' }, { project_status: 'complete' }],
            error: null,
          }),
        }
      }
      if (table === 'onboarding_plans') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  client_project_id: 'cp-2',
                  status: 'in_progress',
                  milestones: [
                    { status: 'complete' },
                    { status: 'in_progress' },
                    { status: 'pending' },
                  ],
                },
              ],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request('?status=all'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(statusEq).not.toHaveBeenCalled()
    expect(body.projects).toEqual([
      {
        id: 'cp-2',
        project_name: 'Hold',
        client_id: 'cp-2',
        onboarding_plan_status: 'in_progress',
        milestone_total: 3,
        milestone_completed: 1,
        milestone_in_progress: 1,
      },
    ])
    expect(body.stats).toEqual({
      active: 1,
      testing: 0,
      delivering: 0,
      complete: 1,
      total: 2,
    })
  })
})
