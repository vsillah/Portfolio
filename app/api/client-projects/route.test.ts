import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createOnboardingPlanForProject: vi.fn(),
  generateOnboardingPlanPDF: vi.fn(),
  generateClientDashboard: vi.fn(),
  generateKickoffAgenda: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/onboarding-templates', () => ({
  createOnboardingPlanForProject: mocks.createOnboardingPlanForProject,
}))

vi.mock('@/lib/onboarding-pdf', () => ({
  generateOnboardingPlanPDF: mocks.generateOnboardingPlanPDF,
}))

vi.mock('@/lib/client-dashboard', () => ({
  generateClientDashboard: mocks.generateClientDashboard,
}))

vi.mock('@/lib/kickoff-agenda', () => ({
  generateKickoffAgenda: mocks.generateKickoffAgenda,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/client-projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    payment_schedule: 'full',
    client_name: 'Ada',
    client_email: 'ada@example.com',
    client_company: 'Ada Co',
    sales_session_id: null,
    bundle_name: 'Strategy Sprint',
    total_amount: 5000,
    checkout_session_id: null,
    contract_pdf_url: null,
    ...overrides,
  }
}

describe('POST /api/client-projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createOnboardingPlanForProject.mockResolvedValue(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('requires proposal_id before any lookup', async () => {
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'proposal_id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the proposal is missing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
        }),
      }),
    })

    const response = await POST(makeRequest({ proposal_id: 'prop-missing' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
    expect(mocks.from).toHaveBeenCalledWith('proposals')
    expect(mocks.from).not.toHaveBeenCalledWith('client_projects')
  })

  it('blocks milestone proposals until verified payment evidence exists', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: proposalRow({ payment_schedule: 'milestones' }),
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await POST(makeRequest({ proposal_id: 'prop-1' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Milestone projects are created only from verified payment evidence',
    })
    expect(mocks.from).not.toHaveBeenCalledWith('client_projects')
    expect(mocks.createOnboardingPlanForProject).not.toHaveBeenCalled()
  })

  it('returns 409 when a client project already exists for the proposal', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: proposalRow(), error: null }),
            }),
          }),
        }
      }
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'cp-existing', onboarding_plan_id: 'plan-1' },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await POST(makeRequest({ proposal_id: 'prop-1' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Client project already exists for this proposal',
      client_project_id: 'cp-existing',
      onboarding_plan_id: 'plan-1',
    })
    expect(mocks.createOnboardingPlanForProject).not.toHaveBeenCalled()
  })

  it('creates a non-milestone project even when no onboarding template matches', async () => {
    let clientProjectSelects = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: proposalRow(), error: null }),
            }),
          }),
        }
      }
      if (table === 'client_projects') {
        return {
          select: vi.fn((cols?: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return Promise.resolve({ count: 4, error: null })
            }
            clientProjectSelects += 1
            const n = clientProjectSelects
            return {
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(
                  n === 1
                    ? { data: null, error: null }
                    : { data: { contact_submission_id: null }, error: null },
                ),
              }),
            }
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'cp-new',
                  client_name: 'Ada',
                  client_email: 'ada@example.com',
                  client_company: 'Ada Co',
                  project_start_date: '2026-09-21T00:00:00.000Z',
                  product_purchased: 'Strategy Sprint',
                  estimated_end_date: null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await POST(makeRequest({ proposal_id: 'prop-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      client_project_id: 'cp-new',
      onboarding_plan_id: null,
      message: 'Project created but no matching onboarding template found.',
    })
    expect(body.client_id).toMatch(/^cli_\d{8}_5$/)
    expect(mocks.createOnboardingPlanForProject).toHaveBeenCalledTimes(1)
    expect(mocks.generateOnboardingPlanPDF).not.toHaveBeenCalled()
    expect(mocks.generateClientDashboard).not.toHaveBeenCalled()
  })
})
