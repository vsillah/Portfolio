import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
  triggerValueEvidenceExtraction: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/n8n', () => ({
  triggerValueEvidenceExtraction: mocks.triggerValueEvidenceExtraction,
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/extract-leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupContacts(
  contacts: Array<Record<string, unknown>>,
  completedAuditIds: number[] = [],
) {
  const updates: Array<{ payload: Record<string, unknown>; eq?: unknown; in?: unknown }> = []
  mocks.from.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
      return {
        select: () => ({
          in: vi.fn().mockResolvedValue({ data: contacts, error: null }),
        }),
        update: (payload: Record<string, unknown>) => {
          const result = {
            eq: (field: string, value: unknown) => {
              updates.push({ payload, eq: [field, value] })
              return Promise.resolve({ error: null })
            },
            in: (field: string, value: unknown) => {
              updates.push({ payload, in: [field, value] })
              return Promise.resolve({ error: null })
            },
          }
          return result
        },
      }
    }
    if (table === 'diagnostic_audits') {
      return {
        select: () => ({
          in: () => ({
            eq: vi.fn().mockResolvedValue({
              data: completedAuditIds.map((contact_submission_id) => ({ contact_submission_id })),
              error: null,
            }),
          }),
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
  return updates
}

describe('POST /api/admin/value-evidence/extract-leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.triggerValueEvidenceExtraction.mockResolvedValue({ triggered: true, message: 'ok' })
  })

  it('requires admin auth before mutating contacts', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ leads: [{ contact_submission_id: 1 }] }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.triggerValueEvidenceExtraction).not.toHaveBeenCalled()
  })

  it('rejects a missing or empty leads array', async () => {
    for (const body of [{}, { leads: [] }, { leads: '1' }]) {
      const response = await POST(request(body))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'leads is required and must be a non-empty array',
      })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects leads that lack a positive integer contact id', async () => {
    const response = await POST(request({
      leads: [{ contact_submission_id: '12' }, { contact_submission_id: 0 }, { contact_submission_id: 1.5 }],
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Each lead must have a valid contact_submission_id (positive integer)',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects more than 50 leads', async () => {
    const response = await POST(request({
      leads: Array.from({ length: 51 }, (_, index) => ({ contact_submission_id: index + 1 })),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Maximum 50 leads per request' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips contacts with no extractable text or completed diagnostic', async () => {
    setupContacts([{
      id: 7,
      message: '   ',
      quick_wins: null,
      full_report: null,
      rep_pain_points: null,
    }])

    const response = await POST(request({ leads: [{ contact_submission_id: 7 }] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.triggered).toBe(false)
    expect(body.extractable).toEqual([])
    expect(body.skipped).toEqual([7])
    expect(mocks.triggerValueEvidenceExtraction).not.toHaveBeenCalled()
  })

  it('persists enrichment, marks extractable leads pending, and triggers n8n', async () => {
    const updates = setupContacts([{
      id: 7,
      message: null,
      quick_wins: null,
      full_report: null,
      rep_pain_points: null,
    }])

    const response = await POST(request({
      leads: [{
        contact_submission_id: 7,
        rep_pain_points: '  slow follow-up  ',
        industry: 'logistics',
      }],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.triggered).toBe(true)
    expect(body.extractable).toEqual([7])
    expect(body.skipped).toEqual([])
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        payload: expect.objectContaining({
          rep_pain_points: 'slow follow-up',
          industry: 'logistics',
        }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({ last_vep_status: 'pending' }),
        in: ['id', [7]],
      }),
    ]))
    expect(mocks.triggerValueEvidenceExtraction).toHaveBeenCalledWith({
      contactSubmissionIds: [7],
      enrichments: { 7: { pain_points_freetext: 'slow follow-up' } },
    })
  })

  it('treats a completed diagnostic as extractable even without text', async () => {
    setupContacts([{
      id: 9,
      message: null,
      quick_wins: null,
      full_report: null,
      rep_pain_points: null,
    }], [9])

    const response = await POST(request({ leads: [{ contact_submission_id: 9 }] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.extractable).toEqual([9])
    expect(mocks.triggerValueEvidenceExtraction).toHaveBeenCalledWith({
      contactSubmissionIds: [9],
      enrichments: undefined,
    })
  })
})
