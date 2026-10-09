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

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/contacts-search${query}`)
}

function thenableQuery(result: { data: unknown; error?: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    not: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    not: vi.fn(),
    is: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.not.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.or.mockReturnValue(query)
  return query
}

describe('GET /api/admin/contacts-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('?q=acme'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('searches clients without an or-filter when q is blank and caps limit at 50', async () => {
    const clients = thenableQuery({ data: [] })
    const leads = thenableQuery({ data: [] })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return clients
      if (table === 'contact_submissions') return leads
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('?q=%20&limit=99'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ contacts: [] })
    expect(clients.limit).toHaveBeenCalledWith(50)
    expect(clients.or).not.toHaveBeenCalled()
    expect(leads.or).not.toHaveBeenCalled()
    expect(leads.is).toHaveBeenCalledWith('removed_at', null)
    expect(leads.eq).toHaveBeenCalledWith('do_not_contact', false)
  })

  it('prefers client rows over leads for the same email and fills remaining slots from leads', async () => {
    const clients = thenableQuery({
      data: [
        { client_email: ' Ada@Acme.com ', client_name: 'Ada Client', client_company: 'Acme' },
        { client_email: null, client_name: 'No Email', client_company: null },
      ],
    })
    const leads = thenableQuery({
      data: [
        { email: 'ada@acme.com', name: 'Ada Lead', company: 'Lead Co' },
        { email: 'bob@example.com', name: 'Bob', company: 'Beta' },
      ],
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return clients
      if (table === 'contact_submissions') return leads
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('?q=ada&limit=5'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(clients.or).toHaveBeenCalledWith(
      'client_name.ilike.%ada%,client_email.ilike.%ada%,client_company.ilike.%ada%',
    )
    expect(leads.or).toHaveBeenCalledWith('name.ilike.%ada%,email.ilike.%ada%,company.ilike.%ada%')
    expect(leads.limit).toHaveBeenCalledWith(5)
    expect(body).toEqual({
      contacts: [
        { email: 'ada@acme.com', name: 'Ada Client', company: 'Acme', source: 'client' },
        { email: 'bob@example.com', name: 'Bob', company: 'Beta', source: 'lead' },
      ],
    })
  })

  it('skips lead lookup when client results already fill the limit', async () => {
    const clients = thenableQuery({
      data: [
        { client_email: 'one@example.com', client_name: 'One', client_company: null },
        { client_email: 'two@example.com', client_name: 'Two', client_company: null },
      ],
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return clients
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('?limit=2'))

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('client_projects')
    await expect(response.json()).resolves.toEqual({
      contacts: [
        { email: 'one@example.com', name: 'One', company: null, source: 'client' },
        { email: 'two@example.com', name: 'Two', company: null, source: 'client' },
      ],
    })
  })
})
