import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DECISION_FILE_VERSION, emptyDecisionFile } from '@/lib/accelerated-decision-file'

const auth = vi.hoisted(() => ({ result: { error: 'Authentication required', status: 401 } as Record<string, unknown>, rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: vi.fn(async () => auth.result), isAuthError: (value: Record<string, unknown>) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn(() => { throw new Error('Database should not be touched') }), rpc: auth.rpc } }))
vi.mock('@/lib/client-dashboard', () => ({ getDashboardByToken: vi.fn() }))

import { GET, POST } from './route'

const state = () => ({ version: DECISION_FILE_VERSION, worksheet: emptyDecisionFile('6c51b755-86b4-4f11-a2f7-5e9f1430d0e0'), completed: ['L01'], videoSeconds: { L01: 90 }, currentLessonId: 'L02', updatedAt: new Date().toISOString() })
const request = (body: unknown) => new NextRequest('http://localhost/api/accelerated/member', { method: 'POST', headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('member progress gate', () => {
  beforeEach(() => { auth.result = { error: 'Authentication required', status: 401 }; auth.rpc.mockReset() })
  it('keeps member data behind authentication', async () => {
    expect((await GET(new NextRequest('http://localhost/api/accelerated/member'))).status).toBe(401)
    expect((await POST(request({ action: 'claim', consent: true, state: state() }))).status).toBe(401)
  })
  it('requires explicit guest claim consent before touching storage', async () => {
    auth.result = { user: { id: 'synthetic-user' } }
    const response = await POST(request({ action: 'claim', consent: false, state: state() }))
    expect(response.status).toBe(400)
  })
  it('rejects foreign editions and stale snapshots before touching storage', async () => {
    auth.result = { user: { id: 'synthetic-user' } }
    expect((await POST(request({ action: 'claim', consent: true, state: { ...state(), version: 'foreign-edition' } }))).status).toBe(400)
    expect((await POST(request({ action: 'claim', consent: true, state: { ...state(), updatedAt: '2020-01-01T00:00:00Z' } }))).status).toBe(400)
  })
  it('requires an expected persisted revision before writing', async () => {
    auth.result = { user: { id: 'synthetic-user' } }
    expect((await POST(request({ action: 'claim', consent: true, state: state() }))).status).toBe(400)
    expect(auth.rpc).not.toHaveBeenCalled()
  })
  it('sends one transactional claim command and returns its revision receipt', async () => {
    auth.result = { user: { id: 'synthetic-user' } }
    auth.rpc.mockResolvedValue({ data: [{ revision: 1, replay: false }] })
    const response = await POST(request({ action: 'claim', consent: true, expectedRevision: 0, state: state() }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ saved: true, revision: 1, replay: false })
    expect(auth.rpc).toHaveBeenCalledWith('accelerated_write_member_progress', expect.objectContaining({ p_user_id: 'synthetic-user', p_action: 'claim', p_expected_revision: 0 }))
  })
  it('rejects stale writes and missing transactional receipts', async () => {
    auth.result = { user: { id: 'synthetic-user' } }
    auth.rpc.mockResolvedValueOnce({ error: { code: 'P0001', message: 'Member progress changed on another device' } }).mockResolvedValueOnce({ data: [] })
    expect((await POST(request({ action: 'save', expectedRevision: 1, state: state() }))).status).toBe(409)
    expect((await POST(request({ action: 'save', expectedRevision: 1, state: state() }))).status).toBe(503)
  })
})
