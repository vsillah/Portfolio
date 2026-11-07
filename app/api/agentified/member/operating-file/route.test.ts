import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AGENTIFIED_VERSION, emptyAgentifiedDraft } from '@/lib/agentified-workshop'

const { verifyAuth, rpc } = vi.hoisted(() => ({ verifyAuth: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth, isAuthError: (value: unknown) => !value || typeof value !== 'object' || !('user' in value) }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc } }))
import { POST } from './route'

const draft = () => ({ ...emptyAgentifiedDraft('153d6a83-0bcc-47eb-b761-03a2f85c204d'), answers: { L01: 'Morgan reviews the brief.' } })
const request = (body: unknown) => new NextRequest('http://localhost/api/agentified/member/operating-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const base = () => ({ action: 'submit', commandId: 'b3490d33-a9a4-4697-8475-8d9b93913f95', expectedRevision: 1, draft: draft(), name: 'Course Learner', email: 'learner@example.invalid', consent: true })

describe('Agentified Operating File command boundary', () => {
  beforeEach(() => { verifyAuth.mockReset(); rpc.mockReset(); verifyAuth.mockResolvedValue({ user: { id: 'user-1', email: 'learner@example.invalid' } }) })
  it('requires identity, review consent, and the signed-in email', async () => {
    verifyAuth.mockResolvedValueOnce(null)
    expect((await POST(request(base()))).status).toBe(401)
    expect((await POST(request({ ...base(), consent: false }))).status).toBe(400)
    expect((await POST(request({ ...base(), email: 'other@example.invalid' }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects a foreign edition and nonempty delete', async () => {
    expect((await POST(request({ ...base(), draft: { ...draft(), version: 'accelerated-l01-l16-ed73dee7' } }))).status).toBe(400)
    expect((await POST(request({ ...base(), action: 'delete' }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('uses the existing atomic review path with the Agentified version', async () => {
    rpc.mockResolvedValue({ data: [{ revision: 2, replay: false, intake_id: 'intake-1' }], error: null })
    const response = await POST(request(base()))
    expect(response.status).toBe(201)
    expect(rpc).toHaveBeenCalledWith('accelerated_commit_completion_workspace', expect.objectContaining({ p_version: AGENTIFIED_VERSION, p_user_id: 'user-1', p_expected_revision: 1, p_action: 'submit', p_consent: true }))
  })
})
