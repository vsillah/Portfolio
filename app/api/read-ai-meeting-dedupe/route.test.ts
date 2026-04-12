import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const limitMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const eqMock = vi.fn(() => ({ limit: limitMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))

  return {
    maybeSingleMock,
    limitMock,
    eqMock,
    selectMock,
    fromMock,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.fromMock,
  },
}))

import { GET } from './route'

function makeRequest(readAiMeetingId?: string, token?: string) {
  const url = new URL('https://example.com/api/read-ai-meeting-dedupe')
  if (readAiMeetingId !== undefined) {
    url.searchParams.set('read_ai_meeting_id', readAiMeetingId)
  }

  const headers = token ? { authorization: `Bearer ${token}` } : undefined
  return new NextRequest(url, { headers })
}

describe('GET /api/read-ai-meeting-dedupe', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.N8N_INGEST_SECRET = 'test-secret'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('returns 401 when bearer token is missing', async () => {
    const response = await GET(makeRequest('meeting-123'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })

  it('returns non-duplicate when id query is empty', async () => {
    const response = await GET(makeRequest(undefined, 'test-secret'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      duplicate: false,
      meeting_record_id: null,
    })
    expect(mocks.fromMock).not.toHaveBeenCalled()
  })

  it('returns duplicate=true and record id when found', async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: { id: 'record-1' },
      error: null,
    })

    const response = await GET(makeRequest('  read-ai-42  ', 'test-secret'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      duplicate: true,
      meeting_record_id: 'record-1',
    })

    expect(mocks.fromMock).toHaveBeenCalledWith('meeting_records')
    expect(mocks.selectMock).toHaveBeenCalledWith('id')
    expect(mocks.eqMock).toHaveBeenCalledWith('read_ai_meeting_id', 'read-ai-42')
    expect(mocks.limitMock).toHaveBeenCalledWith(1)
  })

  it('returns duplicate=false when no matching row exists', async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    const response = await GET(makeRequest('read-ai-miss', 'test-secret'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      duplicate: false,
      meeting_record_id: null,
    })
  })

  it('fails open with duplicate=false when db query errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    })

    const response = await GET(makeRequest('read-ai-err', 'test-secret'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      duplicate: false,
      meeting_record_id: null,
    })
    expect(errorSpy).toHaveBeenCalled()
  })
})
