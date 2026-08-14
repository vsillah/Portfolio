import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listChangedScripts: vi.fn(),
  fetchScriptChange: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/google-drive', () => ({
  listChangedScripts: mocks.listChangedScripts,
  fetchScriptChange: mocks.fetchScriptChange,
}))

import { POST } from './route'

function request(token?: string) {
  return new NextRequest('http://localhost/api/cron/drive-sync', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })
}

function installDb(options?: {
  lastModified?: string | null
  insertError?: { message: string } | null
}) {
  const single = vi.fn().mockResolvedValue({
    data: options?.lastModified ? { last_modified: options.lastModified } : null,
    error: null,
  })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const insert = vi.fn().mockResolvedValue({ data: null, error: options?.insertError ?? null })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'drive_sync_state') return { select, upsert }
    if (table === 'drive_video_queue') return { insert }
    throw new Error(`Unexpected table ${table}`)
  })

  return { upsert, insert, eq }
}

describe('POST /api/cron/drive-sync', () => {
  const originalSecret = process.env.N8N_INGEST_SECRET
  const originalFolder = process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.N8N_INGEST_SECRET = 'cron-secret'
    process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID = 'folder-1'
  })

  afterEach(() => {
    process.env.N8N_INGEST_SECRET = originalSecret
    process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID = originalFolder
  })

  it('rejects unauthenticated requests before touching Drive or the queue', async () => {
    const response = await POST(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.listChangedScripts).not.toHaveBeenCalled()
  })

  it('rejects requests when the ingest secret is unset', async () => {
    delete process.env.N8N_INGEST_SECRET

    const response = await POST(request('cron-secret') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.listChangedScripts).not.toHaveBeenCalled()
  })

  it('fails closed when the scripts folder is not configured', async () => {
    delete process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID

    const response = await POST(request('cron-secret') as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'GOOGLE_DRIVE_SCRIPTS_FOLDER_ID is not configured',
    })
    expect(mocks.listChangedScripts).not.toHaveBeenCalled()
  })

  it('advances sync state and returns queued 0 when Drive has no changes', async () => {
    const { upsert, insert } = installDb({ lastModified: '2026-08-01T00:00:00.000Z' })
    mocks.listChangedScripts.mockResolvedValue([])

    const response = await POST(request('cron-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      queued: 0,
      message: 'No changes',
    })
    expect(mocks.listChangedScripts).toHaveBeenCalledWith('folder-1', '2026-08-01T00:00:00.000Z')
    expect(insert).not.toHaveBeenCalled()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ folder_id: 'folder-1' }),
      { onConflict: 'folder_id' },
    )
  })

  it('queues changed scripts and skips files that fail to fetch', async () => {
    const { upsert, insert } = installDb({ lastModified: '2026-08-01T00:00:00.000Z' })
    mocks.listChangedScripts.mockResolvedValue([
      { id: 'file-1', name: 'script-a.md', modifiedTime: '2026-08-02T00:00:00.000Z' },
      { id: 'file-2', name: 'script-b.md', modifiedTime: '2026-08-03T00:00:00.000Z' },
    ])
    mocks.fetchScriptChange
      .mockResolvedValueOnce({
        driveFileId: 'file-1',
        driveFileName: 'script-a.md',
        scriptTextPrior: 'old',
        scriptText: 'new',
        effectiveAt: '2026-08-02T12:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('export failed'))

    const response = await POST(request('cron-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      queued: 1,
      files: ['script-a.md'],
    })
    expect(insert).toHaveBeenCalledWith([{
      drive_file_id: 'file-1',
      drive_file_name: 'script-a.md',
      script_text_prior: 'old',
      script_text: 'new',
      effective_at: '2026-08-02T12:00:00.000Z',
      status: 'pending',
    }])
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        folder_id: 'folder-1',
        last_modified: '2026-08-02T12:00:00.000Z',
      }),
      { onConflict: 'folder_id' },
    )
  })

  it('returns 500 when queue insert fails', async () => {
    installDb({
      lastModified: '2026-08-01T00:00:00.000Z',
      insertError: { message: 'insert failed' },
    })
    mocks.listChangedScripts.mockResolvedValue([
      { id: 'file-1', name: 'script-a.md', modifiedTime: '2026-08-02T00:00:00.000Z' },
    ])
    mocks.fetchScriptChange.mockResolvedValue({
      driveFileId: 'file-1',
      driveFileName: 'script-a.md',
      scriptTextPrior: null,
      scriptText: 'new',
      effectiveAt: '2026-08-02T12:00:00.000Z',
    })

    const response = await POST(request('cron-secret') as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to insert queue items' })
  })
})
