import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  verifyAdmin: vi.fn(),
  triggerLeadQualificationWebhook: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: object) => 'error' in result,
}))

vi.mock('@/lib/n8n', () => ({
  triggerLeadQualificationWebhook: mocks.triggerLeadQualificationWebhook,
}))

import { GET, POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'Ada@Example.COM',
    message: '  I want a diagnostic  ',
    company: ' Analytical Engines ',
    companyDomain: 'analyticalengines.com',
    linkedinUrl: 'https://linkedin.com/in/ada',
    interestAreas: ['consulting', 'unknown_code'],
    isDecisionMaker: true,
    ...overrides,
  }
}

function lookupChain(existing: { id: number } | null) {
  const single = vi.fn().mockResolvedValue({
    data: existing,
    error: existing ? null : { code: 'PGRST116', message: 'not found' },
  })
  const limit = vi.fn().mockReturnValue({ single })
  const eq = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, limit, single }
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in API test') }))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.triggerLeadQualificationWebhook.mockResolvedValue({ triggered: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requires name, email, and message', async () => {
    const response = await POST(makeRequest({ name: 'Ada', email: 'ada@example.com' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Name, email, and message are required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid email addresses before writing', async () => {
    const response = await POST(makeRequest(validBody({ email: 'not-an-email' })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid email address' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts a new lead with normalized email, urls, and interest labels', async () => {
    const lookup = lookupChain(null)
    const inserted = { id: 101 }
    const insertSingle = vi.fn().mockResolvedValue({ data: inserted, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })
    mocks.from.mockReturnValue({
      select: lookup.select,
      insert,
    })

    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, id: 101 })
    expect(lookup.eq).toHaveBeenCalledWith('email', 'ada@example.com')
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Analytical Engines',
        company_domain: 'https://analyticalengines.com',
        linkedin_url: 'https://linkedin.com/in/ada',
        interest_areas: ['consulting', 'unknown_code'],
        interest_summary: 'Consulting Services, unknown_code',
        is_decision_maker: true,
        message: 'I want a diagnostic',
        lead_source: 'website_form',
      }),
    ])
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        companyDomain: 'https://analyticalengines.com',
        submissionId: '101',
        source: 'portfolio_contact_form',
      }),
    )
  })

  it('updates an existing contact instead of inserting a duplicate email', async () => {
    const lookup = lookupChain({ id: 7 })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    mocks.from.mockReturnValue({
      select: lookup.select,
      update,
    })

    const response = await POST(makeRequest(validBody({ companyDomain: 'https://already.https' })))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, id: 7 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ada Lovelace',
        company_domain: 'https://already.https',
        lead_source: 'website_form',
      }),
    )
    expect(updateEq).toHaveBeenCalledWith('id', 7)
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: '7' }),
    )
  })

  it('treats unique-constraint races as success and still qualifies the lead', async () => {
    const firstLookup = lookupChain(null)
    const racedLookup = lookupChain({ id: 88 })
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    })
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    })

    mocks.from
      .mockReturnValueOnce({ select: firstLookup.select })
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({ select: racedLookup.select })

    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, id: 88 })
    expect(racedLookup.eq).toHaveBeenCalledWith('email', 'ada@example.com')
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: '88' }),
    )
  })
})

describe('GET /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in API test') }))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function submissionsQuery(result: { data: unknown; error: unknown }) {
    const limit = vi.fn().mockResolvedValue(result)
    const order = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({ select })
    return { select, order, limit }
  }

  it.each([401, 403])('blocks a non-admin caller with %s before reading PII', async (status) => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Access denied', status })
    const request = new NextRequest('http://localhost/api/contact')
    const response = await GET(request)
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error: 'Access denied' })
    expect(mocks.verifyAdmin).toHaveBeenCalledWith(request)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists recent submissions for a verified admin', async () => {
    const submissions = [
      { id: 1, email: 'ada@example.com', name: 'Ada', message: 'Need a diagnostic' },
    ]
    const query = submissionsQuery({ data: submissions, error: null })

    const response = await GET(new NextRequest('http://localhost/api/contact'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ submissions })
    expect(mocks.from).toHaveBeenCalledWith('contact_submissions')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(50)
  })

  it('returns an empty list when there are no submissions', async () => {
    submissionsQuery({ data: [], error: null })

    const response = await GET(new NextRequest('http://localhost/api/contact'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ submissions: [] })
  })

  it('returns a generic 500 when the lookup fails', async () => {
    submissionsQuery({ data: null, error: { message: 'relation missing' } })

    const response = await GET(new NextRequest('http://localhost/api/contact'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch submissions' })
  })
})
