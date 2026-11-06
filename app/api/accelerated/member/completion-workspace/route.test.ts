import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DECISION_FILE_VERSION, emptyDecisionFile } from '@/lib/accelerated-decision-file'

const mocks = vi.hoisted(() => ({ auth: { error: 'Authentication required' } as Record<string, unknown>, rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: vi.fn(async () => mocks.auth), isAuthError: (value: Record<string, unknown>) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))
import { POST } from './route'

const draft = () => ({ ...emptyDecisionFile('12345678-1234-4234-8234-123456789abc'), answers: { L01: 'Synthetic decision' } })
const payload = () => ({ action: 'save', commandId: 'a65c81f6-10be-438c-800d-5cfd4cf7bb5e', expectedRevision: 2, draft: draft() })
const request = (body: unknown) => new NextRequest('http://localhost/api/accelerated/member/completion-workspace', { method: 'POST', headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('member completion workspace command', () => {
  beforeEach(() => { mocks.auth = { error: 'Authentication required' }; mocks.rpc.mockReset() })
  it('keeps every bulk action behind member authentication', async () => {
    for (const action of ['save', 'delete', 'submit']) expect((await POST(request({ ...payload(), action }))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects stale edition, missing revision, and invalid answers before persistence', async () => {
    mocks.auth = { user: { id: 'member-1', email: 'member@example.com' } }
    expect((await POST(request({ ...payload(), draft: { ...draft(), version: 'old' } }))).status).toBe(400)
    expect((await POST(request({ ...payload(), expectedRevision: null }))).status).toBe(400)
    expect((await POST(request({ ...payload(), draft: { ...draft(), answers: { L17: 'Out of range' } } }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('requires empty answers for deletion and explicit consent and matching identity for submission', async () => {
    mocks.auth = { user: { id: 'member-1', email: 'member@example.com' } }
    expect((await POST(request({ ...payload(), action: 'delete' }))).status).toBe(400)
    expect((await POST(request({ ...payload(), action: 'submit', name: 'Learner', email: 'member@example.com' }))).status).toBe(400)
    expect((await POST(request({ ...payload(), action: 'submit', consent: true, name: 'Learner', email: 'other@example.com' }))).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('sends a version-bound transactional command and returns idempotent receipts', async () => {
    mocks.auth = { user: { id: 'member-1', email: 'member@example.com' } }
    mocks.rpc.mockResolvedValueOnce({ data: [{ revision: 3, replay: false, intake_id: null }] }).mockResolvedValueOnce({ data: [{ revision: 3, replay: true, intake_id: null }] })
    const first = await POST(request(payload()))
    const replay = await POST(request(payload()))
    expect(first.status).toBe(201)
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ revision: 3, replay: true })
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_commit_completion_workspace', expect.objectContaining({ p_user_id: 'member-1', p_version: DECISION_FILE_VERSION, p_expected_revision: 2, p_action: 'save' }))
  })
  it('returns stale revision and identity failures without partial success', async () => {
    mocks.auth = { user: { id: 'member-1', email: 'member@example.com' } }
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Member work changed on another device' } })
    expect((await POST(request(payload()))).status).toBe(409)
    expect((await POST(request({ ...payload(), action: 'delete', draft: { ...draft(), answers: {} } }))).status).toBe(409)
  })
  it('binds explicit submission to the account email and one database command', async () => {
    mocks.auth = { user: { id: 'member-1', email: 'member@example.com' } }
    mocks.rpc.mockResolvedValue({ data: [{ revision: 3, replay: false, intake_id: 'intake-1' }] })
    const response = await POST(request({ ...payload(), action: 'submit', name: 'Learner', email: 'member@example.com', consent: true }))
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ submitted: true })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_commit_completion_workspace', expect.objectContaining({ p_learner_email: 'member@example.com', p_consent: true }))
  })
})
