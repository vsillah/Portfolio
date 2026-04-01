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

describe('POST /api/admin/value-evidence/workflow-complete', () => {
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

  it('returns 400 when workflow_id is missing', async () => {
    requestJsonMock.mockResolvedValue({ status: 'success' })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(jsonMock).toHaveBeenCalledWith({ error: 'workflow_id is required' }, { status: 400 })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('maps WF-VEP-001 to vep001 and updates existing running row', async () => {
    requestJsonMock.mockResolvedValue({
      workflow_id: 'WF-VEP-001',
      status: 'success',
      items_inserted: 8,
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    fromMock.mockReturnValue(runTable)

    selectChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'running-vep001' } })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(selectChain.eq).toHaveBeenCalledWith('workflow_id', 'vep001')
    expect(runTable.insert).not.toHaveBeenCalled()
    expect(runTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        completed_at: expect.any(String),
        updated_at: expect.any(String),
        items_inserted: 8,
      })
    )
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'running-vep001')
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, run_id: 'running-vep001' })
  })

  it('creates run row when no run is found and keeps normalized workflow id', async () => {
    requestJsonMock.mockResolvedValue({
      workflow_id: 'vep002',
      status: 'failed',
      error_message: 'upstream timeout',
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    fromMock.mockReturnValue(runTable)

    selectChain.maybeSingle.mockResolvedValueOnce({ data: null })
    insertChain.single.mockResolvedValueOnce({ data: { id: 'created-vep-run' } })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(runTable.insert).toHaveBeenCalledWith({ workflow_id: 'vep002', status: 'running' })
    expect(runTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_message: 'upstream timeout',
      })
    )
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'created-vep-run')
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, run_id: 'created-vep-run' })
  })
})
