import { beforeEach, describe, expect, it, vi } from 'vitest'

const jsonMock = vi.fn((body: unknown, init?: { status?: number }) => ({
  body,
  status: init?.status ?? 200,
}))

const requestJsonMock = vi.fn()
const fromMock = vi.fn()

const selectChain = {
  eq: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
}

const insertChain = {
  select: vi.fn(),
  single: vi.fn(),
}

const updateChain = {
  eq: vi.fn(),
}

vi.mock('next/server', () => ({
  NextResponse: {
    json: jsonMock,
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}))

describe('POST /api/admin/social-content/workflow-complete', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv, N8N_INGEST_SECRET: 'secret-token' }

    requestJsonMock.mockReset()
    fromMock.mockReset()
    jsonMock.mockClear()

    selectChain.eq.mockReset()
    selectChain.single.mockReset()
    selectChain.order.mockReset()
    selectChain.limit.mockReset()
    selectChain.maybeSingle.mockReset()

    insertChain.select.mockReset()
    insertChain.single.mockReset()

    updateChain.eq.mockReset()

    // from(...).select(...).eq(...).single()
    selectChain.eq.mockImplementation(() => selectChain)
    selectChain.order.mockImplementation(() => selectChain)
    selectChain.limit.mockImplementation(() => selectChain)
    insertChain.select.mockImplementation(() => insertChain)
    updateChain.eq.mockResolvedValue({ error: null })
  })

  it('returns 401 when auth token is missing/invalid', async () => {
    const { POST } = await import('./route')

    const request = {
      headers: { get: vi.fn().mockReturnValue(null) },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('creates a run row when no matching run exists and updates it', async () => {
    requestJsonMock.mockResolvedValue({
      status: 'failed',
      items_inserted: 4,
      error_message: 'timeout',
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    fromMock.mockReturnValue(runTable)

    // No explicit run_id lookup is done in this request.
    selectChain.maybeSingle.mockResolvedValueOnce({ data: null })
    insertChain.single.mockResolvedValueOnce({ data: { id: 'created-run-id' } })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(runTable.insert).toHaveBeenCalledWith({ status: 'running' })
    expect(runTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        completed_at: expect.any(String),
        items_inserted: 4,
        error_message: 'timeout',
      })
    )
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'created-run-id')
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, run_id: 'created-run-id' })
  })

  it('normalizes non-failed statuses to success', async () => {
    requestJsonMock.mockResolvedValue({
      status: 'unexpected-value',
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    fromMock.mockReturnValue(runTable)

    selectChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'running-id' } })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(runTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
      })
    )
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'running-id')
    expect(runTable.insert).not.toHaveBeenCalled()
  })
})
