import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: (value: object) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/delivery-email', () => ({ suggestEmailTemplate: () => 'email_asset_delivery' }))
import { GET } from './route'

const contact = { id: 42, name: 'Synthetic QA', email: 'qa@example.invalid', created_at: '2026-11-05T00:00:00Z', lead_source: 'website_form' }
const missingColumn = { code: '42703', message: 'column accelerated_quote_contact_links.refinement_id does not exist' }
const missingTable = { code: 'PGRST205', message: "Could not find the table 'accelerated_quote_refinements' in the schema cache" }
let quoteResult: { data: unknown; error: {code:string;message:string} | null }
let refinementProbe: { data: unknown; error: {code:string;message:string} | null }

function resultFor(table: string) {
  if (table === 'contact_submissions') return { data: contact, error: null }
  if (table === 'accelerated_quote_contact_links') return quoteResult
  if (table === 'accelerated_quote_refinements') return refinementProbe
  return { data: [], error: null }
}

function query(table: string) {
  const response = () => resultFor(table)
  const builder = {
    select: () => builder, eq: () => builder, is: () => builder, order: () => builder, limit: () => builder,
    single: async () => response(), maybeSingle: async () => response(),
    then: (resolve: (value: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve),
  }
  return builder
}

const request = new NextRequest('http://localhost/api/admin/contacts/42')
const params = { params: { id: '42' } }

describe('admin contact quote compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.from.mockImplementation(query)
    quoteResult = { data: null, error: null }
    refinementProbe = { data: [], error: null }
  })

  it('keeps the contact detail available before the quote refinement migration', async () => {
    quoteResult = { data: null, error: missingColumn }
    refinementProbe = { data: null, error: missingTable }
    const response = await GET(request, params)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ contact, acceleratedQuote: null })
    expect(mocks.from).toHaveBeenCalledWith('accelerated_quote_refinements')
  })

  it('preserves the contextual package on the migrated schema', async () => {
    const packageData = { projection: { status: 'candidates', remaining: [{ kind: 'service', id: 's1' }] } }
    quoteResult = { data: { order_id: 1203, context_package: packageData }, error: null }
    const response = await GET(request, params)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ acceleratedQuote: { order_id: 1203, context_package: packageData } })
    expect(mocks.from).not.toHaveBeenCalledWith('accelerated_quote_refinements')
  })

  it('does not hide a missing column after the companion migration exists', async () => {
    quoteResult = { data: null, error: missingColumn }
    const response = await GET(request, params)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Quote context is temporarily unavailable' })
  })

  it('rejects unrelated quote query errors and enforces admin authentication', async () => {
    quoteResult = { data: null, error: { code: '42501', message: 'permission denied' } }
    expect((await GET(request, params)).status).toBe(503)
    mocks.from.mockClear()
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    expect((await GET(request, params)).status).toBe(403)
    expect(mocks.from).toHaveBeenCalledTimes(0)
  })
})
