import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))

const { verifyAdminMock, snapshotMock, actionMock } = vi.hoisted(() => ({ verifyAdminMock: vi.fn(), snapshotMock: vi.fn(), actionMock: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: verifyAdminMock, isAuthError: (value: unknown) => !!value && typeof value === 'object' && 'error' in value }))
vi.mock('@/lib/app-activation-operator.server', () => ({ getOperatorSnapshot: snapshotMock, applySyntheticOperatorAction: actionMock, OperatorActionError: class extends Error { status = 409 } }))
vi.mock('@/lib/app-activation-repository.server', () => ({ getActivationRepository: () => null, ActivationError: class extends Error { status = 409 } }))

import { GET, POST } from './route'

const url = 'http://localhost:3000/api/admin/app-activation'
const request = (body?: unknown, headers: Record<string, string> = {}) => new NextRequest(url, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json', ...headers } : headers, body: body ? JSON.stringify(body) : undefined })

beforeEach(() => {
  verifyAdminMock.mockReset(); snapshotMock.mockReset(); actionMock.mockReset()
  verifyAdminMock.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
  snapshotMock.mockReturnValue({ mode: 'synthetic', apps: [], records: [], message: 'Local only' })
  actionMock.mockReturnValue({ id: 'interest-1', appKey: 'trumpet-trainer', status: 'in_review' })
})

describe('admin app activation route', () => {
  it('fails closed before reading or mutating for unauthenticated and non-admin callers', async () => {
    for (const auth of [{ error: 'Authentication required', status: 401 }, { error: 'Admin access required', status: 403 }]) {
      verifyAdminMock.mockResolvedValueOnce(auth)
      expect((await GET(request())).status).toBe(auth.status)
      verifyAdminMock.mockResolvedValueOnce(auth)
      expect((await POST(request({ appKey: 'trumpet-trainer', recordId: 'interest-1', action: 'approve', reason: 'Reviewed fixture.' }))).status).toBe(auth.status)
    }
    expect(snapshotMock).not.toHaveBeenCalled(); expect(actionMock).not.toHaveBeenCalled()
  })

  it('returns an unconfigured hosted view and refuses all mutations', async () => {
    snapshotMock.mockReturnValue({ mode: 'unconfigured', apps: [], records: [], message: 'Provider unconfigured' })
    expect(await (await GET(request())).json()).toMatchObject({ mode: 'unconfigured', records: [] })
    const response = await POST(request({ appKey: 'trumpet-trainer', recordId: 'interest-1', action: 'approve', reason: 'Reviewed fixture.' }))
    expect(response.status).toBe(503); expect(actionMock).not.toHaveBeenCalled()
  })

  it('rejects cross-origin and malformed requests before application actions', async () => {
    expect((await POST(request({ appKey: 'x' }, { origin: 'https://other.example.test' }))).status).toBe(403)
    expect((await POST(request({ appKey: 'x' }))).status).toBe(400)
    expect(actionMock).not.toHaveBeenCalled()
  })

  it('binds every synthetic action to the verified admin identity', async () => {
    const response = await POST(request({ appKey: 'trumpet-trainer', recordId: 'interest-1', action: 'start_review', reason: 'Reviewed fixture source.' }))
    expect(response.status).toBe(200)
    expect(actionMock).toHaveBeenCalledWith({ appKey: 'trumpet-trainer', recordId: 'interest-1', action: 'start_review', reason: 'Reviewed fixture source.', actor: 'admin-1', confirmation: undefined })
  })
})
