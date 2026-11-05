import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DECISION_FILE_VERSION, emptyDecisionFile } from '@/lib/accelerated-decision-file'

const auth = vi.hoisted(() => ({ result: { error: 'Authentication required', status: 401 } as Record<string, unknown> }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: vi.fn(async () => auth.result), isAuthError: (value: Record<string, unknown>) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn(() => { throw new Error('Database should not be touched') }) } }))
vi.mock('@/lib/client-dashboard', () => ({ getDashboardByToken: vi.fn() }))

import { GET, POST } from './route'

const state = () => ({ version: DECISION_FILE_VERSION, worksheet: emptyDecisionFile('6c51b755-86b4-4f11-a2f7-5e9f1430d0e0'), completed: ['L01'], videoSeconds: { L01: 90 }, currentLessonId: 'L02', updatedAt: new Date().toISOString() })
const request = (body: unknown) => new NextRequest('http://localhost/api/accelerated/member', { method: 'POST', headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('member progress gate', () => {
  beforeEach(() => { auth.result = { error: 'Authentication required', status: 401 } })
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
})
