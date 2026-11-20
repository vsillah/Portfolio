import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const params = { params: { id: 'queue-1' } }

function request() {
  return new NextRequest('http://localhost/api/admin/video-generation/queue/queue-1/add-to-drafts', {
    method: 'POST',
  })
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.single.mockResolvedValue(result)
  return query
}

describe('POST /api/admin/video-generation/queue/[id]/add-to-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the drive queue item is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'not found' } }))

    const response = await POST(request(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Drive queue item not found' })
  })

  it('rejects items that are not pending', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: { id: 'queue-1', status: 'dismissed', script_text: 'hello', drive_file_name: 'Script' },
      error: null,
    }))

    const response = await POST(request(), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Drive queue item already dismissed' })
  })

  it('rejects pending items with blank script text', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: { id: 'queue-1', status: 'pending', script_text: '   ', drive_file_name: 'Script' },
      error: null,
    }))

    const response = await POST(request(), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Drive queue item has no script text' })
  })

  it('copies the script into video_ideas_queue and marks the drive item generated', async () => {
    const fetchQuery = thenableQuery({
      data: {
        id: 'queue-1',
        drive_file_id: 'file-1',
        drive_file_name: 'Q3 Script',
        script_text: '  Speak to operators.  ',
        status: 'pending',
      },
      error: null,
    })
    const insertQuery = thenableQuery({
      data: { id: 'draft-1', title: 'Q3 Script' },
      error: null,
    })
    const updateQuery = thenableQuery({ data: null, error: null })
    mocks.from
      .mockReturnValueOnce(fetchQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(updateQuery)

    const response = await POST(request(), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draftId: 'draft-1',
      title: 'Q3 Script',
      driveFileId: 'file-1',
    })
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'video_ideas_queue')
    expect(insertQuery.insert).toHaveBeenCalledWith({
      title: 'Q3 Script',
      script_text: 'Speak to operators.',
      storyboard_json: { scenes: [] },
      source: 'drive_script',
      status: 'pending',
      custom_prompt: null,
    })
    expect(updateQuery.update).toHaveBeenCalledWith({ status: 'generated' })
  })
})
