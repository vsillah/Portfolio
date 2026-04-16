import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  fromMock,
  selectMock,
  eqMock,
  limitMock,
  maybeSingleMock,
} = vi.hoisted(() => {
  return {
    fromMock: vi.fn(),
    selectMock: vi.fn(),
    eqMock: vi.fn(),
    limitMock: vi.fn(),
    maybeSingleMock: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}))

import { GET } from './route'

describe('GET /api/read-ai-meeting-dedupe', () => {
  beforeEach(() => {
    process.env.N8N_INGEST_SECRET = 'test-ingest-secret'

    fromMock.mockReset()
    selectMock.mockReset()
    eqMock.mockReset()
    limitMock.mockReset()
    maybeSingleMock.mockReset()

    fromMock.mockReturnValue({ select: selectMock })
    selectMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ limit: limitMock })
    limitMock.mockReturnValue({ maybeSingle: maybeSingleMock })
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
  })

  it('returns 401 when bearer token is missing', async () => {
    const request = new NextRequest('http://localhost/api/read-ai-meeting-dedupe')

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns duplicate=false without querying db when id is blank', async () => {
    const request = new NextRequest('http://localhost/api/read-ai-meeting-dedupe?read_ai_meeting_id=%20%20', {
      headers: { authorization: 'Bearer test-ingest-secret' },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ duplicate: false, meeting_record_id: null })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns duplicate=true when matching meeting record exists', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: 'meeting-123' }, error: null })

    const request = new NextRequest('http://localhost/api/read-ai-meeting-dedupe?read_ai_meeting_id=%20abc-123%20', {
      headers: { authorization: 'Bearer test-ingest-secret' },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('meeting_records')
    expect(selectMock).toHaveBeenCalledWith('id')
    expect(eqMock).toHaveBeenCalledWith('read_ai_meeting_id', 'abc-123')
    expect(limitMock).toHaveBeenCalledWith(1)
    expect(body).toEqual({ duplicate: true, meeting_record_id: 'meeting-123' })
  })

  it('returns duplicate=false when no matching meeting record exists', async () => {
    const request = new NextRequest('http://localhost/api/read-ai-meeting-dedupe?read_ai_meeting_id=abc-123', {
      headers: { authorization: 'Bearer test-ingest-secret' },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ duplicate: false, meeting_record_id: null })
  })

  it('falls back to duplicate=false when database query errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const request = new NextRequest('http://localhost/api/read-ai-meeting-dedupe?read_ai_meeting_id=abc-123', {
      headers: { authorization: 'Bearer test-ingest-secret' },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ duplicate: false, meeting_record_id: null })
    expect(consoleSpy).toHaveBeenCalled()
  })
})
