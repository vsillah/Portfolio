import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  generateAccelerationRecs: vi.fn(),
  extractCategoryScores: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/acceleration-engine', () => ({
  generateAccelerationRecs: mocks.generateAccelerationRecs,
}))

vi.mock('@/lib/assessment-scoring', () => ({
  extractCategoryScores: mocks.extractCategoryScores,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }
const SECRET = 'ingest-secret'

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { authorization: `Bearer ${SECRET}` },
) {
  return new NextRequest('http://localhost/api/webhooks/n8n/generate-acceleration-recs', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/webhooks/n8n/generate-acceleration-recs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = SECRET
  })

  afterEach(() => {
    restoreEnv()
  })

  it('returns 401 without a valid ingest bearer token', async () => {
    const response = await POST(makeRequest({ client_project_id: 'p1' }, {}))
    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when client_project_id is missing', async () => {
    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'client_project_id is required',
    })
  })

  it('returns 400 when no snapshot or completed audit scores exist', async () => {
    const snapshotSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const projectSingle = vi.fn().mockResolvedValue({
      data: { contact_submission_id: null },
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'score_snapshots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ single: snapshotSingle }),
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: projectSingle }),
        }),
      }
    })

    const response = await POST(makeRequest({ client_project_id: 'proj-1' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'No score data available for this project',
    })
    expect(mocks.generateAccelerationRecs).not.toHaveBeenCalled()
  })

  it('uses snapshot category scores when present', async () => {
    const scores = { operations: 40, marketing: 20 }
    const snapshotSingle = vi.fn().mockResolvedValue({
      data: { category_scores: scores },
      error: null,
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ single: snapshotSingle }),
          }),
        }),
      }),
    })
    mocks.generateAccelerationRecs.mockResolvedValue({ count: 3, error: null })

    const response = await POST(makeRequest({ client_project_id: 'proj-1' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      recommendations_created: 3,
    })
    expect(mocks.generateAccelerationRecs).toHaveBeenCalledWith('proj-1', scores)
    expect(mocks.extractCategoryScores).not.toHaveBeenCalled()
  })

  it('falls back to a completed diagnostic audit when snapshots are empty', async () => {
    const snapshotSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const projectSingle = vi.fn().mockResolvedValue({
      data: { contact_submission_id: 88 },
      error: null,
    })
    const audit = { id: 'audit-1', status: 'completed' }
    const maybeSingle = vi.fn().mockResolvedValue({ data: audit, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'score_snapshots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ single: snapshotSingle }),
              }),
            }),
          }),
        }
      }
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: projectSingle }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ maybeSingle }),
              }),
            }),
          }),
        }),
      }
    })
    mocks.extractCategoryScores.mockReturnValue({ operations: 12 })
    mocks.generateAccelerationRecs.mockResolvedValue({ count: 1, error: null })

    const response = await POST(makeRequest({ client_project_id: 'proj-1' }))

    expect(response.status).toBe(200)
    expect(mocks.extractCategoryScores).toHaveBeenCalledWith(audit)
    expect(mocks.generateAccelerationRecs).toHaveBeenCalledWith('proj-1', {
      operations: 12,
    })
    expect(await response.json()).toEqual({
      success: true,
      recommendations_created: 1,
    })
  })
})
