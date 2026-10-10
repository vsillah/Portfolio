import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  listChangedScripts: vi.fn(),
  fetchScriptChange: vi.fn(),
  startVideoGenRun: vi.fn(),
  completeVideoGenRun: vi.fn(),
  syncSingle: vi.fn(),
  syncUpsert: vi.fn(),
  queueInsert: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/google-drive', () => ({
  listChangedScripts: mocks.listChangedScripts,
  fetchScriptChange: mocks.fetchScriptChange,
}))

vi.mock('@/lib/video-generation-workflow-runs', () => ({
  startVideoGenRun: mocks.startVideoGenRun,
  completeVideoGenRun: mocks.completeVideoGenRun,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const FROZEN_NOW = '2026-09-23T10:00:00.000Z'
const YEAR_AGO = '2025-09-23T10:00:00.000Z'

function request(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/video-generation/sync-drive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? 'not-json' : JSON.stringify(body),
  })
}

function wireSupabase() {
  mocks.syncUpsert.mockResolvedValue({ error: null })
  mocks.queueInsert.mockResolvedValue({ error: null })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'drive_sync_state') {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mocks.syncSingle })) })),
        upsert: mocks.syncUpsert,
      }
    }
    if (table === 'drive_video_queue') return { insert: mocks.queueInsert }
    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('POST /api/admin/video-generation/sync-drive', () => {
  const originalFolder = process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FROZEN_NOW))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID = 'folder-1'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startVideoGenRun.mockResolvedValue({ id: 'run-1', agentRunId: 'agent-1' })
    mocks.completeVideoGenRun.mockResolvedValue(undefined)
    wireSupabase()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalFolder === undefined) delete process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID
    else process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID = originalFolder
  })

  it('requires admin auth before reading Drive configuration', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    delete process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID

    const response = await POST(request({}))

    expect(response.status).toBe(401)
    expect(mocks.startVideoGenRun).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stops when the scripts folder id is not configured', async () => {
    delete process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID

    const response = await POST(request({}))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'GOOGLE_DRIVE_SCRIPTS_FOLDER_ID is not configured' })
    expect(mocks.startVideoGenRun).not.toHaveBeenCalled()
  })

  it('treats invalid JSON and a string force flag as a non-forced sync from the stored cursor', async () => {
    mocks.syncSingle.mockResolvedValue({ data: { last_modified: '2026-09-01T00:00:00.000Z' }, error: null })
    mocks.listChangedScripts.mockResolvedValue([])

    const invalid = await POST(request())
    expect(invalid.status).toBe(200)
    expect(mocks.listChangedScripts).toHaveBeenCalledWith('folder-1', '2026-09-01T00:00:00.000Z')

    mocks.listChangedScripts.mockClear()
    const stringForce = await POST(request({ force: 'true' }))
    expect(stringForce.status).toBe(200)
    expect(mocks.listChangedScripts).toHaveBeenLastCalledWith('folder-1', '2026-09-01T00:00:00.000Z')
  })

  it('looks back one year on a forced sync and records an empty queue', async () => {
    mocks.syncSingle.mockResolvedValue({ data: { last_modified: '2026-09-01T00:00:00.000Z' }, error: null })
    mocks.listChangedScripts.mockResolvedValue([])

    const response = await POST(request({ force: true }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.startVideoGenRun).toHaveBeenCalledWith('vgen_drive')
    expect(mocks.listChangedScripts).toHaveBeenCalledWith('folder-1', YEAR_AGO)
    expect(mocks.syncUpsert).toHaveBeenCalledWith(
      {
        folder_id: 'folder-1',
        last_modified: FROZEN_NOW,
        last_sync_at: FROZEN_NOW,
      },
      { onConflict: 'folder_id' },
    )
    expect(mocks.queueInsert).not.toHaveBeenCalled()
    expect(mocks.completeVideoGenRun).toHaveBeenCalledWith('run-1', {
      success: true,
      itemsInserted: 0,
      errorMessage: null,
    })
    expect(body).toEqual({
      ok: true,
      queued: 0,
      message: 'No script files found. Supported: Google Docs, .txt, .md',
      run_id: 'run-1',
      agent_run_id: 'agent-1',
    })
  })

  it('queues fetched scripts, skips a failed file, and advances the cursor to the newest effective time', async () => {
    mocks.syncSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    mocks.listChangedScripts.mockResolvedValue([
      { id: 'file-old', name: 'old.md', modifiedTime: YEAR_AGO },
      { id: 'file-bad', name: 'bad.txt', modifiedTime: FROZEN_NOW },
      { id: 'file-new', name: 'new.md', modifiedTime: FROZEN_NOW },
    ])
    mocks.fetchScriptChange.mockImplementation(async (file: { id: string; name: string }) => {
      if (file.id === 'file-bad') throw new Error('export failed')
      return {
        driveFileId: file.id,
        driveFileName: file.name,
        scriptTextPrior: null,
        scriptText: `script ${file.name}`,
        effectiveAt: file.id === 'file-new' ? '2026-09-20T00:00:00.000Z' : '2025-01-01T00:00:00.000Z',
      }
    })

    const response = await POST(request({}))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.listChangedScripts).toHaveBeenCalledWith('folder-1', YEAR_AGO)
    expect(mocks.queueInsert).toHaveBeenCalledWith([
      {
        drive_file_id: 'file-old',
        drive_file_name: 'old.md',
        script_text_prior: null,
        script_text: 'script old.md',
        effective_at: '2025-01-01T00:00:00.000Z',
        status: 'pending',
      },
      {
        drive_file_id: 'file-new',
        drive_file_name: 'new.md',
        script_text_prior: null,
        script_text: 'script new.md',
        effective_at: '2026-09-20T00:00:00.000Z',
        status: 'pending',
      },
    ])
    expect(mocks.syncUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ last_modified: '2026-09-20T00:00:00.000Z' }),
      { onConflict: 'folder_id' },
    )
    expect(body).toMatchObject({
      ok: true,
      queued: 2,
      files: ['old.md', 'new.md'],
      run_id: 'run-1',
      agent_run_id: 'agent-1',
    })
  })

  it('hides the insert error from the response and marks the workflow run failed', async () => {
    mocks.syncSingle.mockResolvedValue({ data: { last_modified: '2026-09-01T00:00:00.000Z' }, error: null })
    mocks.listChangedScripts.mockResolvedValue([{ id: 'file-1', name: 'script.md', modifiedTime: FROZEN_NOW }])
    mocks.fetchScriptChange.mockResolvedValue({
      driveFileId: 'file-1',
      driveFileName: 'script.md',
      scriptTextPrior: 'old',
      scriptText: 'new',
      effectiveAt: FROZEN_NOW,
    })
    mocks.queueInsert.mockResolvedValue({ error: { message: 'duplicate key value' } })

    const response = await POST(request({}))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Failed to insert queue items',
      run_id: 'run-1',
      agent_run_id: 'agent-1',
    })
    expect(mocks.completeVideoGenRun).toHaveBeenCalledWith('run-1', {
      success: false,
      itemsInserted: 0,
      errorMessage: 'duplicate key value',
    })
    expect(mocks.syncUpsert).not.toHaveBeenCalled()
  })

  it('returns the thrown message when Drive listing fails and still closes a missing run id', async () => {
    mocks.startVideoGenRun.mockResolvedValue(null)
    mocks.syncSingle.mockResolvedValue({ data: null, error: null })
    mocks.listChangedScripts.mockRejectedValue('drive down')

    const response = await POST(request({}))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'drive down',
      run_id: null,
      agent_run_id: null,
    })
    expect(mocks.completeVideoGenRun).not.toHaveBeenCalled()
  })
})
