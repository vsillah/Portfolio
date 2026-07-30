import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  refreshCategoryStats: vi.fn(),
  linkEvidenceToCalculations: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/value-evidence-linker', () => ({
  refreshCategoryStats: mocks.refreshCategoryStats,
  linkEvidenceToCalculations: mocks.linkEvidenceToCalculations,
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
  return new NextRequest('http://localhost/api/admin/value-evidence/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = 'secret-token'
    mocks.refreshCategoryStats.mockResolvedValue(undefined)
    mocks.linkEvidenceToCalculations.mockResolvedValue({ updated: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('returns 401 when bearer auth fails', async () => {
    const response = await POST(makeRequest({ evidence: [] }, 'Bearer wrong'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when evidence is not an array', async () => {
    const response = await POST(makeRequest({ evidence: 'nope' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'evidence must be an array' })
  })

  it('accepts an empty evidence array without database writes', async () => {
    const response = await POST(makeRequest({ evidence: [] }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      total: 0,
      inserted: 0,
      categoriesCreated: 0,
      errors: [],
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('records validation errors for incomplete items and continues', async () => {
    const response = await POST(
      makeRequest({
        evidence: [
          { pain_point_category_name: 'manual_processes' },
          {
            // missing source_type and source_excerpt
            pain_point_category_name: 'staffing',
            source_id: 'x',
          },
        ],
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.total).toBe(2)
    expect(body.inserted).toBe(0)
    expect(body.errors).toHaveLength(2)
    expect(body.errors[0]).toMatch(/Missing required fields/)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('reuses an existing category, inserts evidence, refreshes stats, and links calculations', async () => {
    const evidenceInserted: Record<string, unknown>[] = []
    const categorySingle = vi.fn().mockResolvedValue({
      data: { id: 'cat-1' },
      error: null,
    })
    const categorySelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single: categorySingle }),
    })
    const evidenceInsert = vi.fn((row: Record<string, unknown>) => {
      evidenceInserted.push(row)
      return Promise.resolve({ error: null })
    })
    const contactUpdateIn = vi.fn().mockResolvedValue({ error: null })
    const contactUpdateEq = vi.fn().mockReturnValue({ in: contactUpdateIn })
    const contactUpdate = vi.fn().mockReturnValue({ eq: contactUpdateEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'pain_point_categories') {
        return { select: categorySelect }
      }
      if (table === 'pain_point_evidence') {
        return { insert: evidenceInsert }
      }
      if (table === 'contact_submissions') {
        return { update: contactUpdate }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        is_test_data: true,
        evidence: [
          {
            pain_point_category_name: 'manual_processes',
            source_type: 'meeting',
            source_id: 'm-1',
            source_excerpt: 'Staff spend hours on spreadsheets.',
            confidence_score: 0.9,
            contact_submission_id: 55,
            extracted_by: 'n8n',
          },
        ],
      }),
    )

    expect(evidenceInserted).toHaveLength(1)
    expect(evidenceInserted[0]).toMatchObject({
      pain_point_category_id: 'cat-1',
      source_type: 'meeting',
      source_id: 'm-1',
      source_excerpt: 'Staff spend hours on spreadsheets.',
      confidence_score: 0.9,
      extracted_by: 'n8n',
      contact_submission_id: 55,
      is_test_data: true,
    })
    expect(mocks.refreshCategoryStats).toHaveBeenCalledWith(expect.anything(), 'cat-1')
    expect(mocks.linkEvidenceToCalculations).toHaveBeenCalledWith('cat-1')
    expect(contactUpdate).toHaveBeenCalledWith({ last_vep_status: 'success' })
    expect(contactUpdateEq).toHaveBeenCalledWith('last_vep_status', 'pending')
    expect(contactUpdateIn).toHaveBeenCalledWith('id', [55])

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      total: 1,
      inserted: 1,
      categoriesCreated: 0,
      errors: [],
      calculationsUpdated: 1,
    })
  })

  it('creates a missing category then inserts evidence', async () => {
    const missingCategory = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const createdCategory = vi.fn().mockResolvedValue({
      data: { id: 'cat-new' },
      error: null,
    })
    const categoryInsertSelect = vi.fn().mockReturnValue({ single: createdCategory })
    const categoryInsert = vi.fn().mockReturnValue({ select: categoryInsertSelect })
    const industryTagsSingle = vi.fn().mockResolvedValue({
      data: { industry_tags: [] },
      error: null,
    })
    const categoryUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const categoryUpdate = vi.fn().mockReturnValue({ eq: categoryUpdateEq })
    let categorySelectCalls = 0
    const categorySelect = vi.fn().mockImplementation(() => {
      categorySelectCalls += 1
      if (categorySelectCalls === 1) {
        return { eq: vi.fn().mockReturnValue({ single: missingCategory }) }
      }
      return { eq: vi.fn().mockReturnValue({ single: industryTagsSingle }) }
    })
    const evidenceInsert = vi.fn().mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'pain_point_categories') {
        return {
          select: categorySelect,
          insert: categoryInsert,
          update: categoryUpdate,
        }
      }
      if (table === 'pain_point_evidence') {
        return { insert: evidenceInsert }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        evidence: [
          {
            pain_point_category_name: 'new_pain',
            pain_point_display_name: 'New Pain',
            source_type: 'linkedin',
            source_id: 'post-1',
            source_excerpt: 'Hiring is slow.',
            industry: 'healthcare',
          },
        ],
      }),
    )

    expect(categoryInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'new_pain',
        display_name: 'New Pain',
        industry_tags: ['healthcare'],
      }),
    )
    expect(evidenceInsert).toHaveBeenCalled()
    expect(categoryUpdate).toHaveBeenCalledWith({ industry_tags: ['healthcare'] })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      total: 1,
      inserted: 1,
      categoriesCreated: 1,
      calculationsUpdated: 1,
    })
  })
})
