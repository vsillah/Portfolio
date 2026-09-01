import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  triggerLeadQualificationWebhook: vi.fn(),
  propagateContactWebsiteTechStackToAudits: vi.fn(),
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

vi.mock('@/lib/n8n', () => ({
  triggerLeadQualificationWebhook: mocks.triggerLeadQualificationWebhook,
}))

vi.mock('@/lib/diagnostic', () => ({
  propagateContactWebsiteTechStackToAudits:
    mocks.propagateContactWebsiteTechStackToAudits,
}))

import { GET, PATCH } from './route'

const existingLead = {
  id: 42,
  name: 'Ada',
  email: 'ada@example.com',
  company: 'Analytical',
  company_domain: 'analytical.example',
  job_title: 'Engineer',
  industry: 'Tech',
  phone_number: '555-0100',
  linkedin_url: 'https://linkedin.com/in/ada',
  message: 'Existing note',
  lead_source: 'cold_linkedin',
}

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost/api/admin/outreach/leads/${id}`)
}

function makePatchRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/admin/outreach/leads/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockLeadFetch(
  lead: typeof existingLead | null,
  updateError: { message: string } | null = null,
) {
  const updatePayloads: Record<string, unknown>[] = []
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'contact_submissions') {
      throw new Error(`Unexpected table ${table}`)
    }
    return {
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: lead,
              error: lead ? null : { message: 'not found' },
            }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updatePayloads.push(payload)
        return {
          eq: () => Promise.resolve({ error: updateError }),
        }
      },
    }
  })
  return { updatePayloads }
}

describe('GET /api/admin/outreach/leads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest('42'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric lead id', async () => {
    const response = await GET(makeGetRequest('abc'), {
      params: Promise.resolve({ id: 'abc' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead id' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the lead is missing', async () => {
    mockLeadFetch(null)

    const response = await GET(makeGetRequest('42'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead not found' })
  })

  it('returns the lead row', async () => {
    mockLeadFetch(existingLead)

    const response = await GET(makeGetRequest('42'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(existingLead)
  })
})

describe('PATCH /api/admin/outreach/leads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.triggerLeadQualificationWebhook.mockResolvedValue(undefined)
    mocks.propagateContactWebsiteTechStackToAudits.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated updates', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(makePatchRequest('42', { name: 'Ada' }), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric lead id', async () => {
    const response = await PATCH(makePatchRequest('nope', { name: 'Ada' }), {
      params: Promise.resolve({ id: 'nope' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead id' })
  })

  it('returns 404 when the lead does not exist', async () => {
    mockLeadFetch(null)

    const response = await PATCH(makePatchRequest('42', { name: 'Ada' }), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead not found' })
  })

  it('rejects an invalid email before writing', async () => {
    mockLeadFetch(existingLead)

    const response = await PATCH(
      makePatchRequest('42', { email: 'not-valid' }),
      { params: Promise.resolve({ id: '42' }) },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid email address',
    })
    expect(mocks.triggerLeadQualificationWebhook).not.toHaveBeenCalled()
  })

  it('still persists the existing message when no message or notes are sent', async () => {
    const { updatePayloads } = mockLeadFetch(existingLead)

    const response = await PATCH(makePatchRequest('42', { ignored: true }), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 42, updated: true })
    expect(updatePayloads).toEqual([{ message: 'Existing note' }])
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalled()
  })

  it('persists do_not_contact together with the existing message', async () => {
    const { updatePayloads } = mockLeadFetch(existingLead)

    const response = await PATCH(
      makePatchRequest('42', { do_not_contact: true }),
      { params: Promise.resolve({ id: '42' }) },
    )

    expect(response.status).toBe(200)
    expect(updatePayloads).toEqual([
      { message: 'Existing note', do_not_contact: true },
    ])
  })

  it('normalizes LinkedIn URLs and re-runs enrichment on profile edits', async () => {
    const { updatePayloads } = mockLeadFetch(existingLead)

    const response = await PATCH(
      makePatchRequest('42', {
        name: '  Ada Byron  ',
        linkedin_url: 'linkedin.com/in/ada-byron',
        input_type: 'linkedin',
      }),
      { params: Promise.resolve({ id: '42' }) },
    )

    expect(response.status).toBe(200)
    expect(updatePayloads[0]).toEqual(
      expect.objectContaining({
        name: 'Ada Byron',
        linkedin_url: 'https://linkedin.com/in/ada-byron',
        lead_source: 'cold_linkedin',
        warm_source_detail: 'Manual entry: linkedin',
      }),
    )
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: '42',
        name: 'Ada Byron',
        source: 'manual_entry',
      }),
    )
  })

  it('skips enrichment when re_run_enrichment is false', async () => {
    mockLeadFetch(existingLead)

    const response = await PATCH(
      makePatchRequest('42', {
        company: 'New Co',
        re_run_enrichment: false,
      }),
      { params: Promise.resolve({ id: '42' }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.triggerLeadQualificationWebhook).not.toHaveBeenCalled()
  })
})
