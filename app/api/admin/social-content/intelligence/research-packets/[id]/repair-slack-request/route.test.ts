import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), request: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (value: { error?: string }) => !!value.error }))
vi.mock('@/lib/evidence-repair-slack', () => ({ requestEvidenceRepairSlackReview: mocks.request }))
import { POST } from './route'

const packetId = '10000000-0000-4000-8000-000000000001'
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/repair-slack-request', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
}), { params: Promise.resolve({ id: packetId }) })

describe('evidence repair Slack request API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'admin' } })
    mocks.request.mockResolvedValue({ status: 'dry_run', external_execution_enabled: false })
  })

  it('requires admin authority and an exact visible binding', async () => {
    mocks.auth.mockResolvedValueOnce({ error: 'Denied', status: 403 })
    expect((await post({ packet_version: 'v', binding_hash: 'h' })).status).toBe(403)
    expect((await post({})).status).toBe(400)
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('delegates read-only dry run with the exact version and hash', async () => {
    const response = await post({ packet_version: '2026-11-25T12:00:00Z', binding_hash: 'a'.repeat(64), dry_run: true })
    expect(response.status).toBe(200)
    expect(mocks.request).toHaveBeenCalledWith(packetId, true,
      { packetVersion: '2026-11-25T12:00:00Z', bindingHash: 'a'.repeat(64) })
    expect(await response.json()).toMatchObject({ external_execution_enabled: false })
  })
})
