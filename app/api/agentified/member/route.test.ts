import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AGENTIFIED_VERSION, emptyAgentifiedDraft } from '@/lib/agentified-workshop'

const { verifyAuth, rpc } = vi.hoisted(() => ({ verifyAuth: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth, isAuthError: (value: unknown) => !value || typeof value !== 'object' || !('user' in value) }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc } }))
import { POST } from './route'

const state = () => ({ version: AGENTIFIED_VERSION, worksheet: emptyAgentifiedDraft('153d6a83-0bcc-47eb-b761-03a2f85c204d'), completed: ['L01'], videoSeconds: {}, currentLessonId: 'L02', updatedAt: new Date().toISOString() })
const request = (body: unknown) => new NextRequest('http://localhost/api/agentified/member', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('Agentified member progress boundary', () => {
  beforeEach(() => { verifyAuth.mockReset(); rpc.mockReset(); verifyAuth.mockResolvedValue({ user: { id: 'user-1' } }) })
  it('requires an authenticated identity and explicit guest claim consent', async () => {
    verifyAuth.mockResolvedValueOnce(null)
    expect((await POST(request({ action: 'claim', consent: true, expectedRevision: 0, state: state() }))).status).toBe(401)
    expect((await POST(request({ action: 'claim', expectedRevision: 0, state: state() }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects cross-course and stale editions before the shared RPC', async () => {
    expect((await POST(request({ action: 'claim', consent: true, expectedRevision: 0, state: { ...state(), version: 'accelerated-l01-l16-ed73dee7' } }))).status).toBe(400)
    expect((await POST(request({ action: 'save', expectedRevision: 0, state: { ...state(), updatedAt: '2025-01-01T00:00:00Z' } }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('uses the existing edition-scoped, revision-checked write path', async () => {
    rpc.mockResolvedValue({ data: [{ revision: 1, replay: false }], error: null })
    const response = await POST(request({ action: 'claim', consent: true, expectedRevision: 0, state: state() }))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('accelerated_write_member_progress', expect.objectContaining({ p_version: AGENTIFIED_VERSION, p_user_id: 'user-1', p_expected_revision: 0, p_action: 'claim' }))
  })
})
