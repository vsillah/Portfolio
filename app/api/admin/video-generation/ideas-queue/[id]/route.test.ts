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

import { PATCH } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/ideas-queue/draft-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockQueueFetch(row: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, single }
}

function mockQueueUpdate(row: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  const select = vi.fn(() => ({ single }))
  const eq = vi.fn(() => ({ select }))
  const update = vi.fn(() => ({ eq }))
  return { update, eq, select, single }
}

describe('PATCH /api/admin/video-generation/ideas-queue/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(
      makeRequest({ title: 'Draft', scriptText: 'Script', storyboardJson: { scenes: [] } }),
      { params: { id: 'draft-1' } }
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates a pending draft and sanitizes storyboard scenes', async () => {
    const fetchBuilder = mockQueueFetch({
      id: 'draft-1',
      status: 'pending',
      video_generation_job_id: null,
    })
    const updateBuilder = mockQueueUpdate({
      id: 'draft-1',
      title: 'The Receipt Every Agent Needs',
      script_text: 'The first thing I built around agents was the receipt.',
      storyboard_json: { scenes: [{ sceneNumber: 1, description: 'Opening', brollHint: 'home' }] },
      source: 'manual',
      status: 'pending',
      video_generation_job_id: null,
      custom_prompt: null,
      created_at: '2026-05-27T20:37:59.676529+00:00',
    })
    mocks.from
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder)

    const response = await PATCH(
      makeRequest({
        title: ' The Receipt Every Agent Needs ',
        scriptText: ' The first thing I built around agents was the receipt. ',
        storyboardJson: {
          scenes: [{ sceneNumber: 1, description: ' Opening ', brollHint: ' home ' }],
        },
      }),
      { params: { id: 'draft-1' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(updateBuilder.update).toHaveBeenCalledWith({
      title: 'The Receipt Every Agent Needs',
      script_text: 'The first thing I built around agents was the receipt.',
      storyboard_json: {
        scenes: [{ sceneNumber: 1, description: 'Opening', brollHint: 'home' }],
      },
    })
    expect(body.item.id).toBe('draft-1')
  })

  it('rejects generated or non-pending drafts', async () => {
    const fetchBuilder = mockQueueFetch({
      id: 'draft-1',
      status: 'generated',
      video_generation_job_id: 'job-1',
    })
    mocks.from.mockReturnValueOnce(fetchBuilder)

    const response = await PATCH(
      makeRequest({
        title: 'Draft',
        scriptText: 'Script',
        storyboardJson: { scenes: [{ description: 'Opening' }] },
      }),
      { params: { id: 'draft-1' } }
    )

    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('already generated')
  })

  it('rejects scripts over the HeyGen limit', async () => {
    const response = await PATCH(
      makeRequest({
        title: 'Draft',
        scriptText: 'x'.repeat(5001),
        storyboardJson: { scenes: [{ description: 'Opening' }] },
      }),
      { params: { id: 'draft-1' } }
    )

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
