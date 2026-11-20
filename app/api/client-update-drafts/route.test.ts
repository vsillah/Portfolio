import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listDrafts: vi.fn(),
  createDraftDirect: vi.fn(),
  generateLeadFollowup: vi.fn(),
  generateUpdateDraft: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/client-update-drafts', () => ({
  listDrafts: mocks.listDrafts,
  createDraftDirect: mocks.createDraftDirect,
  generateLeadFollowup: mocks.generateLeadFollowup,
  generateUpdateDraft: mocks.generateUpdateDraft,
}))

import { GET, POST } from './route'

const BASE_ENV = { ...process.env }
const INGEST_SECRET = 'n8n-ingest-secret'

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/client-update-drafts${query}`)
}

function postRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/client-update-drafts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('GET /api/client-update-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listDrafts.mockResolvedValue([])
  })

  it('returns the admin auth error before listing drafts', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.listDrafts).not.toHaveBeenCalled()
  })

  it('applies no status restriction when status is omitted', async () => {
    await GET(getRequest('?client_project_id=proj-1'))

    expect(mocks.listDrafts).toHaveBeenCalledWith({
      clientProjectId: 'proj-1',
      status: undefined,
    })
  })

  it('rejects an unknown status including literal all', async () => {
    const response = await GET(getRequest('?status=all'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid status: all. Allowed: draft, sent',
    })
    expect(mocks.listDrafts).not.toHaveBeenCalled()
  })

  it('forwards a valid status filter', async () => {
    mocks.listDrafts.mockResolvedValue([{ id: 'draft-1', status: 'sent' }])

    const response = await GET(getRequest('?status=sent'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      drafts: [{ id: 'draft-1', status: 'sent' }],
    })
    expect(mocks.listDrafts).toHaveBeenCalledWith({
      clientProjectId: undefined,
      status: 'sent',
    })
  })
})

describe('POST /api/client-update-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV, N8N_INGEST_SECRET: INGEST_SECRET }
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createDraftDirect.mockResolvedValue({ id: 'draft-direct' })
    mocks.generateLeadFollowup.mockResolvedValue({ id: 'draft-lead' })
    mocks.generateUpdateDraft.mockResolvedValue({ id: 'draft-project' })
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('rejects callers that are neither admin nor n8n', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest({ client_project_id: 'proj-1' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.generateUpdateDraft).not.toHaveBeenCalled()
  })

  it('accepts a matching n8n ingest bearer when admin auth fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest(
      { client_project_id: 'proj-1' },
      { authorization: `Bearer ${INGEST_SECRET}` },
    ))

    expect(response.status).toBe(201)
    expect(mocks.generateUpdateDraft).toHaveBeenCalledWith(expect.objectContaining({
      clientProjectId: 'proj-1',
      userId: undefined,
    }))
  })

  it('never accepts bearer auth when N8N_INGEST_SECRET is unset', async () => {
    delete process.env.N8N_INGEST_SECRET
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest(
      { client_project_id: 'proj-1' },
      { authorization: 'Bearer anything' },
    ))

    expect(response.status).toBe(401)
    expect(mocks.generateUpdateDraft).not.toHaveBeenCalled()
  })

  it('requires a project or contact id', async () => {
    const response = await POST(postRequest({ subject: 'Hi', body: 'Hello' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'client_project_id or contact_submission_id is required',
    })
  })

  it('requires client_email and client_name for direct draft creation', async () => {
    const response = await POST(postRequest({
      client_project_id: 'proj-1',
      subject: 'Update',
      body: 'Shipped the milestone.',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'client_email and client_name are required for direct draft creation',
    })
    expect(mocks.createDraftDirect).not.toHaveBeenCalled()
  })

  it('creates a direct draft when subject and body are provided', async () => {
    const response = await POST(postRequest({
      client_project_id: 'proj-1',
      subject: 'Update',
      body: 'Shipped the milestone.',
      client_email: 'client@example.com',
      client_name: 'Client',
      source: 'gmail_reply',
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      success: true,
      draft: { id: 'draft-direct' },
    })
    expect(mocks.createDraftDirect).toHaveBeenCalledWith({
      clientProjectId: 'proj-1',
      contactSubmissionId: null,
      subject: 'Update',
      body: 'Shipped the milestone.',
      clientEmail: 'client@example.com',
      clientName: 'Client',
      meetingRecordId: undefined,
      source: 'gmail_reply',
      userId: 'admin-user',
    })
    expect(mocks.generateUpdateDraft).not.toHaveBeenCalled()
  })

  it('generates a lead follow-up when only contact_submission_id is present', async () => {
    const response = await POST(postRequest({
      contact_submission_id: 42,
      task_ids: ['task-1'],
      custom_note: 'Keep it short',
    }))

    expect(response.status).toBe(201)
    expect(mocks.generateLeadFollowup).toHaveBeenCalledWith({
      contactSubmissionId: 42,
      meetingRecordId: undefined,
      tasks: undefined,
      taskIds: ['task-1'],
      customNote: 'Keep it short',
      userId: 'admin-user',
    })
    expect(mocks.generateUpdateDraft).not.toHaveBeenCalled()
  })

  it('returns 404 when the lead follow-up generator finds no tasks', async () => {
    mocks.generateLeadFollowup.mockResolvedValue(null)

    const response = await POST(postRequest({ contact_submission_id: 42 }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'No tasks found for this contact',
    })
  })

  it('generates a project update when client_project_id is present even if a contact id is also sent', async () => {
    const response = await POST(postRequest({
      client_project_id: 'proj-1',
      contact_submission_id: 42,
    }))

    expect(response.status).toBe(201)
    expect(mocks.generateUpdateDraft).toHaveBeenCalledWith({
      clientProjectId: 'proj-1',
      meetingRecordId: undefined,
      taskIds: undefined,
      customNote: undefined,
      userId: 'admin-user',
    })
    expect(mocks.generateLeadFollowup).not.toHaveBeenCalled()
  })

  it('returns 404 when no unsent completed tasks exist for a project update', async () => {
    mocks.generateUpdateDraft.mockResolvedValue(null)

    const response = await POST(postRequest({ client_project_id: 'proj-1' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'No unsent completed tasks found to include in draft',
    })
  })
})
