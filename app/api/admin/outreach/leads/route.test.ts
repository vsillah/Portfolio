import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  triggerLeadQualificationWebhook: vi.fn(),
  generateOutreachDraftInApp: vi.fn(),
  notifyOutreachDraftReady: vi.fn(),
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

vi.mock('@/lib/outreach-queue-generator', () => ({
  generateOutreachDraftInApp: mocks.generateOutreachDraftInApp,
}))

vi.mock('@/lib/slack-outreach-notification', () => ({
  notifyOutreachDraftReady: mocks.notifyOutreachDraftReady,
}))

import { GET, POST } from './route'

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/outreach/leads${query}`)
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

type QueryCalls = {
  eq: Array<[string, unknown]>
  is: Array<[string, unknown]>
  not: unknown[][]
  like: Array<[string, unknown]>
}

function mockLeadsListQuery(contacts: Record<string, unknown>[]) {
  const queryCalls: QueryCalls = { eq: [], is: [], not: [], like: [] }

  const listChain: {
    select: (...args: unknown[]) => typeof listChain
    eq: (field: string, value: unknown) => typeof listChain
    is: (field: string, value: unknown) => typeof listChain
    not: (field: string, op: string, value: unknown) => typeof listChain
    like: (field: string, value: unknown) => typeof listChain
    or: (...args: unknown[]) => typeof listChain
    order: (...args: unknown[]) => typeof listChain
    range: (...args: unknown[]) => Promise<{
      data: Record<string, unknown>[]
      error: null
      count: number
    }>
  } = {
    select: () => listChain,
    eq: (field, value) => {
      queryCalls.eq.push([field, value])
      return listChain
    },
    is: (field, value) => {
      queryCalls.is.push([field, value])
      return listChain
    },
    not: (field, op, value) => {
      queryCalls.not.push([field, op, value])
      return listChain
    },
    like: (field, value) => {
      queryCalls.like.push([field, value])
      return listChain
    },
    or: () => listChain,
    order: () => listChain,
    range: () =>
      Promise.resolve({
        data: contacts,
        error: null,
        count: contacts.length,
      }),
  }

  mocks.from.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
      return {
        select: () => listChain,
        update: () => {
          const result = Promise.resolve({ error: null }) as Promise<{ error: null }> & {
            eq: () => Promise<{ error: null }>
          }
          result.eq = () => Promise.resolve({ error: null })
          return { in: () => result }
        },
      }
    }
    if (table === 'pain_point_evidence') {
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) }
    }
    if (table === 'diagnostic_audits') {
      return {
        select: () => ({
          in: () => {
            const result = Promise.resolve({ data: [] }) as Promise<{ data: never[] }> & {
              eq: () => Promise<{ data: never[] }>
            }
            result.eq = () => Promise.resolve({ data: [] })
            return result
          },
        }),
      }
    }
    if (table === 'sales_sessions') {
      return {
        select: () => ({
          in: () => ({ order: () => Promise.resolve({ data: [] }) }),
        }),
      }
    }
    if (table === 'outreach_queue') {
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) }
    }
    if (table === 'email_messages') {
      return {
        select: () => ({
          eq: () => ({ in: () => Promise.resolve({ data: [] }) }),
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return queryCalls
}

const websiteFormLead = {
  id: 101,
  name: 'Form Lead',
  email: 'form@example.com',
  company: 'Other Co',
  company_domain: null,
  job_title: null,
  industry: null,
  phone_number: null,
  lead_source: 'website_form',
  lead_score: null,
  outreach_status: 'not_contacted',
  qualification_status: null,
  created_at: '2026-08-01T00:00:00Z',
  linkedin_url: null,
  ai_readiness_score: null,
  competitive_pressure_score: null,
  quick_wins: null,
  message: 'hello',
  full_report: null,
  rep_pain_points: null,
  last_vep_triggered_at: null,
  last_vep_status: null,
  last_n8n_outreach_triggered_at: null,
  last_n8n_outreach_status: null,
  last_n8n_outreach_template_key: null,
  do_not_contact: false,
  removed_at: null,
  website_tech_stack: null,
  website_tech_stack_fetched_at: null,
}

describe('GET /api/admin/outreach/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before listing leads', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns an empty page without batch lookups when no contacts match', async () => {
    mockLeadsListQuery([])

    const response = await GET(makeGetRequest('?filter=all'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      leads: [],
      total: 0,
      page: 1,
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('does not restrict lead_source, visibility, source, or status when those filters are all', async () => {
    // filter === 'all' → no restriction on lead_source
    // visibility === 'all' → no restriction on do_not_contact/removed_at
    // source === 'all' and status === 'all' → no extra equality filters
    const queryCalls = mockLeadsListQuery([websiteFormLead])

    const response = await GET(
      makeGetRequest('?filter=all&visibility=all&source=all&status=all'),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.leads).toHaveLength(1)
    expect(body.leads[0].lead_source).toBe('website_form')
    expect(queryCalls.like).toEqual([])
    expect(queryCalls.eq.filter(([field]) => field === 'lead_source')).toEqual([])
    expect(queryCalls.eq.filter(([field]) => field === 'do_not_contact')).toEqual([])
    expect(queryCalls.eq.filter(([field]) => field === 'outreach_status')).toEqual([])
    expect(queryCalls.is.filter(([field]) => field === 'removed_at')).toEqual([])
    expect(queryCalls.not).toEqual([])
  })

  it('applies the warm temperature filter and default active visibility', async () => {
    const queryCalls = mockLeadsListQuery([])

    const response = await GET(makeGetRequest('?filter=warm'))

    expect(response.status).toBe(200)
    expect(queryCalls.like).toEqual([['lead_source', 'warm_%']])
    expect(queryCalls.eq).toContainEqual(['do_not_contact', false])
    expect(queryCalls.is).toContainEqual(['removed_at', null])
  })
})

describe('POST /api/admin/outreach/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.triggerLeadQualificationWebhook.mockResolvedValue(undefined)
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'created',
      id: 'queue-1',
    })
    mocks.notifyOutreachDraftReady.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated create requests', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makePostRequest({ name: 'Ada' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a non-empty name', async () => {
    const missing = await POST(makePostRequest({ email: 'a@b.com' }))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'Name is required' })

    const blank = await POST(makePostRequest({ name: '   ' }))
    expect(blank.status).toBe(400)
    await expect(blank.json()).resolves.toEqual({ error: 'Name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid email before writing', async () => {
    const response = await POST(
      makePostRequest({ name: 'Ada', email: 'not-an-email' }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid email address',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a new lead, lowercases email, and prefixes a bare LinkedIn URL', async () => {
    const insertPayloads: Record<string, unknown>[] = []
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'contact_submissions') {
        throw new Error(`Unexpected table ${table}`)
      }
      return {
        select: () => ({
          eq: () => ({
            limit: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'not found' },
                }),
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          insertPayloads.push(payload)
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: 42 }, error: null }),
            }),
          }
        },
      }
    })

    const response = await POST(
      makePostRequest({
        name: '  Ada Lovelace  ',
        email: 'Ada@Example.COM',
        linkedin_url: 'linkedin.com/in/ada',
        input_type: 'linkedin',
      }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      id: 42,
      created: true,
      outreach_queued: false,
    })
    expect(insertPayloads[0]).toEqual(
      expect.objectContaining({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        linkedin_url: 'https://linkedin.com/in/ada',
        lead_source: 'cold_linkedin',
        outreach_status: 'not_contacted',
        relationship_strength: 'weak',
        message: 'Imported manually (linkedin)',
      }),
    )
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: '42',
        source: 'manual_entry',
      }),
    )
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('updates an existing lead matched by email and can queue meeting outreach', async () => {
    const updatePayloads: Record<string, unknown>[] = []
    const meetingUpdates: Array<{ id: string; contactId: number }> = []
    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_records') {
        return {
          update: () => ({
            eq: (field: string, value: unknown) => {
              meetingUpdates.push({
                id: String(value),
                contactId: 7,
              })
              expect(field).toBe('id')
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      if (table !== 'contact_submissions') {
        throw new Error(`Unexpected table ${table}`)
      }
      return {
        select: () => ({
          eq: () => ({
            limit: () => ({
              single: () =>
                Promise.resolve({ data: { id: 7 }, error: null }),
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload)
          return {
            eq: () => Promise.resolve({ error: null }),
          }
        },
      }
    })

    const response = await POST(
      makePostRequest({
        name: 'Ada',
        email: 'ada@example.com',
        input_type: 'meeting',
        meeting_record_id: 'mtg-1',
        meeting_summary: 'Talked about automation',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 7,
      updated: true,
      outreach_queued: true,
    })
    expect(updatePayloads[0]).toEqual(
      expect.objectContaining({
        name: 'Ada',
        email: 'ada@example.com',
        lead_source: 'warm_meeting',
      }),
    )
    expect(meetingUpdates).toEqual([{ id: 'mtg-1', contactId: 7 }])
    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith({
      contactId: 7,
      sequenceStep: 1,
      meetingSummary: 'Talked about automation',
    })
  })
})
