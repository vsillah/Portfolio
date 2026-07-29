import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(body: unknown, authHeader: string | null = 'Bearer secret-token') {
  return new NextRequest('http://localhost/api/admin/outreach/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

type ContactLookup = { id: number; do_not_contact: boolean } | null

function contactLookupChain(result: ContactLookup) {
  const single = vi.fn().mockResolvedValue({
    data: result,
    error: result ? null : { message: 'not found', code: 'PGRST116' },
  })
  const limit = vi.fn().mockReturnValue({ single })
  const eq = vi.fn().mockReturnValue({ limit, single, eq: vi.fn().mockReturnValue({ limit, single }) })
  const ilike = vi.fn().mockReturnValue({ eq })
  const select = vi.fn().mockReturnValue({ eq, ilike })
  return { select, eq, ilike, limit, single }
}

function mockContactInsert(error: { code?: string; message: string } | null = null) {
  return vi.fn().mockResolvedValue({ error })
}

function mockContactUpdate() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  return { update, eq }
}

function mockWarmAudit(running: { id: string } | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: running, error: null })
  const limit = vi.fn().mockReturnValue({ maybeSingle })
  const order = vi.fn().mockReturnValue({ limit })
  const eqStatus = vi.fn().mockReturnValue({ order })
  const eqSource = vi.fn().mockReturnValue({ eq: eqStatus })
  const select = vi.fn().mockReturnValue({ eq: eqSource })
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  return { select, update, updateEq }
}

describe('POST /api/admin/outreach/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = 'secret-token'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('returns 401 when bearer token is missing or invalid', async () => {
    const response = await POST(makeRequest({ leads: [{ name: 'A', lead_source: 'warm_linkedin' }] }, null))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()

    const bad = await POST(
      makeRequest({ leads: [{ name: 'A', lead_source: 'warm_linkedin' }] }, 'Bearer wrong'),
    )
    expect(bad.status).toBe(401)
  })

  it('returns 401 when N8N_INGEST_SECRET is unset', async () => {
    delete process.env.N8N_INGEST_SECRET
    const response = await POST(
      makeRequest({ leads: [{ name: 'A', lead_source: 'warm_linkedin' }] }),
    )
    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when leads array is missing or empty', async () => {
    const missing = await POST(makeRequest({}))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({
      error: 'leads array is required and must not be empty',
    })

    const empty = await POST(makeRequest({ leads: [] }))
    expect(empty.status).toBe(400)
  })

  it('returns 400 for missing name or invalid lead_source', async () => {
    const noName = await POST(
      makeRequest({ leads: [{ lead_source: 'warm_linkedin' }] }),
    )
    expect(noName.status).toBe(400)
    expect(await noName.json()).toEqual({ error: 'Each lead must have a name' })

    const badSource = await POST(
      makeRequest({ leads: [{ name: 'Alice', lead_source: 'not_a_source' }] }),
    )
    expect(badSource.status).toBe(400)
    expect(await badSource.json()).toEqual({ error: 'Invalid lead_source: not_a_source' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips organization-looking names without writing contacts', async () => {
    const warm = mockWarmAudit(null)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'warm_lead_trigger_audit') return warm
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        leads: [{ name: 'Acme Solutions', lead_source: 'warm_facebook_friends' }],
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      summary: {
        total: 1,
        inserted: 0,
        updated: 0,
        skipped: 0,
        skipped_company: 1,
        skipped_dnc: 0,
        errors: 0,
      },
    })
    expect(mocks.from).not.toHaveBeenCalledWith('contact_submissions')
  })

  it('skips re-ingest when existing contact is marked do_not_contact', async () => {
    const lookup = contactLookupChain({ id: 42, do_not_contact: true })
    const warm = mockWarmAudit(null)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return lookup
      if (table === 'warm_lead_trigger_audit') return warm
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        leads: [
          {
            name: 'Alice Lead',
            email: 'Alice@Example.COM',
            lead_source: 'warm_linkedin',
          },
        ],
      }),
    )

    expect(lookup.eq).toHaveBeenCalledWith('email', 'alice@example.com')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      summary: { total: 1, inserted: 0, skipped_dnc: 1 },
    })
  })

  it('inserts a new lead and completes a running warm-lead audit row', async () => {
    const lookup = contactLookupChain(null)
    const insert = mockContactInsert(null)
    const warm = mockWarmAudit({ id: 'audit-1' })
    const insertedRows: Record<string, unknown>[] = []

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return {
          select: lookup.select,
          insert: (row: Record<string, unknown>) => {
            insertedRows.push(row)
            return insert(row)
          },
        }
      }
      if (table === 'warm_lead_trigger_audit') return warm
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        is_test_data: true,
        leads: [
          {
            name: 'Bob Person',
            email: 'bob@example.com',
            company: 'Widgets',
            lead_source: 'warm_facebook_friends',
            linkedin_url: 'https://linkedin.com/in/bob',
          },
        ],
      }),
    )

    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0]).toMatchObject({
      name: 'Bob Person',
      email: 'bob@example.com',
      company: 'Widgets',
      lead_source: 'warm_facebook_friends',
      outreach_status: 'not_contacted',
      relationship_strength: 'strong',
      is_test_data: true,
      linkedin_url: 'https://linkedin.com/in/bob',
    })
    expect(warm.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', completed_at: expect.any(String) }),
    )
    expect(warm.updateEq).toHaveBeenCalledWith('id', 'audit-1')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      summary: { total: 1, inserted: 1, updated: 0, skipped: 0, errors: 0 },
    })
  })

  it('updates an existing non-DNC contact with new fields', async () => {
    const lookup = contactLookupChain({ id: 7, do_not_contact: false })
    const contactUpdate = mockContactUpdate()
    const warm = mockWarmAudit(null)

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return {
          select: lookup.select,
          update: contactUpdate.update,
        }
      }
      if (table === 'warm_lead_trigger_audit') return warm
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        leads: [
          {
            name: 'Carol',
            email: 'carol@example.com',
            lead_source: 'warm_referral',
            phone_number: '555-0100',
            job_title: 'CEO',
          },
        ],
      }),
    )

    expect(contactUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        phone_number: '555-0100',
        job_title: 'CEO',
        lead_source: 'warm_referral',
        relationship_strength: 'moderate',
      }),
    )
    expect(contactUpdate.eq).toHaveBeenCalledWith('id', 7)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      summary: { total: 1, updated: 1, inserted: 0 },
    })
  })

  it('counts unique-constraint insert races as skipped', async () => {
    const lookup = contactLookupChain(null)
    const insert = mockContactInsert({ code: '23505', message: 'duplicate' })
    const warm = mockWarmAudit(null)

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return {
          select: lookup.select,
          insert,
        }
      }
      if (table === 'warm_lead_trigger_audit') return warm
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        leads: [{ name: 'Dana', email: 'dana@example.com', lead_source: 'cold_apollo' }],
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      summary: { total: 1, inserted: 0, skipped: 1, errors: 0 },
    })
  })
})
