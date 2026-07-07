import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  updateTask: vi.fn(),
  generateOutreachDraftInApp: vi.fn(),
  isInAppOutreachGenerationEnabled: vi.fn(),
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

vi.mock('@/lib/meeting-action-tasks', () => ({
  updateTask: mocks.updateTask,
}))

vi.mock('@/lib/outreach-queue-generator', () => ({
  generateOutreachDraftInApp: mocks.generateOutreachDraftInApp,
  isInAppOutreachGenerationEnabled: mocks.isInAppOutreachGenerationEnabled,
}))

import { POST } from './route'

type TaskRow = {
  id: string
  title: string
  contact_submission_id: number | null
  outreach_queue_id: string | null
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
}

type QueryResult = {
  data: unknown
  error: unknown
}

type QueryChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

const baseTask: TaskRow = {
  id: 'task-1',
  title: 'Follow up with Jordan',
  contact_submission_id: 42,
  outreach_queue_id: null,
  status: 'pending',
}

function makeRequest() {
  return new NextRequest('http://localhost/api/meeting-action-tasks/task-1/send-to-outreach', {
    method: 'POST',
  })
}

function routeContext(id = 'task-1') {
  return { params: Promise.resolve({ id }) }
}

function makeMaybeSingleQuery(result: QueryResult): QueryChain {
  const chain = {} as QueryChain
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  return chain
}

function mockDatabase(options: {
  task?: TaskRow | null
  taskError?: unknown
  outreachResults?: QueryResult[]
}) {
  let outreachIndex = 0
  const taskResult = {
    data: options.task === undefined ? baseTask : options.task,
    error: options.taskError ?? null,
  }

  mocks.from.mockImplementation((table: string) => {
    if (table === 'meeting_action_tasks') {
      return makeMaybeSingleQuery(taskResult)
    }

    if (table === 'outreach_queue') {
      const result = options.outreachResults?.[outreachIndex] ?? {
        data: null,
        error: null,
      }
      outreachIndex += 1
      return makeMaybeSingleQuery(result)
    }

    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('POST /api/meeting-action-tasks/[id]/send-to-outreach', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(true)
    mocks.updateTask.mockResolvedValue({ ...baseTask, outreach_queue_id: 'queue-created' })
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'created',
      id: 'queue-created',
      subject: 'Checking in',
      body: 'Draft body',
    })
  })

  it('returns auth error response when admin verification fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('returns 503 when in-app outreach generation is disabled', async () => {
    mocks.isInAppOutreachGenerationEnabled.mockReturnValue(false)

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'In-app outreach generation is disabled',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('returns 404 when the task does not exist', async () => {
    mockDatabase({ task: null })

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Task not found' })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('requires the task to be attributed to a contact before generating outreach', async () => {
    mockDatabase({
      task: {
        ...baseTask,
        contact_submission_id: null,
      },
    })

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Task is not attributed to a contact. Attribute it first (edit the task) before sending to outreach.',
    })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('blocks complete tasks so reps do not generate stale follow-up drafts', async () => {
    mockDatabase({
      task: {
        ...baseTask,
        status: 'complete',
      },
    })

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Task is complete; reopen it before sending to outreach.',
    })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('reuses an already linked outreach draft without invoking the generator', async () => {
    const existingDraft = {
      id: 'queue-linked',
      subject: 'Existing subject',
      body: 'Existing body',
      status: 'draft',
    }
    mockDatabase({
      task: {
        ...baseTask,
        outreach_queue_id: 'queue-linked',
      },
      outreachResults: [{ data: existingDraft, error: null }],
    })

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      reused: true,
      draft: existingDraft,
    })
    expect(mocks.updateTask).not.toHaveBeenCalled()
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('relinks an existing task-sourced draft when the task row lost its queue pointer', async () => {
    const existingTaskDraft = {
      id: 'queue-orphan',
      subject: 'Prior subject',
      body: 'Prior body',
      status: 'draft',
    }
    mockDatabase({
      outreachResults: [{ data: existingTaskDraft, error: null }],
    })

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      reused: true,
      draft: existingTaskDraft,
    })
    expect(mocks.updateTask).toHaveBeenCalledWith('task-1', {
      outreach_queue_id: 'queue-orphan',
    })
    expect(mocks.generateOutreachDraftInApp).not.toHaveBeenCalled()
  })

  it('generates a fresh draft and links it back to the task when no draft exists', async () => {
    mockDatabase({
      outreachResults: [{ data: null, error: null }],
    })

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      reused: false,
      draft: {
        id: 'queue-created',
        subject: 'Checking in',
        body: 'Draft body',
        status: 'draft',
      },
    })
    expect(mocks.generateOutreachDraftInApp).toHaveBeenCalledWith({
      contactId: 42,
      sequenceStep: 1,
      sourceTaskId: 'task-1',
      force: false,
    })
    expect(mocks.updateTask).toHaveBeenCalledWith('task-1', {
      outreach_queue_id: 'queue-created',
    })
  })

  it('returns the existing queue id when the generator detects a duplicate meeting/template draft', async () => {
    mockDatabase({
      outreachResults: [{ data: null, error: null }],
    })
    mocks.generateOutreachDraftInApp.mockResolvedValue({
      outcome: 'existing',
      queueId: 'queue-duplicate',
      reason: 'duplicate',
    })

    const response = await POST(makeRequest(), routeContext())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error:
        'A draft is already in the queue for this meeting and template. Open it from Email center or the task.',
      queueId: 'queue-duplicate',
    })
    expect(mocks.updateTask).not.toHaveBeenCalled()
  })
})
