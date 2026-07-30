import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  fireOnboardingWebhook: vi.fn(),
  buildMilestonesSummary: vi.fn(),
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

vi.mock('@/lib/onboarding-templates', () => ({
  fireOnboardingWebhook: mocks.fireOnboardingWebhook,
  buildMilestonesSummary: mocks.buildMilestonesSummary,
}))

import { POST } from './route'

function makeRequest() {
  return new NextRequest(
    'http://localhost/api/admin/client-projects/proj-1/approve-onboarding',
    { method: 'POST' },
  )
}

function params(id = 'proj-1') {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/admin/client-projects/[id]/approve-onboarding', () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.fireOnboardingWebhook.mockResolvedValue(true)
    mocks.buildMilestonesSummary.mockReturnValue('Week 1: Kickoff')
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before reading projects', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.fireOnboardingWebhook).not.toHaveBeenCalled()
  })

  it('returns 404 when the client project is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Client project not found' })
    expect(mocks.fireOnboardingWebhook).not.toHaveBeenCalled()
  })

  it('short-circuits when onboarding email was already sent', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'proj-1',
                  onboarding_email_sent_at: '2026-07-01T12:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      already_sent: true,
      sent_at: '2026-07-01T12:00:00.000Z',
    })
    expect(mocks.fireOnboardingWebhook).not.toHaveBeenCalled()
  })

  it('returns 400 when the project has no onboarding plan', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'proj-1',
                  client_name: 'Acme',
                  client_email: 'acme@example.com',
                  project_name: 'Launch',
                  onboarding_email_sent_at: null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'onboarding_plans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No onboarding plan found for this project',
    })
    expect(mocks.fireOnboardingWebhook).not.toHaveBeenCalled()
  })

  it('fires the onboarding webhook, includes dashboard URL, and stamps sent_at', async () => {
    const projectUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const projectUpdate = vi.fn().mockReturnValue({ eq: projectUpdateEq })
    let projectFromCalls = 0

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        projectFromCalls += 1
        if (projectFromCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'proj-1',
                    client_name: 'Acme',
                    client_email: 'acme@example.com',
                    project_name: 'Launch',
                    project_start_date: '2026-08-01',
                    onboarding_email_sent_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return { update: projectUpdate }
      }
      if (table === 'onboarding_plans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'plan-1',
                  pdf_url: 'https://cdn.example/plan.pdf',
                  milestones: [{ week: 1, title: 'Kickoff' }],
                  template_name: 'Standard',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'client_dashboard_access') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { access_token: 'dash-token-1' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(typeof body.sent_at).toBe('string')

    expect(mocks.buildMilestonesSummary).toHaveBeenCalledWith([{ week: 1, title: 'Kickoff' }])
    expect(mocks.fireOnboardingWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        onboarding_plan_id: 'plan-1',
        onboarding_plan_url: 'https://example.test/onboarding/plan-1',
        client_name: 'Acme',
        client_email: 'acme@example.com',
        project_name: 'Launch',
        milestones_summary: 'Week 1: Kickoff',
        trigger_onboarding_call: true,
        dashboard_url: 'https://example.test/client/dashboard/dash-token-1',
      }),
    )
    expect(projectUpdate).toHaveBeenCalledWith({ onboarding_email_sent_at: body.sent_at })
    expect(projectUpdateEq).toHaveBeenCalledWith('id', 'proj-1')
  })
})
