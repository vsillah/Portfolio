import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateTaskStatus: vi.fn(),
  validateDashboardToken: vi.fn(),
  recalculateScores: vi.fn(),
}))

vi.mock('@/lib/client-dashboard', () => ({
  updateTaskStatus: mocks.updateTaskStatus,
  validateDashboardToken: mocks.validateDashboardToken,
}))

vi.mock('@/lib/assessment-scoring', () => ({
  recalculateScores: mocks.recalculateScores,
}))

import { PATCH } from './route'

const VALID_TOKEN = 'client-dashboard-token-abcdefghij'
const SHORT_TOKEN = 'too-short-token'

function request(token: string, taskId: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/client/dashboard/${token}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('PATCH /api/client/dashboard/[token]/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects short dashboard tokens before mutating tasks', async () => {
    const response = await PATCH(request(SHORT_TOKEN, 'task-1', { status: 'complete' }), {
      params: Promise.resolve({ token: SHORT_TOKEN, taskId: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid dashboard link' })
    expect(mocks.updateTaskStatus).not.toHaveBeenCalled()
    expect(mocks.recalculateScores).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON bodies', async () => {
    const badRequest = new NextRequest(
      `http://localhost/api/client/dashboard/${VALID_TOKEN}/tasks/task-1`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{not-json',
      }
    )

    const response = await PATCH(badRequest, {
      params: Promise.resolve({ token: VALID_TOKEN, taskId: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' })
    expect(mocks.updateTaskStatus).not.toHaveBeenCalled()
  })

  it('rejects status values outside the allowed task lifecycle', async () => {
    const response = await PATCH(request(VALID_TOKEN, 'task-1', { status: 'archived' }), {
      params: Promise.resolve({ token: VALID_TOKEN, taskId: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid status. Must be pending, in_progress, or complete',
    })
    expect(mocks.updateTaskStatus).not.toHaveBeenCalled()
  })

  it('surfaces update failures without recalculating scores', async () => {
    mocks.updateTaskStatus.mockResolvedValue({
      success: false,
      error: 'Task not found',
    })

    const response = await PATCH(request(VALID_TOKEN, 'task-missing', { status: 'complete' }), {
      params: Promise.resolve({ token: VALID_TOKEN, taskId: 'task-missing' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Task not found' })
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(VALID_TOKEN, 'task-missing', 'complete')
    expect(mocks.validateDashboardToken).not.toHaveBeenCalled()
    expect(mocks.recalculateScores).not.toHaveBeenCalled()
  })

  it('updates non-complete statuses without score recalculation', async () => {
    mocks.updateTaskStatus.mockResolvedValue({ success: true })

    const response = await PATCH(request(VALID_TOKEN, 'task-1', { status: 'in_progress' }), {
      params: Promise.resolve({ token: VALID_TOKEN, taskId: 'task-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(VALID_TOKEN, 'task-1', 'in_progress')
    expect(mocks.validateDashboardToken).not.toHaveBeenCalled()
    expect(mocks.recalculateScores).not.toHaveBeenCalled()
  })

  it('recalculates project scores when a task is marked complete', async () => {
    mocks.updateTaskStatus.mockResolvedValue({ success: true })
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    mocks.recalculateScores.mockResolvedValue({
      categoryScores: { tech_stack: 72 },
      overallScore: 68,
      dreamOutcomeGap: 22,
    })

    const response = await PATCH(request(VALID_TOKEN, 'task-1', { status: 'complete' }), {
      params: Promise.resolve({ token: VALID_TOKEN, taskId: 'task-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      scores: {
        categoryScores: { tech_stack: 72 },
        overallScore: 68,
        dreamOutcomeGap: 22,
      },
    })
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(VALID_TOKEN, 'task-1', 'complete')
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith(VALID_TOKEN)
    expect(mocks.recalculateScores).toHaveBeenCalledWith('project-1', 'task-1')
  })

  it('skips score recalculation when a completed update has no linked project', async () => {
    mocks.updateTaskStatus.mockResolvedValue({ success: true })
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: null,
      error: 'Invalid or expired dashboard link',
    })

    const response = await PATCH(request(VALID_TOKEN, 'task-1', { status: 'complete' }), {
      params: Promise.resolve({ token: VALID_TOKEN, taskId: 'task-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.recalculateScores).not.toHaveBeenCalled()
  })
})
