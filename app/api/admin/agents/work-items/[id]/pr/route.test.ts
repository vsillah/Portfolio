import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  attachAgentWorkItemPr: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  attachAgentWorkItemPr: mocks.attachAgentWorkItemPr,
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/agents/work-items/work-1/pr', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/pr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.attachAgentWorkItemPr.mockResolvedValue({ id: 'work-1', status: 'ready_for_review' })
  })

  it('rejects unauthenticated requests before attaching a PR', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ pr_url: 'https://github.com/org/repo/pull/12' }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.attachAgentWorkItemPr).not.toHaveBeenCalled()
  })

  it('forwards finite pr_number, url, branch, and string touched_files only', async () => {
    const response = await POST(
      request({
        pr_number: 42,
        pr_url: 'https://github.com/org/repo/pull/42',
        branch_name: 'cursor/attach-pr',
        touched_files: ['lib/agent-work-items.ts', 9, null, 'app/api/admin/agents/work-items/[id]/pr/route.ts'],
      }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      work_item: { id: 'work-1', status: 'ready_for_review' },
    })
    expect(mocks.attachAgentWorkItemPr).toHaveBeenCalledWith({
      id: 'work-1',
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
      branchName: 'cursor/attach-pr',
      touchedFiles: [
        'lib/agent-work-items.ts',
        'app/api/admin/agents/work-items/[id]/pr/route.ts',
      ],
    })
  })

  it('treats non-finite pr_number, non-string url/branch, and non-array touched_files as null/empty', async () => {
    const response = await POST(
      request({
        pr_number: '42',
        pr_url: 12,
        branch_name: { name: 'main' },
        touched_files: 'lib/agent-work-items.ts',
      }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(200)
    expect(mocks.attachAgentWorkItemPr).toHaveBeenCalledWith({
      id: 'work-1',
      prNumber: null,
      prUrl: null,
      branchName: null,
      touchedFiles: [],
    })
  })

  it('returns 404 when the work item is missing', async () => {
    mocks.attachAgentWorkItemPr.mockRejectedValue(new Error('Agent work item not found'))

    const response = await POST(request({ pr_url: 'https://github.com/org/repo/pull/1' }) as never, {
      params: { id: 'missing' },
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Agent work item not found' })
  })

  it('returns 500 with the helper message for other attach failures', async () => {
    mocks.attachAgentWorkItemPr.mockRejectedValue(new Error('GitHub API timeout'))

    const response = await POST(request({ pr_number: 7 }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'GitHub API timeout' })
  })
})
