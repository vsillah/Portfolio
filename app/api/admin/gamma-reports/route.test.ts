import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  buildGammaReportInput: vi.fn(),
  insertGammaReportRow: vi.fn(),
  runGammaGeneration: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/gamma-report-builder', () => ({
  buildGammaReportInput: mocks.buildGammaReportInput,
}))

vi.mock('@/lib/gamma-generation', () => ({
  insertGammaReportRow: mocks.insertGammaReportRow,
  runGammaGeneration: mocks.runGammaGeneration,
}))

import { GET, POST } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/gamma-reports${query}`)
}

function postRequest(body?: unknown, raw?: string) {
  return new NextRequest('http://localhost/api/admin/gamma-reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(raw !== undefined ? { body: raw } : {}),
  })
}

function chain(result: { data?: unknown; error?: unknown } = {}) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = vi.fn(self)
  query.eq = vi.fn(self)
  query.in = vi.fn(self)
  query.is = vi.fn(self)
  query.order = vi.fn(self)
  query.limit = vi.fn(self)
  query.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ data: result.data ?? [], error: result.error ?? null }).then(
      onFulfilled,
      onRejected,
    )
  return query as typeof query & {
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
  }
}

describe('/api/admin/gamma-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated list and create requests', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const list = await GET(request())
    const create = await POST(postRequest({ reportType: 'audit_summary' }))

    expect(list.status).toBe(401)
    expect(create.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.buildGammaReportInput).not.toHaveBeenCalled()
  })

  it('forwards status=all to an equality filter and skips omitted dimensions', async () => {
    const reports = chain({ data: [] })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'gamma_reports') throw new Error(`Unexpected table: ${table}`)
      return reports
    })

    await GET(request('?status=all&limit=10'))
    expect(reports.eq).toHaveBeenCalledWith('status', 'all')
    expect(reports.limit).toHaveBeenCalledWith(10)

    const unrestricted = chain({ data: [] })
    mocks.from.mockImplementation(() => unrestricted)
    await GET(request())
    expect(unrestricted.eq).not.toHaveBeenCalled()
    expect(unrestricted.limit).toHaveBeenCalledWith(50)
  })

  it('prefers the newest completed companion video with a usable URL', async () => {
    const reports = chain({
      data: [{ id: 'rep-1', title: 'Audit' }],
    })
    const jobs = chain({
      data: [
        {
          id: 'job-new',
          gamma_report_id: 'rep-1',
          heygen_status: 'processing',
          video_share_url: 'https://share.example/new',
          video_url: 'https://cdn.example/new.mp4',
          created_at: '2026-09-12T12:00:00Z',
        },
        {
          id: 'job-done',
          gamma_report_id: 'rep-1',
          heygen_status: 'completed',
          video_share_url: ' https://share.example/done ',
          video_url: 'https://cdn.example/done.mp4',
          created_at: '2026-09-11T12:00:00Z',
        },
      ],
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'gamma_reports') return reports
      if (table === 'video_generation_jobs') return jobs
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(jobs.in).toHaveBeenCalledWith('gamma_report_id', ['rep-1'])
    expect(jobs.is).toHaveBeenCalledWith('deleted_at', null)
    expect(body.reports[0].companion_video).toEqual({
      job_id: 'job-done',
      heygen_status: 'completed',
      watch_url: 'https://share.example/done',
    })
  })

  it('returns a completed job without a watch URL when no playable URL exists', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'gamma_reports') return chain({ data: [{ id: 'rep-2' }] })
      if (table === 'video_generation_jobs') {
        return chain({
          data: [
            {
              id: 'job-empty',
              gamma_report_id: 'rep-2',
              heygen_status: 'completed',
              video_share_url: '   ',
              video_url: null,
              created_at: '2026-09-12T00:00:00Z',
            },
          ],
        })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request())
    const body = await response.json()

    expect(body.reports[0].companion_video).toEqual({
      job_id: 'job-empty',
      heygen_status: 'completed',
      watch_url: null,
    })
  })

  it('validates create payloads before calling Gamma', async () => {
    const invalidJson = await POST(postRequest(undefined, '{not-json'))
    expect(invalidJson.status).toBe(400)
    await expect(invalidJson.json()).resolves.toEqual({ error: 'Invalid JSON body' })

    const missingType = await POST(postRequest({}))
    expect(missingType.status).toBe(400)
    await expect(missingType.json()).resolves.toEqual({ error: 'reportType is required' })

    const badType = await POST(postRequest({ reportType: 'slide_deck' }))
    expect(badType.status).toBe(400)
    await expect(badType.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid reportType'),
    })

    const offer = await POST(postRequest({ reportType: 'offer_presentation' }))
    expect(offer.status).toBe(400)
    await expect(offer.json()).resolves.toEqual({
      error: 'offer_presentation requires either bundleId or pricingTierId',
    })

    const calendly = await POST(
      postRequest({ reportType: 'audit_summary', calendlyEventKey: 'not-a-meeting' }),
    )
    expect(calendly.status).toBe(400)
    await expect(calendly.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid calendlyEventKey'),
    })

    expect(mocks.buildGammaReportInput).not.toHaveBeenCalled()
  })

  it('returns 409 when a matching report is already generating', async () => {
    mocks.buildGammaReportInput.mockResolvedValue({
      inputText: 'body',
      options: {},
      title: 'Audit',
      citationsMeta: null,
      feasibilityAssessment: null,
    })
    mocks.insertGammaReportRow.mockResolvedValue(null)

    const response = await POST(postRequest({ reportType: 'audit_summary' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'A report is already being generated for this input',
    })
    expect(mocks.runGammaGeneration).not.toHaveBeenCalled()
  })
})
