import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  updateDraft: vi.fn(),
  sendDraft: vi.fn(),
  deleteDraft: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/client-update-drafts', () => ({
  updateDraft: mocks.updateDraft,
  sendDraft: mocks.sendDraft,
  deleteDraft: mocks.deleteDraft,
}))

import { DELETE, GET, PATCH, POST } from './route'

function params(id = 'draft-1') {
  return { params: Promise.resolve({ id }) }
}

function jsonRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/client-update-drafts/draft-1', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/client-update-drafts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns 404 when the draft is missing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
        })),
      })),
    })

    const response = await GET(jsonRequest('GET'), params('missing'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Draft not found' })
  })

  it('updates only the provided subject/body fields', async () => {
    mocks.updateDraft.mockResolvedValue({ id: 'draft-1', subject: 'New', body: 'Old body' })

    const response = await PATCH(jsonRequest('PATCH', { subject: 'New' }), params())

    expect(response.status).toBe(200)
    expect(mocks.updateDraft).toHaveBeenCalledWith('draft-1', { subject: 'New' })
    await expect(response.json()).resolves.toEqual({
      success: true,
      draft: { id: 'draft-1', subject: 'New', body: 'Old body' },
    })
  })

  it('rejects send POSTs that are not action=send', async () => {
    const response = await POST(jsonRequest('POST', { action: 'preview' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid action' })
    expect(mocks.sendDraft).not.toHaveBeenCalled()
  })

  it('defaults the send channel to email', async () => {
    mocks.sendDraft.mockResolvedValue({ sent: true, message: 'Queued' })

    const response = await POST(jsonRequest('POST', { action: 'send' }), params())

    expect(response.status).toBe(200)
    expect(mocks.sendDraft).toHaveBeenCalledWith({ draftId: 'draft-1', channel: 'email' })
    await expect(response.json()).resolves.toEqual({ success: true, message: 'Queued' })
  })

  it('returns 400 when sendDraft reports it did not send', async () => {
    mocks.sendDraft.mockResolvedValue({ sent: false, message: 'Already sent' })

    const response = await POST(jsonRequest('POST', { action: 'send', channel: 'slack' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Already sent' })
    expect(mocks.sendDraft).toHaveBeenCalledWith({ draftId: 'draft-1', channel: 'slack' })
  })

  it('deletes the draft after admin auth', async () => {
    mocks.deleteDraft.mockResolvedValue(undefined)

    const response = await DELETE(jsonRequest('DELETE'), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.deleteDraft).toHaveBeenCalledWith('draft-1')
  })
})
