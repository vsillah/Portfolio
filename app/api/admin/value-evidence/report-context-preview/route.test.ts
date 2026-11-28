import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  client: { from: vi.fn() } as { from: ReturnType<typeof vi.fn> } | null,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.client
  },
}))

vi.mock('@/lib/source-validator', () => ({
  applyValidatedEvidenceFilter: (query: unknown) => query,
}))

import { GET } from './route'

type QueryResult = { data: unknown; error: unknown }

function terminal(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => query
  for (const method of ['select', 'eq', 'order', 'limit']) {
    query[method] = vi.fn(chain)
  }
  query.single = vi.fn(() => Promise.resolve(result))
  query.then = vi.fn((onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected))
  return query
}

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/value-evidence/report-context-preview${query}`)
}

describe('GET /api/admin/value-evidence/report-context-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.client = { from: mocks.from }
  })

  it('requires admin authentication and a configured database client', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const unauthorized = await GET(request('?contactId=4'))
    expect(unauthorized.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.isAuthError.mockReturnValue(false)
    mocks.client = null
    const unconfigured = await GET(request())
    expect(unconfigured.status).toBe(500)
    await expect(unconfigured.json()).resolves.toEqual({ error: 'Server configuration error' })
  })

  it('rejects a missing or non-numeric contact id', async () => {
    const missing = await GET(request())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'contactId is required' })

    const blank = await GET(request('?contactId=%20%20'))
    expect(blank.status).toBe(400)
    await expect(blank.json()).resolves.toEqual({ error: 'contactId must be a number' })

    const word = await GET(request('?contactId=abc'))
    expect(word.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips audit and pain-point queries when no audit id is supplied', async () => {
    const contact = terminal({
      data: { id: 12, industry: null, website_tech_stack: null, company_domain: null },
      error: null,
    })
    const market = terminal({ data: [], error: null })
    const meetings = terminal({ data: [], error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return contact
      if (table === 'market_intelligence') return market
      if (table === 'meeting_records') return meetings
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(request('?contactId=12abc&auditId=%20%20'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      auditFindings: null,
      marketIntel: [],
      techStack: null,
      companyDomain: null,
      contactIndustry: null,
      meetingExcerpts: [],
    })
    expect(contact.eq).toHaveBeenCalledWith('id', 12)
    expect(mocks.from).not.toHaveBeenCalledWith('diagnostic_audits')
    expect(mocks.from).not.toHaveBeenCalledWith('pain_point_evidence')
  })

  it('keeps all market intel when none match the contact industry', async () => {
    const rows = [
      {
        id: 'mi-1',
        content_text: 'General hiring note',
        source_platform: 'reddit',
        content_type: 'post',
        industry_detected: 'Healthcare',
        sentiment_score: 0.2,
        relevance_score: 0.9,
      },
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return terminal({
          data: { industry: 'Retail', website_tech_stack: ['shopify'], company_domain: 'shop.example' },
          error: null,
        })
      }
      if (table === 'market_intelligence') return terminal({ data: rows, error: null })
      return terminal({ data: [], error: null })
    })

    const response = await GET(request('?contactId=3'))
    const body = await response.json()

    expect(body.marketIntel).toEqual([{
      id: 'mi-1',
      text: 'General hiring note',
      platform: 'reddit',
      type: 'post',
      industry: 'Healthcare',
      sentiment: 0.2,
      relevance: 0.9,
    }])
    expect(body.techStack).toEqual(['shopify'])
    expect(body.companyDomain).toBe('shop.example')
    expect(body.contactIndustry).toBe('Retail')
  })

  it('filters market intel by industry and builds bounded meeting excerpts', async () => {
    const meetingDate = '2026-03-04T15:00:00.000Z'
    const dateLabel = new Date(meetingDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const kept = 'This sentence is definitely long enough to include.'
    const tooLong = 'y'.repeat(321)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return terminal({ data: { industry: 'retail' }, error: null })
      }
      if (table === 'diagnostic_audits') {
        return terminal({
          data: {
            diagnostic_summary: 'Summary',
            key_insights: null,
            recommended_actions: ['Call back'],
            business_challenges: 'Cash',
            tech_stack: null,
            automation_needs: null,
            ai_readiness: null,
            budget_timeline: null,
            decision_making: null,
            urgency_score: 4,
            opportunity_score: 7,
          },
          error: null,
        })
      }
      if (table === 'pain_point_evidence') {
        return terminal({
          data: [{ id: 'pp-1', source_excerpt: 'Late invoices', pain_point_category_id: 'cat-1' }],
          error: null,
        })
      }
      if (table === 'market_intelligence') {
        return terminal({
          data: [
            {
              id: 'keep',
              content_text: 'Retail margin pressure',
              source_platform: 'linkedin',
              content_type: 'post',
              industry_detected: 'US Retail',
              sentiment_score: -0.4,
              relevance_score: 0.8,
            },
            {
              id: 'drop',
              content_text: 'Clinic staffing',
              source_platform: 'web',
              content_type: 'article',
              industry_detected: 'Healthcare',
              sentiment_score: 0,
              relevance_score: 0.1,
            },
          ],
          error: null,
        })
      }
      return terminal({
        data: [{
          id: 'meet-1',
          meeting_type: 'discovery_call',
          meeting_date: meetingDate,
          transcript: `Too short. ${kept} ${tooLong}`,
          structured_notes: {
            action_items: 'Send the revised proposal tomorrow',
            tiny: 'short',
            score: 4,
            risks: [
              'Vendor lock-in is already visible',
              'nope',
              12,
              'The second risk is also long enough',
              'The third risk is also long enough',
              'The fourth risk is also long enough',
              'The fifth risk is also long enough',
              'The sixth risk should be dropped',
            ],
          },
        }],
        error: null,
      })
    })

    const response = await GET(request('?contactId=8&auditId=audit-1'))
    const body = await response.json()

    expect(body.marketIntel.map((row: { id: string }) => row.id)).toEqual(['keep'])
    expect(body.auditFindings).toMatchObject({
      summary: 'Summary',
      insights: [],
      actions: ['Call back'],
      scores: { urgency: 4, opportunity: 7 },
      painPointExcerpts: [{ id: 'pp-1', excerpt: 'Late invoices', categoryId: 'cat-1' }],
    })
    expect(body.meetingExcerpts.map((item: { excerptId: string }) => item.excerptId)).toEqual([
      'meet-1:t0',
      'meet-1:n:action_items',
      'meet-1:n:risks:0',
      'meet-1:n:risks:3',
      'meet-1:n:risks:4',
    ])
    expect(body.meetingExcerpts[0]).toMatchObject({
      meetingId: 'meet-1',
      sourceLabel: `discovery call (${dateLabel})`,
      dateLabel,
      text: kept,
    })
    expect(body.meetingExcerpts[1].text).toBe('action items: Send the revised proposal tomorrow')
    expect(body.meetingExcerpts.some((item: { text: string }) => item.text.includes('sixth risk'))).toBe(false)
    expect(body.meetingExcerpts.some((item: { text: string }) => item.text.includes(tooLong.slice(0, 40)))).toBe(false)
  })

  it('returns a generic error when a lookup throws', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('connection reset')
    })

    const response = await GET(request('?contactId=1'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to load report context' })
  })
})
