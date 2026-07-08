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

const contactUpdateChain = {
  in: vi.fn(),
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
    contactUpdateChain.in.mockReset()
    contactUpdateChain.eq.mockReset()

    selectChain.eq.mockImplementation(() => selectChain)
    selectChain.order.mockImplementation(() => selectChain)
    selectChain.limit.mockImplementation(() => selectChain)
    insertChain.select.mockImplementation(() => insertChain)
    updateChain.eq.mockResolvedValue({ error: null })
    contactUpdateChain.in.mockImplementation(() => contactUpdateChain)
    contactUpdateChain.eq.mockResolvedValue({ error: null })
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
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      run_id: 'running-vep001',
      agent_run_id: null,
      chained_social: false,
    })
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
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      run_id: 'created-vep-run',
      agent_run_id: null,
      chained_social: false,
    })
  })

  it('flips pending contact submissions to success when VEP-001 completes with contact ids', async () => {
    requestJsonMock.mockResolvedValue({
      workflow_id: 'WF-VEP-001',
      status: 'success',
      items_inserted: 0,
      contact_submission_ids: [42, '43', 0, 'not-a-number', null],
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    const contactTable = {
      update: vi.fn(() => contactUpdateChain),
    }
    fromMock.mockImplementation((table: string) => (table === 'contact_submissions' ? contactTable : runTable))

    selectChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'running-vep001',
        stages: null,
        scope_type: null,
        scope_id: null,
        scope_label: null,
      },
    })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(runTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        items_inserted: 0,
      })
    )
    expect(contactTable.update).toHaveBeenCalledWith({ last_vep_status: 'success' })
    expect(contactUpdateChain.in).toHaveBeenCalledWith('id', [42, 43])
    expect(contactUpdateChain.eq).toHaveBeenCalledWith('last_vep_status', 'pending')
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      run_id: 'running-vep001',
      agent_run_id: null,
      chained_social: false,
    })
  })

  it('flips pending contact submissions to failed when VEP-001 reports failure', async () => {
    requestJsonMock.mockResolvedValue({
      workflow_id: 'vep001',
      status: 'failed',
      error_message: 'n8n failed',
      contact_submission_ids: ['99'],
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    const contactTable = {
      update: vi.fn(() => contactUpdateChain),
    }
    fromMock.mockImplementation((table: string) => (table === 'contact_submissions' ? contactTable : runTable))

    selectChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'running-vep001',
        stages: null,
        scope_type: null,
        scope_id: null,
        scope_label: null,
      },
    })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(runTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_message: 'n8n failed',
      })
    )
    expect(contactTable.update).toHaveBeenCalledWith({ last_vep_status: 'failed' })
    expect(contactUpdateChain.in).toHaveBeenCalledWith('id', [99])
    expect(contactUpdateChain.eq).toHaveBeenCalledWith('last_vep_status', 'pending')
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      run_id: 'running-vep001',
      agent_run_id: null,
      chained_social: false,
    })
  })

  it('leaves contact submissions pending while VEP-001 auto-chains to social listening', async () => {
    requestJsonMock.mockResolvedValue({
      workflow_id: 'vep001',
      status: 'success',
      items_inserted: 4,
      contact_submission_ids: [77],
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    const contactTable = {
      update: vi.fn(() => contactUpdateChain),
    }
    fromMock.mockImplementation((table: string) => (table === 'contact_submissions' ? contactTable : runTable))

    selectChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'running-vep001',
        stages: { scope: { socialPending: true } },
        scope_type: null,
        scope_id: null,
        scope_label: null,
      },
    })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(runTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: 'vep002',
        status: 'running',
        completed_at: null,
        stages: {
          scope: {
            socialPending: false,
            socialTriggered: true,
          },
        },
      })
    )
    expect(contactTable.update).not.toHaveBeenCalled()
    expect(contactUpdateChain.in).not.toHaveBeenCalled()
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      run_id: 'running-vep001',
      agent_run_id: null,
      chained_social: true,
    })
  })

  it('materializes a supplied UUID run_id so repeated callbacks reuse one row', async () => {
    const suppliedRunId = '25c30da4-7b69-42d4-9237-8187d691e2ac'
    requestJsonMock.mockResolvedValue({
      run_id: suppliedRunId,
      workflow_id: 'WF-VEP-002',
      status: 'success',
      items_inserted: 0,
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    fromMock.mockReturnValue(runTable)

    selectChain.maybeSingle.mockResolvedValueOnce({ data: null })
    insertChain.single.mockResolvedValueOnce({
      data: {
        id: suppliedRunId,
        stages: null,
        scope_type: null,
        scope_id: null,
        scope_label: null,
      },
      error: null,
    })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(selectChain.eq).toHaveBeenCalledWith('id', suppliedRunId)
    expect(runTable.insert).toHaveBeenCalledWith({
      id: suppliedRunId,
      workflow_id: 'vep002',
      status: 'running',
    })
    expect(updateChain.eq).toHaveBeenCalledWith('id', suppliedRunId)
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      run_id: suppliedRunId,
      agent_run_id: null,
      chained_social: false,
    })
  })

  it('reselects supplied UUID run_id when concurrent callback already created it', async () => {
    const suppliedRunId = '25c30da4-7b69-42d4-9237-8187d691e2ac'
    requestJsonMock.mockResolvedValue({
      run_id: suppliedRunId,
      workflow_id: 'vep002',
      status: 'success',
    })

    const runTable = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    }
    fromMock.mockReturnValue(runTable)

    selectChain.maybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({
        data: {
          id: suppliedRunId,
          stages: null,
          scope_type: null,
          scope_id: null,
          scope_label: null,
        },
      })
    insertChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "value_evidence_workflow_runs_pkey"' },
    })

    const { POST } = await import('./route')
    const request = {
      headers: { get: vi.fn().mockReturnValue('Bearer secret-token') },
      json: requestJsonMock,
    } as unknown as Request

    await POST(request as never)

    expect(runTable.insert).toHaveBeenCalledWith({
      id: suppliedRunId,
      workflow_id: 'vep002',
      status: 'running',
    })
    expect(updateChain.eq).toHaveBeenCalledWith('id', suppliedRunId)
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      run_id: suppliedRunId,
      agent_run_id: null,
      chained_social: false,
    })
  })
})
