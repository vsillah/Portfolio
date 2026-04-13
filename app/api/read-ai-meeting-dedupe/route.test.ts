import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const limitMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const eqMock = vi.fn(() => ({ limit: limitMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))
  return { maybeSingleMock, limitMock, eqMock, selectMock, fromMock }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: supabaseMocks.fromMock,
  },
}))

import { GET } from './route'

function makeRequest(url: string, token?: string) {
  return {
    headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
    nextUrl: new URL(url),
  } as any
}

describe('GET /api/read-ai-meeting-dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'test-secret'
  })

  it('returns 401 when bearer token is missing or invalid', async () => {
    const response = await GET(makeRequest('https://example.com/api/read-ai-meeting-dedupe'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(supabaseMocks.fromMock).not.toHaveBeenCalled()
  })

  it('returns duplicate=false without querying when id is empty', async () => {
    const response = await GET(
      makeRequest(
        'https://example.com/api/read-ai-meeting-dedupe?read_ai_meeting_id=   ',
        'test-secret',
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ duplicate: false, meeting_record_id: null })
    expect(supabaseMocks.fromMock).not.toHaveBeenCalled()
  })

  it('trims read_ai_meeting_id and returns duplicate=true when a record exists', async () => {
    supabaseMocks.maybeSingleMock.mockResolvedValueOnce({
      data: { id: 'meeting-123' },
      error: null,
    })

    const response = await GET(
      makeRequest(
        'https://example.com/api/read-ai-meeting-dedupe?read_ai_meeting_id=%2001KNHYS5%20',
        'test-secret',
      ),
    )

    expect(supabaseMocks.fromMock).toHaveBeenCalledWith('meeting_records')
    expect(supabaseMocks.selectMock).toHaveBeenCalledWith('id')
    expect(supabaseMocks.eqMock).toHaveBeenCalledWith('read_ai_meeting_id', '01KNHYS5')
    expect(supabaseMocks.limitMock).toHaveBeenCalledWith(1)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      duplicate: true,
      meeting_record_id: 'meeting-123',
    })
  })

  it('returns safe non-duplicate response when Supabase returns an error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    supabaseMocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'db is down' },
    })

    const response = await GET(
      makeRequest(
        'https://example.com/api/read-ai-meeting-dedupe?read_ai_meeting_id=abc123',
        'test-secret',
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      duplicate: false,
      meeting_record_id: null,
    })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
